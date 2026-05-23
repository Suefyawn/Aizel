-- Migration 087 — seed the WELCOME10 newsletter coupon.
--
-- Newsletter signups (NewsletterModal / NewsletterSignup) trigger a
-- welcome email that now surfaces a discount code. A single shared
-- code keeps the email send path free of per-user coupon minting;
-- abuse is capped by usage_limit_per_user = 1 so each account can
-- only redeem it once. 10% off, percent discount, min order PKR 1,500.
--
-- Idempotent: skips the insert if a WELCOME10 row already exists.

INSERT INTO public.coupons (
  code, type, value, discount_type,
  min_order, max_uses, usage_limit_per_user,
  active, individual_use, exclude_sale_items, free_shipping,
  description
)
SELECT
  'WELCOME10', 'percent', 10, 'percent',
  1500, NULL, 1,
  true, false, false, false,
  'Newsletter welcome — 10% off your first order over PKR 1,500.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.coupons WHERE upper(code) = 'WELCOME10'
);
