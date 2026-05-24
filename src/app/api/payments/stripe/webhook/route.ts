// POST /api/payments/stripe/webhook — Stripe → Aizel event ingress.
//
// Configure once in the Stripe dashboard:
//   - Endpoint URL:  https://aizel.co.uk/api/payments/stripe/webhook
//   - Events:        checkout.session.completed, checkout.session.expired,
//                    checkout.session.async_payment_failed,
//                    payment_intent.payment_failed,
//                    charge.refunded
//
// The endpoint MUST receive the request body verbatim (no JSON parse) for
// signature verification to work — that's why we read `req.text()` and pass
// the raw string to `verifyWebhookEvent`.
//
// Idempotency: Stripe retries failed webhooks. We key on session.id /
// payment_intent.id and silently no-op if we've already processed an event
// with that reference. The DB constraint `payments.txn_ref` (unique per
// gateway) is the backstop.

import { NextResponse } from 'next/server';
import { verifyWebhookEvent } from '@/lib/payments/stripe';
import { supabaseAdmin } from '@/lib/supabase';
import { sendPaymentReceivedEmail } from '@/lib/email';
import * as Sentry from '@sentry/nextjs';
import type Stripe from 'stripe';

export const runtime = 'nodejs';
// Stripe webhooks must NOT be cached.
export const dynamic = 'force-dynamic';

interface OrderRow {
  id: string;
  order_number: string;
  email: string | null;
  first_name: string | null;
  total: number;
}

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  let event: Stripe.Event;
  try {
    const raw = await req.text();
    event = verifyWebhookEvent(raw, sig);
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'stripe-webhook-verify' } });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed':
        await handleSessionFailed(event.data.object as Stripe.Checkout.Session, event.type);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case 'charge.refunded':
        // Catches refunds issued FROM THE STRIPE DASHBOARD (or any other
        // out-of-band tool). Refunds issued through our admin RefundPanel
        // already wrote the payments row — the unique (gateway, txn_ref)
        // index means this handler is a no-op for those, while filling
        // the gap for dashboard refunds that would otherwise leave the
        // order's books out of sync.
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      default:
        // Unhandled event types — log and ack so Stripe stops retrying.
        // (Useful debugging signal if we ever wonder why an event didn't fire.)
        break;
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'stripe-webhook-handler', event_type: event.type } });
    // ALWAYS return 200 from the handler-error path so Stripe stops retrying.
    // A permanent failure (bad schema, malformed event) re-tried for 3 days
    // floods Sentry and our DB. The signature is already verified at this
    // point, so emitting 200 doesn't risk accepting a forged event.
    // Transient DB outages will retry on the NEXT real webhook anyway since
    // the order will still be in payment_pending.
    return NextResponse.json({ received: true, handler_failed: true });
  }
}

async function handleSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const orderNumber = session.client_reference_id;
  if (!orderNumber) {
    Sentry.captureMessage('Stripe session completed with no client_reference_id', 'warning');
    return;
  }

  // Look up the order. The session.amount_total is in pence; convert back.
  const { data: order } = await supabaseAdmin()
    .from('orders')
    .select('id, order_number, email, first_name, total')
    .eq('order_number', orderNumber)
    .maybeSingle<OrderRow>();
  if (!order) {
    Sentry.captureMessage(`Stripe session completed for unknown order ${orderNumber}`, 'warning');
    return;
  }

  const settledAmount = (session.amount_total ?? 0) / 100;

  // Update the `payments` row inserted at init time. If somehow none exists
  // (initiation race / replay), insert one.
  const { data: existing } = await supabaseAdmin()
    .from('payments')
    .select('id')
    .eq('gateway', 'stripe')
    .eq('txn_ref', session.id)
    .maybeSingle();
  if (existing) {
    await supabaseAdmin().from('payments').update({
      amount: settledAmount,
      status: 'succeeded',
      raw_payload: session as unknown as Record<string, unknown>,
    }).eq('id', existing.id);
  } else {
    await supabaseAdmin().from('payments').insert({
      order_id: order.id,
      gateway: 'stripe',
      amount: settledAmount,
      currency: 'GBP',
      status: 'succeeded',
      txn_ref: session.id,
      raw_payload: session as unknown as Record<string, unknown>,
    });
  }

  // Promote the order out of payment_pending. We don't touch it if it's
  // already past pending — staff may have moved it forward in the meantime.
  await supabaseAdmin().from('orders').update({
    status: 'pending',
  }).eq('id', order.id).eq('status', 'payment_pending');

  // Customer-facing payment confirmation. Best-effort.
  if (order.email && order.first_name) {
    await sendPaymentReceivedEmail({
      email: order.email,
      first_name: order.first_name,
      order_number: order.order_number,
      total: settledAmount || order.total,
      method: 'Card',
    });
  }
}

async function handleSessionFailed(session: Stripe.Checkout.Session, reason: string): Promise<void> {
  const orderNumber = session.client_reference_id;
  if (!orderNumber) return;

  await supabaseAdmin().from('payments')
    .update({
      status: reason === 'checkout.session.expired' ? 'cancelled' : 'failed',
      error_message: reason,
      raw_payload: session as unknown as Record<string, unknown>,
    })
    .eq('gateway', 'stripe')
    .eq('txn_ref', session.id);

  // Move the order into payment_failed so it doesn't sit silently in
  // payment_pending forever. Owner can manually advance / cancel.
  await supabaseAdmin().from('orders')
    .update({ status: 'payment_failed' })
    .eq('order_number', orderNumber)
    .eq('status', 'payment_pending');
}

async function handlePaymentIntentFailed(pi: Stripe.PaymentIntent): Promise<void> {
  // PaymentIntent failures arrive separately to session events on cards
  // that 3DS-fail or are declined post-authorisation. We correlate back to
  // our order via `metadata.order_number`, which the Checkout Session
  // creator copies into the PI at create time (see createCheckoutSession).
  const orderNumber = typeof pi.metadata?.order_number === 'string'
    ? pi.metadata.order_number
    : null;
  if (!orderNumber) return;

  const admin = supabaseAdmin();
  // Find the order, then mark its most recent stripe payment row failed.
  const { data: order } = await admin
    .from('orders')
    .select('id')
    .eq('order_number', orderNumber)
    .maybeSingle<{ id: string }>();
  if (!order) return;

  await admin.from('payments')
    .update({
      status: 'failed',
      error_message: pi.last_payment_error?.message ?? 'payment_intent.payment_failed',
      raw_payload: pi as unknown as Record<string, unknown>,
    })
    .eq('order_id', order.id)
    .eq('gateway', 'stripe')
    .eq('status', 'initiated');

  // Move the order to payment_failed if still in payment_pending.
  await admin.from('orders')
    .update({ status: 'payment_failed' })
    .eq('id', order.id)
    .eq('status', 'payment_pending');
}

async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
  // `charge.refunded` fires every time a refund is created against the
  // charge — including ones our admin RefundPanel just issued. The unique
  // (gateway, txn_ref) index on payments makes those duplicate inserts
  // a no-op, so this handler only effectively does work for refunds
  // initiated outside Aizel (most commonly: someone clicked "Refund" in
  // the Stripe dashboard).
  //
  // Correlation: charge.payment_intent → our payments row that holds the
  // original Checkout Session id. We look up the order via the existing
  // succeeded payment row rather than re-parsing metadata.

  const piId = typeof charge.payment_intent === 'string'
    ? charge.payment_intent
    : charge.payment_intent?.id;
  if (!piId) {
    Sentry.captureMessage('charge.refunded with no payment_intent — cannot correlate', 'warning');
    return;
  }

  const admin = supabaseAdmin();

  // Find the succeeded Stripe payment that this charge belongs to. The
  // Session payload we stored includes the PI id, so we fish out the row
  // by joining via the raw_payload JSON. PostgREST supports
  // ->>'payment_intent' for jsonb dot access.
  const { data: sourceRow } = await admin
    .from('payments')
    .select('id, order_id, raw_payload')
    .eq('gateway', 'stripe')
    .eq('status', 'succeeded')
    .filter('raw_payload->>payment_intent', 'eq', piId)
    .maybeSingle<{ id: string; order_id: string; raw_payload: Record<string, unknown> }>();

  if (!sourceRow) {
    // Could be a charge for an order we never recorded (test mode, manual
    // dashboard payment). Skip rather than insert orphan payments rows.
    Sentry.captureMessage(`charge.refunded for unknown PI ${piId}`, 'info');
    return;
  }

  // Walk every refund on the charge — Stripe fires `charge.refunded` once
  // per refund, but `charge.refunds.data` carries the full history, and a
  // single event sometimes covers a multi-refund reconciliation. Inserting
  // each one keyed by its refund id makes the handler safely re-runnable.
  const refunds = charge.refunds?.data ?? [];
  if (refunds.length === 0) {
    Sentry.captureMessage(`charge.refunded with empty refunds.data for PI ${piId}`, 'warning');
    return;
  }

  for (const refund of refunds) {
    const amount = (refund.amount ?? 0) / 100;
    // Upsert via (gateway, txn_ref) unique index — INSERT … ON CONFLICT
    // DO NOTHING is the Postgres pattern. PostgREST exposes this via
    // .upsert({...}, { onConflict: 'gateway,txn_ref', ignoreDuplicates: true }).
    await admin.from('payments').upsert(
      {
        order_id: sourceRow.order_id,
        gateway: 'stripe',
        amount,
        currency: (charge.currency ?? 'gbp').toUpperCase(),
        status: 'refunded',
        txn_ref: refund.id,
        raw_payload: {
          stripe_refund: { id: refund.id, status: refund.status, reason: refund.reason },
          via: 'webhook:charge.refunded',
        },
      },
      { onConflict: 'gateway,txn_ref', ignoreDuplicates: true },
    );
  }

  // Recompute the cumulative refunded amount + flip status if the order is
  // now fully refunded. Mirrors the logic in refund-actions.ts so an
  // admin-initiated refund and a dashboard-initiated one converge on the
  // same end state.
  const { data: allPayments } = await admin
    .from('payments')
    .select('amount, status')
    .eq('order_id', sourceRow.order_id)
    .eq('gateway', 'stripe');
  const refundedTotal = ((allPayments ?? []) as Array<{ amount: number; status: string }>)
    .filter(r => r.status === 'refunded')
    .reduce((s, r) => s + Number(r.amount ?? 0), 0);

  const { data: orderRow } = await admin
    .from('orders')
    .select('total, status')
    .eq('id', sourceRow.order_id)
    .maybeSingle<{ total: number; status: string }>();
  if (orderRow && refundedTotal + 0.005 >= Number(orderRow.total ?? 0)) {
    await admin.from('orders').update({ status: 'refunded' }).eq('id', sourceRow.order_id);
    await admin.from('order_events').insert({
      order_id: sourceRow.order_id,
      from_status: orderRow.status,
      to_status: 'refunded',
      note: `Refunded via Stripe dashboard (£${refundedTotal.toFixed(2)})`,
      actor_kind: 'system',
    });
  }
}
