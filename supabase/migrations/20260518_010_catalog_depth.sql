-- ============================================================================
-- Catalog depth — bring the schema up to WooCommerce parity so the WP import
-- doesn't have to flatten data.
--
-- Adds:
--   • categories               — hierarchical (parent_id), with slug + image
--   • product_categories       — M2M between products and categories
--   • product_attributes       — global attributes (e.g. "Shade", "Size")
--   • attribute_values         — per-attribute term values ("Coral", "250 ml")
--   • product_variants         — per-SKU variant rows with own price/stock/image
--   • variant_attribute_values — M2M: which attribute values define each variant
--   • product_images           — multi-image gallery (variants override)
--   • product_relations        — cross-sells, upsells, related (Woo equivalents)
--   • products.kind            — 'simple' | 'variable' | 'bundle' | 'external'
--
-- All RLS read policies are public-read (catalog) — writes go through the
-- service-role key (admin / importer).
-- ============================================================================

-- ─── categories ─────────────────────────────────────────────────────────────
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid references public.categories(id) on delete set null,
  slug        text not null unique,
  name        text not null,
  description text,
  image_url   text,
  sort_order  integer not null default 0,
  -- For WC import: keep the original term_id so re-runs are idempotent.
  wp_term_id  bigint unique,
  created_at  timestamptz not null default now()
);

create index if not exists categories_parent_idx on public.categories (parent_id);
create index if not exists categories_sort_idx   on public.categories (sort_order, name);

alter table public.categories enable row level security;
drop policy if exists categories_read_all on public.categories;
create policy categories_read_all on public.categories for select using ( true );

-- ─── product_categories (M2M) ───────────────────────────────────────────────
create table if not exists public.product_categories (
  product_id   uuid not null references public.products(id)   on delete cascade,
  category_id  uuid not null references public.categories(id) on delete cascade,
  is_primary   boolean not null default false,
  primary key (product_id, category_id)
);

-- Ensure at most one primary category per product.
create unique index if not exists product_categories_one_primary
  on public.product_categories (product_id) where is_primary;

create index if not exists product_categories_category_idx on public.product_categories (category_id);

alter table public.product_categories enable row level security;
drop policy if exists product_categories_read_all on public.product_categories;
create policy product_categories_read_all on public.product_categories for select using ( true );

-- ─── product_attributes (global) ────────────────────────────────────────────
-- These are the "axes" — e.g. Shade, Size, Scent. Mirrors WC's wp_woocommerce_attribute_taxonomies.
create table if not exists public.product_attributes (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,    -- e.g. "shade", "size"
  name          text not null,           -- "Shade", "Size"
  visible_on_pdp boolean not null default true,
  usable_in_filter boolean not null default true,
  sort_order    integer not null default 0,
  wp_attribute_id bigint unique,
  created_at    timestamptz not null default now()
);

alter table public.product_attributes enable row level security;
drop policy if exists product_attributes_read_all on public.product_attributes;
create policy product_attributes_read_all on public.product_attributes for select using ( true );

-- ─── attribute_values (terms) ───────────────────────────────────────────────
create table if not exists public.attribute_values (
  id            uuid primary key default gen_random_uuid(),
  attribute_id  uuid not null references public.product_attributes(id) on delete cascade,
  slug          text not null,    -- "coral", "250-ml"
  value         text not null,    -- "Coral", "250 ml"
  color_hex     text,             -- for swatch UI (Shade attribute)
  image_url     text,             -- optional swatch image
  sort_order    integer not null default 0,
  wp_term_id    bigint,
  unique (attribute_id, slug)
);

create index if not exists attribute_values_attribute_idx on public.attribute_values (attribute_id, sort_order);
create unique index if not exists attribute_values_wp_term_unique on public.attribute_values (wp_term_id) where wp_term_id is not null;

alter table public.attribute_values enable row level security;
drop policy if exists attribute_values_read_all on public.attribute_values;
create policy attribute_values_read_all on public.attribute_values for select using ( true );

-- ─── product_variants ───────────────────────────────────────────────────────
-- Per-SKU row for variable products. Simple products store their stock on
-- products.stock and skip variants entirely.
create table if not exists public.product_variants (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references public.products(id) on delete cascade,
  sku             text unique,
  price           numeric(10,2) not null check (price >= 0),
  compare_at_price numeric(10,2),
  stock           integer not null default 0 check (stock >= 0),
  image_url       text,
  weight_grams    integer,
  enabled         boolean not null default true,
  wp_variation_id bigint unique,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists product_variants_product_idx on public.product_variants (product_id, sort_order);

drop trigger if exists product_variants_set_updated_at on public.product_variants;
create trigger product_variants_set_updated_at
  before update on public.product_variants
  for each row execute function public.set_updated_at();

alter table public.product_variants enable row level security;
drop policy if exists product_variants_read_all on public.product_variants;
create policy product_variants_read_all on public.product_variants for select using ( enabled );

-- ─── variant_attribute_values (which option(s) identify each variant) ──────
create table if not exists public.variant_attribute_values (
  variant_id          uuid not null references public.product_variants(id) on delete cascade,
  attribute_value_id  uuid not null references public.attribute_values(id) on delete cascade,
  primary key (variant_id, attribute_value_id)
);

create index if not exists variant_attribute_values_av_idx on public.variant_attribute_values (attribute_value_id);

alter table public.variant_attribute_values enable row level security;
drop policy if exists variant_attribute_values_read_all on public.variant_attribute_values;
create policy variant_attribute_values_read_all on public.variant_attribute_values for select using ( true );

-- ─── product_images ─────────────────────────────────────────────────────────
-- Multi-image gallery. The PDP shows these in order; the legacy products.image_url
-- stays as a fallback for products that have no rows here yet.
create table if not exists public.product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  variant_id  uuid references public.product_variants(id) on delete cascade, -- optional: per-variant image
  url         text not null,
  alt         text,
  sort_order  integer not null default 0,
  wp_media_id bigint,
  created_at  timestamptz not null default now()
);

create index if not exists product_images_product_idx on public.product_images (product_id, sort_order);
create index if not exists product_images_variant_idx on public.product_images (variant_id) where variant_id is not null;

alter table public.product_images enable row level security;
drop policy if exists product_images_read_all on public.product_images;
create policy product_images_read_all on public.product_images for select using ( true );

-- ─── product_relations (cross-sell / upsell / related) ─────────────────────
create table if not exists public.product_relations (
  product_id          uuid not null references public.products(id) on delete cascade,
  related_product_id  uuid not null references public.products(id) on delete cascade,
  kind                text not null check (kind in ('cross_sell','upsell','related','grouped')),
  sort_order          integer not null default 0,
  primary key (product_id, related_product_id, kind),
  check (product_id <> related_product_id)
);

create index if not exists product_relations_related_idx on public.product_relations (related_product_id, kind);

alter table public.product_relations enable row level security;
drop policy if exists product_relations_read_all on public.product_relations;
create policy product_relations_read_all on public.product_relations for select using ( true );

-- ─── products: new columns ──────────────────────────────────────────────────
alter table public.products
  add column if not exists kind            text not null default 'simple' check (kind in ('simple','variable','bundle','external')),
  add column if not exists short_description text,
  add column if not exists weight_grams    integer,
  add column if not exists status          text not null default 'published' check (status in ('draft','published','archived')),
  add column if not exists wp_product_id   bigint unique;

create index if not exists products_status_idx on public.products (status);
create index if not exists products_kind_idx   on public.products (kind);
