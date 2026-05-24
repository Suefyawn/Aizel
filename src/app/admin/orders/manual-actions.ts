'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';
import { sendNewOrderEmail, sendOrderConfirmationEmail } from '@/lib/email';
import { z } from 'zod';

// ============================================================================
// Create a manual order from the admin. Used for phone orders, gift
// purchases, vendor returns / store-credit issuance — anything that didn't
// come through the customer-facing checkout but needs a real order row so
// it reaches the dispatch queue, the analytics, and the customer's order
// history.
//
// Shape mirrors the checkout place_order RPC so the resulting row is
// indistinguishable from a self-serve order downstream. Differences:
//   • Mints its own AZ- order number (no client to send one).
//   • Status starts at 'pending' (skip payment_pending — manual orders
//     are assumed already-paid by whatever channel the operator confirms).
//   • Audit-logged with the staff actor so the order's provenance is
//     traceable; an order_events row narrates "Manually created".
//   • Pay-method 'manual' so the order page doesn't try to start a Stripe
//     session for it.
// ============================================================================

const ItemSchema = z.object({
  product_id: z.string().uuid().nullable(),
  name: z.string().min(1),
  brand: z.string().nullable(),
  price: z.number().nonnegative(),
  qty: z.number().int().positive(),
  variant: z.string().nullable().optional(),
  image_url: z.string().url().nullable().optional(),
  slug: z.string().nullable().optional(),
});

// Phone schema mirrors validators.ts / twilio.ts / CheckoutPage so a
// manual order's phone goes through the same gauntlet a self-serve one
// would. Tolerates spaces / hyphens in input.
const PhoneSchema = z.string().trim()
  .transform(s => s.replace(/[\s()-]/g, ''))
  .pipe(z.string().regex(/^(?:\+?44|0044|0)(7\d{9}|[123]\d{8,9})$/,
    'Enter a valid UK phone number'));

const PayMethodSchema = z.enum(['manual', 'card', 'cod', 'bank']);

const InputSchema = z.object({
  first_name: z.string().trim().min(1, 'Required'),
  last_name:  z.string().trim().min(1, 'Required'),
  email:      z.string().trim().email('Enter a valid email').or(z.literal('')).optional(),
  phone:      PhoneSchema,
  address:    z.string().trim().min(1, 'Required'),
  city:       z.string().trim().min(1, 'Required'),
  province:   z.string().trim().optional(),
  zip:        z.string().trim().min(1, 'Postcode required'),
  pay_method: PayMethodSchema.default('manual'),
  shipping:   z.coerce.number().nonnegative().default(0),
  note:       z.string().trim().max(500).optional(),
  items_json: z.string().min(2), // JSON-encoded list, decoded below
});

interface OrderResult {
  ok: boolean;
  error?: string;
  /** Order id on success — caller redirects to /admin/orders/[id]. */
  id?: string;
}

function makeOrderNumber(): string {
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return 'AZ-' + Date.now().toString(36).slice(-5).toUpperCase() + rand;
}

export async function createManualOrder(_prev: OrderResult | null, formData: FormData): Promise<OrderResult> {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('orders.edit'))) {
    return { ok: false, error: 'Unauthorized' };
  }

  const raw: Record<string, FormDataEntryValue | null> = {};
  for (const [k, v] of formData.entries()) raw[k] = v;

  const parsed = InputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  let items;
  try {
    const arr = JSON.parse(parsed.data.items_json);
    items = z.array(ItemSchema).min(1, 'Add at least one item').parse(arr);
  } catch {
    return { ok: false, error: 'Invalid items list — add at least one product' };
  }

  const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
  const shipping = parsed.data.shipping ?? 0;
  const total = subtotal + shipping;

  const orderNumber = makeOrderNumber();
  const admin = supabaseAdmin();

  // We bypass the `place_order` RPC because manual orders don't need
  // its loyalty / gift-card / referral side-effects. Direct insert keeps
  // the surface area small + the audit trail crystal clear.
  const { data: inserted, error } = await admin.from('orders').insert({
    order_number: orderNumber,
    email:        parsed.data.email || null,
    first_name:   parsed.data.first_name,
    last_name:    parsed.data.last_name,
    phone:        parsed.data.phone,
    address:      parsed.data.address,
    city:         parsed.data.city,
    province:     parsed.data.province || null,
    zip:          parsed.data.zip,
    pay_method:   parsed.data.pay_method,
    subtotal,
    shipping,
    total,
    items,
    status:       'pending',
    // No user_id — these orders are anonymous unless the operator later
    // attaches them to a customer profile (out of scope here).
    user_id:      null,
  }).select('id').single();

  if (error || !inserted) {
    return { ok: false, error: error?.message ?? 'Failed to create order' };
  }

  await admin.from('order_events').insert({
    order_id: inserted.id,
    from_status: null,
    to_status: 'pending',
    note: parsed.data.note
      ? `Manual order created by ${session.name} — ${parsed.data.note}`
      : `Manual order created by ${session.name}`,
    actor_kind: 'staff',
  });

  await logAudit(session, {
    action: 'order.manual_create',
    entity: 'order',
    entity_id: inserted.id,
    diff: { order_number: orderNumber, total, item_count: items.length, pay_method: parsed.data.pay_method },
  });

  // Best-effort customer email — only when an email was supplied AND the
  // operator hasn't said "don't email" via the `silent` flag.
  const silent = formData.get('silent') === '1';
  if (parsed.data.email && !silent) {
    try {
      await sendOrderConfirmationEmail({
        email: parsed.data.email,
        order_number: orderNumber,
        first_name: parsed.data.first_name,
        last_name:  parsed.data.last_name,
        phone:      parsed.data.phone,
        city:       parsed.data.city,
        total,
        pay_method: parsed.data.pay_method,
        items: items.map(it => ({
          name: it.name, brand: it.brand ?? undefined,
          qty: it.qty, price: it.price, variant: it.variant ?? undefined,
        })),
      });
      void sendNewOrderEmail({
        order_number: orderNumber,
        first_name: parsed.data.first_name,
        last_name:  parsed.data.last_name,
        phone:      parsed.data.phone,
        city:       parsed.data.city,
        total,
        pay_method: parsed.data.pay_method,
        items: items.map(it => ({
          name: it.name, brand: it.brand ?? undefined,
          qty: it.qty, price: it.price, variant: it.variant ?? undefined,
        })),
      });
    } catch {
      // Don't fail the order create if email send wobbles — Sentry captures
      // it inside email.ts already, and the operator can resend manually.
    }
  }

  revalidatePath('/admin/orders');
  // Server-side redirect to the detail page so the operator lands on what
  // they just created without a second click.
  redirect(`/admin/orders/${inserted.id}`);
}
