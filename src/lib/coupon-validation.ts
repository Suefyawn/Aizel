// Coupon validator shared between CartPage and CheckoutPage. Returns the
// first failure reason as user-facing text, or `{ ok: true }` if every
// constraint passes.
//
// Note: this is best-effort client-side validation for UX (don't accept a
// coupon that's clearly invalid). The authoritative check happens in the
// place_order RPC. Server-side re-validation is tracked as a P1 follow-up.

import type { Coupon, CartItem } from '@/types';

export interface ValidateCouponInput {
  coupon: Coupon;
  cartItems: CartItem[];
  subtotal: number;
  /** Logged-in user's email, if any — needed for `email_restrictions`. */
  email?: string | null;
  /** Number of times THIS user has redeemed THIS coupon in the past. */
  perUserUsedCount?: number;
}

export type ValidateCouponResult = { ok: true } | { ok: false; error: string };

export function validateCoupon({
  coupon: c,
  cartItems,
  subtotal,
  email,
  perUserUsedCount,
}: ValidateCouponInput): ValidateCouponResult {
  // Time gate.
  if (c.expires_at && new Date(c.expires_at) < new Date()) {
    return { ok: false, error: 'This coupon has expired.' };
  }
  // Global usage cap.
  if (c.max_uses !== null && c.used_count >= c.max_uses) {
    return { ok: false, error: 'This coupon has reached its usage limit.' };
  }
  // Per-user usage cap (only enforceable when the caller knows the user's
  // prior count — guests bypass this and the server will catch them).
  if (
    typeof c.usage_limit_per_user === 'number' &&
    c.usage_limit_per_user > 0 &&
    typeof perUserUsedCount === 'number' &&
    perUserUsedCount >= c.usage_limit_per_user
  ) {
    return { ok: false, error: 'You have already used this coupon the maximum number of times.' };
  }
  // Cart subtotal floor / ceiling.
  if (subtotal < c.min_order) {
    return { ok: false, error: `Minimum order of £${c.min_order.toLocaleString()} required.` };
  }
  if (typeof c.max_order === 'number' && c.max_order > 0 && subtotal > c.max_order) {
    return { ok: false, error: `This coupon only applies to orders up to £${c.max_order.toLocaleString()}.` };
  }
  // Email allowlist (substring or domain match — Woo-style: an entry
  // starting with `*@` is a domain wildcard, e.g. `*@aizel.co.uk`).
  if (c.email_restrictions && c.email_restrictions.length > 0) {
    const e = (email ?? '').trim().toLowerCase();
    if (!e) {
      return { ok: false, error: 'This coupon requires you to be signed in with a specific email.' };
    }
    const ok = c.email_restrictions.some(raw => {
      const r = raw.trim().toLowerCase();
      if (r.startsWith('*@')) return e.endsWith(r.slice(1));
      return e === r;
    });
    if (!ok) return { ok: false, error: 'This coupon is not valid for your account.' };
  }
  // Per-product allowlist / denylist. Coupon is invalid if every cart item
  // is excluded, OR if none of the items hit the allowlist.
  if (c.product_ids && c.product_ids.length > 0) {
    const matched = cartItems.some(it => c.product_ids!.includes(it.id));
    if (!matched) return { ok: false, error: 'This coupon does not apply to items in your cart.' };
  }
  if (c.excluded_product_ids && c.excluded_product_ids.length > 0) {
    const allExcluded = cartItems.every(it => c.excluded_product_ids!.includes(it.id));
    if (allExcluded) return { ok: false, error: 'This coupon does not apply to items in your cart.' };
  }
  // Per-category allowlist / denylist. We don't have a categories[] on
  // CartItem (storefront uses `category` string), so match by single category.
  if (c.category_ids && c.category_ids.length > 0) {
    // category_ids contains category UUIDs, not slugs — until we surface the
    // category id on CartItem we can only enforce this server-side. Skip.
  }
  if (c.excluded_category_ids && c.excluded_category_ids.length > 0) {
    // Same caveat — server enforces.
  }
  return { ok: true };
}
