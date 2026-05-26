'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';

// ============================================================================
// In-store returns at the POS till
//
// Walk-in customer brings back items. The cashier:
//   1. Looks the order up by order number (we accept AZ-…, AZ-P…, or raw)
//   2. Picks which line items + qty to return
//   3. Hands cash back from the drawer (or marks "store credit" / refunds
//      to the original card via the existing order-detail refund flow)
//
// What this action does on submit:
//   • Records a refund row on `payments` with the negative amount + the
//     same gateway as the original tender (typically `cash` for POS).
//   • Returns the chosen quantities to stock for tracked products by
//     calling adjustStock under-the-hood — the inventory ledger gets a
//     proper `return` row tied back to the order id.
//   • If a POS session is open, journals the negative amount to
//     pos_cash_events so end-of-shift cash reconciliation balances.
//   • Logs an audit row for the till operator's name.
//
// What it does NOT do:
//   • Stripe / card refunds — those route through the existing
//     /admin/orders/[id] refund panel (Stripe API call). This action
//     handles only "money out of the drawer" returns. The till UI
//     surfaces both options.
//   • Partial-quantity stock adjustments below 1 unit — qty is an int.
// ============================================================================

const ReturnLineSchema = z.object({
  /** Product id from the original order's items[].id */
  product_id: z.string().uuid().nullable(),
  /** Number of units being returned. Must be ≤ originally sold qty. */
  qty: z.number().int().positive().max(999),
  /** Unit price the customer paid for ONE unit (post-discount). Used to
   *  compute the refund amount. We trust the value the client sends
   *  because it gets cross-checked against the order's items[] row. */
  unit_price: z.number().nonnegative(),
  /** Human-readable name carried for the audit row + receipt. */
  name: z.string().min(1),
});

const ProcessSchema = z.object({
  order_id: z.string().uuid(),
  lines:    z.array(ReturnLineSchema).min(1, 'Choose at least one item to return'),
  /** Optional cashier-facing reason for the audit log + the order
   *  timeline. Free-text, not customer-facing. */
  reason:   z.string().max(200).optional(),
  /** Active till session, if any. Negative cash event posts here. */
  session_id: z.string().uuid().nullable().optional(),
});

interface ProcessResult {
  ok: boolean;
  error?: string;
  refunded_amount?: number;
}

async function assertPos() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('pos.operate'))) {
    throw new Error('Unauthorized');
  }
  return session;
}

/** Customer walks in with an order number. Pull the order + summarise
 *  what's eligible to refund. Bound from the client by the till. */
export async function lookupOrderForReturn(orderNumber: string): Promise<{
  ok: boolean;
  error?: string;
  order?: {
    id: string;
    order_number: string;
    channel: 'pos' | 'web' | string;
    pay_method: string;
    created_at: string;
    total: number;
    first_name: string | null;
    last_name: string | null;
    items: Array<{
      id: string | null;
      name: string;
      brand: string | null;
      qty: number;
      price: number;
      variant?: string | null;
    }>;
    already_refunded: number;
  };
}> {
  await assertPos();
  const num = orderNumber.trim().toUpperCase();
  if (!num) return { ok: false, error: 'Type an order number to look up.' };

  const admin = supabaseAdmin();
  const { data: row } = await admin
    .from('orders')
    .select('id, order_number, channel, pay_method, created_at, total, first_name, last_name, items')
    .eq('order_number', num)
    .maybeSingle();

  if (!row) return { ok: false, error: `No order found for "${num}".` };

  // Sum existing refund rows so we don't show items that have already
  // been fully returned.
  const { data: refundRows } = await admin
    .from('payments')
    .select('amount, status')
    .eq('order_id', row.id);
  const alreadyRefunded = ((refundRows ?? []) as Array<{ amount: number; status: string }>)
    .filter(p => p.status === 'refunded' || p.amount < 0)
    .reduce((s, p) => s + Math.abs(Number(p.amount ?? 0)), 0);

  return {
    ok: true,
    order: {
      id:           row.id as string,
      order_number: row.order_number as string,
      channel:      (row.channel as 'pos' | 'web') ?? 'web',
      pay_method:   row.pay_method as string,
      created_at:   row.created_at as string,
      total:        Number(row.total ?? 0),
      first_name:   row.first_name as string | null,
      last_name:    row.last_name as string | null,
      items:        ((row.items ?? []) as Array<{ id: string | null; name: string; brand: string | null; qty: number; price: number; variant?: string | null }>).map(it => ({
        id: it.id ?? null,
        name: it.name,
        brand: it.brand ?? null,
        qty: Number(it.qty ?? 0),
        price: Number(it.price ?? 0),
        variant: it.variant ?? null,
      })),
      already_refunded: alreadyRefunded,
    },
  };
}

/** Process the actual return. */
export async function processPosReturn(input: unknown): Promise<ProcessResult> {
  const session = await assertPos();

  const parsed = ProcessSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const data = parsed.data;
  const admin = supabaseAdmin();

  // Load the original order so we can cross-check qty + total.
  const { data: order } = await admin
    .from('orders')
    .select('id, order_number, items, total, pay_method, channel')
    .eq('id', data.order_id)
    .single();
  if (!order) return { ok: false, error: 'Order not found' };

  const origItems = (order.items ?? []) as Array<{ id?: string | null; qty: number; price: number; name?: string }>;

  // Validate each return line against the original order — qty must be
  // ≤ originally sold; unit_price must match within 1p (we don't trust
  // the client's number unless it matches the recorded sale).
  let refundTotal = 0;
  for (const line of data.lines) {
    const orig = origItems.find(it => it.id === line.product_id);
    if (!orig) {
      return { ok: false, error: `Item "${line.name}" wasn't on this order.` };
    }
    if (line.qty > orig.qty) {
      return { ok: false, error: `Can't return ${line.qty}× "${line.name}" — only ${orig.qty} were sold.` };
    }
    if (Math.abs(Number(orig.price) - line.unit_price) > 0.005) {
      return { ok: false, error: `Price mismatch on "${line.name}".` };
    }
    refundTotal += line.unit_price * line.qty;
  }
  refundTotal = Math.round(refundTotal * 100) / 100;

  // Refund leaves the till as a NEGATIVE-amount payment row. We use the
  // same gateway as the dominant pay method on the order so the
  // accountant's reconciliation matches (cash refunds against cash
  // takings, etc.). Card-original orders that are refunded "as cash"
  // at the till should still register against the cash gateway — that's
  // what's actually leaving the drawer.
  const gateway = order.pay_method === 'split' ? 'cash' : (order.pay_method as string);
  const { data: refundPaymentRow, error: payErr } = await admin
    .from('payments')
    .insert({
      order_id: order.id,
      gateway,
      amount:   -refundTotal,                  // negative = money leaving the till
      currency: 'GBP',
      status:   'refunded',
      txn_ref:  null,
      raw_payload: {
        source: 'pos_return',
        staff_id: session.id,
        reason: data.reason ?? null,
        lines: data.lines,
      },
    })
    .select('id')
    .single();
  if (payErr) return { ok: false, error: payErr.message };

  // Return items to stock — only for tracked products. We call
  // adjustStock via the public ledger insert directly to keep the audit
  // chain consistent (reason='return', actor='staff', tied to order_id).
  for (const line of data.lines) {
    if (!line.product_id) continue;
    const { data: prod } = await admin
      .from('products')
      .select('id, stock, track_inventory')
      .eq('id', line.product_id)
      .maybeSingle();
    if (!prod || prod.track_inventory === false) continue;
    const newStock = (prod.stock ?? 0) + line.qty;
    await admin.from('products').update({ stock: newStock }).eq('id', line.product_id);
    await admin.from('inventory_ledger').insert({
      product_id:    line.product_id,
      qty_delta:     line.qty,
      balance_after: newStock,
      reason:        'return',
      order_id:      order.id,
      actor_kind:    session.isOwner ? 'owner' : 'staff',
      actor_email:   session.email,
      note:          `POS return on ${order.order_number}`,
    });
  }

  // Journal the negative cash to the till if a shift is open.
  if (data.session_id && gateway === 'cash') {
    await admin.from('pos_cash_events').insert({
      session_id: data.session_id,
      kind:       'refund',
      amount:     -refundTotal,
      note:       `Return on ${order.order_number}${data.reason ? ` — ${data.reason}` : ''}`,
      actor_id:   session.id,
    });
  }

  // If the original order is now fully refunded, flip its status so it
  // disappears from "to fulfil" dashboards. Sum prior negative-amount
  // refunds on the order (POS + Stripe panel both write into payments)
  // and add THIS refund before comparing — otherwise two consecutive
  // partial returns of half each never trip the threshold.
  const { data: priorRefunds } = await admin
    .from('payments')
    .select('amount')
    .eq('order_id', order.id)
    .eq('status', 'refunded');
  const priorSum = ((priorRefunds ?? []) as Array<{ amount: number }>)
    .reduce((acc, r) => acc + Math.abs(Number(r.amount)), 0);
  const newRefundedTotal = priorSum;
  if (newRefundedTotal >= Number(order.total ?? 0) - 0.005) {
    await admin.from('orders').update({ status: 'returned' }).eq('id', order.id);
  }

  await logAudit(session, {
    action: 'pos.return_processed',
    entity: 'orders',
    entity_id: order.id,
    diff: { refund: refundTotal, lines: data.lines, reason: data.reason ?? null, payment_id: refundPaymentRow?.id ?? null },
  });

  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${order.id}`);
  revalidatePath('/admin/pos');
  return { ok: true, refunded_amount: refundTotal };
}
