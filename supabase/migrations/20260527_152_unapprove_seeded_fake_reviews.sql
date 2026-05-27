-- ============================================================================
-- Unapprove the 24 seeded fake product reviews so they vanish from PDPs.
--
-- All 24 rows were inserted at exactly `2026-05-26 09:19:48.440107+00`
-- (the seed batch from the earlier WordPress-style content backfill) and
-- share the same fingerprint:
--
--   • verified_purchase = false
--   • user_id IS NULL
--   • order_id IS NULL
--   • legacy_wp_comment_id IS NULL  (NOT WordPress-imported)
--
-- With zero orders in the system, there's no way any of them is a real
-- customer review. Under the UK Digital Markets, Competition and
-- Consumers Act 2024 (effective 6 April 2025) + CMA / ASA guidance,
-- displaying fabricated reviews as "approved" is unlawful — fines up
-- to 10% of global turnover. Flip `approved = false` so the PDP review
-- component hides them; the rows stay in the table for audit, and an
-- operator can re-approve real ones via the admin queue.
--
-- IDEMPOTENT — re-running on already-unapproved rows is a no-op.
-- ============================================================================

update public.product_reviews
   set approved = false
 where approved = true
   and verified_purchase = false
   and user_id is null
   and order_id is null
   and legacy_wp_comment_id is null
   and created_at = '2026-05-26 09:19:48.440107+00'::timestamptz;
