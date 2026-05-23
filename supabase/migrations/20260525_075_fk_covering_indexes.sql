-- 20260525_075_fk_covering_indexes.sql
--
-- Adds covering indexes for the 10 foreign keys the Database Linter
-- flagged as unindexed. Without an index on the referencing column,
-- joins + cascades fall back to a sequential scan as the parent table
-- grows. All ten tables are small today (≤ 50 rows in most cases) so the
-- write cost of these indexes is negligible.
--
-- Naming convention: <table>_<col>_idx — matches the rest of the schema.

begin;

create index if not exists abandoned_carts_user_id_idx
  on public.abandoned_carts (user_id);

create index if not exists coupon_redemptions_order_id_idx
  on public.coupon_redemptions (order_id);

create index if not exists coupon_redemptions_user_id_idx
  on public.coupon_redemptions (user_id);

create index if not exists gift_card_transactions_order_id_idx
  on public.gift_card_transactions (order_id);

create index if not exists gift_cards_issued_by_user_idx
  on public.gift_cards (issued_by_user);

create index if not exists loyalty_ledger_order_id_idx
  on public.loyalty_ledger (order_id);

create index if not exists products_tax_class_id_idx
  on public.products (tax_class_id);

create index if not exists province_zones_zone_id_idx
  on public.province_zones (zone_id);

create index if not exists shipping_rates_zone_id_idx
  on public.shipping_rates (zone_id);

create index if not exists stock_subscriptions_variant_id_idx
  on public.stock_subscriptions (variant_id);

commit;
