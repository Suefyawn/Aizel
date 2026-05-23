-- Migration 080 — extend inventory_reason enum with 'cancellation'.
--
-- Order-cancelled is a distinct stock event from a customer return:
-- the goods never shipped, the customer doesn't return anything, but
-- the products.stock was decremented at place_order time and now needs
-- to be reversed. Using 'return' for cancellations conflates two
-- different operations in the /admin/inventory filter chips and
-- breaks the trail when a real return DOES happen later.

ALTER TYPE public.inventory_reason ADD VALUE IF NOT EXISTS 'cancellation';
