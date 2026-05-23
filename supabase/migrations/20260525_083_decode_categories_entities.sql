-- Migration 083 — decode HTML entities in categories.name + .description.
--
-- Migration 076 decoded entities in `products.category` but the `categories`
-- side table was left untouched. Result: chip buttons rendered from
-- `categories` show "Energy &amp;amp;amp; Performance" / "Heart &amp;amp;amp; Cardiovascular"
-- (the WP REST payload encoded once, the React renderer encoded again,
-- and the React string encoder also lifted the `&` to `&amp;` — three
-- layers of encoding stacked because the source string is already
-- entity-text rather than plain text).
--
-- Same regex chain as migration 076. Idempotent — the WHERE clause makes
-- it a no-op once the entities are gone.

DO $$
DECLARE
  cols text[] := ARRAY['name','description','slug'];
  col  text;
BEGIN
  FOREACH col IN ARRAY cols LOOP
    EXECUTE format($f$
      UPDATE public.categories SET %1$I =
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
