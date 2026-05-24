'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';
import { sendOrderConfirmationEmail } from '@/lib/email';
import { sendOrderPlacedSms } from '@/lib/notifications/twilio';
import { z } from 'zod';

// ============================================================================
// Point of Sale — server actions
//
// Sales pass through this module so the orders + payments + cash-events
// writes always happen in the same place. Validation is zod-shaped so a
// rogue client (e.g. someone fiddling with the FormData payload in
// devtools) can't push negative quantities or arbitrary prices through.
//
// Pricing trust model: the CLIENT sends prices, not just product IDs,
// because the cashier may have applied a per-line discount the catalogue
// row doesn't know about. We compare each line against the live product
// row server-side and refuse the sale if the cashier-stated price is
// MORE than the catalogue price by more than 1p (rounding tolerance) —
// otherwise an attacker can't inflate basket value, while legitimate
// markdowns stay possible.
// ============================================================================

const LineItemSchema = z.object({
  product_id: z.string().uuid(),
  name: z.string().min(1),
  brand: z.string().nullable(),
  unit_price: z.number().nonnegative(),        // post-line-discount unit price
  qty: z.number().int().positive().max(999),
  /** Reason for any line discount; surfaces on the Z-report so the
   *  operator can audit "did the cashier give away the shop?". */
  discount_note: z.string().max(120).optional(),
  variant: z.string().nullable().optional(),
  image_url: z.string().url().nullable().optional(),
  slug: z.string().nullable().optional(),
});

const TenderSchema = z.object({
  method: z.enum(['cash', 'card', 'stripe_terminal']),
  /** Amount the customer handed over (cash) or charged (card). */
  amount: z.number().nonnegative(),
  /** Stripe Terminal PI id when method='stripe_terminal'; manual card
   *  ref otherwise (optional, for the receipt). */
  txn_ref: z.string().max(80).nullable().optional(),
});

const InputSchema = z.object({
  items: z.array(LineItemSchema).min(1, 'No items in the sale'),
  /** Cart-level discount applied AFTER line discounts. Subtracted from
   *  the cart subtotal; cannot make the total negative. */
  cart_discount: z.number().nonnegative().default(0),
  cart_discount_note: z.string().max(120).optional(),
  /** Optional — for receipt email. */
  customer_email: z.string().email().or(z.literal('')).optional(),
  /** Optional — for receipt SMS. */
  customer_phone: z.string().max(30).optional(),
  /** Optional — when the cashier looked the customer up in the till's
   *  customer-finder and attached them to this sale, this is the
   *  profile.id. Used to fill order.user_id so the sale shows up in
   *  the customer's lifetime spend + recent orders. */
  customer_id: z.string().uuid().nullable().optional(),
  /** Optional — when a customer is attached, the cashier may have
   *  picked them by name. Carry through for the order's display name
   *  (instead of "Counter Sale"). */
  customer_first_name: z.string().max(60).optional(),
  customer_last_name:  z.string().max(60).optional(),
  /** Active drawer session, if open. NULL means we're ringing through
   *  with no till open — allowed (sale still recorded), but cash sales
   *  won't journal to pos_cash_events because there's no till to credit. */
  session_id: z.string().uuid().nullable().optional(),
  tenders: z.array(TenderSchema).min(1, 'At least one tender required'),
});

// 1-penny tolerance for floating-point + GBP rounding.
const EPS = 0.005;

function makeOrderNumber(): string {
  // AZ-P prefix on POS so the operator can spot POS sales at a glance
  // in /admin/orders (the existing web orders use plain AZ-).
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return 'AZ-P' + Date.now().toString(36).slice(-5).toUpperCase() + rand;
}

interface CompleteResult {
  ok: boolean;
  error?: string;
  order_id?: string;
  order_number?: string;
  change?: number;
}

export async function completePosSale(input: unknown): Promise<CompleteResult> {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('pos.operate'))) {
    return { ok: false, error: 'Unauthorized' };
  }

  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const data = parsed.data;

  // ── Server-side price recompute ────────────────────────────────────────
  // Pull live prices for every product in the cart; ensure each cashier-
  // stated unit_price isn't ABOVE the catalogue price (we allow lower —
  // legitimate cashier discount — but not higher, which would mean
  // someone tampered with the client payload to inflate the sale).
  const admin = supabaseAdmin();
  const productIds = Array.from(new Set(data.items.map(i => i.product_id)));
  const { data: liveRows } = await admin
    .from('products')
    .select('id, price, name, stock, track_inventory')
    .in('id', productIds);
  const live = new Map<string, { price: number; name: string; stock: number; track_inventory: boolean | null }>(
    ((liveRows ?? []) as Array<{ id: string; price: number; name: string; stock: number; track_inventory: boolean | null }>)
      .map(r => [r.id, { price: Number(r.price ?? 0), name: r.name, stock: r.stock, track_inventory: r.track_inventory }]),
  );

  for (const it of data.items) {
    const row = live.get(it.product_id);
    if (!row) {
      return { ok: false, error: `Product not found: ${it.name}` };
    }
    if (it.unit_price - row.price > EPS) {
      return { ok: false, error: `Price for "${row.name}" is above the catalogue price (£${row.price.toFixed(2)})` };
    }
    if (row.track_inventory && row.stock < it.qty) {
      return { ok: false, error: `Not enough stock for "${row.name}" (${row.stock} in stock, ${it.qty} requested)` };
    }
  }

  // ── Compute the totals server-side ─────────────────────────────────────
  const subtotal = data.items.reduce((s, it) => s + it.unit_price * it.qty, 0);
  const cartDiscount = Math.min(data.cart_discount, subtotal); // can't go negative
  const total = Math.max(0, subtotal - cartDiscount);
  const tendered = data.tenders.reduce((s, t) => s + t.amount, 0);

  if (tendered + EPS < total) {
    return { ok: false, error: `Tendered £${tendered.toFixed(2)} is less than total £${total.toFixed(2)}` };
  }
  const change = tendered - total;

  // ── Insert the order row ───────────────────────────────────────────────
  // Single dominant pay method gets stored as the order's pay_method
  // (so the existing OrdersTable / dashboard filters still work); split
  // sales surface 'split' as a special value that the order detail
  // unpacks into its individual payments rows.
  const payMethod = data.tenders.length > 1
    ? 'split'
    : data.tenders[0].method === 'stripe_terminal'
      ? 'card'
      : data.tenders[0].method; // 'cash' | 'card'

  const orderNumber = makeOrderNumber();
  const { data: orderRow, error: orderErr } = await admin
    .from('orders')
    .insert({
      order_number: orderNumber,
      channel:      'pos',
      // POS sales are delivered the moment they ring — the customer
      // walks out with the goods.
      status:       'delivered',
      // When the cashier attached a customer, use their real name on the
      // order row so it stops reading as "Counter Sale" in the orders
      // list and the customer's history page actually identifies them.
      first_name:   data.customer_first_name || 'Counter',
      last_name:    data.customer_last_name  || 'Sale',
      phone:        data.customer_phone || 'in-store',
      email:        data.customer_email || null,
      address:      'In-store',
      city:         'In-store',
      pay_method:   payMethod,
      subtotal,
      shipping:     0,
      discount_amount: cartDiscount,
      total,
      items: data.items.map(it => ({
        id:           it.product_id,
        name:         it.name,
        brand:        it.brand,
        price:        it.unit_price,
        qty:          it.qty,
        variant:      it.variant ?? null,
        image_url:    it.image_url ?? null,
        slug:         it.slug ?? null,
        // Carry the line-discount note onto the order item so the
        // Z-report + the order detail can show it later.
        discount_note: it.discount_note ?? null,
      })),
      user_id: data.customer_id ?? null,
    })
    .select('id')
    .single();

  if (orderErr || !orderRow) {
    return { ok: false, error: orderErr?.message ?? 'Failed to create POS order' };
  }

  // ── Payments rows — one per tender ─────────────────────────────────────
  for (const t of data.tenders) {
    const gateway = t.method === 'stripe_terminal' ? 'stripe_terminal' : t.method; // cash | card | stripe_terminal
    await admin.from('payments').insert({
      order_id: orderRow.id,
      gateway,
      amount: t.amount,
      currency: 'GBP',
      status: 'succeeded',
      txn_ref: t.txn_ref ?? null,
      raw_payload: { source: 'pos', staff_id: session.id, change: t === data.tenders[data.tenders.length - 1] ? change : 0 },
    });

    // Cash-tender events go on the till journal when a shift is open.
    // We don't error if the shift is closed — the sale itself is still
    // valid; the cash just gets reconciled at the next shift open.
    if (t.method === 'cash' && data.session_id) {
      await admin.from('pos_cash_events').insert({
        session_id: data.session_id,
        amount:     t.amount,
        kind:       'sale',
        order_id:   orderRow.id,
      });
      // If change is given back, journal it as a negative cash_out event
      // so the till's net position is correct.
      if (t === data.tenders[data.tenders.length - 1] && change > 0) {
        await admin.from('pos_cash_events').insert({
          session_id: data.session_id,
          amount:     -change,
          kind:       'cash_out',
          order_id:   orderRow.id,
          note:       'Change given',
        });
      }
    }
  }

  // ── Order events timeline entry ────────────────────────────────────────
  await admin.from('order_events').insert({
    order_id: orderRow.id,
    from_status: null,
    to_status: 'delivered',
    note: `POS sale rung by ${session.name}`,
    actor_kind: 'staff',
  });

  await logAudit(session, {
    action: 'pos.sale_complete',
    entity: 'order',
    entity_id: orderRow.id,
    diff: {
      order_number: orderNumber,
      total,
      item_count: data.items.length,
      tenders: data.tenders.map(t => ({ method: t.method, amount: t.amount })),
      session_id: data.session_id ?? null,
    },
  });

  // ── Best-effort receipts ───────────────────────────────────────────────
  // Email + SMS are fire-and-forget — a Resend/Twilio outage shouldn't
  // block the sale from completing on the till. Failures are already
  // captured to Sentry inside email.ts + twilio.ts.
  if (data.customer_email) {
    try {
      await sendOrderConfirmationEmail({
        email: data.customer_email,
        order_number: orderNumber,
        first_name: 'In-store',
        last_name: 'customer',
        phone: data.customer_phone || 'in-store',
        city: 'In-store',
        total,
        pay_method: payMethod,
        items: data.items.map(it => ({
          name: it.name,
          brand: it.brand ?? undefined,
          qty: it.qty,
          price: it.unit_price,
          variant: it.variant ?? undefined,
        })),
      });
    } catch { /* logged in email.ts */ }
  }
  if (data.customer_phone) {
    try {
      await sendOrderPlacedSms({
        phone: data.customer_phone,
        orderNumber,
        total,
      });
    } catch { /* logged in twilio.ts */ }
  }

  revalidatePath('/admin/orders');
  revalidatePath('/admin/pos');
  return {
    ok: true,
    order_id: orderRow.id,
    order_number: orderNumber,
    change,
  };
}
