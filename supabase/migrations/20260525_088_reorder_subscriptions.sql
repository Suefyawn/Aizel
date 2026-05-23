-- Migration 088 — reorder subscriptions ("Subscribe & Save").
--
-- Wellness supplements are consumables: customers run out and reorder
-- on a predictable cadence. This adds a lightweight subscription —
-- NOT auto-billing (the storefront has no card-on-file; payments are
-- COD / JazzCash / Easypaisa) but a recurring reorder *reminder*.
--
--   • A customer opts in from a wellness PDP, picking a cadence
--     (30 / 45 / 60 / 90 days).
--   • The daily cron (src/app/api/cron/subscription-reorder) emails a
--     reorder nudge when next_reminder_at falls due, then rolls the
--     date forward by interval_days.
--   • The "Save" half is the SUBSCRIBE10 coupon seeded below — surfaced
--     in every reminder email and on the PDP opt-in.
--   • Customers manage / pause / cancel from /account/subscriptions.
--
-- email is denormalized onto the row (same approach as abandoned_carts)
-- so the cron can send without reaching into the auth schema per row.

create table if not exists public.reorder_subscriptions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  email            text not null,
  product_id       uuid not null references public.products(id) on delete cascade,
  variant_id       uuid references public.product_variants(id) on delete set null,
  interval_days    integer not null check (interval_days in (30, 45, 60, 90)),
  status           text not null default 'active'
                     check (status in ('active', 'paused', 'cancelled')),
  next_reminder_at timestamptz not null,
  last_reminded_at timestamptz,
  reminder_count   integer not null default 0,
  created_at       timestamptz not null default now()
);

create index if not exists reorder_subs_user_idx
  on public.reorder_subscriptions (user_id);
-- The cron only ever scans active rows that are due.
create index if not exists reorder_subs_due_idx
  on public.reorder_subscriptions (next_reminder_at)
  where status = 'active';

-- One live subscription per (user, product, variant). A cancelled row is
-- excluded from the constraint so a customer can always re-subscribe.
create unique index if not exists reorder_subs_unique_live
  on public.reorder_subscriptions
     (user_id, product_id, coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status <> 'cancelled';

alter table public.reorder_subscriptions enable row level security;

-- Per-user RLS: server actions use the customer's own session (the
-- authedClient() pattern) so each row is reachable only by its owner.
-- The cron uses the service-role key and bypasses RLS.
drop policy if exists reorder_subs_select_own on public.reorder_subscriptions;
drop policy if exists reorder_subs_insert_own on public.reorder_subscriptions;
drop policy if exists reorder_subs_update_own on public.reorder_subscriptions;
drop policy if exists reorder_subs_delete_own on public.reorder_subscriptions;

create policy reorder_subs_select_own on public.reorder_subscriptions
  for select using (auth.uid() = user_id);
create policy reorder_subs_insert_own on public.reorder_subscriptions
  for insert with check (auth.uid() = user_id);
create policy reorder_subs_update_own on public.reorder_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy reorder_subs_delete_own on public.reorder_subscriptions
  for delete using (auth.uid() = user_id);

-- ─── SUBSCRIBE10 coupon ─────────────────────────────────────────────────────
-- The standing subscriber discount. Unlimited per user (subscribers reorder
-- repeatedly); bounded by min_order so a leaked code stays low-impact.
-- Idempotent insert.
insert into public.coupons (
  code, type, value, discount_type,
  min_order, max_uses, usage_limit_per_user,
  active, individual_use, exclude_sale_items, free_shipping,
  description
)
select
  'SUBSCRIBE10', 'percent', 10, 'percent',
  1500, null, null,
  true, false, false, false,
  'Subscribe & Save — 10% off every reorder over PKR 1,500.'
where not exists (
  select 1 from public.coupons where upper(code) = 'SUBSCRIBE10'
);
