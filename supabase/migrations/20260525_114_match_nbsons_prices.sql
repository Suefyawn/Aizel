-- ============================================================================
-- Match the last three vendor products to nbsons.com pricing.
--
-- The nbsons price audit left three products a rupee off — nbsons uses
-- .99-style endings. This brings each into exact parity, including the
-- strike-through (compare-at) price:
--   Flex-4    ₨3,500 → ₨3,499  (was ₨3,700 → ₨4,500)
--   Repro-M   ₨1,300 → ₨1,299  (was ₨1,500 → ₨1,780)
--   Marixtizer  ₨250 → ₨249    (strike-through removed — nbsons has none)
-- ============================================================================

update public.products set price = 3499, original_price = 4500 where wp_product_id = 2806; -- Flex-4
update public.products set price = 1299, original_price = 1780 where wp_product_id = 2740; -- Repro-M
update public.products set price = 249,  original_price = null where wp_product_id = 2828; -- Marixtizer
