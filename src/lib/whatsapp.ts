// ============================================================================
// WhatsApp deep-link helpers.
//
// The merchant runs the standard WhatsApp Business app on their phone — no
// paid API, no webhook, no card on file. Buttons across the storefront +
// admin generate `wa.me` URLs that open the customer's WhatsApp app with
// the merchant number pre-filled and an optional pre-typed message.
//
// Env:
//   NEXT_PUBLIC_WHATSAPP_NUMBER — merchant's WhatsApp number in
//     international E.164 format **without** the leading "+" and without
//     spaces/dashes. Pakistan example: 923001234567 (where 92 is the country
//     code and 3001234567 is the 10-digit mobile).
//
// The number is intentionally public-build-time so the buttons can render
// server-side without a runtime fetch. If unset, the helper returns null
// and the calling component should hide its button gracefully.
// ============================================================================

/** Raw merchant number, normalised. `null` if unset → calling components
 *  should not render a WhatsApp button at all. */
function rawMerchantNumber(): string | null {
  const v = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.trim();
  if (!v) return null;
  // Strip everything that isn't a digit so accidental "+" / spaces don't
  // break the wa.me URL (`+` is reserved in URL paths).
  const digits = v.replace(/\D+/g, '');
  return digits || null;
}

export function hasWhatsApp(): boolean {
  return rawMerchantNumber() !== null;
}

export function merchantNumber(): string | null {
  return rawMerchantNumber();
}

/** Build a `wa.me` link to the merchant's number with an optional pre-typed
 *  message. Returns null when the merchant number isn't configured so callers
 *  can short-circuit the render. */
export function whatsappUrl(message?: string): string | null {
  const n = rawMerchantNumber();
  if (!n) return null;
  if (!message) return `https://wa.me/${n}`;
  return `https://wa.me/${n}?text=${encodeURIComponent(message)}`;
}

/** Build a `wa.me` link to an arbitrary customer phone (admin → customer
 *  outbound), normalising the phone the same way the merchant number is
 *  normalised. Returns null if the phone is empty / unparseable. */
export function whatsappUrlForCustomer(phone: string | null | undefined, message?: string): string | null {
  if (!phone) return null;
  // UK phones often arrive as "0300 1234567" / "07123456789" /
  // "+447123456789". Strip non-digits then prepend the country code if the
  // remaining string starts with "0".
  let digits = phone.replace(/\D+/g, '');
  if (digits.startsWith('0')) digits = '92' + digits.slice(1);
  if (!digits) return null;
  if (!message) return `https://wa.me/${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** Pre-typed messages for the common storefront contact points. */
export const WA_TEMPLATES = {
  generic:     () => "Hi Aizel! I'd like to ask a question.",
  product:     (name: string) => `Hi Aizel! I have a question about "${name}".`,
  cart:        () => "Hi Aizel! I'm checking out and need help with my cart.",
  orderTrack:  (orderNumber: string) => `Hi Aizel! Can you share an update on order ${orderNumber}?`,
  orderQuestion: (orderNumber: string) =>
    `Hi Aizel! I just placed order ${orderNumber} and would like to confirm my details.`,
};
