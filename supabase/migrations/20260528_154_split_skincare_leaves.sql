-- ============================================================================
-- Split the single-leaf Skincare taxon into real sub-categories.
--
-- The Skincare taxon had exactly one leaf, also named "Skincare" — so the
-- storefront mega-menu rendered a pointless dropdown: "All Skincare" + a
-- duplicate "Skincare" link and nothing else. 24 products all sat in that
-- one catch-all leaf.
--
-- This migration adds four real leaves, reclassifies all 24 products by
-- name, and drops the now-empty "Skincare" leaf so the dropdown shows a
-- proper category list (Cleansers / Moisturisers / Serums / Masks) like
-- Hair Care and Body Care do.
--
-- Distribution after split: Cleansers & Face Wash 8, Moisturisers 7,
-- Serums & Treatments 6, Face Masks 3.
--
-- subcategory stays 'Skincare' (the taxon label) on every row — only the
-- leaf-level `category` changes.
-- ============================================================================

-- ── Step 1: new leaves under the skincare taxon ───────────────────────────
insert into public.categories (slug, label, description, taxon_id, sort_order)
select 'cleansers-face-wash', 'Cleansers & Face Wash',
       'Face washes, cleansing balms, astringents and exfoliating scrubs for melanin-rich skin.',
       t.id, 10
  from public.taxons t where t.key = 'skincare'
on conflict (slug) do nothing;

insert into public.categories (slug, label, description, taxon_id, sort_order)
select 'moisturisers', 'Moisturisers',
       'Daily creams and intensive moisturisers — lightweight hydration to rich nourishing formulas.',
       t.id, 20
  from public.taxons t where t.key = 'skincare'
on conflict (slug) do nothing;

insert into public.categories (slug, label, description, taxon_id, sort_order)
select 'serums-treatments', 'Serums & Treatments',
       'Targeted serums, facial oils, aloe gels and dark-spot / even-tone treatments.',
       t.id, 30
  from public.taxons t where t.key = 'skincare'
on conflict (slug) do nothing;

insert into public.categories (slug, label, description, taxon_id, sort_order)
select 'face-masks', 'Face Masks',
       'Clay, healing and soothing face masks for a weekly deep-clean or calm-down.',
       t.id, 40
  from public.taxons t where t.key = 'skincare'
on conflict (slug) do nothing;

-- ── Step 2: reclassify (order matters — most specific first) ───────────────
-- Masks first so "Aloe Vera Face Mask" doesn't get grabbed by the aloe-gel
-- serums rule.
update public.products set category = 'Face Masks'
 where category = 'Skincare' and status = 'published'
   and name ~* '\m(mask|masque|healing\s+clay|clay\s+mask)\M';

update public.products set category = 'Cleansers & Face Wash'
 where category = 'Skincare' and status = 'published'
   and name ~* '\m(cleanser|face\s+wash|cleansing|astringent|scrub|exfoliator|makeup\s+remover)\M';

update public.products set category = 'Serums & Treatments'
 where category = 'Skincare' and status = 'published'
   and name ~* '\m(serum|anti[- ]?dark\s+spot|fade\s+milk|aloe\s+vera\s+gel|baby\s+oil|active\s+serum)\M';

-- Everything still left is a moisturiser/cream — catch-all so nothing is
-- orphaned in the (about-to-be-deleted) Skincare leaf.
update public.products set category = 'Moisturisers'
 where category = 'Skincare' and status = 'published';

-- ── Step 3: drop the now-empty redundant leaf ─────────────────────────────
-- The taxon row (taxons.key='skincare', label='Skincare') stays; only the
-- leaf categories row is removed. Guarded so it only deletes when empty.
delete from public.categories c
 using public.taxons t
 where c.taxon_id = t.id
   and t.key = 'skincare'
   and c.label = 'Skincare'
   and not exists (
     select 1 from public.products p
      where p.category = 'Skincare' and p.status = 'published'
   );
