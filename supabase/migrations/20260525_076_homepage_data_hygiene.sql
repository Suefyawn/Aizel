-- Migration 076 — homepage data hygiene.
--
-- Problems found post WP-import:
-- 1. Tag-based homepage queries returned 0 rows (no product had `tag`
--    populated — WC stores tags in a join table, not a single-column
--    enum). Replacing with column-based feature flags so editorial
--    curation lives on the row.
-- 2. 26 product rows still carry HTML entities ('&amp;', '&#39;', etc.)
--    from the WC REST payload — they leaked into category/subcategory/
--    name/brand. Decoding them here so the storefront doesn't have to
--    decode at render time.
-- 3. The flat `category` column has a mix of real categories and the
--    handful of values the new nav taxonomy will group ("Lip & Cheek
--    Tints", "Human Health", etc). Leaving as-is — the taxonomy lives
--    in app code (TAXON_MAP), not the DB, so editors can re-shuffle
--    without a migration.

-- 1. Add editorial feature flags
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_featured    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_bestseller  boolean NOT NULL DEFAULT false;

-- Partial indexes so the homepage queries land on a tiny index instead
-- of the full table. Each section pulls ≤8 rows, so the index reads in
-- a single page.
CREATE INDEX IF NOT EXISTS products_is_featured_idx
  ON public.products (created_at DESC) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS products_is_bestseller_idx
  ON public.products (created_at DESC) WHERE is_bestseller = true;

-- 2. Decode common HTML entities in user-visible string columns.
-- Restricted to the entities we actually saw in the import payload
-- (&amp; / &#39; / &quot; / &lt; / &gt; / &nbsp; / &rsquo; / &lsquo;).
DO $$
DECLARE
  cols text[] := ARRAY['category','subcategory','name','brand','description','short_description'];
  col  text;
BEGIN
  FOREACH col IN ARRAY cols LOOP
    EXECUTE format($f$
      UPDATE public.products SET %1$I =
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(
                  regexp_replace(
                    regexp_replace(
                      regexp_replace(%1$I, '&amp;',   '&', 'g'),
                                                     '&#39;',  '''', 'g'),
                                                     '&quot;', '"',  'g'),
                                                     '&lt;',   '<',  'g'),
                                                     '&gt;',   '>',  'g'),
                                                     '&nbsp;', ' ',  'g'),
                                                     '&rsquo;', '''', 'g'),
                                                     '&lsquo;', '''', 'g')
      WHERE %1$I ~ '&(amp|#39|quot|lt|gt|nbsp|rsquo|lsquo);';
    $f$, col);
  END LOOP;
END $$;

-- 3. Backfill bestseller / featured for the post-WP-import dataset.
--    Bestseller = ~8 popular picks across major categories with deep
--    discounts (the homepage "Bestsellers" rail). The mix is curated to
--    span the catalog instead of stacking from one category.
WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY category
    ORDER BY
      CASE WHEN original_price IS NOT NULL AND original_price > price
           THEN (original_price - price)::float / original_price
           ELSE 0
      END DESC,
      stock DESC
  ) AS rn,
  category
  FROM public.products
  WHERE status = 'published'
    AND category IN ('Lip & Cheek Tints','Skincare','Highlighters',
                     'Moisturizers','Human Health','Women''s Health',
                     'Bone Health','Brushes')
)
UPDATE public.products p SET is_bestseller = true
  FROM ranked r
  WHERE p.id = r.id AND r.rn = 1;

-- Featured = the 6 most visually striking landing-page picks. Mirror
-- bestseller heuristic but rank by second-best item per beauty-leaning
-- category so the two rails don't overlap.
WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY category
    ORDER BY
      CASE WHEN original_price IS NOT NULL AND original_price > price
           THEN (original_price - price)::float / original_price
           ELSE 0
      END DESC,
      stock DESC
  ) AS rn,
  category
  FROM public.products
  WHERE status = 'published'
    AND category IN ('Lip & Cheek Tints','Skincare','Highlighters',
                     'Skin Makeup','Foundations','Brushes')
)
UPDATE public.products p SET is_featured = true
  FROM ranked r
  WHERE p.id = r.id AND r.rn = 2;
