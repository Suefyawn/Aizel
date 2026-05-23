-- ============================================================================
-- Phase 1.5 + 1.6: Shipping zones and tax classes.
--
--   • shipping_zones    — named regions (Karachi, Lahore, Other Major, Remote…)
--   • shipping_rates    — flat rate + free-shipping threshold per zone
--   • province_zones    — map a PK province name to a zone
--   • tax_classes       — named tax rules; later linked to products.tax_class_id
--
-- Defaults seed a single nation-wide zone matching the current
-- hard-coded `FREE_SHIPPING = 2500` / `shipping = 200` logic in
-- src/sections/checkout/CheckoutPage.tsx, so behaviour doesn't change on
-- apply until the merchant edits zones in admin/settings.
-- ============================================================================

create table if not exists public.shipping_zones (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  sort_order  integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.shipping_rates (
  id                       uuid primary key default gen_random_uuid(),
  zone_id                  uuid not null references public.shipping_zones(id) on delete cascade,
  rate                     numeric(10,2) not null check (rate >= 0),
  free_shipping_threshold  numeric(10,2),                   -- null = never free
  label                    text not null default 'Standard',
  estimated_days_min       integer,
  estimated_days_max       integer,
  created_at               timestamptz not null default now()
);

-- One row per province → zone mapping. A province may belong to one zone.
create table if not exists public.province_zones (
  province  text primary key,
  zone_id   uuid not null references public.shipping_zones(id) on delete cascade
);

alter table public.shipping_zones  enable row level security;
alter table public.shipping_rates  enable row level security;
alter table public.province_zones  enable row level security;

drop policy if exists shipping_zones_read_all on public.shipping_zones;
drop policy if exists shipping_rates_read_all on public.shipping_rates;
drop policy if exists province_zones_read_all on public.province_zones;
create policy shipping_zones_read_all on public.shipping_zones for select using ( active );
create policy shipping_rates_read_all on public.shipping_rates for select using ( true );
create policy province_zones_read_all on public.province_zones for select using ( true );

-- Seed: nation-wide zone matching existing checkout defaults.
insert into public.shipping_zones (name, sort_order)
values ('Pakistan — Nationwide', 0)
on conflict (name) do nothing;

insert into public.shipping_rates (zone_id, rate, free_shipping_threshold, label, estimated_days_min, estimated_days_max)
select z.id, 200, 2500, 'Standard', 2, 5
from public.shipping_zones z
where z.name = 'Pakistan — Nationwide'
  and not exists (
    select 1 from public.shipping_rates r where r.zone_id = z.id
  );

-- Map every PK province to the default zone so checkout has a fallback.
insert into public.province_zones (province, zone_id)
select p, z.id
from public.shipping_zones z,
     unnest(array['Punjab','Sindh','KPK','Balochistan','Islamabad','AJK','Gilgit-Baltistan']) p
where z.name = 'Pakistan — Nationwide'
on conflict (province) do nothing;

-- ─── tax_classes ────────────────────────────────────────────────────────────
create table if not exists public.tax_classes (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  rate_percent numeric(5,2) not null check (rate_percent >= 0 and rate_percent <= 100),
  inclusive    boolean not null default false,         -- price already includes tax?
  created_at   timestamptz not null default now()
);

alter table public.tax_classes enable row level security;
drop policy if exists tax_classes_read_all on public.tax_classes;
create policy tax_classes_read_all on public.tax_classes for select using ( true );

-- Default: no tax (matches current behaviour). Merchant edits to GST etc.
insert into public.tax_classes (name, rate_percent, inclusive)
values ('No Tax', 0, false)
on conflict (name) do nothing;

-- Attach a default tax class column to products. Migrations are safe to re-run.
alter table public.products
  add column if not exists tax_class_id uuid references public.tax_classes(id) on delete set null;
