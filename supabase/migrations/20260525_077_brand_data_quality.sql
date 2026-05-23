-- Migration 077 — brand column normalisation.
--
-- Problem: the WP→Supabase importer copied a WC "concern" attribute into
-- products.brand instead of the WC "brands" attribute. Result: out of
-- 109 rows, only ~32 had a real brand value (with multiple casing
-- duplicates: CeraVe + cerave, NARS + nars, PIXI + pixi) and the rest
-- carried strings like "arthritis", "bone health", "blush", "cheek tint",
-- "anti-aging", "foundation", "Couple", "Pregnancy", etc.
--
-- User-visible impact: shop-page brand filter showed "antioxidants" as
-- a brand alongside CeraVe; PDPs displayed "blush brush by Real
-- Techniques" with brand="blush brush"; JSON-LD `brand.name` was junk.
--
-- Fix: re-derive brand from the product name's prefix using a known-
-- canonical allowlist. For products without a recognisable brand prefix,
-- null the column (those are mostly Pakistani generic-name supplements
-- where there is no consumer-facing brand — they live under the
-- category instead).
--
-- We *don't* try to back-link to product_attributes/brands because the
-- variant→attribute_values join is empty for every product in the
-- catalog. The name-prefix approach reaches 100% of the products that
-- should have a brand.

-- Step 0: brand can legitimately be NULL for own-label Pakistani
-- supplements that don't have a consumer-facing brand. Drop the
-- NOT NULL constraint before the bulk update.
ALTER TABLE public.products ALTER COLUMN brand DROP NOT NULL;

-- Step 1: derive canonical brand from the name prefix.
WITH canonical_brand_patterns(canonical, pattern, priority) AS (
  VALUES
    -- Longer-prefix brands first (priority 10 wins over 20).
    ('Anastasia Beverly Hills', '^anastasia\s',                  10),
    ('Makeup Revolution',       '^makeup\s+revolution\s',        10),
    ('Real Techniques',         '^real\s+techniques\s',          10),
    ('Iconic London',           '^iconic\s+london\s',            10),
    ('Kiko Milano',             '^kiko\s+milano\s',              10),
    ('Fenty Beauty',            '^fenty\s+beauty\s',             10),
    ('Glow Recipe',             '^glow\s+recipe\s',              10),
    ('Huda Beauty',             '^huda\s+beauty\s',              10),
    ('Rare Beauty',             '^rare\s+beauty\s',              10),
    ('The Ordinary',            '^the\s+ordinary\s',             10),
    -- Short, distinctive prefixes.
    ('CeraVe',                  '^cerave(\s|$)',                 20),
    ('PIXI',                    '^pixi(\s|$)',                   20),
    ('NARS',                    '^nars(\s|$)',                   20),
    ('SHEGLAM',                 '^sheglam(\s|$)',                20),
    ('DRMTLGY',                 '^drmtlgy(\s|$)',                20),
    ('Skin1004',                '^skin1004(\s|$)',               20),
    ('Dior',                    '^dior(\s|$)',                   20),
    ('Rhode',                   '^rhode(\s|$)',                  20),
    ('Tarte',                   '^tarte(\s|$)',                  20),
    ('Christine',               '^christine(\s|$)',              20),
    ('Argivital',               '^argivital(\s|$)',              20)
),
suffix_patterns(canonical, pattern, priority) AS (
  VALUES
    ('Real Techniques', '\bby\s+real\s+techniques\b', 30),
    ('PIXI',            '\bby\s+pixi\b',              30),
    ('NARS',            '\bby\s+nars\b',              30)
),
all_patterns AS (
  SELECT * FROM canonical_brand_patterns
  UNION ALL
  SELECT * FROM suffix_patterns
),
resolved AS (
  SELECT
    p.id,
    (
      SELECT canonical
        FROM all_patterns
       WHERE lower(p.name) ~ pattern
       ORDER BY priority
       LIMIT 1
    ) AS new_brand
  FROM public.products p
)
UPDATE public.products p
   SET brand = r.new_brand
  FROM resolved r
 WHERE p.id = r.id
   AND p.brand IS DISTINCT FROM r.new_brand;

-- Step 2: covering index on lower(brand) for shop-page filter.
CREATE INDEX IF NOT EXISTS products_brand_lower_idx
  ON public.products (lower(brand))
  WHERE brand IS NOT NULL;
