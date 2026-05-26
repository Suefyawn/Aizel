-- Homepage content blocks — operator-managed cards + tile rows that
-- previously lived as hardcoded constants in src/app/page.tsx.
--
-- One row per block. The `kind` column picks the render shape:
--   • 'banner_card' — the big editorial card (EditorialDuo). Title +
--      subtitle + CTA + image. category_slugs[0] is an optional source
--      for the auto-picked product image when image_url is blank.
--   • 'category_row' — the small "Shop by category" tile row
--     (CategoryTiles). title is the row heading, category_slugs is the
--     ordered list of category slugs to render as tiles.
--
-- Loader: src/lib/homepage-content.ts. Admin: /admin/settings/featured.

create table if not exists public.homepage_content (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('banner_card','category_row')),
  title         text not null,
  subtitle      text,
  cta_text      text,
  cta_href      text,
  image_url     text,
  category_slugs text[] not null default '{}',
  sort_order    integer not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_homepage_content_kind_order
  on public.homepage_content(kind, sort_order)
  where active = true;

alter table public.homepage_content enable row level security;
drop policy if exists homepage_content_read_all on public.homepage_content;
create policy homepage_content_read_all on public.homepage_content for select using (true);

-- Seed: mirror the homepage as it shipped before the CMS.
insert into public.homepage_content (kind, title, subtitle, cta_text, cta_href, image_url, category_slugs, sort_order, active) values
  ('banner_card', 'Wash Day Essentials', 'Hair Care Edit', 'Shop Hair Care', '/shop?taxon=hair',
   'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=1200&q=80&auto=format&fit=crop',
   array['shampoo-conditioner'], 10, true),
  ('banner_card', 'Butters & Oils', 'Body Care Edit', 'Shop Body Care', '/shop?taxon=body',
   'https://images.unsplash.com/photo-1722933375700-e297a7996265?w=1200&q=80&auto=format&fit=crop',
   array['cocoa-shea-butter'], 20, true),
  ('category_row', 'Hair Care', null, null, null, null,
   array['shampoo-conditioner','hair-oils-serums','curl-styling-creams','edge-control-gels'], 100, true),
  ('category_row', 'Body & More', null, null, null, null,
   array['cocoa-shea-butter','body-oils','petroleum-jelly','wig-lace-adhesives'], 200, true)
on conflict do nothing;
