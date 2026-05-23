-- Migration 086 — decode HTML entities in blog_posts user-visible columns.
-- Mirror of migration 076 (products.category) and 083 (categories.name).
-- The WP REST payload encoded `&` as `&amp;` etc., leaking into blog
-- category filters ("Health &amp; Beauty", "Allergies &amp; Immunity")
-- and titles. Same regex chain; idempotent.

DO $$
DECLARE
  cols text[] := ARRAY['category','title','excerpt'];
  col  text;
BEGIN
  FOREACH col IN ARRAY cols LOOP
    EXECUTE format($f$
      UPDATE public.blog_posts SET %1$I =
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
