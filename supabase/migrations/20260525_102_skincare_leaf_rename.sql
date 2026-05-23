-- ============================================================================
-- The Skincare taxon had a leaf category also literally named "Skincare", so
-- the shop showed a "Skincare" sub-chip nested under the "Skincare" tab.
-- Rename that catch-all leaf to "Cleansers & Treatments" (distinct from the
-- taxon, and more descriptive of what's in it — cleansers, toners, serums,
-- SPF). Also moves two foundations that were mis-filed under Skincare into
-- Face Makeup.
-- ============================================================================

update public.products set category = 'Face Makeup'
  where category = 'Skincare' and name ilike '%foundation%';

update public.products set category = 'Cleansers & Treatments'
  where category = 'Skincare';
