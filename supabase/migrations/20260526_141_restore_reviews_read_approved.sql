-- Restore the storefront's anon SELECT policy on product_reviews.
--
-- Migration 20260525_073_security_hardening.sql intended to drop legacy
-- duplicate policies (the quoted "public read blog_posts" / "public read
-- products" variants). It also dropped `reviews_read_approved` and
-- `reviews_insert_any`, but those WERE the canonical baseline-migration
-- policies on product_reviews, not duplicates. The drop went through
-- but the recreate didn't, leaving product_reviews with RLS enabled and
-- no SELECT policy = deny-all from anon.
--
-- Result: every PDP's review fetch returned [] under the anon storefront
-- client even though the rows existed. The product card showed cached
-- aggregate counts (rating / review_count columns on products are
-- populated by trigger and the products table HAS a read-all policy),
-- but the PDP couldn't read the actual review rows. End-user impression:
-- "this product says 12 reviews but the page shows none".
--
-- An `"insert own review"` policy was added later (visible in pg_policies)
-- so writes work; this migration only restores the SELECT half.

drop policy if exists reviews_read_approved on public.product_reviews;
create policy reviews_read_approved on public.product_reviews
  for select using (approved = true);
