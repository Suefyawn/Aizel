-- Lock down SECURITY DEFINER functions from anon / authenticated.
--
-- Postgres grants EXECUTE to PUBLIC by default on every new function, and our
-- SECURITY DEFINER helpers rely on that grant being intact. Supabase exposes
-- every public.* function as a PostgREST RPC endpoint callable with the
-- anon key — which is, by design, embedded in the storefront's client JS and
-- therefore readable by anyone with devtools. That meant 46 of 47 functions
-- (every one except the new get_customer_order_stats) were callable by
-- strangers on the internet. Some were intentional (the storefront calls
-- place_order, search_products, lookup_order, etc. via the anon client);
-- many were not — get_admin_users dumped every customer's PII, grant_loyalty_points
-- minted store credit, analytics_* leaked revenue.
--
-- This migration revokes EXECUTE on every function not used by the public
-- storefront. The matching code change (admin/users + admin/analytics) switches
-- the two admin pages that used to call these via the anon client over to
-- supabaseAdmin() / service-role, which is unaffected by REVOKE.
--
-- Convention going forward: every new SECURITY DEFINER function should ship
-- with a REVOKE EXECUTE ... FROM public, anon, authenticated immediately after
-- its CREATE. See get_customer_order_stats (migration 126) for the pattern.

-- Tier 1 — PII / admin-data exposure
REVOKE EXECUTE ON FUNCTION public.get_admin_users()                            FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_admin_user(uuid)                          FROM anon, authenticated;

-- Tier 2 — business / revenue analytics
REVOKE EXECUTE ON FUNCTION public.dashboard_kpis()                              FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.analytics_kpis(integer)                       FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.analytics_daily(integer)                      FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.analytics_cohort_retention(integer)           FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.analytics_orders_by_status()                  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.analytics_rfm_segments()                      FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.analytics_top_products(integer, integer)      FROM anon, authenticated;

-- Tier 3 — value-bearing / integrity-critical actions
REVOKE EXECUTE ON FUNCTION public.grant_loyalty_points(uuid, integer, text, uuid, text)
                                                                                FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.redeem_loyalty_points(uuid, integer, uuid)    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.redeem_gift_card(text, numeric, uuid)         FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_stock_change(
  uuid, uuid, integer, public.inventory_reason, uuid, uuid, text, text, text
)                                                                               FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.note_stock_restock()                          FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_email_send(text, integer)               FROM anon, authenticated;

-- Tier 4 — internal helpers (defence in depth)
REVOKE EXECUTE ON FUNCTION public.award_points_on_delivery()                    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_referral_for_user(uuid)                 FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_review_points()                         FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_welcome_points()                        FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_product_rating(uuid)                   FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_abandoned_cart_recovered()               FROM anon, authenticated;

-- Tier 5 — trigger functions (anon RPC calls mostly error, but principle of
-- least privilege still applies; trigger fires unaffected because triggers
-- run with the table owner's privileges, not the calling role's).
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                             FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_order_status_change()                     FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_low_stock()                            FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_order()                            FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_review()                           FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_payment_failed()                       FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_return_request()                       FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.product_reviews_rating_sync()                 FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_order_tracking_from_shipment()           FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_log_activity()                             FROM anon, authenticated;

-- INTENTIONALLY NOT REVOKED — these are called by the storefront via the anon
-- client and must remain anon-executable:
--   place_order, search_products, lookup_order, lookup_coupon,
--   validate_gift_card, validate_referral_code,
--   capture_abandoned_cart, restore_abandoned_cart, subscribe_back_in_stock,
--   bump_review_helpful, bump_redirect_hit, frequently_bought_with,
--   has_purchased_product, claim_guest_orders, generate_referral_code.
