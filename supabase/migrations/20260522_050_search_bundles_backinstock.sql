-- ============================================================================
-- Phase 2.5: Typeahead / fuzzy search via pg_trgm.
-- Phase 2.6: Product bundles (kit pricing).
-- Phase 2.7: Back-in-stock subscriptions.
-- ============================================================================

-- pg_trgm is enabled in baseline. Storage extension installed by Supabase.
create extension if not exists "pg_trgm";

-- ─── search_products RPC ───────────────────────────────────────────────────
-- Returns the top N products matching a fuzzy search across brand, name,
-- and (lightly) description. Sorted by trigram similarity. Anon-callable.
create or replace function public.search_products(p_query text, p_limit integer default 8)
returns table (
  id          uuid,
  brand       text,
  name        text,
  slug        text,
  price       numeric,
  image_url   text,
  category    text,
  similarity  real
)
language sql
stable
security definer
set search_path = public
as $$
  with q as (select trim(p_query) as q)
  select
    p.id, p.brand, p.name, p.slug, p.price, p.image_url, p.category,
    greatest(
      similarity(p.name,  (select q from q)),
      similarity(p.brand, (select q from q)),
      similarity(coalesce(p.short_description, p.description, ''), (select q from q)) * 0.6
    )::real as similarity
  from public.products p
  where (select q from q) <> ''
    and (
      p.name ilike '%' || (select q from q) || '%'
      or p.brand ilike '%' || (select q from q) || '%'
      or p.name % (select q from q)
      or p.brand % (select q from q)
    )
    and (p.status is null or p.status = 'published')
  order by similarity desc, p.created_at desc nulls last
  limit greatest(1, least(p_limit, 50));
$$;
grant execute on function public.search_products(text, integer) to anon, authenticated;

-- Lower default similarity threshold so 4-char queries find products.
do $$ begin perform set_limit(0.18); exception when others then null; end $$;

-- ─── Bundles ────────────────────────────────────────────────────────────────
-- A bundle groups N products at a fixed kit price. Stored as a "bundle"
-- kind product so the existing catalog / cart machinery still applies; the
-- bundle_items table holds its contents.
create table if not exists public.bundle_items (
  bundle_product_id   uuid not null references public.products(id) on delete cascade,
  child_product_id    uuid not null references public.products(id) on delete cascade,
  qty                 integer not null default 1 check (qty > 0),
  sort_order          integer not null default 0,
  primary key (bundle_product_id, child_product_id)
);
create index if not exists bundle_items_child_idx on public.bundle_items (child_product_id);

alter table public.bundle_items enable row level security;
drop policy if exists bundle_items_read_all on public.bundle_items;
create policy bundle_items_read_all on public.bundle_items for select using ( true );

-- ─── Back-in-stock subscriptions ───────────────────────────────────────────
create table if not exists public.stock_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  email        citext not null,
  product_id   uuid not null references public.products(id) on delete cascade,
  variant_id   uuid references public.product_variants(id) on delete cascade,
  notified_at  timestamptz,
  created_at   timestamptz not null default now()
);

create unique index if not exists stock_subscriptions_unique
  on public.stock_subscriptions (email, product_id, coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index if not exists stock_subscriptions_pending_idx
  on public.stock_subscriptions (product_id, variant_id) where notified_at is null;

alter table public.stock_subscriptions enable row level security;
-- Writes go through the subscribe_back_in_stock RPC (no public-write policy).

-- ─── subscribe_back_in_stock RPC ───────────────────────────────────────────
create or replace function public.subscribe_back_in_stock(
  p_email      text,
  p_product_id uuid,
  p_variant_id uuid default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_email is null or length(trim(p_email)) = 0 then return false; end if;
  insert into public.stock_subscriptions (email, product_id, variant_id)
  values (lower(trim(p_email)), p_product_id, p_variant_id)
  on conflict do nothing;
  return true;
end $$;
grant execute on function public.subscribe_back_in_stock(text, uuid, uuid) to anon, authenticated;

-- ─── Trigger: when stock crosses 0 → positive, find pending subscriptions ──
-- We don't email from inside the trigger (transactional cost); the cron
-- handler at /api/cron/back-in-stock reads pending rows and dispatches.
-- This trigger just ensures the cron has work to find — by leaving
-- notified_at null whenever the product becomes available, the existing
-- rows are already discoverable. No-op trigger here, kept as a documentation
-- anchor.
create or replace function public.note_stock_restock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Intentional no-op. Cron handler picks up rows where notified_at is null
  -- AND the product / variant has stock > 0.
  return new;
end $$;

drop trigger if exists products_note_restock on public.products;
create trigger products_note_restock
  after update of stock on public.products
  for each row when (old.stock = 0 and new.stock > 0)
  execute function public.note_stock_restock();
