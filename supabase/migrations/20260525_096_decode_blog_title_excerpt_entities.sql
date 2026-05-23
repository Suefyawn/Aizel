-- Migration 096 — decode HTML entities in blog_posts.title + excerpt.
--
-- Cowork QA found raw entities (&#038;, &#8217;, &#8230; …) showing on blog
-- cards, post headings, and in the admin Blog editor. Migration 086 decoded
-- the `category` column; title + excerpt were missed. They render as plain
-- JSX text (not HTML), so an undecoded entity shows literally.
--
-- The post `body` is intentionally left alone — it renders via
-- dangerouslySetInnerHTML, so entities there decode correctly in the browser.
--
-- A temporary helper keeps the long replace-chain in one place.

create or replace function public.decode_wp_entities(t text) returns text
language sql immutable as $$
  select replace(replace(replace(replace(replace(replace(replace(replace(
         replace(replace(replace(replace(replace(replace(replace(replace(
         replace(replace(coalesce(t, ''),
           '&amp;',    '&'),
           '&#038;',   '&'),
           '&#8217;',  chr(8217)),
           '&#8216;',  chr(8216)),
           '&#8220;',  chr(8220)),
           '&#8221;',  chr(8221)),
           '&#8211;',  chr(8211)),
           '&#8212;',  chr(8212)),
           '&#8230;',  chr(8230)),
           '&#039;',   ''''),
           '&#39;',    ''''),
           '&quot;',   '"'),
           '&hellip;', chr(8230)),
           '&rsquo;',  chr(8217)),
           '&lsquo;',  chr(8216)),
           '&rdquo;',  chr(8221)),
           '&ldquo;',  chr(8220)),
           '&nbsp;',   ' ');
$$;

update public.blog_posts
set title   = public.decode_wp_entities(title),
    excerpt = public.decode_wp_entities(excerpt)
where title ~ '&#?[0-9a-zA-Z]+;' or excerpt ~ '&#?[0-9a-zA-Z]+;';

drop function public.decode_wp_entities(text);
