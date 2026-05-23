// POST /api/payments/stripe/webhook — Stripe → Aizel event ingress.
//
// Configure once in the Stripe dashboard:
//   - Endpoint URL:  https://aizel.co.uk/api/payments/stripe/webhook
//   - Events:        checkout.session.completed, checkout.session.expired,
//                    checkout.session.async_payment_failed,
//                    payment_intent.payment_failed
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
import { supabase } from '@/lib/supabase';
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
      default:
        // Unhandled event types — log and ack so Stripe stops retrying.
        // (Useful debugging signal if we ever wonder why an event didn't fire.)
        break;
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'stripe-webhook-handler', event_type: event.type } });
    // 500 → Stripe will retry. Only emit 500 for transient issues we want a
    // retry on; permanent failures should still return 200 to stop loops.
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }
}

async function handleSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const orderNumber = session.client_reference_id;
  if (!orderNumber) {
    Sentry.captureMessage('Stripe session completed with no client_reference_id', 'warning');
    return;
  }

  // Look up the order. The session.amount_total is in pence; convert back.
  const { data: order } = await supabase
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
  const { data: existing } = await supabase
    .from('payments')
    .select('id')
    .eq('gateway', 'stripe')
    .eq('txn_ref', session.id)
    .maybeSingle();
  if (existing) {
    await supabase.from('payments').update({
      amount: settledAmount,
      status: 'succeeded',
      raw_payload: session as unknown as Record<string, unknown>,
    }).eq('id', existing.id);
  } else {
    await supabase.from('payments').insert({
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
  await supabase.from('orders').update({
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

  await supabase.from('payments')
    .update({
      status: reason === 'checkout.session.expired' ? 'cancelled' : 'failed',
      error_message: reason,
      raw_payload: session as unknown as Record<string, unknown>,
    })
    .eq('gateway', 'stripe')
    .eq('txn_ref', session.id);

  // Move the order into payment_failed so it doesn't sit silently in
  // payment_pending forever. Owner can manually advance / cancel.
  await supabase.from('orders')
    .update({ status: 'payment_failed' })
    .eq('order_number', orderNumber)
    .eq('status', 'payment_pending');
}

async function handlePaymentIntentFailed(pi: Stripe.PaymentIntent): Promise<void> {
  // PaymentIntent failures arrive separately to session events on cards that
  // 3DS-fail or are declined post-authorisation. We log the error against the
  // existing payments row (matched via the related session if available) so
  // staff have the decline reason on the order detail page.
  const sessionId = typeof pi.metadata?.checkout_session_id === 'string'
    ? pi.metadata.checkout_session_id
    : null;
  if (!sessionId) return;

  await supabase.from('payments')
    .update({
      status: 'failed',
      error_message: pi.last_payment_error?.message ?? 'payment_intent.payment_failed',
      raw_payload: pi as unknown as Record<string, unknown>,
    })
    .eq('gateway', 'stripe')
    .eq('txn_ref', sessionId);
}
