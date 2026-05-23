-- ============================================================================
-- Lock down the `images` storage bucket.
--
-- The bucket had `admin_insert_images` (INSERT) and `admin_delete_images`
-- (DELETE) policies on storage.objects whose only check was
-- `bucket_id = 'images'` — no authentication condition at all. That let
-- anyone holding the public anon key upload to or delete from the bucket.
--
-- Every legitimate write goes through the server upload routes
-- (/api/upload, /api/upload/review), which use the SERVICE-ROLE client and
-- therefore bypass RLS. So no non-service-role INSERT/DELETE policy is
-- needed: dropping these two policies means only the service role can
-- write or delete, while `public_read_images` keeps public read intact so
-- product/review image URLs still resolve.
-- ============================================================================

drop policy if exists admin_insert_images on storage.objects;
drop policy if exists admin_delete_images on storage.objects;
