// Pure post-order routing helper. Lives outside `'use server'` so both the
// client component (CheckoutPage) and server callers can import it.

import type { PayMethod } from '@/types';

export function postOrderDestination(_method: PayMethod, orderNumber: string): {
  kind: 'redirect_thank_you' | 'gateway_post';
  url: string;
} {
  // UK gateways (Stripe / PayPal) integration TBD — for now all methods land
  // on the thank-you page. When Stripe Checkout is wired up, branch here.
  return { kind: 'redirect_thank_you', url: `/thank-you?order=${encodeURIComponent(orderNumber)}` };
}
