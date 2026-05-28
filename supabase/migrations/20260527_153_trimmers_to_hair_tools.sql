-- ============================================================================
-- Move the two RED BY KISS cordless trimmers into Hair Tools.
--
-- They were filed under Grooming > Beard Care, but their sibling product
-- (RED by Kiss Cordless Clipper) already lives in Styling > Hair Tools and
-- a shopper looking for "trimmers" alongside hair dryers + straighteners
-- expects to find them in the electricals/tools group, not buried in
-- beard care. Consolidating the electrical hair-cutting tools into one
-- leaf so Hair Tools reads as a complete category (dryers, straightener,
-- clipper, trimmers) rather than a thin four-item shelf.
--
-- Idempotent — filters by the exact source leaf + name prefix.
-- ============================================================================

update public.products
   set category = 'Hair Tools', subcategory = 'Styling & Tools'
 where category = 'Beard Care'
   and status = 'published'
   and name ilike 'RED BY KISS Precision Blade Cordless Trimmer%';
