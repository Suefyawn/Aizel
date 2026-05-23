-- Corrective revoke for migration 130.
--
-- Migration 130 ran REVOKE EXECUTE ... FROM anon, authenticated, which on the
-- face of it should have closed the SEV-1 anon-RPC exposure. It did not:
-- Postgres's default GRANT EXECUTE on a new function goes to PUBLIC, and the
-- `anon` and `authenticated` roles are MEMBERS of PUBLIC. Postgres role-grant
-- evaluation gives every PUBLIC member effective EXECUTE as long as the PUBLIC
-- grant is intact; an explicit REVOKE on `anon` alone is shadowed by the
-- inherited PUBLIC grant. has_function_privilege('anon', ..., 'EXECUTE') still
-- returned true after migration 130, and the live PostgREST exploit attempt
-- still returned 200.
--
-- The correct pattern is the one used by migration 126 for
-- get_customer_order_stats: REVOKE ALL ON FUNCTION ... FROM public, anon,
-- authenticated. The FROM public clause removes the underlying grant that
-- anon/authenticated inherit; the explicit FROM anon, authenticated catches
-- any case where a per-role grant was added on top.
--
-- This migration revokes EXECUTE from PUBLIC on the same 31 functions
-- enumerated in migration 130. After this runs, anon and authenticated lose
-- effective EXECUTE; service_role is unaffected (it bypasses the grant check
-- as the Supabase service_role does).
--
-- Convention for new SECURITY DEFINER functions going forward — see
-- migration 126 for the template:
--   REVOKE ALL ON FUNCTION public.<name>(...) FROM public, anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.<name>(...) TO service_role;  -- if needed
--
-- This file is idempotent — REVOKE on an already-revoked privilege is a no-op.

REVOKE EXECUTE ON FUNCTION public.get_admin_users()                            FROM public;
REVOKE EXECUTE ON FUNCTION public.get_admin_user(uuid)                          FROM public;
REVOKE EXECUTE ON FUNCTION public.dashboard_kpis()                              FROM public;
REVOKE EXECUTE ON FUNCTION public.analytics_kpis(integer)                       FROM public;
REVOKE EXECUTE ON FUNCTION public.analytics_daily(integer)                      FROM public;
REVOKE EXECUTE ON FUNCTION public.analytics_cohort_retention(integer)           FROM public;
REVOKE EXECUTE ON FUNCTION public.analytics_orders_by_status()                  FROM public;
REVOKE EXECUTE ON FUNCTION public.analytics_rfm_segments()                      FROM public;
REVOKE EXECUTE ON FUNCTION public.analytics_top_products(integer, integer)      FROM public;
REVOKE EXECUTE ON FUNCTION public.grant_loyalty_points(uuid, integer, text, uuid, text)
                                                                                FROM public;
REVOKE EXECUTE ON FUNCTION public.redeem_loyalty_points(uuid, integer, uuid)    FROM public;
REVOKE EXECUTE ON FUNCTION public.redeem_gift_card(text, numeric, uuid)         FROM public;
REVOKE EXECUTE ON FUNCTION public.record_stock_change(
  uuid, uuid, integer, public.inventory_reason, uuid, uuid, text, text, text
)                                                                               FROM public;
REVOKE EXECUTE ON FUNCTION public.note_stock_restock()                          FROM public;
REVOKE EXECUTE ON FUNCTION public.claim_email_send(text, integer)               FROM public;
REVOKE EXECUTE ON FUNCTION public.award_points_on_delivery()                    FROM public;
REVOKE EXECUTE ON FUNCTION public.award_referral_for_user(uuid)                 FROM public;
REVOKE EXECUTE ON FUNCTION public.award_review_points()                         FROM public;
REVOKE EXECUTE ON FUNCTION public.award_welcome_points()                        FROM public;
REVOKE EXECUTE ON FUNCTION public.recalc_product_rating(uuid)                   FROM public;
REVOKE EXECUTE ON FUNCTION public.mark_abandoned_cart_recovered()               FROM public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                             FROM public;
REVOKE EXECUTE ON FUNCTION public.log_order_status_change()                     FROM public;
REVOKE EXECUTE ON FUNCTION public.notify_low_stock()                            FROM public;
REVOKE EXECUTE ON FUNCTION public.notify_new_order()                            FROM public;
REVOKE EXECUTE ON FUNCTION public.notify_new_review()                           FROM public;
REVOKE EXECUTE ON FUNCTION public.notify_payment_failed()                       FROM public;
REVOKE EXECUTE ON FUNCTION public.notify_return_request()                       FROM public;
REVOKE EXECUTE ON FUNCTION public.product_reviews_rating_sync()                 FROM public;
REVOKE EXECUTE ON FUNCTION public.sync_order_tracking_from_shipment()           FROM public;
REVOKE EXECUTE ON FUNCTION public.tg_log_activity()                             FROM public;
