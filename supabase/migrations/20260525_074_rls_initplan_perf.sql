-- 20260525_074_rls_initplan_perf.sql
--
-- Wraps every public-table RLS policy that calls auth.uid() / auth.role() in
-- (select auth.<fn>()), per the Supabase Database Linter's
-- "auth_rls_initplan" finding. Without the wrap, auth.uid() is re-evaluated
-- per row in the policy filter; with the wrap, Postgres lifts it to an
-- InitPlan that runs once. Typical 10-100x speedup on RLS-protected reads
-- at scale.
--
-- Also drops the three legacy "users * own profile" policies — exact
-- duplicates of profiles_select_own / _insert_own / _update_own, all of
-- which check (auth.uid() = id). They were flagged as
-- multiple_permissive_policies.

begin;

-- ── addresses ───────────────────────────────────────────────────────────────
drop policy if exists "addresses_delete_own" on public.addresses;
create policy "addresses_delete_own" on public.addresses
  for delete to public
  using ((select auth.uid()) = user_id);

drop policy if exists "addresses_insert_own" on public.addresses;
create policy "addresses_insert_own" on public.addresses
  for insert to public
  with check ((select auth.uid()) = user_id);

drop policy if exists "addresses_select_own" on public.addresses;
create policy "addresses_select_own" on public.addresses
  for select to public
  using ((select auth.uid()) = user_id);

drop policy if exists "addresses_update_own" on public.addresses;
create policy "addresses_update_own" on public.addresses
  for update to public
  using ((select auth.uid()) = user_id);

-- ── coupon_redemptions ──────────────────────────────────────────────────────
drop policy if exists "coupon_redemptions_select_own" on public.coupon_redemptions;
create policy "coupon_redemptions_select_own" on public.coupon_redemptions
  for select to public
  using ( ((select auth.uid()) is not null) and ((select auth.uid()) = user_id) );

-- ── loyalty ─────────────────────────────────────────────────────────────────
drop policy if exists "loyalty_accounts_select_own" on public.loyalty_accounts;
create policy "loyalty_accounts_select_own" on public.loyalty_accounts
  for select to public
  using ((select auth.uid()) = user_id);

drop policy if exists "loyalty_ledger_select_own" on public.loyalty_ledger;
create policy "loyalty_ledger_select_own" on public.loyalty_ledger
  for select to public
  using ((select auth.uid()) = user_id);

-- ── order_events ────────────────────────────────────────────────────────────
drop policy if exists "order_events_select_own" on public.order_events;
create policy "order_events_select_own" on public.order_events
  for select to public
  using ( exists (
    select 1
    from public.orders o
    where o.id = order_events.order_id
      and o.user_id = (select auth.uid())
  ) );

-- ── orders ──────────────────────────────────────────────────────────────────
drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own" on public.orders
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- ── payments ────────────────────────────────────────────────────────────────
drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own" on public.payments
  for select to public
  using ( exists (
    select 1
    from public.orders o
    where o.id = payments.order_id
      and o.user_id = (select auth.uid())
  ) );

-- ── product_reviews ─────────────────────────────────────────────────────────
drop policy if exists "insert own review" on public.product_reviews;
create policy "insert own review" on public.product_reviews
  for insert to public
  with check ( ((select auth.uid()) = user_id) or (user_id is null) );

-- ── profiles ────────────────────────────────────────────────────────────────
-- Drop the three legacy "users * own profile" policies — exact duplicates
-- of profiles_*_own. Linter flagged them as multiple_permissive_policies.
drop policy if exists "users insert own profile" on public.profiles;
drop policy if exists "users read own profile"   on public.profiles;
drop policy if exists "users update own profile" on public.profiles;

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to public
  with check ((select auth.uid()) = id);

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to public
  using ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to public
  using ((select auth.uid()) = id);

-- ── return_requests ─────────────────────────────────────────────────────────
drop policy if exists "return_requests_insert_own" on public.return_requests;
create policy "return_requests_insert_own" on public.return_requests
  for insert to public
  with check ( ((select auth.uid()) is not null) and ((select auth.uid()) = user_id) );

drop policy if exists "return_requests_select_own" on public.return_requests;
create policy "return_requests_select_own" on public.return_requests
  for select to public
  using ( ((select auth.uid()) is not null) and ((select auth.uid()) = user_id) );

-- ── shipments + shipment_events ─────────────────────────────────────────────
drop policy if exists "shipments_select_own" on public.shipments;
create policy "shipments_select_own" on public.shipments
  for select to public
  using ( exists (
    select 1
    from public.orders o
    where o.id = shipments.order_id
      and o.user_id = (select auth.uid())
  ) );

drop policy if exists "shipment_events_select_own" on public.shipment_events;
create policy "shipment_events_select_own" on public.shipment_events
  for select to public
  using ( exists (
    select 1
    from public.shipments s
    join public.orders o on o.id = s.order_id
    where s.id = shipment_events.shipment_id
      and o.user_id = (select auth.uid())
  ) );

commit;
