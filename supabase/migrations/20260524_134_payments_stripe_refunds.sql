-- ============================================================================
-- Fix the payments.gateway CHECK constraint + default currency for the UK
-- rebrand, and document the refund pattern.
--
-- The original 006_payments migration was written for the YellowPink
-- Pakistan template. The check constraint pinned `gateway` to
-- ('jazzcash','easypaisa','cod','bank','manual','gift_card') and the
-- default currency to 'PKR'. The Stripe webhook handler inserts
-- gateway='stripe' / currency='GBP' rows, which silently violated the
-- check constraint — the only reason real payments hadn't broken in
-- production is that the storefront has been in demo mode (no Supabase
-- env) for the rebrand window.
--
-- Refunds: rather than a separate refunds table, each refund inserts a
-- new payments row with status='refunded' and amount=<refunded GBP>. The
-- order's "amount refunded so far" is then SUM(amount) on those rows;
-- "amount paid" is SUM(amount where status='succeeded'). The
-- (gateway, txn_ref) unique index already prevents duplicate refund
-- inserts when Stripe's refund.created webhook eventually fires.
-- ============================================================================

alter table public.payments drop constraint if exists payments_gateway_check;
alter table public.payments
  add constraint payments_gateway_check
  check (gateway in ('stripe','paypal','jazzcash','easypaisa','cod','bank','manual','gift_card'));

-- Default currency for new rows lands as GBP. Existing rows keep whatever
-- they have (the column is NOT NULL so old rows already have 'PKR'); the
-- storefront has never gone live so this is purely cosmetic for fresh
-- installs.
alter table public.payments alter column currency set default 'GBP';
