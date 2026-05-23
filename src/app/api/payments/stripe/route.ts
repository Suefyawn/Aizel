// POST /api/payments/stripe — initiate a Stripe Checkout Session for an
// already-inserted order row (pay_method='card', status='payment_pending')
// and 303-redirect the browser to Stripe's hosted Checkout page.
//
// CheckoutPage submits a tiny HTML form with `order_number` so this can be a
// top-level navigation (not a fetch) — the browser ends up on stripe.com,
// not on /api/...

import { NextResponse } from 'next/server';
import { isConfigured, createCheckoutSession } from '@/lib/payments/stripe';
import { supabase } from '@/lib/supabase';
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

  // Form-encoded body (the checkout page submits a real <form>, not fetch).
  const form = await req.formData();
  const orderNumber = String(form.get('order_number') ?? '').trim();
  if (!orderNumber) {
    return NextResponse.json({ error: 'order_number is required' }, { status: 400 });
  }

  const { data: order, error } = await supabase
    .from('orders')
    .select('id, order_number, email, pay_method, status, shipping, discount_amount, items')
    .eq('order_number', orderNumber)
    .maybeSingle<OrderRow>();

  if (error || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }
  if (order.pay_method !== 'card') {
    return NextResponse.json(
      { error: `Order is not a card order (method: ${order.pay_method})` },
      { status: 409 },
    );
  }
  if (order.status !== 'payment_pending') {
    return NextResponse.json(
      { error: `Order is in status ${order.status}; cannot initiate payment` },
      { status: 409 },
    );
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
    await supabase.from('payments').insert({
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
