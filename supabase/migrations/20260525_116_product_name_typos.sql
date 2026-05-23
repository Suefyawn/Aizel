-- ============================================================================
-- Cowork audit P3 — product-name fixes.
--
--  * "Hylauronic" is a misspelling of "Hyaluronic" (the benefit chips and
--    product photo already use the correct spelling).
--  * "Calin G" → "Calin-G" so the product name matches how it is written in
--    its own description and on the vendor's catalogue (NB Sons "CALIN-G").
-- ============================================================================

update public.products
set name = 'Medicated Vitamin C Face Cream with Hyaluronic Acid, Vit E'
where wp_product_id = 1785;

update public.products
set name = 'Calin-G'
where wp_product_id = 2842;
