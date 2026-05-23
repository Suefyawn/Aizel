-- ============================================================================
-- WordPress legacy ID columns + import-run log.
--
-- The importer keys every upsert on a wp_* id column (added to the
-- relevant tables) so the import is idempotent and re-runnable. The
-- wp_import_runs table is the audit log of each run.
-- ============================================================================

-- ─── Legacy columns on existing tables ──────────────────────────────────────
alter table public.profiles
  add column if not exists legacy_wp_user_id    bigint unique;

alter table public.orders
  add column if not exists legacy_wp_order_id   bigint unique,
  add column if not exists legacy_wp_customer_id bigint;

create index if not exists orders_legacy_customer_idx
  on public.orders (legacy_wp_customer_id)
  where legacy_wp_customer_id is not null;

alter table public.product_reviews
  add column if not exists legacy_wp_comment_id bigint unique;

alter table public.coupons
  add column if not exists wp_coupon_id         bigint unique;

alter table public.blog_posts
  add column if not exists wp_post_id           bigint unique;

-- ─── Import-run audit log ──────────────────────────────────────────────────
create table if not exists public.wp_import_runs (
  id            uuid primary key default gen_random_uuid(),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  -- Per-step counts. Keeps the JSON shape open since we'll add more steps.
  counts        jsonb not null default '{}'::jsonb,
  errors        jsonb not null default '[]'::jsonb,
  status        text not null default 'running' check (status in ('running','success','partial','failed'))
);

create index if not exists wp_import_runs_started_idx on public.wp_import_runs (started_at desc);

alter table public.wp_import_runs enable row level security;
-- Only the service role (importer) and authenticated staff (via admin) can read.
-- No public-read policy: rows stay invisible to anon.
