-- ============================================================================
-- Phase 6.11: Feature flags. Simple per-flag rollout: enabled, audience
-- ('all' | 'staff' | 'percent'), percent_rollout.
-- ============================================================================

create table if not exists public.feature_flags (
  key             text primary key,
  enabled         boolean not null default false,
  audience        text not null default 'all' check (audience in ('all','staff','percent')),
  percent_rollout integer not null default 0 check (percent_rollout between 0 and 100),
  description     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists feature_flags_set_updated_at on public.feature_flags;
create trigger feature_flags_set_updated_at
  before update on public.feature_flags
  for each row execute function public.set_updated_at();

alter table public.feature_flags enable row level security;
drop policy if exists feature_flags_read_all on public.feature_flags;
create policy feature_flags_read_all on public.feature_flags for select using ( true );

-- Seed a sensible default so the table isn't empty.
insert into public.feature_flags (key, enabled, audience, description) values
  ('exit_intent_modal', false, 'percent', 'Show the newsletter exit-intent modal (10%% by default once enabled).'),
  ('back_in_stock',     true,  'all',     'Show the back-in-stock email form on out-of-stock PDPs.'),
  ('reviews_photos',    true,  'all',     'Allow customers to attach photos to reviews.'),
  ('promo_banner',      true,  'all',     'Show the storefront promo banner (existing PromoBanner.tsx).')
on conflict (key) do nothing;
