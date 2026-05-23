-- ============================================================================
-- Sync product prices to the live WordPress / WooCommerce store.
--
-- An audit against the live WP store (wc/store/v1 API) found 22 products
-- whose price / original_price disagreed with WordPress. WP is the live,
-- selling store, so its prices are authoritative.
--
-- This migration corrects the 20 products that have a real WP price.
-- Two more — Argivital (wp 2671) and Energy Boost (wp 2687) — are unpriced
-- and not purchasable on WP, so their prices are left for the owner to set.
--
-- `original_price` is set to the WP regular price only when the product is
-- actually on sale on WP; otherwise it is cleared so the storefront shows
-- no false strike-through discount.
-- ============================================================================

update public.products set price = 4999, original_price = null where wp_product_id = 2402; -- Anastasia Beverly Hills Highlighter Glow Seeker
update public.products set price = 999,  original_price = null where wp_product_id = 2354; -- AquaColor Base
update public.products set price = 2650, original_price = null where wp_product_id = 2413; -- Dior Blush Rosy Glow
update public.products set price = 8500, original_price = null where wp_product_id = 2393; -- Fenty Beauty Diamond Bomb
update public.products set price = 2300, original_price = null where wp_product_id = 2085; -- Highlighter Sticks by Pixi
update public.products set price = 2560, original_price = null where wp_product_id = 2487; -- Huda Beauty Icon Liquid Lipstick
update public.products set price = 1999, original_price = 2999 where wp_product_id = 1892; -- Iconic London Liquid Highlighter (on sale)
update public.products set price = 3200, original_price = null where wp_product_id = 2250; -- Kiko Milano 3D Hydra Lip Gloss
update public.products set price = 899,  original_price = null where wp_product_id = 2598; -- Makeup Revolution Super Dewy Liquid Blush
update public.products set price = 1699, original_price = null where wp_product_id = 2160; -- Milk Jelly Tints
update public.products set price = 1899, original_price = 5500 where wp_product_id = 2133; -- NARS Afterglow Liquid Blush (on sale)
update public.products set price = 2899, original_price = 6999 where wp_product_id = 1969; -- NARS Light Reflecting Foundation (All Shades) (on sale)
update public.products set price = 1599, original_price = null where wp_product_id = 2094; -- Pixi Blush Sticks Buy 1 Get 1 Free
update public.products set price = 999,  original_price = null where wp_product_id = 2186; -- Pixi LipGlow
update public.products set price = 1999, original_price = 2999 where wp_product_id = 1716; -- Pixi On-the-Glow Blush Sticks (on sale)
update public.products set price = 1999, original_price = null where wp_product_id = 2240; -- Pixi On-the-Glow Bronze
update public.products set price = 2499, original_price = 2999 where wp_product_id = 1936; -- Rhode Peptide Lip Tints (All Shades) (on sale)
update public.products set price = 999,  original_price = 2999 where wp_product_id = 2445; -- SHEGLAM Lip Plumper (on sale)
update public.products set price = 1599, original_price = 3999 where wp_product_id = 1938; -- SHEGLAM Liquid Blush (All Shades) (on sale)
update public.products set price = 1599, original_price = null where wp_product_id = 2036; -- Tarte Shape Tape Creamy Concealer
