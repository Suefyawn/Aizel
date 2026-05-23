-- ============================================================================
-- Baseline schema (Phase 1.8): commits the schema that until now only existed
-- in the Supabase dashboard.
--
-- Every CREATE uses `IF NOT EXISTS` and every ALTER is idempotent so this can
-- be applied to a database that already has these tables (production) or to a
-- fresh database (preview branch / local dev).
--
-- Apply with: supabase db push   (or Supabase Studio → SQL Editor)
-- ============================================================================

-- ─── Extensions ─────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";          -- gen_random_uuid()
create extension if not exists "pg_trgm";           -- fuzzy product search (Phase 2.5)
create extension if not exists "citext";            -- case-insensitive email columns

-- ─── profiles ───────────────────────────────────────────────────────────────
-- Mirror of auth.users with our customer profile fields. Created via trigger
-- on auth.user insert so every signed-up user has a row.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  first_name  text,
  last_name   text,
  phone       text,
  dob         date,                                  -- birthday rewards (Phase 4.6)
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- A profile is readable & writable only by its owner.
drop policy if exists profiles_select_own  on public.profiles;
drop policy if exists profiles_update_own  on public.profiles;
drop policy if exists profiles_insert_own  on public.profiles;
create policy profiles_select_own on public.profiles
  for select using ( auth.uid() = id );
create policy profiles_update_own on public.profiles
  for update using ( auth.uid() = id );
create policy profiles_insert_own on public.profiles
  for insert with check ( auth.uid() = id );

-- Auto-create profile on signup. (Safe to re-run.)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, auth
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── products ───────────────────────────────────────────────────────────────
create table if not exists public.products (
  id              uuid primary key default gen_random_uuid(),
  brand           text not null,
  name            text not null,
  variant         text,
  price           numeric(10,2) not null check (price >= 0),
  original_price  numeric(10,2) check (original_price is null or original_price >= 0),
  category        text not null,
  subcategory     text,
  tag             text,                              -- New | Sale | Bestseller | Featured | Limited
  slug            text not null unique,
  stock           integer not null default 0 check (stock >= 0),
  image_url       text,
  description     text,
  how_to_use      text,
  ingredients     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists products_category_idx     on public.products (category);
create index if not exists products_subcategory_idx  on public.products (subcategory);
create index if not exists products_tag_idx          on public.products (tag) where tag is not null;
create index if not exists products_created_idx      on public.products (created_at desc);
-- Trigram index powers fuzzy search later (Phase 2.5).
create index if not exists products_name_trgm_idx    on public.products using gin (name gin_trgm_ops);
create index if not exists products_brand_trgm_idx   on public.products using gin (brand gin_trgm_ops);

alter table public.products enable row level security;
-- Anyone can read products (storefront catalog).
drop policy if exists products_read_all on public.products;
create policy products_read_all on public.products for select using ( true );

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ─── blog_posts ─────────────────────────────────────────────────────────────
create table if not exists public.blog_posts (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  title       text not null,
  excerpt     text not null,
  category    text not null,
  date        date not null,
  read_time   text not null default '3 min read',
  featured    boolean not null default false,
  body        text,
  image_url   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists blog_posts_date_idx     on public.blog_posts (date desc);
create index if not exists blog_posts_featured_idx on public.blog_posts (featured) where featured;

alter table public.blog_posts enable row level security;
drop policy if exists blog_posts_read_all on public.blog_posts;
create policy blog_posts_read_all on public.blog_posts for select using ( true );

drop trigger if exists blog_posts_set_updated_at on public.blog_posts;
create trigger blog_posts_set_updated_at
  before update on public.blog_posts
  for each row execute function public.set_updated_at();

-- ─── coupons ────────────────────────────────────────────────────────────────
create table if not exists public.coupons (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  type        text not null check (type in ('percent','fixed')),
  value       numeric(10,2) not null check (value > 0),
  min_order   numeric(10,2) not null default 0,
  max_uses    integer,
  used_count  integer not null default 0,
  active      boolean not null default true,
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);

alter table public.coupons enable row level security;
-- Anon can read active coupons for the checkout-side validation lookup
-- (CheckoutPage.tsx does .from('coupons').select('*').eq('code',...).eq('active',true).single()).
-- This is acceptable because coupon codes aren't secrets — but we explicitly
-- restrict to active coupons to avoid leaking expired/internal codes.
drop policy if exists coupons_read_active on public.coupons;
create policy coupons_read_active on public.coupons
  for select using ( active = true );

-- ─── orders ─────────────────────────────────────────────────────────────────
-- NOTE: `status` enum is widened in 20260517_001_order_state_machine.sql to
-- include payment_pending / payment_failed / refunded / returned.
create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  order_number    text not null unique,
  user_id         uuid references auth.users(id) on delete set null,
  email           text,
  first_name      text not null,
  last_name       text not null,
  phone           text not null,
  address         text not null,
  city            text not null,
  province        text,
  zip             text,
  pay_method      text not null check (pay_method in ('cod','card','bank','jazzcash','easypaisa','gift_card')),
  subtotal        numeric(10,2) not null,
  shipping        numeric(10,2) not null default 0,
  total           numeric(10,2) not null,
  items           jsonb not null,
  status          text not null default 'pending',
  tracking_number text,
  courier         text,
  coupon_code     text,
  discount_amount numeric(10,2) not null default 0,
  notes           text,                              -- admin internal notes
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists orders_user_id_idx     on public.orders (user_id) where user_id is not null;
create index if not exists orders_status_idx      on public.orders (status);
create index if not exists orders_created_at_idx  on public.orders (created_at desc);
create index if not exists orders_phone_idx       on public.orders (phone);

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

alter table public.orders enable row level security;

-- Owners can read their own orders; service role bypasses RLS for admin.
drop policy if exists orders_select_own on public.orders;
create policy orders_select_own on public.orders
  for select using ( auth.uid() is not null and auth.uid() = user_id );

-- The /track flow uses the anon key but server-side enforces order_number +
-- phone match. We allow read-anon explicitly only via a SECURITY DEFINER
-- function (see 20260517_004_order_lookup.sql) — no broad anon select policy.

-- ─── product_reviews ────────────────────────────────────────────────────────
create table if not exists public.product_reviews (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,
  order_id      uuid references public.orders(id) on delete set null,
  author_name   text not null,
  rating        integer not null check (rating between 1 and 5),
  body          text not null,
  approved      boolean not null default false,
  -- Phase 3.3: photo URLs (Supabase Storage); helpful_count; brand reply.
  photo_urls    text[] not null default '{}',
  helpful_count integer not null default 0,
  brand_reply   text,
  created_at    timestamptz not null default now()
);

create index if not exists product_reviews_product_idx  on public.product_reviews (product_id) where approved;
create index if not exists product_reviews_user_idx     on public.product_reviews (user_id) where user_id is not null;

alter table public.product_reviews enable row level security;
drop policy if exists reviews_read_approved on public.product_reviews;
create policy reviews_read_approved on public.product_reviews
  for select using ( approved = true );
drop policy if exists reviews_insert_any on public.product_reviews;
create policy reviews_insert_any on public.product_reviews
  for insert with check ( true );  -- moderation gate is `approved=false`

-- ─── site_settings ──────────────────────────────────────────────────────────
create table if not exists public.site_settings (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);

alter table public.site_settings enable row level security;
-- Anyone can read settings (the layout reads them at request time).
drop policy if exists site_settings_read_all on public.site_settings;
create policy site_settings_read_all on public.site_settings for select using ( true );

drop trigger if exists site_settings_set_updated_at on public.site_settings;
create trigger site_settings_set_updated_at
  before update on public.site_settings
  for each row execute function public.set_updated_at();

-- Default settings (insert-only if missing — won't clobber prod values).
insert into public.site_settings (key, value) values
  ('store_name',        'Yellow Pink'),
  ('store_email',       'hello@yellowpink.pk'),
  ('store_phone',       ''),
  ('currency',          'PKR'),
  ('free_shipping_threshold', '2500'),
  ('default_shipping_rate',   '200'),
  ('tax_rate_percent',  '0'),
  ('tax_inclusive',     'false')
on conflict (key) do nothing;
