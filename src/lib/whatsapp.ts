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
//     spaces/dashes. UK example: 447123456789 (where 44 is the country
//     code and 7123456789 is the 10-digit mobile).
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
 *  outbound), normalising the phone to UK E.164 (without the leading "+",
 *  per wa.me's URL format). Returns null if the phone is empty / unparseable.
 *
 *  Handles the common UK input styles:
 *    "07123456789"     → 447123456789
 *    "+447123456789"   → 447123456789
 *    "447123456789"    → 447123456789
 *    "00447123456789"  → 447123456789
 *    "07123 456 789"   → 447123456789  (spaces / dashes stripped)
 */
export function whatsappUrlForCustomer(phone: string | null | undefined, message?: string): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D+/g, '');
  if (!digits) return null;
  // 0044 → 44
  if (digits.startsWith('0044')) digits = digits.slice(2);
  // Leading single 0 → assume national-format UK mobile/landline; prepend 44.
  else if (digits.startsWith('0')) digits = '44' + digits.slice(1);
  // Bare number (no prefix) — if it looks like a 10-11 digit UK mobile,
  // prepend the country code. Anything else we pass through and let wa.me
  // reject if invalid.
  else if (!digits.startsWith('44') && digits.length >= 10 && digits.length <= 11) {
    digits = '44' + digits;
  }
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
