-- Migration 093 — fix coupon validation (P1).
--
-- Cowork QA found WELCOME10 / SUBSCRIBE10 (both Active, both advertised on
-- the site) rejected at the cart as "Invalid or inactive coupon code".
--
-- Root cause: migration 070 enabled RLS on `coupons` and dropped the anon
-- SELECT policy with no replacement. The cart + checkout validate a coupon
-- client-side with `supabase.from('coupons').select(...)` on the anon
-- client — which now returns zero rows, so every code reads as invalid.
--
-- A `lookup_coupon` RPC already existed but was stale: it returned only a
-- 9-column subset, missing every field added since (discount_type,
-- usage_limit_per_user, product/category scoping, etc.) that
-- validateCoupon() needs — so it was unused and the cart hit the table
-- directly instead.
--
-- Fix: redefine lookup_coupon to return the whole coupons row (setof
-- public.coupons — no column list to drift), case-insensitive, active-only,
-- one row. SECURITY DEFINER so it bypasses RLS without a blanket anon read;
-- it can only ever return a single code the caller already knows. The
-- richer validateCoupon() logic still runs client-side, and place_order
-- re-validates server-side at redemption.

drop function if exists public.lookup_coupon(text);

create function public.lookup_coupon(p_code text)
returns setof public.coupons
language sql
stable
security definer
set search_path = public
as $$
  select * from public.coupons
  where upper(code) = upper(trim(p_code))
    and active = true
  limit 1;
$$;

grant execute on function public.lookup_coupon(text) to anon, authenticated;
