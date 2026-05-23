-- Migration 089 — post-delivery review requests.
--
-- The product_reviews table + the PDP ReviewsSection have existed for a
-- while, but nothing ever *asks* a customer to review. This adds the
-- request loop: a cron (src/app/api/cron/review-requests) finds orders
-- delivered 3–30 days ago, emails the customer a "how did it go?" nudge
-- linking each purchased product to its review form, then stamps the
-- order so it's never asked twice.
--
-- The delivery timestamp itself isn't stored on orders — it lives in
-- order_events (to_status = 'delivered'). Only the once-per-order
-- guard needs a column here.

alter table public.orders
  add column if not exists review_request_sent_at timestamptz;

comment on column public.orders.review_request_sent_at is
  'Set by the review-requests cron when the post-delivery review email '
  'is sent. NULL = not yet asked.';
