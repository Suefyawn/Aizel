-- Migration 098 — re-categorise the catalogue into a clean two-pillar taxonomy.
--
-- The owner's brief: the store sells makeup AND nutraceuticals (Nazir's
-- Group inventory) and wants both pushed equally — "beauty, inside out".
-- The imported `products.category` values were a flat 21-value mix with a
-- 23-product "Human Health" dump and stray micro-buckets.
--
-- New leaf categories (18), grouped by pillar in src/lib/category-taxonomy.ts:
--   Makeup   : Lip & Cheek Tints, Face Makeup, Eyes, Highlighters, Brushes & Tools
--   Skincare : Skincare, Moisturizers, Hair Care
--   Wellness : Women's Health, Men's Health, Immunity, Bone & Joint,
--              Heart Health, Digestive & Gut, Cough & Respiratory, Kids
--   Bundles  : Combo Packs, Budget Bundles
--
-- Wellness products are re-sorted individually by what each supplement
-- actually does (read from its description), since the brand names
-- (Argivital, Fybosim, Trimo-M …) are not self-describing.

-- ── Makeup: consolidate thin buckets ───────────────────────────────────────
update public.products set category = 'Face Makeup'
  where category in ('Foundations', 'Concealers', 'Contour Sticks', 'Skin Makeup');
update public.products set category = 'Eyes'            where category = 'Eyeshadow';
update public.products set category = 'Brushes & Tools' where category = 'Brushes';

-- ── Wellness: re-sort by indication ────────────────────────────────────────
update public.products set category = 'Men''s Health'
  where name in ('Repro-M', 'Trimo-M', 'X-fit');

update public.products set category = 'Immunity'
  where name in ('Cee', 'MORR', 'Multiflux', 'Gluthic', 'Calosent');

update public.products set category = 'Bone & Joint'
  where name in ('Calin G', 'Ultrapin', 'Vit KD', 'Flex-4', 'NB Cal', 'Artibro', 'Meth D', 'Energy Boost');

update public.products set category = 'Heart Health'
  where name in ('Argivital', 'Argivital Sachet', 'Simzyme 100 mg');

update public.products set category = 'Digestive & Gut'
  where name in ('Eletcid', 'Fybosim', 'Marixtizer', 'Stevoice');

update public.products set category = 'Cough & Respiratory'
  where name in ('Finkuff', 'Pelagonium Ivy leaf', 'Simrid');

update public.products set category = 'Kids'
  where name in ('F.lium Drops', 'Kidogest Drops', 'Simdac Drops');

-- Cranblue, Citowit (urinary), Fol Chew, M-Sol Sachet, Repro F (fertility)
-- join the existing Women's Health set; everything still in a wellness
-- bucket that isn't one of the above is women's-health.
update public.products set category = 'Women''s Health'
  where name in ('Cranblue', 'Citowit', 'Fol Chew', 'M-Sol Sachet', 'Repro F')
     or category in ('Human Health', 'Health & Wellness', 'Bone Health',
                     'Immune Support', 'Brain Health', 'Energy & Performance',
                     'Heart & Cardiovascular');
