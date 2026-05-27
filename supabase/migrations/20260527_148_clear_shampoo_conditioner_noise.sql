-- ============================================================================
-- Hair-care taxonomy phase 3: clear the residual noise from "Shampoo &
-- Conditioner" by:
--
--   • Adding two new Styling-taxon leaves so wigs, extensions, electricals
--     and pump bottles have a real home (Aizel chooses to widen its
--     positioning here — "Tools" + "Wigs & Extensions" — rather than
--     archive products that don't fit the old "products you apply to
--     hair" framing).
--   • Routing the remaining 29 mis-tagged products in "Shampoo &
--     Conditioner" to their correct leaves:
--       6 → Hair Treatments & Masks (escaped restructurizer / heat
--           protectant / repair-set / bond-repair-bundle patterns)
--       1 → Relaxers & Kits (ORS Olive Oil straightening kit)
--       5 → Combs & Brushes (MR brushes / rollers / curler)
--      10 → Wigs & Extensions (Blissourse + 8 Dressmaker Brazilian Hair
--           + X-Pression braiding hair)
--       4 → Hair Tools (3 Wahl/Remington/RED Kiss electricals +
--           1 MR pump bottle)
--       3 stay (Kera Care Hair Set × 2, Motions Hair Care — legitimate
--           multi-product brand combo packs)
--
-- After this migration the "Shampoo & Conditioner" leaf holds only true
-- shampoo + conditioner combo packs and the 11-leaf Hair Care nav is
-- internally consistent.
--
-- Subcategory is updated alongside category — the Styling-taxon products
-- carry `subcategory = 'Styling & Tools'` by convention.
-- ============================================================================

-- ── Step 1: add new Styling leaves ────────────────────────────────────────
-- Sort orders interleaved with the existing 10-spaced sequence
-- (10/20/30/40) so the column reads:
--   Wig & Lace Adhesives → Bonding Glue → Combs & Brushes →
--   Durags & Bonnets → Wigs & Extensions → Hair Tools.

insert into public.categories (slug, label, description, taxon_id, sort_order)
select 'wigs-extensions',
       'Wigs & Extensions',
       'Human and synthetic wigs, bundles, weaves and braiding hair — the protective-style essentials.',
       t.id,
       50
  from public.taxons t where t.key = 'styling'
on conflict (slug) do nothing;

insert into public.categories (slug, label, description, taxon_id, sort_order)
select 'hair-tools',
       'Hair Tools',
       'Hair dryers, straighteners, clippers and applicators from Wahl, Remington and Babyliss — the tools that finish the routine.',
       t.id,
       60
  from public.taxons t where t.key = 'styling'
on conflict (slug) do nothing;

-- ── Step 2: route the 6 hair treatments / repair sets / bond repair ──────
-- ApHogee Keratin Restructurizer — "restructurizer" was missed by the
-- earlier `restructuriz` pattern because `\m` requires a word-start and
-- "restructurizer" starts at a word boundary, but the migration ran on
-- the cleaned (post-146) set where this product was the only restructurizer
-- mention — explicit ID-free name match is the safest finish.
update public.products
   set category = 'Hair Treatments & Masks'
 where category = 'Shampoo & Conditioner'
   and status = 'published'
   and (
     name ilike 'ApHogee Keratin %Restructurizer%'
     or name ilike 'ApHogee Hair Repair Set%'
     or name ilike 'Cantu Thermal Shield Heat Protectant%'
     or name ilike 'Olaplex %Bundle%'
     or name ilike 'ORS HAIRepair%'
   );

-- ── Step 3: route ORS Olive Oil straightening kit ─────────────────────────
update public.products
   set category = 'Relaxers & Kits'
 where category = 'Shampoo & Conditioner'
   and status = 'published'
   and name ilike 'ORS Olive Oil Normal Hair kit%';

-- ── Step 4: route 5 brushes/rollers/curler to Combs & Brushes ────────────
-- Subcategory flips to 'Styling & Tools' so the storefront filter rail
-- shows them under the right top-level chip.
update public.products
   set category = 'Combs & Brushes',
       subcategory = 'Styling & Tools'
 where category = 'Shampoo & Conditioner'
   and status = 'published'
   and (
     name ilike 'MR Detangling % Hair Brush%'
     or name ilike 'MR Detangling Hair Brush%'
     or name ilike 'MR Soft Foam Hair Rollers%'
     or name ilike 'MR 4pcs Heatless Curling Set%'
   );

-- ── Step 5: route 10 wigs + braiding hair to new Wigs & Extensions ───────
update public.products
   set category = 'Wigs & Extensions',
       subcategory = 'Styling & Tools'
 where category = 'Shampoo & Conditioner'
   and status = 'published'
   and (
     name ilike 'Blissourse Synthetic Wig%'
     or name ilike 'Dressmaker Virgin Brazilian Hair%'
     or name ilike 'X-Pression Ultra Braid Pre-Stretched Hair%'
   );

-- ── Step 6: route 4 electricals + pump bottle to new Hair Tools leaf ─────
update public.products
   set category = 'Hair Tools',
       subcategory = 'Styling & Tools'
 where category = 'Shampoo & Conditioner'
   and status = 'published'
   and (
     name ilike 'RED by Kiss%'
     or name ilike 'Remington%Hair Straightener%'
     or name ilike 'Wahl%'
     or name ilike 'MR Foam Pump Bottle%'
   );

-- ── End: the 3 remaining noise rows (Kera Care Hair Set × 2, Motions Hair
--   Care) are legitimate multi-product combo packs and stay under the
--   "Shampoo & Conditioner" combo leaf.
