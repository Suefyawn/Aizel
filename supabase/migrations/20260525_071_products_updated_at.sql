-- products had a BEFORE UPDATE trigger (products_set_updated_at) calling
-- set_updated_at() which references NEW.updated_at — but the column was
-- never added. Every UPDATE (including the UPDATE half of an upsert)
-- failed with: record "new" has no field "updated_at".
--
-- Surfaced 2026-05-19 during WP→Supabase re-import: 50/145 products
-- landed, the rest failed on this trigger. Adding the column is the
-- right fix; the trigger function is generic and used by orders +
-- other tables that already have updated_at.

alter table public.products
  add column if not exists updated_at timestamptz not null default now();

-- Backfill prior rows so the index / sort orders aren't lopsided.
update public.products set updated_at = coalesce(created_at, now()) where updated_at is null;
