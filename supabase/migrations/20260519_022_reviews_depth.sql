-- ============================================================================
-- Phase 3.3: Reviews depth — RPCs for helpful votes + verified-purchase
-- lookups. The columns (helpful_count, photo_urls, brand_reply) were already
-- added in 20260517_000_baseline_schema.sql; this migration adds the
-- behaviour around them.
-- ============================================================================

-- ─── Bump helpful-vote count (anon callable, idempotent per IP via app log) ─
-- The app layer dedupes by (review_id, ip) using a small Upstash key so the
-- DB function itself is intentionally trivial.
create or replace function public.bump_review_helpful(p_review_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  update public.product_reviews
    set helpful_count = helpful_count + 1
    where id = p_review_id and approved
  returning helpful_count;
$$;

grant execute on function public.bump_review_helpful(uuid) to anon, authenticated;

-- ─── Verified-purchase lookup ──────────────────────────────────────────────
-- Returns true if (email | user_id) has ever placed a non-cancelled order
-- containing this product_id. Used to flag a "Verified purchase" badge in
-- the storefront and to gate the helpful-vote button server-side.
create or replace function public.has_purchased_product(
  p_product_id uuid,
  p_email      text default null,
  p_user_id    uuid default null
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders o
    cross join lateral jsonb_array_elements(o.items) item
    where o.status not in ('cancelled','payment_pending','payment_failed','refunded')
      and (item ->> 'id')::uuid = p_product_id
      and (
        (p_user_id is not null and o.user_id = p_user_id) or
        (p_email   is not null and lower(o.email) = lower(p_email))
      )
  );
$$;

grant execute on function public.has_purchased_product(uuid, text, uuid) to anon, authenticated;

-- ─── Bookkeeping: per-review helpful vote log ──────────────────────────────
-- A lightweight table that records who voted, to prevent the same browser
-- from voting twice. Anon writes are allowed via RLS; the unique index
-- ensures idempotency.
create table if not exists public.review_helpful_votes (
  review_id uuid not null references public.product_reviews(id) on delete cascade,
  voter_key text not null,                -- hashed IP + UA from the API route
  created_at timestamptz not null default now(),
  primary key (review_id, voter_key)
);

alter table public.review_helpful_votes enable row level security;
-- No public-read; the API route writes via service role.

-- Add verified-purchase column to surface the badge fast (no per-render
-- lookups). Populated by the submission flow (action checks then writes).
alter table public.product_reviews
  add column if not exists verified_purchase boolean not null default false;

-- Add reviewer email so we can match against orders without needing a user_id.
alter table public.product_reviews
  add column if not exists reviewer_email text;
