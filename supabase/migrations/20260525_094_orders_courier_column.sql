-- Migration 094 — add the missing orders.courier column (P1).
--
-- Cowork QA found every admin order-status update failing with:
--   Could not find the 'courier' column of 'orders' in the schema cache
--
-- updateOrderStatus() writes `.update({ status, tracking_number, courier })`
-- and the order detail page reads order.courier; the Order type has the
-- field and `tracking_number` is already a column — `courier` was simply
-- never migrated in. Add it so order fulfilment works.

alter table public.orders add column if not exists courier text;
