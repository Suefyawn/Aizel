'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';
import {
  isConfigured as stripeConfigured,
  refundCheckoutSession,
  type StripeRefundReason,
} from '@/lib/payments/stripe';

interface PaymentRow {
  id: string;
  gateway: string;
  amount: number;
  status: string;
  txn_ref: string | null;
}

/**
 * Per-order refund summary used by both the admin UI (read-only display)
 * and the action below (server-side guard). Sums refunds across all rows
 * the gateway returned + this order, so partial-refunds stack correctly.
 */
export interface RefundSummary {
  gateway: 'stripe' | 'manual' | null;
  /** The Checkout Session id (Stripe) or the txn_ref of the latest succeeded
   *  payment we can refund against. */
  refundableRef: string | null;
  /** Total GBP paid via a refundable rail (i.e. Stripe). 0 for bank
   *  transfer / COD orders where Stripe never touched the money. */
  paid: number;
  /** Sum of all refund rows recorded so far. */
  refunded: number;
  /** Remaining balance the operator can still refund. */
  remaining: number;
}

export async function loadRefundSummary(orderId: string): Promise<RefundSummary> {
  const { data } = await supabaseAdmin()
    .from('payments')
    .select('id, gateway, amount, status, txn_ref')
    .eq('order_id', orderId);
  const rows = (data ?? []) as PaymentRow[];

  // Find the most recent successful Stripe payment — refunds chain off
  // it. We deliberately only operate on Stripe rows; bank-transfer +
  // COD refunds happen out of band and the operator records them via
  // the order timeline rather than this flow.
  const stripeSucceeded = rows.filter(r => r.gateway === 'stripe' && r.status === 'succeeded');
  const stripeRefunded  = rows.filter(r => r.gateway === 'stripe' && r.status === 'refunded');

  const paid = stripeSucceeded.reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const refunded = stripeRefunded.reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const remaining = Math.max(0, paid - refunded);

  return {
    gateway: stripeSucceeded.length > 0 ? 'stripe' : null,
    refundableRef: stripeSucceeded[stripeSucceeded.length - 1]?.txn_ref ?? null,
    paid,
    refunded,
    remaining,
  };
}

interface RefundActionInput {
  orderId: string;
  amount: number;                  // GBP
  reason?: StripeRefundReason;
  note?: string;                   // free-text, surfaces in Stripe dashboard + audit log
}

export async function refundOrder(input: RefundActionInput): Promise<{
  ok: boolean;
  error?: string;
  refunded?: number;
}> {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('orders.edit'))) {
    return { ok: false, error: 'Unauthorized' };
  }
  if (!stripeConfigured()) {
    return { ok: false, error: 'Stripe is not configured — refunds can only be issued for card payments.' };
  }
  if (!isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, error: 'Refund amount must be greater than zero.' };
  }

  // Re-load the refund summary server-side so we don't trust the client's
  // notion of "how much is refundable" (could be stale or tampered).
  const summary = await loadRefundSummary(input.orderId);
  if (!summary.refundableRef) {
    return { ok: false, error: 'This order has no card payment that can be refunded via Stripe.' };
  }
  if (input.amount - summary.remaining > 0.005) {
    return { ok: false, error: `Maximum refundable amount is £${summary.remaining.toFixed(2)}.` };
  }

  let refund;
  try {
    refund = await refundCheckoutSession({
      checkoutSessionId: summary.refundableRef,
      amount: input.amount,
      reason: input.reason,
      note: input.note,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Stripe rejected the refund.';
    return { ok: false, error: msg };
  }

  const admin = supabaseAdmin();

  // Record the refund as a separate payments row — this is what
  // loadRefundSummary above sums to compute "refunded so far". The
  // unique (gateway, txn_ref) index makes the future refund.created
  // webhook a no-op rather than a duplicate.
  await admin.from('payments').insert({
    order_id: input.orderId,
    gateway: 'stripe',
    amount: refund.amount,
    currency: 'GBP',
    status: 'refunded',
    txn_ref: refund.refundId,
    raw_payload: { stripe_refund: { id: refund.refundId, status: refund.status }, note: input.note },
  });

  // Flip the order status when the cumulative refunded amount reaches
  // (or rounds up to) the original total. Otherwise we leave the status
  // alone — partial refunds are still 'delivered'/'shipped' etc.
  const newRefundedTotal = summary.refunded + refund.amount;
  const { data: orderRow } = await admin
    .from('orders')
    .select('total, status')
    .eq('id', input.orderId)
    .maybeSingle<{ total: number; status: string }>();
  if (orderRow && newRefundedTotal + 0.005 >= Number(orderRow.total ?? 0)) {
    await admin.from('orders').update({ status: 'refunded' }).eq('id', input.orderId);
  }

  // Order-events timeline entry so the admin order page narrates
  // "refunded £12.34" in the same feed it uses for status transitions.
  await admin.from('order_events').insert({
    order_id: input.orderId,
    from_status: orderRow?.status ?? null,
    to_status: orderRow && newRefundedTotal + 0.005 >= Number(orderRow.total ?? 0)
      ? 'refunded'
      : (orderRow?.status ?? 'pending'),
    note: `Refunded £${refund.amount.toFixed(2)}${input.reason ? ` (${input.reason})` : ''}${input.note ? ` — ${input.note}` : ''}`,
    actor_kind: 'staff',
  });

  await logAudit(session, {
    action: 'order.refund',
    entity: 'order',
    entity_id: input.orderId,
    diff: { amount: refund.amount, reason: input.reason ?? null, stripe_refund_id: refund.refundId },
  });

  revalidatePath(`/admin/orders/${input.orderId}`);
  revalidatePath('/admin/orders');
  return { ok: true, refunded: refund.amount };
}
