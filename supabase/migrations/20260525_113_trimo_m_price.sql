-- ============================================================================
-- Match Trimo-M's price to the vendor (nbsons.com).
--
-- A price audit against nbsons.com found Trimo-M selling on Yellow Pink at
-- ₨1,790 while the vendor lists it at ₨2,499 (with a ₨2,999 strike-through).
-- Yellow Pink lists vendor products at the vendor's price, so this brings
-- Trimo-M into line: ₨2,499 with a ₨2,999 original price.
-- ============================================================================

update public.products
set price = 2499, original_price = 2999
where wp_product_id = 2735;  -- Trimo-M
