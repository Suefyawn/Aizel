'use server';

import { headers } from 'next/headers';
import {
  sendNewOrderEmail,
  sendOrderConfirmationEmail,
} from '@/lib/email';
import { sendOrderPlacedSms, isConfigured as twilioReady } from '@/lib/notifications/twilio';
import { checkoutLimiter, ipFromHeaders } from '@/lib/ratelimit';
import { resolveShipping } from '@/lib/shipping';

// ─── Order notifications fan-out (called after a successful place_order RPC) ─
// Sends the internal new-order email, the customer confirmation email (when
// we have an address), and a customer SMS (when Twilio is configured + the
// phone looks like a UK number). All best-effort — errors are swallowed
// inside each sender so a failed alert never breaks an order placement.
//
// Called from CheckoutPage.tsx after the place_order RPC succeeds for the
// COD / bank / card path. Gateway webhook handlers (Stripe etc.) do their own
// email + SMS fan-out for the payment-confirmed moment.
export async function notifyNewOrder(order: {
  order_number: string;
  email?: string;
  first_name: string;
  last_name: string;
  phone: string;
  city: string;
  province?: string;
  total: number;
  items: Array<{ name: string; qty: number; price: number; brand?: string; variant?: string }>;
  pay_method: string;
}): Promise<void> {
  const sends: Promise<unknown>[] = [sendNewOrderEmail(order)];
  if (order.email) {
    sends.push(
      sendOrderConfirmationEmail({
        email: order.email,
        first_name: order.first_name,
        last_name: order.last_name,
        phone: order.phone,
        city: order.city,
        province: order.province,
        order_number: order.order_number,
        total: order.total,
        items: order.items,
        pay_method: order.pay_method,
      })
    );
  }
  // Customer SMS — only when Twilio is configured AND we have a phone.
  // sendOrderPlacedSms() also tolerates non-UK phones gracefully (returns
  // {ok:false, code:'invalid_phone'}); we don't await its outcome here.
  if (order.phone && twilioReady()) {
    sends.push(
      sendOrderPlacedSms({
        phone: order.phone,
        firstName: order.first_name,
        orderNumber: order.order_number,
        total: order.total,
      })
    );
  }
  await Promise.all(sends);
}

// ─── Shipping calculator exposed to the client for the order summary. ──────
export async function calculateShipping(opts: {
  province?: string;
  subtotal: number;
}): Promise<{ rate: number; free: boolean; label: string }> {
  const resolved = await resolveShipping(opts);
  return { rate: resolved.rate, free: resolved.free, label: resolved.label };
}

// ─── Server-side rate-limit gate (called before place_order client RPC). ────
export async function checkoutRateGate(): Promise<{ ok: boolean }> {
  const h = await headers();
  const { success } = await checkoutLimiter.limit(ipFromHeaders(h));
  return { ok: success };
}

// Note: postOrderDestination is a pure helper and lives in @/lib/checkout-routing
// so it can be imported by client code without being treated as a server action.
