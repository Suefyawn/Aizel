-- Analytics cache + admin-notifications extension for the Sentry/PostHog
-- dashboard. Commits the schema that was previously created in the Supabase
-- console so fresh setups are reproducible.
--
-- Three changes:
--   1. analytics_cache       — key/value JSON cache populated by refreshAnalytics()
--   2. admin_notifications.kind — widen the CHECK to allow sentry_issue + posthog_spike
--   3. analytics_meta        — tracks the most-recent Sentry issue id we've seen,
--                              so we only fire one notification per new issue

-- ─── 1. analytics_cache ────────────────────────────────────────────────────
create table if not exists public.analytics_cache (
  key         text primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table public.analytics_cache enable row level security;
-- service-role only; widgets read via the same client.
drop policy if exists "analytics_cache_service_all" on public.analytics_cache;
create policy "analytics_cache_service_all" on public.analytics_cache
  for all to service_role using (true) with check (true);

comment on table public.analytics_cache is
  'Cached Sentry / PostHog summaries keyed by name (sentry, sentry_trend, posthog, posthog_funnel, posthog_top_pages, posthog_top_events, posthog_top_referrers).';

-- ─── 2. admin_notifications kind enum ──────────────────────────────────────
-- Drop + recreate the CHECK so we can append two new kinds.
alter table public.admin_notifications drop constraint if exists admin_notifications_kind_check;
alter table public.admin_notifications add constraint admin_notifications_kind_check
  check (kind in (
    'new_order','low_stock','payment_failed','return_request','new_review','staff_added',
    'sentry_issue','posthog_spike','posthog_drop'
  ));

-- ─── 3. analytics_meta (dedup tracking) ────────────────────────────────────
-- Single-row "scratchpad" keyed by name. Used by refreshSentry() to remember
-- which issue ids it has already raised a notification for, so repeated
-- refreshes don't spam the inbox.
create table if not exists public.analytics_meta (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table public.analytics_meta enable row level security;
drop policy if exists "analytics_meta_service_all" on public.analytics_meta;
create policy "analytics_meta_service_all" on public.analytics_meta
  for all to service_role using (true) with check (true);

comment on table public.analytics_meta is
  'State for analytics refresh jobs (e.g. "seen Sentry issue ids" so we only notify on new ones).';
