-- Index 3 unindexed foreign-key columns that the QA pass flagged.
-- An unindexed FK means every ON DELETE / ON UPDATE on the referenced row has
-- to seq-scan the referencing table to enforce the constraint, and JOINs from
-- the parent side are also slow.
--
-- The 4th column the advisor originally flagged (reorder_subscriptions.
-- variant_id) actually already has an index — the advisor's cache was stale —
-- so it's left out here.
--
-- IF NOT EXISTS so a fresh DB re-applying everything is idempotent if a future
-- table-creation migration ever adds these inline.

CREATE INDEX IF NOT EXISTS inventory_ledger_return_id_idx
  ON public.inventory_ledger (return_id)
  WHERE return_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS orders_vendor_id_idx
  ON public.orders (vendor_id)
  WHERE vendor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS reorder_subscriptions_product_id_idx
  ON public.reorder_subscriptions (product_id);
