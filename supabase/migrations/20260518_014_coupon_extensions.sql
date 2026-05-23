-- ============================================================================
-- Coupon rule extensions — bring the coupon model up to WooCommerce parity.
--
-- WooCommerce coupons support:
--   • per-product restrictions (whitelist / blacklist)
--   • per-category restrictions (whitelist / blacklist)
--   • per-customer email restrictions
--   • individual_use (can't combine with other coupons)
--   • exclude_sale_items
--   • usage_limit_per_user (in addition to global usage_limit)
--   • min/max spend
--   • free_shipping flag
--   • date_expires (we already have expires_at)
--
-- This migration extends our coupons table to cover all of them. The
-- application-side enforcement happens in src/lib/coupons.ts (added in
-- a follow-up commit when we wire the new fields into checkout).
-- ============================================================================

alter table public.coupons
  add column if not exists discount_type        text default 'percent'
    check (discount_type in ('percent','fixed_cart','fixed_product','free_shipping')),
  add column if not exists individual_use       boolean not null default false,
  add column if not exists exclude_sale_items   boolean not null default false,
  add column if not exists free_shipping        boolean not null default false,
  add column if not exists usage_limit_per_user integer,
  add column if not exists max_order            numeric(10,2),
  -- Whitelists / blacklists stored as arrays of ids (UUID for our products / categories).
  add column if not exists product_ids          uuid[] not null default '{}',
  add column if not exists excluded_product_ids uuid[] not null default '{}',
  add column if not exists category_ids         uuid[] not null default '{}',
  add column if not exists excluded_category_ids uuid[] not null default '{}',
  -- Email restrictions stored as a lowercase array.
  add column if not exists email_restrictions   text[] not null default '{}',
  add column if not exists description          text;

-- Per-user usage log so we can enforce usage_limit_per_user without scanning orders.
create table if not exists public.coupon_redemptions (
  id          uuid primary key default gen_random_uuid(),
  coupon_id   uuid not null references public.coupons(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  email       text,                                  -- guests
  order_id    uuid references public.orders(id) on delete set null,
  amount      numeric(10,2) not null,
  created_at  timestamptz not null default now()
);

create index if not exists coupon_redemptions_coupon_user_idx
  on public.coupon_redemptions (coupon_id, user_id);
create index if not exists coupon_redemptions_coupon_email_idx
  on public.coupon_redemptions (coupon_id, email)
  where email is not null;

alter table public.coupon_redemptions enable row level security;
-- A signed-in customer can see their own redemptions.
drop policy if exists coupon_redemptions_select_own on public.coupon_redemptions;
create policy coupon_redemptions_select_own on public.coupon_redemptions
  for select using ( auth.uid() is not null and auth.uid() = user_id );

-- Update the type-check on existing rows so 'percent' | 'fixed' still maps.
-- The Phase 1.8 migration declared coupons.type as 'percent'|'fixed'. New
-- column discount_type is preferred going forward; we keep `type` for
-- backward compatibility but it's redundant.
