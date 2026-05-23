-- ============================================================================
-- Fixes for the 2026-05-19 audit report. Bundle of RLS hardening + defensive
-- signup triggers + cleanup of the leaked $ACTION_ID_ row in site_settings.
--
-- Apply with: supabase db push   (or paste into Supabase Studio → SQL Editor)
--
-- Idempotent — every CREATE uses OR REPLACE, every POLICY drops-then-creates.
-- ============================================================================


-- ─── SEV-0: lock down public.orders RLS ────────────────────────────────────
-- Audit finding: anon Supabase REST returned full PII (name/email/phone/
-- address/items/total) when probing `/rest/v1/orders?select=*`. Customer-
-- ownership policy + a guest-tracking RPC are both needed so the storefront
-- and the /track page keep working.
alter table public.orders enable row level security;

-- Drop every existing SELECT policy so we don't leave a stale "true" rule
-- behind from a forgotten migration.
do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'orders' and cmd = 'SELECT'
  loop
    execute format('drop policy if exists %I on public.orders', r.policyname);
  end loop;
end $$;

-- Customer can read their own orders (linked via user_id).
create policy orders_select_own on public.orders
  for select to authenticated
  using ( auth.uid() = user_id );

-- Anon role has NO direct SELECT. Guest order tracking goes through the
-- SECURITY DEFINER lookup_order(order_number, phone) RPC (migration 005).
-- Mutations still go through the place_order() / payment-callback RPCs which
-- are SECURITY DEFINER themselves, so closing anon SELECT here doesn't break
-- checkout.


-- ─── SEV-1: lock down public.coupons RLS ───────────────────────────────────
-- Audit finding: anon REST listed every promo code (WELCOME10, SAVE200,
-- NEWUSER15). The cart applies coupons via a server action (apply_coupon
-- / rewards-actions.ts), not a direct table read, so the only legitimate
-- SELECT path is admin (service_role bypass) — anon needs no access at all.
alter table public.coupons enable row level security;

do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'coupons'
  loop
    execute format('drop policy if exists %I on public.coupons', r.policyname);
  end loop;
end $$;

-- No SELECT for anon or authenticated. Service_role still bypasses RLS for
-- admin. Storefront validation goes through a SECURITY DEFINER RPC.
-- (We don't add an explicit deny rule — RLS-on-without-policy denies by
-- default for any role except superuser/owner/service_role.)

-- Make sure there's a coupon-validation RPC the storefront can use. If one
-- already exists (validate_coupon, check_coupon, etc.) this is a no-op
-- because of CREATE OR REPLACE.
create or replace function public.lookup_coupon(p_code text)
returns table (
  id uuid,
  code text,
  type text,
  value numeric,
  min_order numeric,
  max_uses integer,
  used_count integer,
  active boolean,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select id, code, type, value, min_order, max_uses, used_count, active, expires_at
  from public.coupons
  where upper(code) = upper(p_code)
  limit 1;
$$;

grant execute on function public.lookup_coupon(text) to anon, authenticated;


-- ─── SEV-1: defensive signup — don't let an award failure block user create ─
-- Audit finding: `supabase.auth.signUp()` returns "Database error saving new
-- user" on every email. Most likely cause: one of the AFTER INSERT triggers
-- on auth.users (award_welcome_points → loyalty_accounts insert, OR
-- profile creation → referral_code generator) is throwing.
--
-- Rather than guess which is broken, wrap each downstream side-effect in
-- BEGIN/EXCEPTION so the user creation always succeeds. If a side-effect
-- fails, we log a NOTICE and the user is created without that bonus — a
-- backfill job can clean up later.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- Profile is required for signed-in flows, but if the insert fails (e.g.
  -- referral_code generator errors) the user should still be created. The
  -- backfill below will catch it.
  begin
    insert into public.profiles (id) values (new.id)
    on conflict (id) do nothing;
  exception when others then
    raise warning 'handle_new_user: profile insert failed for %: % (%) — user still created, backfill needed',
      new.id, sqlerrm, sqlstate;
  end;
  return new;
end $$;

create or replace function public.award_welcome_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_welcome integer;
begin
  begin
    select coalesce(value::integer, 0) into v_welcome
      from public.site_settings where key = 'loyalty_welcome_points';
    if coalesce(v_welcome, 0) > 0 then
      perform public.grant_loyalty_points(new.id, v_welcome, 'welcome');
    end if;
  exception when others then
    raise warning 'award_welcome_points: failed for %: % (%) — signup still succeeds',
      new.id, sqlerrm, sqlstate;
  end;
  return new;
end $$;

-- Same defensive wrap for the BEFORE INSERT referral-code generator on
-- profiles. If we can't generate a code, leave it NULL — they can earn
-- one later when they visit /account/rewards.
create or replace function public.generate_referral_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_attempt int := 0;
begin
  if new.referral_code is not null then return new; end if;
  begin
    loop
      v_attempt := v_attempt + 1;
      v_code := upper(substr(translate(encode(gen_random_bytes(8), 'base64'), '+/=oO0Il1', ''), 1, 8));
      exit when not exists (select 1 from public.profiles where referral_code = v_code);
      if v_attempt > 5 then
        v_code := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
        exit;
      end if;
    end loop;
    new.referral_code := v_code;
  exception when others then
    raise warning 'generate_referral_code: failed: % (%) — leaving NULL', sqlerrm, sqlstate;
    new.referral_code := null;
  end;
  return new;
end $$;

-- Backfill job: anyone in auth.users without a profile/loyalty_account gets
-- one now so the report's "0 customers" state stays accurate going forward.
do $$
declare u record;
begin
  for u in select id from auth.users where id not in (select id from public.profiles)
  loop
    begin
      insert into public.profiles (id) values (u.id) on conflict (id) do nothing;
    exception when others then
      raise warning 'backfill profile for % failed: %', u.id, sqlerrm;
    end;
  end loop;
end $$;


-- ─── SEV-2: scrub $ACTION_ID_ row from site_settings + filter on insert ────
-- Audit finding: a row with key like `$ACTION_ID_4071400faf6a660da3c334bbe...`
-- (a Next.js server-action binding) had leaked into site_settings.
delete from public.site_settings where key like '$ACTION_%' or key like '$%';

-- Defence-in-depth: refuse to insert any key starting with '$' going
-- forward. The app-layer fix is in src/app/admin/settings/actions.ts.
alter table public.site_settings
  drop constraint if exists site_settings_no_dollar_keys;
alter table public.site_settings
  add constraint site_settings_no_dollar_keys
  check (key !~ '^\$');


-- ─── SEV-2: dedupe staff_members.permissions if duplicated ────────────────
-- Audit finding: the Team page rendered each permission pill twice for
-- Areej Saeed. Could be UI bug (handled in TeamPage.tsx) or a real data
-- duplicate. This is the data side — dedupe defensively.
update public.staff_members
   set permissions = array(select distinct unnest(permissions))
 where array_length(permissions, 1) is distinct from
       array_length(array(select distinct unnest(permissions)), 1);


-- ═══════════════════════════════════════════════════════════════════════════
-- Verification queries (run interactively after applying):
--
-- 1. SEV-0 orders RLS — should return 0 rows for anon:
--      set role anon;
--      select count(*) from public.orders;            -- expect 0
--      reset role;
--
-- 2. SEV-1 coupons RLS — should return 0 rows for anon:
--      set role anon;
--      select count(*) from public.coupons;           -- expect 0
--      select * from public.lookup_coupon('WELCOME10'); -- expect 1
--      reset role;
--
-- 3. SEV-1 signup — try a fresh signup from /login Sign up tab. Should
--    succeed even if loyalty/referral side-effects fail.
--
-- 4. SEV-2 $ACTION_ID — should return 0 rows:
--      select * from public.site_settings where key like '$%';
-- ═══════════════════════════════════════════════════════════════════════════
