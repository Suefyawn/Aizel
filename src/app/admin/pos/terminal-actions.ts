'use server';

import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';
import { supabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';

// ============================================================================
// Stripe Terminal — chip-and-PIN reader integration (env-gated scaffold).
//
// Three server actions wrap the Terminal HTTP API so the client never
// touches the Stripe secret key:
//
//   • createConnectionToken()
//       Used by Stripe's @stripe/terminal-js SDK to authenticate the
//       reader connection. Issued on demand; each token is single-use
//       and short-lived.
//
//   • createTerminalPaymentIntent({ amount, orderRef })
//       Mints a PI with payment_method_types=['card_present'] +
//       capture_method='automatic'. The client SDK then collects the
//       payment_method via the reader and confirms the PI.
//
//   • cancelTerminalPaymentIntent({ pi_id })
//       Cleanup path when the cashier hits "Cancel" before the customer
//       has tapped/inserted.
//
// Env gate: `STRIPE_TERMINAL_LOCATION_ID` MUST be set alongside
// `STRIPE_SECRET_KEY` for any of these to do real work. Without the
// location, every action returns { ok: false, configured: false } so
// the POS UI cleanly falls back to "manual card" (operator keys the
// card on their existing terminal then marks the order paid).
//
// Hardware: Stripe sells BBPOS WisePOS E + Verifone P400 readers in the
// UK; ordering / pairing instructions live in PRE-LAUNCH.md once the
// merchant signs the Terminal Service Agreement.
// ============================================================================

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

function envIsConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_TERMINAL_LOCATION_ID);
}

async function assertPos() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('pos.operate'))) {
    throw new Error('Unauthorized');
  }
  return session;
}

async function stripePost(path: string, body: Record<string, string | number>): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const key = process.env.STRIPE_SECRET_KEY!;
  // Stripe REST takes application/x-www-form-urlencoded; URLSearchParams
  // serialises cleanly for the simple-typed values Terminal needs.
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) form.set(k, String(v));
  const res = await fetch(`${STRIPE_API_BASE}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });
  const data = await res.json() as { error?: { message?: string } } & Record<string, unknown>;
  if (!res.ok) return { ok: false, error: data.error?.message ?? `Stripe ${res.status}` };
  return { ok: true, data };
}

// ─── 1. Connection token ─────────────────────────────────────────────────
export type ConnectionTokenResult =
  | { ok: true;  configured: true;  secret: string }
  | { ok: false; configured: false }
  | { ok: false; configured: true;  error: string };

export async function createConnectionToken(): Promise<ConnectionTokenResult> {
  await assertPos();
  if (!envIsConfigured()) return { ok: false, configured: false };

  const result = await stripePost('terminal/connection_tokens', {});
  if (!result.ok) return { ok: false, configured: true, error: result.error ?? 'Stripe rejected the token request' };
  const secret = (result.data as { secret?: string })?.secret;
  if (!secret) return { ok: false, configured: true, error: 'Stripe returned no token secret' };
  return { ok: true, configured: true, secret };
}

// ─── 2. Create a Terminal-bound PaymentIntent ────────────────────────────
const PiInputSchema = z.object({
  /** Order total in GBP — we convert to pence server-side. */
  amount:   z.number().positive(),
  /** Aizel order number the PI belongs to — surfaces in Stripe metadata
   *  for cross-system correlation. Optional because the cashier can pre-
   *  mint a PI before the order row exists, then patch metadata at confirm
   *  time (less common but allowed). */
  orderRef: z.string().max(60).optional(),
});

export type TerminalPiResult =
  | { ok: true;  configured: true;  payment_intent_id: string; client_secret: string }
  | { ok: false; configured: false }
  | { ok: false; configured: true;  error: string };

export async function createTerminalPaymentIntent(input: unknown): Promise<TerminalPiResult> {
  await assertPos();
  if (!envIsConfigured()) return { ok: false, configured: false };

  const parsed = PiInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, configured: true, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  // Server-side amount check. When the cashier supplies an orderRef we
  // require the requested amount to match the persisted order total within
  // 1p — closes the door on a compromised/negligent till charging £0.01
  // for a £29.99 order by passing a tampered `amount` and shipping the
  // basket once the reader returns succeeded.
  if (parsed.data.orderRef) {
    const { data: order } = await supabaseAdmin()
      .from('orders')
      .select('total, status')
      .eq('order_number', parsed.data.orderRef)
      .maybeSingle<{ total: number; status: string }>();
    if (!order) {
      return { ok: false, configured: true, error: `Order ${parsed.data.orderRef} not found.` };
    }
    if (Math.abs(parsed.data.amount - Number(order.total ?? 0)) > 0.01) {
      return {
        ok: false, configured: true,
        error: `Amount £${parsed.data.amount.toFixed(2)} does not match order total £${Number(order.total).toFixed(2)}.`,
      };
    }
  }

  const amountPence = Math.round(parsed.data.amount * 100);
  const result = await stripePost('payment_intents', {
    amount:                     amountPence,
    currency:                   'gbp',
    'payment_method_types[]':   'card_present',
    capture_method:             'automatic',
    ...(parsed.data.orderRef && {
      'metadata[order_number]': parsed.data.orderRef,
      'metadata[channel]':      'pos',
    }),
  });
  if (!result.ok) return { ok: false, configured: true, error: result.error ?? 'Stripe rejected the PI request' };
  const pi = result.data as { id?: string; client_secret?: string };
  if (!pi.id || !pi.client_secret) {
    return { ok: false, configured: true, error: 'Stripe response missing id/client_secret' };
  }
  return { ok: true, configured: true, payment_intent_id: pi.id, client_secret: pi.client_secret };
}

// ─── 3. Cancel a pending Terminal PI ─────────────────────────────────────
const CancelInputSchema = z.object({
  pi_id: z.string().min(3),
});

export async function cancelTerminalPaymentIntent(input: unknown): Promise<{ ok: boolean; configured: boolean; error?: string }> {
  const session = await assertPos();
  if (!envIsConfigured()) return { ok: false, configured: false };

  const parsed = CancelInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, configured: true, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const result = await stripePost(`payment_intents/${encodeURIComponent(parsed.data.pi_id)}/cancel`, {});
  if (!result.ok) return { ok: false, configured: true, error: result.error ?? 'Stripe rejected the cancel' };

  await logAudit(session, {
    action: 'pos.terminal_cancel',
    entity: 'payment_intent',
    entity_id: parsed.data.pi_id,
    diff: { reason: 'cashier_cancel' },
  });
  return { ok: true, configured: true };
}

// ─── 4. Push a PI to the paired reader (server-driven flow) ──────────────
// For a fixed-location till the reader is paired once via the Stripe
// dashboard and `STRIPE_TERMINAL_READER_ID` points at it. The till then
// pushes each PI to the reader via the REST API — no browser SDK, no
// connection-token dance, no reader discovery in the front-end. This is
// the simpler half of the Terminal API surface and the right fit for a
// till that always uses the same reader.
const ReaderInputSchema = z.object({
  pi_id: z.string().min(3),
});

export type ReaderActionResult =
  | { ok: true;  configured: true;  reader_status: string }
  | { ok: false; configured: false }
  | { ok: false; configured: true;  error: string };

export async function processOnReader(input: unknown): Promise<ReaderActionResult> {
  await assertPos();
  if (!envIsConfigured()) return { ok: false, configured: false };
  const readerId = process.env.STRIPE_TERMINAL_READER_ID;
  if (!readerId) {
    return { ok: false, configured: true, error: 'STRIPE_TERMINAL_READER_ID is not set — pair a reader in the Stripe dashboard first.' };
  }

  const parsed = ReaderInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, configured: true, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const result = await stripePost(
    `terminal/readers/${encodeURIComponent(readerId)}/process_payment_intent`,
    { payment_intent: parsed.data.pi_id },
  );
  if (!result.ok) return { ok: false, configured: true, error: result.error ?? 'Reader refused the PI' };
  const reader = result.data as { action?: { status?: string } };
  return { ok: true, configured: true, reader_status: reader.action?.status ?? 'in_progress' };
}

// ─── 5. Poll a PI's status ───────────────────────────────────────────────
// Client polls this every couple of seconds after the PI is pushed to the
// reader. Status transitions we care about:
//   • requires_payment_method  → waiting for the customer to tap/insert
//   • requires_confirmation    → method captured, about to charge
//   • processing               → Stripe is settling
//   • succeeded                → done — close the sale
//   • canceled                 → cashier or customer aborted
const RetrieveInputSchema = z.object({
  pi_id: z.string().min(3),
});

export type RetrievePiResult =
  | { ok: true;  configured: true;  status: string }
  | { ok: false; configured: false }
  | { ok: false; configured: true;  error: string };

export async function retrievePaymentIntent(input: unknown): Promise<RetrievePiResult> {
  await assertPos();
  if (!envIsConfigured()) return { ok: false, configured: false };

  const parsed = RetrieveInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, configured: true, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const key = process.env.STRIPE_SECRET_KEY!;
  const res = await fetch(`${STRIPE_API_BASE}/payment_intents/${encodeURIComponent(parsed.data.pi_id)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const data = await res.json() as { status?: string; error?: { message?: string } };
  if (!res.ok) return { ok: false, configured: true, error: data.error?.message ?? `Stripe ${res.status}` };
  return { ok: true, configured: true, status: data.status ?? 'unknown' };
}

/**
 * Cheap probe the client uses to decide whether to show the "Tap card"
 * UI vs the manual-card fallback. Doesn't touch Stripe — just reflects
 * the env shape so the client decision happens without a round-trip.
 */
export async function isTerminalConfigured(): Promise<boolean> {
  return envIsConfigured() && Boolean(process.env.STRIPE_TERMINAL_READER_ID);
}
