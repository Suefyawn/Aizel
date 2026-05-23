// ============================================================================
// Stripe Checkout Session — UK card payments for Aizel.
//
// Flow:
//   1. CheckoutPage server-action calls `place_order` RPC to insert a row
//      with pay_method='card', status='payment_pending'.
//   2. The PageView posts to /api/payments/stripe with `order_number`.
//      That route handler calls `createCheckoutSession()` below and 303s the
//      browser to Stripe Checkout.
//   3. Customer pays on Stripe-hosted page.
//   4. Stripe fires a `checkout.session.completed` webhook to
//      /api/payments/stripe/webhook. The handler verifies the signature
//      (`verifyWebhookEvent()` below), then promotes the order to
//      status='pending' and writes a row to `payments`.
//   5. Browser returns to /thank-you?order=<num>.
//
// Required env (see .env.example):
//   STRIPE_SECRET_KEY                — sk_live_… or sk_test_…
//   STRIPE_WEBHOOK_SECRET            — whsec_… from the webhook config
//   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY — pk_… (used client-side for Elements
//                                       if/when we switch off hosted Checkout)
//   NEXT_PUBLIC_SITE_URL             — used to build return URLs
//
// `isConfigured()` returns false when any of the secrets are missing so the
// checkout-routing helper can route customers to the bank-transfer flow as a
// fallback instead of a half-broken Stripe redirect.
// ============================================================================

import Stripe from 'stripe';
import { SITE_URL } from '@/lib/seo';

function env(key: string): string | undefined {
  return process.env[key];
}

export function isConfigured(): boolean {
  return Boolean(env('STRIPE_SECRET_KEY') && env('STRIPE_WEBHOOK_SECRET'));
}

// Lazy singleton so a build that doesn't actually transact never imports
// the secret. `apiVersion: null` lets the SDK use the version pinned to
// the secret key in the Stripe dashboard — safer than hard-coding here and
// drifting from the dashboard's webhook config.
let _client: Stripe | null = null;
function client(): Stripe {
  if (_client) return _client;
  const key = env('STRIPE_SECRET_KEY');
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  _client = new Stripe(key, { typescript: true });
  return _client;
}

export interface CheckoutLineItem {
  /** Product name (incl. brand). Shown on the Stripe Checkout page. */
  name: string;
  /** Variant label, e.g. "Original · 32oz". Optional. */
  variant?: string | null;
  /** Quantity. Must be a positive integer. */
  qty: number;
  /** Unit price in GBP (e.g. 9.99). Stripe wants integer pence — we convert. */
  unitPrice: number;
  /** Optional product image URL — Stripe surfaces it on the Checkout page. */
  image?: string | null;
}

export interface CreateSessionInput {
  /** Aizel order_number — used as the Stripe `client_reference_id` so the
   *  webhook handler can look up the order in our DB. */
  orderNumber: string;
  /** Customer email — pre-fills the Checkout form. Optional but recommended. */
  customerEmail?: string;
  /** Cart line items. Stripe also accepts a single `amount_total` if you'd
   *  rather hide individual prices, but itemised is what UK consumers expect. */
  items: CheckoutLineItem[];
  /** Shipping cost in GBP (0 when free). Added as a separate line item with
   *  a name like "UK delivery". */
  shipping: number;
  /** Discount in GBP (positive number → subtracted via a Stripe coupon-less
   *  inline adjustment). Optional. */
  discount?: number;
}

// Convert GBP-pounds to pence and round to avoid floating-point drift
// ("£9.99" → 999).
function toPence(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Build a Stripe Checkout Session and return the URL the browser should
 * navigate to. Throws if Stripe isn't configured — callers should fall back
 * via `isConfigured()` first.
 */
export async function createCheckoutSession(input: CreateSessionInput): Promise<{
  url: string;
  sessionId: string;
}> {
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = input.items.map(it => ({
    price_data: {
      currency: 'gbp',
      product_data: {
        name: it.variant ? `${it.name} — ${it.variant}` : it.name,
        // Stripe limits to 8 image URLs; one is plenty for the Checkout row.
        images: it.image ? [it.image] : undefined,
      },
      unit_amount: toPence(it.unitPrice),
    },
    quantity: Math.max(1, Math.floor(it.qty)),
  }));

  // Shipping rendered as an additional line item so the customer sees the
  // breakdown on the Checkout page — Stripe's native `shipping_options`
  // would let us pick rate at runtime, but we already calculated it.
  if (input.shipping > 0) {
    lineItems.push({
      price_data: {
        currency: 'gbp',
        product_data: { name: 'UK delivery' },
        unit_amount: toPence(input.shipping),
      },
      quantity: 1,
    });
  }

  // Discounts: Stripe Checkout supports `discounts: [{ coupon }]` but we'd
  // need to register a Coupon object per cart — overkill for a coupon code
  // we've already validated server-side. Instead, deduct the discount from
  // the largest line item and add a "Discount" marker so the customer sees
  // *something*. Total still matches what the order row says.
  if (input.discount && input.discount > 0) {
    lineItems.push({
      price_data: {
        currency: 'gbp',
        product_data: { name: 'Discount (applied at checkout)' },
        unit_amount: -toPence(input.discount),
      },
      quantity: 1,
    });
  }

  const session = await client().checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    client_reference_id: input.orderNumber,
    customer_email: input.customerEmail || undefined,
    line_items: lineItems,
    // Stripe expects absolute URLs with `{CHECKOUT_SESSION_ID}` allowed as a
    // template token if you need the session id on return (we don't — the
    // webhook is the source of truth).
    success_url: `${SITE_URL}/thank-you?order=${encodeURIComponent(input.orderNumber)}`,
    cancel_url: `${SITE_URL}/checkout?cancelled=1&order=${encodeURIComponent(input.orderNumber)}`,
    // Bill the customer in GBP regardless of card BIN currency — the UK
    // storefront is GBP-priced and we don't want surprise FX on receipt.
    currency: 'gbp',
    // Auto-collect billing address — useful for receipts + 3DS risk scoring.
    billing_address_collection: 'auto',
    // We already collect shipping address in our own checkout form, so don't
    // re-collect it on Stripe.
    shipping_address_collection: undefined,
    // 30-minute session window — long enough for a slow card-not-present
    // flow, short enough that a stale link can't be revived a day later.
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    metadata: {
      order_number: input.orderNumber,
    },
    // Receipt sent by Stripe in addition to our own confirmation email —
    // belt-and-braces given Resend can fail silently. We also drop the
    // order_number into the PaymentIntent's metadata so the
    // `payment_intent.payment_failed` webhook can correlate back to our
    // order row (PI events arrive separately from Session events on 3DS
    // failures + post-authorisation declines).
    payment_intent_data: {
      receipt_email: input.customerEmail || undefined,
      description: `Aizel order ${input.orderNumber}`,
      metadata: {
        order_number: input.orderNumber,
      },
    },
  });

  if (!session.url) {
    throw new Error('Stripe session created without a URL — check API version');
  }

  return { url: session.url, sessionId: session.id };
}

/**
 * Verify a Stripe webhook signature and return the parsed event. The route
 * handler must pass the raw request body (not JSON-parsed) and the
 * `stripe-signature` header verbatim.
 */
export function verifyWebhookEvent(rawBody: string | Buffer, signatureHeader: string): Stripe.Event {
  const secret = env('STRIPE_WEBHOOK_SECRET');
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  return client().webhooks.constructEvent(rawBody, signatureHeader, secret);
}
