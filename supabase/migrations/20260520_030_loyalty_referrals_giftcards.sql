-- ============================================================================
-- Phase 4: Loyalty + Referrals + Gift Cards.
--
-- Loyalty: per-customer point balance, append-only ledger, configurable
-- earn rates via site_settings (loyalty_*).
--
-- Referrals: every signed-up customer auto-gets a referral code on their
-- profile. New customers redeem it at checkout for a discount; the
-- referrer earns points when the referee's first order is *delivered*.
--
-- Gift cards: codes with a balance. Sold as a special product OR issued
-- manually by staff (admin/SQL for now). Redeemable as a partial / full
-- payment method.
-- ============================================================================

-- ─── Settings defaults ──────────────────────────────────────────────────────
insert into public.site_settings (key, value) values
  ('loyalty_enabled',          'true'),
  ('loyalty_points_per_pkr',   '0.1'),       -- 10 points per PKR 100 spent
  ('loyalty_pkr_per_point',    '1'),         -- 1 point = PKR 1 at redemption
  ('loyalty_welcome_points',   '100'),
  ('loyalty_review_points',    '25'),
  ('loyalty_referral_points',  '500'),       -- referrer reward
  ('loyalty_referral_discount_pct', '10'),   -- referee's first-order discount
  ('tier_silver_min_points',   '1000'),
  ('tier_gold_min_points',     '5000')
on conflict (key) do nothing;

-- ─── loyalty_accounts ───────────────────────────────────────────────────────
create table if not exists public.loyalty_accounts (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  points_balance   integer not null default 0 check (points_balance >= 0),
  lifetime_points  integer not null default 0,                    -- never decremented
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.loyalty_accounts enable row level security;
drop policy if exists loyalty_accounts_select_own on public.loyalty_accounts;
create policy loyalty_accounts_select_own on public.loyalty_accounts
  for select using ( auth.uid() = user_id );

drop trigger if exists loyalty_accounts_set_updated_at on public.loyalty_accounts;
create trigger loyalty_accounts_set_updated_at
  before update on public.loyalty_accounts
  for each row execute function public.set_updated_at();

-- ─── loyalty_ledger (append-only) ───────────────────────────────────────────
create table if not exists public.loyalty_ledger (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  delta       integer not null,                                 -- positive = earn, negative = redeem
  reason      text not null check (reason in (
    'welcome', 'order_delivered', 'review_approved', 'referral_reward',
    'redemption', 'birthday', 'manual', 'refund_reversal'
  )),
  order_id    uuid references public.orders(id) on delete set null,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists loyalty_ledger_user_idx on public.loyalty_ledger (user_id, created_at desc);

alter table public.loyalty_ledger enable row level security;
drop policy if exists loyalty_ledger_select_own on public.loyalty_ledger;
create policy loyalty_ledger_select_own on public.loyalty_ledger
  for select using ( auth.uid() = user_id );

-- ─── grant_loyalty_points ───────────────────────────────────────────────────
-- Single entry point so balance + lifetime + ledger stay consistent.
create or replace function public.grant_loyalty_points(
  p_user_id uuid,
  p_delta   integer,
  p_reason  text,
  p_order_id uuid default null,
  p_note    text default null
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance integer;
begin
  if p_user_id is null then return 0; end if;
  if p_delta = 0 then return (select points_balance from public.loyalty_accounts where user_id = p_user_id); end if;

  insert into public.loyalty_accounts (user_id, points_balance, lifetime_points)
  values (p_user_id, greatest(0, p_delta), greatest(0, p_delta))
  on conflict (user_id) do update
    set points_balance  = greatest(0, public.loyalty_accounts.points_balance + p_delta),
        lifetime_points = public.loyalty_accounts.lifetime_points + greatest(0, p_delta)
    returning points_balance into v_new_balance;

  insert into public.loyalty_ledger (user_id, delta, reason, order_id, note)
  values (p_user_id, p_delta, p_reason, p_order_id, p_note);

  return v_new_balance;
end $$;

grant execute on function public.grant_loyalty_points(uuid, integer, text, uuid, text) to authenticated;

-- ─── Auto-award on order delivery ───────────────────────────────────────────
create or replace function public.award_points_on_delivery()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rate     numeric;
  v_pkr_per  numeric;
  v_points   integer;
begin
  if new.status = 'delivered' and (old.status is distinct from 'delivered') and new.user_id is not null then
    select value::numeric into v_rate from public.site_settings where key = 'loyalty_points_per_pkr';
    if coalesce(v_rate, 0) > 0 then
      v_points := floor(new.total * v_rate)::integer;
      if v_points > 0 then
        perform public.grant_loyalty_points(new.user_id, v_points, 'order_delivered', new.id);
      end if;
    end if;

    -- Referral reward (paid out when first delivery, not when order is placed).
    if (select count(*) from public.orders where user_id = new.user_id and status = 'delivered') = 1 then
      -- This is the first delivered order for this user. Reward referrer if any.
      perform public.award_referral_for_user(new.user_id);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists orders_award_points on public.orders;
create trigger orders_award_points
  after update of status on public.orders
  for each row execute function public.award_points_on_delivery();

-- ─── Welcome points on signup ──────────────────────────────────────────────
create or replace function public.award_welcome_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_welcome integer;
begin
  select coalesce(value::integer, 0) into v_welcome
    from public.site_settings where key = 'loyalty_welcome_points';
  if coalesce(v_welcome, 0) > 0 then
    perform public.grant_loyalty_points(new.id, v_welcome, 'welcome');
  end if;
  return new;
end $$;

-- The on_auth_user_created trigger from the baseline already handles
-- profile creation. We hook into that AFTER it runs by adding a second
-- AFTER INSERT trigger on auth.users.
drop trigger if exists on_auth_user_welcome_points on auth.users;
create trigger on_auth_user_welcome_points
  after insert on auth.users
  for each row execute function public.award_welcome_points();

-- ─── Review approval awards ────────────────────────────────────────────────
create or replace function public.award_review_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pts integer;
begin
  -- Only on transition from unapproved → approved AND we know the user_id.
  if new.approved and (old.approved is distinct from true) and new.user_id is not null then
    select coalesce(value::integer, 0) into v_pts
      from public.site_settings where key = 'loyalty_review_points';
    if coalesce(v_pts, 0) > 0 then
      perform public.grant_loyalty_points(new.user_id, v_pts, 'review_approved');
    end if;
  end if;
  return new;
end $$;

drop trigger if exists reviews_award_points on public.product_reviews;
create trigger reviews_award_points
  after update of approved on public.product_reviews
  for each row execute function public.award_review_points();

-- ─── Redeem points (anon-callable, but auth-only at app layer) ─────────────
-- Returns the new balance, or raises on insufficient balance.
create or replace function public.redeem_loyalty_points(
  p_user_id uuid,
  p_points  integer,
  p_order_id uuid default null
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if p_points <= 0 then raise exception 'points must be positive'; end if;
  select points_balance into v_balance from public.loyalty_accounts where user_id = p_user_id;
  if coalesce(v_balance, 0) < p_points then
    raise exception 'insufficient loyalty balance: have %, need %', coalesce(v_balance, 0), p_points;
  end if;
  return public.grant_loyalty_points(p_user_id, -p_points, 'redemption', p_order_id);
end $$;
grant execute on function public.redeem_loyalty_points(uuid, integer, uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Referrals
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists referral_code text unique,
  add column if not exists referred_by_code text;          -- the code they joined with

-- Auto-issue a referral code when a profile is created. Uses base32-ish characters
-- to keep it short + readable.
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
  if new.referral_code is null then
    loop
      v_attempt := v_attempt + 1;
      -- 8 alphanumeric chars, uppercase. Roughly 32^8 = 1.1 trillion possibilities.
      v_code := upper(substr(translate(encode(gen_random_bytes(8), 'base64'), '+/=oO0Il1', ''), 1, 8));
      exit when not exists (select 1 from public.profiles where referral_code = v_code);
      if v_attempt > 5 then
        -- give up uniqueness — fallback random
        v_code := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
        exit;
      end if;
    end loop;
    new.referral_code := v_code;
  end if;
  return new;
end $$;

drop trigger if exists profiles_generate_referral_code on public.profiles;
create trigger profiles_generate_referral_code
  before insert on public.profiles
  for each row execute function public.generate_referral_code();

-- Backfill for existing rows.
update public.profiles set referral_code = upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8))
  where referral_code is null;

-- ─── award_referral_for_user (called by award_points_on_delivery) ──────────
create or replace function public.award_referral_for_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code        text;
  v_referrer_id uuid;
  v_reward      integer;
begin
  select referred_by_code into v_code from public.profiles where id = p_user_id;
  if v_code is null then return; end if;

  select id into v_referrer_id from public.profiles where referral_code = v_code;
  if v_referrer_id is null or v_referrer_id = p_user_id then return; end if;

  select coalesce(value::integer, 0) into v_reward
    from public.site_settings where key = 'loyalty_referral_points';
  if v_reward > 0 then
    perform public.grant_loyalty_points(v_referrer_id, v_reward, 'referral_reward', null,
      'Reward for referring ' || p_user_id::text);
  end if;
end $$;

-- ─── Looking up a referral code at checkout ────────────────────────────────
create or replace function public.validate_referral_code(p_code text, p_email text default null)
returns table (valid boolean, discount_pct numeric, owner_id uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_pct numeric;
begin
  select id into v_owner from public.profiles where referral_code = upper(trim(p_code));
  if v_owner is null then
    return query select false, 0::numeric, null::uuid; return;
  end if;
  select coalesce(value::numeric, 0) into v_pct
    from public.site_settings where key = 'loyalty_referral_discount_pct';
  return query select true, v_pct, v_owner;
end $$;
grant execute on function public.validate_referral_code(text, text) to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Gift cards
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.gift_cards (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,                  -- short, displayed to customer
  initial_balance numeric(10,2) not null check (initial_balance > 0),
  current_balance numeric(10,2) not null check (current_balance >= 0),
  currency        text not null default 'PKR',
  issued_to_email text,
  issued_by_user  uuid references auth.users(id) on delete set null,
  expires_at      timestamptz,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists gift_cards_code_idx on public.gift_cards (code);

drop trigger if exists gift_cards_set_updated_at on public.gift_cards;
create trigger gift_cards_set_updated_at
  before update on public.gift_cards
  for each row execute function public.set_updated_at();

alter table public.gift_cards enable row level security;
-- No public-read: redemption goes through validate_gift_card RPC.

create table if not exists public.gift_card_transactions (
  id           uuid primary key default gen_random_uuid(),
  gift_card_id uuid not null references public.gift_cards(id) on delete cascade,
  order_id     uuid references public.orders(id) on delete set null,
  kind         text not null check (kind in ('issue','redeem','refund','adjust')),
  amount       numeric(10,2) not null,
  note         text,
  created_at   timestamptz not null default now()
);
create index if not exists gift_card_transactions_card_idx on public.gift_card_transactions (gift_card_id, created_at);

alter table public.gift_card_transactions enable row level security;

-- ─── validate_gift_card (anon-callable, no PII leaked) ─────────────────────
create or replace function public.validate_gift_card(p_code text)
returns table (valid boolean, balance numeric, currency text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_card record;
begin
  select * into v_card from public.gift_cards where code = upper(trim(p_code));
  if v_card is null then
    return query select false, 0::numeric, 'PKR'::text; return;
  end if;
  if not v_card.active then
    return query select false, 0::numeric, v_card.currency; return;
  end if;
  if v_card.expires_at is not null and v_card.expires_at < now() then
    return query select false, 0::numeric, v_card.currency; return;
  end if;
  return query select true, v_card.current_balance, v_card.currency;
end $$;
grant execute on function public.validate_gift_card(text) to anon, authenticated;

-- ─── redeem_gift_card — atomic balance decrement ───────────────────────────
create or replace function public.redeem_gift_card(
  p_code   text,
  p_amount numeric,
  p_order_id uuid default null
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card  public.gift_cards;
  v_take  numeric;
begin
  select * into v_card from public.gift_cards where code = upper(trim(p_code)) for update;
  if v_card is null then raise exception 'gift card not found'; end if;
  if not v_card.active then raise exception 'gift card is inactive'; end if;
  if v_card.expires_at is not null and v_card.expires_at < now() then
    raise exception 'gift card has expired';
  end if;
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;

  v_take := least(p_amount, v_card.current_balance);
  if v_take <= 0 then raise exception 'gift card has no balance'; end if;

  update public.gift_cards
    set current_balance = current_balance - v_take
    where id = v_card.id;
  insert into public.gift_card_transactions (gift_card_id, order_id, kind, amount)
    values (v_card.id, p_order_id, 'redeem', -v_take);
  return v_take;
end $$;
grant execute on function public.redeem_gift_card(text, numeric, uuid) to anon, authenticated;
