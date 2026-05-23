-- ============================================================================
-- Pages — static content pages migrated from WordPress (About, Privacy,
-- Terms, Shipping, FAQ, etc.). Mirrors the WP "page" custom post type.
-- ============================================================================

create table if not exists public.pages (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  title         text not null,
  body_html     text not null,                       -- sanitised HTML (see src/lib/sanitize.ts)
  excerpt       text,
  status        text not null default 'published' check (status in ('draft','published','archived')),
  meta_title    text,                                -- override <title>
  meta_description text,
  show_in_footer boolean not null default false,
  sort_order    integer not null default 0,
  wp_page_id    bigint unique,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists pages_status_idx on public.pages (status);

drop trigger if exists pages_set_updated_at on public.pages;
create trigger pages_set_updated_at
  before update on public.pages
  for each row execute function public.set_updated_at();

alter table public.pages enable row level security;
drop policy if exists pages_read_published on public.pages;
create policy pages_read_published on public.pages
  for select using ( status = 'published' );
