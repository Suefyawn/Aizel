-- Three tables (blog_posts, orders, site_settings) have a BEFORE UPDATE
-- trigger calling set_updated_at(), but the column itself was never
-- added. Every UPDATE (including the UPDATE half of an upsert) fails:
--   record "new" has no field "updated_at"
--
-- Migration 071 fixed products; this finishes the job for the other
-- three tables that share the trigger. Surfaced during the 2026-05-19
-- WP→Supabase re-import.

alter table public.blog_posts
  add column if not exists updated_at timestamptz not null default now();
update public.blog_posts set updated_at = coalesce(created_at, now()) where updated_at is null;

alter table public.orders
  add column if not exists updated_at timestamptz not null default now();
update public.orders set updated_at = coalesce(created_at, now()) where updated_at is null;

alter table public.site_settings
  add column if not exists updated_at timestamptz not null default now();
update public.site_settings set updated_at = coalesce(updated_at, now());
