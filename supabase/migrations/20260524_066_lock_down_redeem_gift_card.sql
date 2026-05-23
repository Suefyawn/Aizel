-- P1: redeem_gift_card and redeem_loyalty_points were granted EXECUTE to
-- anon + authenticated by 20260520_030. They're SECURITY DEFINER so any
-- caller can drain a gift card by guessing/learning a code, or debit any
-- user's loyalty balance, with no validation that the caller owns the
-- referenced order. Both should be reachable ONLY via place_order, which
-- is itself SECURITY DEFINER and owns the gating logic.

revoke execute on function public.redeem_gift_card(text, numeric, uuid) from anon, authenticated;
revoke execute on function public.redeem_loyalty_points(uuid, integer, uuid) from anon, authenticated;

comment on function public.redeem_gift_card(text, numeric, uuid) is
  'INTERNAL — call only from place_order(). Revoked from anon+authenticated 2026-05-24 (audit P1).';
comment on function public.redeem_loyalty_points(uuid, integer, uuid) is
  'INTERNAL — call only from place_order(). Revoked from anon+authenticated 2026-05-24 (audit P1).';
