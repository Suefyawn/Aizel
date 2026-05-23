// POST /api/payments/stripe — initiate a Stripe Checkout Session for an
// already-inserted order row (pay_method='card', status='payment_pending')
// and 303-redirect the browser to Stripe's hosted Checkout page.
//
// CheckoutPage submits a tiny HTML form with `order_number` so this can be a
// top-level navigation (not a fetch) — the browser ends up on stripe.com,
// not on /api/...

import { NextResponse } from 'next/server';
import { isConfigured, createCheckoutSession } from '@/lib/payments/stripe';
import { supabaseAdmin } from '@/lib/supabase';
import { checkoutLimiter, ipFromHeaders } from '@/lib/ratelimit';
import * as Sentry from '@sentry/nextjs';

export const runtime = 'nodejs';

interface OrderRow {
  id: string;
  order_number: string;
  email: string | null;
  pay_method: string;
  status: string;
  shipping: number;
  discount_amount: number | null;
  items: Array<{
    name: string;
    brand?: string | null;
    variant?: string | null;
    variant_label?: string | null;
    qty: number;
    price: number;
    image_url?: string | null;
  }> | null;
}

export async function POST(req: Request) {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: 'Stripe is not configured on this deployment.' },
      { status: 503 },
    );
  }

  // Per-IP rate limit. The route accepts arbitrary order_numbers from the
  // open web, so without a limit an attacker can spam-create Stripe
  // Checkout sessions (wastes API quota + leaks order existence via 404 vs
  // 409). The same limiter already gates the cart-side checkout submit.
  const rate = await checkoutLimiter.limit(ipFromHeaders(req.headers));
  if (!rate.success) {
    return NextResponse.json({ error: 'Too many requests. Please try again in a moment.' }, { status: 429 });
  }

  // Form-encoded body (the checkout page submits a real <form>, not fetch).
  const form = await req.formData();
  const orderNumber = String(form.get('order_number') ?? '').trim();
  if (!orderNumber) {
    return NextResponse.json({ error: 'order_number is required' }, { status: 400 });
  }

  // Cheap shape check before the DB lookup — order numbers are AZ-XXXXXXX
  // (uppercase base36 + a 3-char random suffix). Anything wildly off shape
  // we reject with a generic 404 to avoid leaking that the format exists.
  if (!/^[A-Z]{2}-[A-Z0-9]{4,16}$/.test(orderNumber)) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // Service-role client — RLS on orders/payments blocks the anon role from
  // reading/writing arbitrary rows, so this MUST be admin. The route is
  // already gated by the order_number being a server-issued secret.
  const admin = supabaseAdmin();
  const { data: order, error } = await admin
    .from('orders')
    .select('id, order_number, email, pay_method, status, shipping, discount_amount, items')
    .eq('order_number', orderNumber)
    .maybeSingle<OrderRow>();

  // Return identical 404 for "no row" and "wrong pay_method" / "wrong
  // status" so an attacker can't probe for orders by status. The legitimate
  // failure modes (e.g. customer hit Back after Stripe redirect, order is
  // already `pending`) just get a generic message.
  const validOrder = !error && order
    && order.pay_method === 'card'
    && order.status === 'payment_pending';
  if (!validOrder) {
    return NextResponse.json({ error: 'Order not found or not awaiting payment' }, { status: 404 });
  }

  try {
    const session = await createCheckoutSession({
      orderNumber: order.order_number,
      customerEmail: order.email ?? undefined,
      shipping: order.shipping ?? 0,
      discount: order.discount_amount ?? 0,
      items: (order.items ?? []).map(it => ({
        name: it.brand ? `${it.brand} ${it.name}` : it.name,
        variant: it.variant_label ?? it.variant ?? null,
        qty: it.qty,
        unitPrice: it.price,
        image: it.image_url ?? null,
      })),
    });

    // Record the initiation as a `payments` row so we can correlate when
    // the webhook lands. RLS on `payments` permits service-role inserts.
    await admin.from('payments').insert({
      order_id: order.id,
      gateway: 'stripe',
      amount: 0, // filled in by the webhook with the actual settled amount
      currency: 'GBP',
      status: 'initiated',
      txn_ref: session.sessionId,
    });

    return NextResponse.redirect(session.url, { status: 303 });
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'stripe-checkout-init' } });
    return NextResponse.json(
      { error: 'Failed to create Stripe Checkout Session' },
      { status: 502 },
    );
  }
}
