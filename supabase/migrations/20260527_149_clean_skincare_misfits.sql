-- ============================================================================
-- Clean the Skincare leaf of products that don't belong there.
--
-- The single "Skincare" leaf carries 33 published products, ~8 of which
-- are mis-tagged: hair-care oils mistakenly filed under Skincare, body
-- lotions / body sets filed under Skincare, plus two products
-- (household antiseptic, a ski balaclava) that don't fit Aizel's
-- positioning at all and never sold a single unit because no
-- skincare-shopper is looking for either.
--
-- This migration only RE-CATEGORISES — it does not add new leaves. With
-- 25 products surviving the cleanup, the single "Skincare" leaf is still
-- the right shape; a future migration can split it into Cleansers /
-- Moisturisers / Serums / Face Masks once the catalogue grows past ~50.
--
-- Moves:
--   • 6 → other taxon leaves (Nivea Men body set, KeraCare overnight /
--     oil moisturizer, The Miracle batana oils, Originals body lotion)
--   • 2 → archived (Dettol household antiseptic, MR Spandex balaclava —
--     out of any conceivable Aizel positioning)
-- ============================================================================

-- ── Nivea Men body set → Body Care > Body Lotions ─────────────────────────
update public.products
   set category = 'Body Lotions', subcategory = 'Body Care'
 where category = 'Skincare' and status = 'published'
   and name ilike 'Nivea Men Body Care Set%';

-- ── KeraCare Overnight Moisturizing Treatment → Hair Treatments ───────────
-- (Hair-product line; the "moisturizing treatment" is a hair mask)
update public.products
   set category = 'Hair Treatments & Masks', subcategory = 'Hair Care'
 where category = 'Skincare' and status = 'published'
   and name ilike 'Kera Care Overnight Moisturizing Treatment%';

-- ── KeraCare Oil Moisturizer → Hair Oils & Serums ────────────────────────
update public.products
   set category = 'Hair Oils & Serums', subcategory = 'Hair Care'
 where category = 'Skincare' and status = 'published'
   and name ilike 'Kera Care%Oil Moisturizer%';

-- ── The Miracle Batana Oils → Hair Oils & Serums ─────────────────────────
-- (Batana oil is the African hair-growth oil; not face skincare.)
update public.products
   set category = 'Hair Oils & Serums', subcategory = 'Hair Care'
 where category = 'Skincare' and status = 'published'
   and (
     name ilike 'The Miracle Batana Oil %ml%'
     or name ilike 'The Miracle Rosemary & Batana Oil%'
   );

-- ── The Miracle Batana Oil Butter Cream → Hair Treatments & Masks ────────
update public.products
   set category = 'Hair Treatments & Masks', subcategory = 'Hair Care'
 where category = 'Skincare' and status = 'published'
   and name ilike 'The Miracle Batana Oil Butter Cream%';

-- ── Originals Africa's Best Olive & Aloe Moisturizing Growth Lotion ─────
-- → Body Lotions (it's a body lotion despite "Growth" in name)
update public.products
   set category = 'Body Lotions', subcategory = 'Body Care'
 where category = 'Skincare' and status = 'published'
   and name ilike 'Originals Africa%Olive %Aloe Moisturizing Growth Lotion%';

-- ── Archive: Dettol Liquid (household antiseptic, no Aizel fit) ──────────
update public.products
   set status = 'archived'
 where category = 'Skincare' and status = 'published'
   and name ilike 'Dettol Liquid%';

-- ── Archive: MR Spandex Balaclava Ski Face Mask (winter clothing) ────────
update public.products
   set status = 'archived'
 where category = 'Skincare' and status = 'published'
   and name ilike 'MR Spandex Balaclava%';
