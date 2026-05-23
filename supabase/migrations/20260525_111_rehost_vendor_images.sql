-- ============================================================================
-- Re-host the imported vendor product images on Yellow Pink's own storage.
--
-- The four products imported from nbsons.com (migration 110) pointed their
-- `image_url` at the vendor's Shopify CDN. The image files have now been
-- copied into this project's Supabase Storage `images` bucket; this migration
-- repoints each product at the self-hosted copy so the store no longer
-- depends on the vendor's CDN.
-- ============================================================================

update public.products set image_url = 'https://cngsjtthiexcfpjpcpsg.supabase.co/storage/v1/object/public/images/nbsons-simzee-zinc-syrup.jpg'      where slug = 'simzee-zinc-syrup';
update public.products set image_url = 'https://cngsjtthiexcfpjpcpsg.supabase.co/storage/v1/object/public/images/nbsons-hydrating-face-wash.jpg'   where slug = 'hydrating-face-wash';
update public.products set image_url = 'https://cngsjtthiexcfpjpcpsg.supabase.co/storage/v1/object/public/images/nbsons-vitamin-c-serum.jpg'       where slug = 'vitamin-c-serum';
update public.products set image_url = 'https://cngsjtthiexcfpjpcpsg.supabase.co/storage/v1/object/public/images/nbsons-rooposh-feminine-wash.jpg' where slug = 'rooposh-feminine-wash';
