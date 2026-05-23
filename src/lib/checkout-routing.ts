// Pure post-order routing helper. Lives outside `'use server'` so both the
// client component (CheckoutPage) and server callers can import it.

import type { PayMethod } from '@/types';

export function postOrderDestination(method: PayMethod, orderNumber: string): {
  kind: 'redirect_thank_you' | 'gateway_post';
  url: string;
} {
  // Card → POST to the Stripe initiator route, which creates a Checkout
  // Session and 303s the browser to Stripe's hosted page. The order row is
  // already inserted with status='payment_pending'; the webhook promotes it
  // to 'pending' once payment succeeds.
  if (method === 'card') {
    return { kind: 'gateway_post', url: '/api/payments/stripe' };
  }
  // COD / bank transfer / gift card all bypass the gateway and land on the
  // thank-you page directly.
  return { kind: 'redirect_thank_you', url: `/thank-you?order=${encodeURIComponent(orderNumber)}` };
}
