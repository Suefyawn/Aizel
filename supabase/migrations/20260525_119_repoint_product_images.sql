-- 109 of 113 products still had their primary `image_url` pointing at the old
-- WordPress host (yellowpink.pk/wp-content). That URL is the storefront's main
-- product image — shop tiles, cart, search, the PDP hero — and every load
-- proxied a cold fetch from the slow WP origin through Next's image optimizer,
-- which is what produced the 2-4s grey placeholders.
--
-- The gallery images (product_images) and variant images were already
-- re-hosted onto this project's Supabase Storage `images` bucket. The
-- re-hosted filename encodes the WordPress attachment id (wp/<id>-<hash>), and
-- the WooCommerce featured image is always images[0] — i.e. the first
-- product_images row by sort_order. So the primary image already exists on
-- Storage as that first gallery row; this migration just repoints `image_url`
-- at it. No file copies needed. Idempotent — re-running matches no rows.

update public.products p
set image_url = sub.url
from (
  select distinct on (product_id) product_id, url
  from public.product_images
  order by product_id, sort_order, id
) sub
where sub.product_id = p.id
  and p.image_url ilike '%yellowpink.pk%';
