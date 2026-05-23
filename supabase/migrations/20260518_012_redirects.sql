-- ============================================================================
-- 301 redirect table — preserves SEO juice from the old WordPress URLs.
--
-- The middleware (src/proxy.ts) checks this table on cache miss whenever a
-- request would otherwise 404. Hits return a 301 Moved Permanently to the
-- new URL.
--
-- Sources:
--   • automatic — built from every WP product/category/page/post during
--     the importer run (old slug → new slug)
--   • manual    — admin-curated rules (e.g. campaign URLs)
-- ============================================================================

create table if not exists public.redirects (
  id           uuid primary key default gen_random_uuid(),
  from_path    text not null unique,             -- "/product/old-slug" (leading slash, no host)
  to_path      text not null,                    -- "/product/new-slug"
  status_code  integer not null default 301 check (status_code in (301, 302, 307, 308)),
  source       text not null default 'manual' check (source in ('manual','wp_import','admin')),
  hit_count    integer not null default 0,
  created_at   timestamptz not null default now()
);

-- Fast path lookup is by exact from_path; the unique index above covers it.

alter table public.redirects enable row level security;
-- Public read so the (anon-keyed) middleware can resolve a hit.
drop policy if exists redirects_read_all on public.redirects;
create policy redirects_read_all on public.redirects for select using ( true );

-- Touch hit_count from middleware after a redirect fires (best-effort,
-- ignored under load) via a SECURITY DEFINER bump function.
create or replace function public.bump_redirect_hit(p_from_path text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.redirects set hit_count = hit_count + 1 where from_path = p_from_path;
$$;

grant execute on function public.bump_redirect_hit(text) to anon, authenticated;
