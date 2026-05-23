-- Migration 082 — backfill prices for the 22 SKUs the WP import landed at
-- price=0. Researched against Pakistani retailers (Daraz, DiscountStore,
-- Beauty Station, Makeup City, Vegas.pk, Pehnawa Wear, dvago.pk, etc.) and
-- chose a typical local retail for `original_price`, then applied a ~50%
-- promo discount for `price` to match Yellow Pink's standing 40-60% off
-- positioning. Each price is the median of ≥2 listings where possible;
-- own-label supplements (Energy Boost) fall back to a class estimate.
--
-- The guard `WHERE p.price IS NULL OR p.price = 0` makes the migration
-- idempotent — running it again after the admin has hand-edited any of
-- these rows won't overwrite their value.

WITH proposed (name, price, original_price) AS (VALUES
  ('Anastasia Beverly Hills Highlighter Glow Seeker',       7250, 14500),
  ('AquaColor Base',                                          2800, 5600),
  ('Argivital',                                               1800, 3600),
  ('Dior Blush Rosy Glow',                                   11500, 22999),
  ('Energy Boost',                                             400,   800),
  ('Fenty Beauty Diamond Bomb',                              6750, 13500),
  ('Highlighter Sticks by Pixi',                             1450,  2900),
  ('Huda Beauty Icon Liquid Lipstick',                       7350, 14700),
  ('Iconic London Liquid Highlighter',                       3500,  7000),
  ('Kiko Milano 3D Hydra Lip Gloss',                         3100,  6210),
  ('Makeup Revolution Super Dewy Liquid Blush',              1500,  3000),
  ('Milk Jelly Tints',                                       9500, 19000),
  ('NARS Afterglow Liquid Blush',                            4950,  9900),
  ('NARS Light Reflecting Foundation (All Shades)',          7500, 14963),
  ('Pixi Blush Sticks Buy 1 Get 1 Free',                     2499,  4998),
  ('Pixi LipGlow',                                           1499,  2999),
  ('Pixi On-the-Glow Blush Sticks',                          1450,  2899),
  ('Pixi On-the-Glow Bronze',                                1299,  2599),
  ('Rhode Peptide Lip Tints (All Shades)',                   3250,  6500),
  ('SHEGLAM Lip Plumper',                                    1399,  2800),
  ('SHEGLAM Liquid Blush (All Shades)',                      1395,  2790),
  ('Tarte Shape Tape Creamy Concealer',                      3450,  6900)
)
UPDATE public.products p
   SET price          = pr.price,
       original_price = pr.original_price
  FROM proposed pr
 WHERE p.name = pr.name
   AND (p.price IS NULL OR p.price = 0);
