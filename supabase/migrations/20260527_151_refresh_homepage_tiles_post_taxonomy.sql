-- ============================================================================
-- Refresh the homepage CategoryTiles + EditorialDuo banners to reflect the
-- new Hair Care + Styling taxonomy from migrations 146–150.
--
-- BEFORE this migration the homepage Category rows showed:
--   Hair Care row : Shampoo & Conditioner (44 combo packs — niche),
--                   Hair Oils & Serums, Curl & Styling Creams,
--                   Edge Control & Gels
--   Body & More   : Cocoa & Shea Butter, Body Oils, Petroleum Jelly,
--                   Wig & Lace Adhesives (random fit)
--   Banner 1     : "Wash Day Essentials" thumbnail from shampoo-conditioner
--   Banner 2     : "Butters & Oils" thumbnail from cocoa-shea-butter
--
-- AFTER:
--   Hair Care row : Shampoo → Leave-In Conditioner → Hair Oils & Serums
--                   → Hair Treatments & Masks. Tells the wash-day arc and
--                   showcases the three new leaves (Shampoo + Leave-In)
--                   from migration 147.
--   Body & More   : Cocoa & Shea Butter → Body Lotions → Body Oils →
--                   Body Wash. Drops the random wig-lace-adhesives in
--                   favour of body-lotions (29 products, properly
--                   on-theme).
--   Banner 1     : thumbnail now resolves from leave-in-conditioner —
--                   on-brand for wash-day messaging vs the niche combo
--                   leaf.
--   Banner 2     : unchanged — cocoa & shea butter is the right hero.
--
-- The operator can edit any of this via /admin/settings/featured later;
-- this migration just sets sensible defaults that match the live
-- taxonomy.
-- ============================================================================

update public.homepage_content
   set category_slugs = array['leave-in-conditioner']
 where kind = 'banner_card'
   and title = 'Wash Day Essentials';

update public.homepage_content
   set category_slugs = array[
     'shampoo',
     'leave-in-conditioner',
     'hair-oils-serums',
     'hair-treatments-masks'
   ]
 where kind = 'category_row'
   and title = 'Hair Care';

update public.homepage_content
   set category_slugs = array[
     'cocoa-shea-butter',
     'body-lotions',
     'body-oils',
     'body-wash'
   ]
 where kind = 'category_row'
   and title = 'Body & More';
