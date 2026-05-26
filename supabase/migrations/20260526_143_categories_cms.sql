-- 26 May 2026: Categories CMS — move taxonomy from hardcoded constants
-- in src/lib/category-taxonomy.ts into editable rows. Two-tier model:
--
--   taxons      — top-level shop sections (Hair Care, Body Care, etc.)
--   categories  — fine-grained leaves under each taxon (Shampoo &
--                 Conditioner, Hair Oils & Serums, etc.)
--
-- Products keep their existing `category` text column (holds the canonical
-- label, e.g. 'Shampoo & Conditioner'). When an operator renames a
-- category, the rename action atomically updates both the categories row
-- AND every matching products.category row in one transaction — products
-- never silently disconnect from their taxon.
--
-- Deletes are blocked when any product is in the category (the admin
-- action returns "37 products are in this category, reassign or delete
-- them first"). That keeps the data tight without forcing a confusing
-- reassign flow at delete time.

create table if not exists public.taxons (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,         -- URL slug, e.g. 'hair'
  label       text not null,                -- display label, 'Hair Care'
  tagline     text,                         -- 'Shampoo, oils, curl & styling'
  description text,                         -- long-form for the landing page
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,         -- URL slug, 'shampoo-conditioner'
  label       text not null unique,         -- canonical label, 'Shampoo & Conditioner'
  description text,                         -- long-form for the landing page
  taxon_id    uuid not null references public.taxons(id) on delete restrict,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_categories_taxon_id on public.categories(taxon_id);

-- ── RLS ────────────────────────────────────────────────────────────────
-- Anyone can read (storefront needs to render the nav); writes go through
-- server actions using the service-role key.
alter table public.taxons      enable row level security;
alter table public.categories  enable row level security;

drop policy if exists taxons_read_all     on public.taxons;
drop policy if exists categories_read_all on public.categories;

create policy taxons_read_all     on public.taxons     for select using (true);
create policy categories_read_all on public.categories for select using (true);

-- ── Seed data ──────────────────────────────────────────────────────────
-- Mirrors the constants that lived in src/lib/category-taxonomy.ts as of
-- the migration date. Operator can edit / reorder / add / delete after.

insert into public.taxons (key, label, tagline, description, sort_order) values
  ('hair',     'Hair Care',       'Shampoo, oils, curl & styling',
   'Shampoo, conditioner, oils, curl creams, edge control and treatments from the brands UK natural-hair fans actually buy.', 1),
  ('skincare', 'Skincare',        'Cleanse, moisturise, treat',
   'Face wash, moisturisers, serums and masks for melanin-rich skin — from Neutrogena, Aloe Pura and more.', 2),
  ('body',     'Body Care',       'Butters, oils & lotions',
   'Cocoa and shea butter, body oils, lotions and petroleum jelly — deeply moisturising body essentials.', 3),
  ('styling',  'Styling & Tools', 'Wig care, lace, accessories',
   'Wig and lace adhesives, bonding glues, durags and the accessories that finish the look.', 4),
  ('grooming', 'Grooming',        'Shaving, beard, fragrance',
   'Shaving sets, beard oils, fragrance and bump treatments built for sensitive skin.', 5)
on conflict (key) do nothing;

-- Helper: insert a category by parent-key lookup.
do $$
declare
  hair_id      uuid;
  skincare_id  uuid;
  body_id      uuid;
  styling_id   uuid;
  grooming_id  uuid;
begin
  select id into hair_id     from public.taxons where key = 'hair';
  select id into skincare_id from public.taxons where key = 'skincare';
  select id into body_id     from public.taxons where key = 'body';
  select id into styling_id  from public.taxons where key = 'styling';
  select id into grooming_id from public.taxons where key = 'grooming';

  -- Hair Care leaves
  insert into public.categories (slug, label, description, taxon_id, sort_order) values
    ('shampoo-conditioner',    'Shampoo & Conditioner',
     'Sulphate-free and moisturising shampoos and conditioners for every curl pattern — from Cantu, ApHogee, Kera Care and more.', hair_id, 10),
    ('hair-oils-serums',       'Hair Oils & Serums',
     'Castor oil, Amla, argan and Jamaican Black Castor Oil — strengthen and nourish from root to tip.', hair_id, 20),
    ('curl-styling-creams',    'Curl & Styling Creams',
     'Curl-defining creams and leave-ins for soft, springy hold without crunch.', hair_id, 30),
    ('edge-control-gels',      'Edge Control & Gels',
     'Long-lasting edge control, sleeking gels and styling pomades.', hair_id, 40),
    ('hair-treatments-masks',  'Hair Treatments & Masks',
     'Protein treatments, deep conditioners and bond-repair masks for hair that''s been through it.', hair_id, 50),
    ('mousse-hairspray',       'Mousse & Hairspray',
     'Setting mousses, hairsprays and finishing products to lock the look in.', hair_id, 60),
    ('relaxers-kits',          'Relaxers & Kits',
     'Relaxer and texturiser kits — at-home application made simple.', hair_id, 70),
    ('hair-colour',            'Hair Colour',
     'Permanent and semi-permanent hair colour from Bigen, Crazy Color, Creme of Nature and more — full coverage and fade-resistant tones.', hair_id, 80)
  on conflict (slug) do nothing;

  -- Skincare leaves
  insert into public.categories (slug, label, description, taxon_id, sort_order) values
    ('skincare',               'Skincare',
     'Face wash, moisturisers, serums and masks for melanin-rich skin.', skincare_id, 10)
  on conflict (slug) do nothing;

  -- Body Care leaves
  insert into public.categories (slug, label, description, taxon_id, sort_order) values
    ('cocoa-shea-butter',      'Cocoa & Shea Butter',
     'Pure cocoa and shea butter from Palmer''s, Ghana''s Best and more — deeply nourishing for dry skin.', body_id, 10),
    ('body-oils',              'Body Oils',
     'Glow-finish body oils that hydrate without the heavy feel.', body_id, 20),
    ('body-lotions',           'Body Lotions',
     'Daily body lotions for soft, comfortable skin all day long.', body_id, 30),
    ('body-wash',              'Body Wash',
     'Moisturising shower gels and body washes that don''t strip the skin.', body_id, 40),
    ('petroleum-jelly',        'Petroleum Jelly',
     'Vaseline and pure petroleum jelly — the multi-use moisture lock.', body_id, 50)
  on conflict (slug) do nothing;

  -- Styling & Tools leaves
  insert into public.categories (slug, label, description, taxon_id, sort_order) values
    ('wig-lace-adhesives',     'Wig & Lace Adhesives',
     'Ebin Wonder Lace Bond and other strong-hold adhesives for wig install that lasts.', styling_id, 10),
    ('bonding-glue',           'Bonding Glue',
     'Salon-grade bonding glues for hair extensions and quick-weave styles.', styling_id, 20),
    ('combs-brushes',          'Combs & Brushes',
     'Wide-tooth combs, detangling brushes and styling tools.', styling_id, 30),
    ('durags-bonnets',         'Durags & Bonnets',
     'Silk and satin durags and bonnets — protect your style overnight.', styling_id, 40)
  on conflict (slug) do nothing;

  -- Grooming leaves
  insert into public.categories (slug, label, description, taxon_id, sort_order) values
    ('shaving',                'Shaving',
     'Magic Shaving Powder, razors and shave creams for a smooth, irritation-free shave.', grooming_id, 10),
    ('beard-care',             'Beard Care',
     'Beard oils, balms and conditioners — soft, sharp and well-kept.', grooming_id, 20),
    ('bump-treatments',        'Bump Treatments',
     'After-shave bump and razor-bump treatments for sensitive skin.', grooming_id, 30),
    ('fragrance',              'Fragrance',
     'Cologne, aftershave and traditional fragrances — Brut, Florida Water and more.', grooming_id, 40)
  on conflict (slug) do nothing;
end $$;
