-- ============================================================================
-- Hair Care taxonomy phase 2: split the cleaned "Shampoo & Conditioner"
-- leaf into Shampoo / Conditioner / Leave-In Conditioner, and pick up the
-- 15 stragglers that phase 1's regex (migration 146) missed.
--
-- Phase 1 dropped the junk-drawer count from 234 → 115. This phase:
--
--   1. Runs a "phase 1.5" pass that catches the misses — `HairColour`
--      (no space), `oils` (plural), `restructurizer` (vs reconstructor),
--      hair grease / hair-dressing creams / scalp therapies (Blue Magic
--      Super Sure Gro, Cantu Hair Dressing Cream etc.), styling custards.
--   2. Adds three new categories rows to the taxonomy: Shampoo,
--      Conditioner, Leave-In Conditioner. Operators can edit them later
--      via the Categories CMS admin page.
--   3. Splits the remaining S&C set into Shampoo (single-purpose) /
--      Conditioner (single-purpose) / Leave-In Conditioner. Real combo
--      packs (name mentions BOTH or is a set/kit/duo) stay under the
--      "Shampoo & Conditioner" combo leaf.
--   4. Moves the 35 leave-in products that were previously routed to
--      Curl & Styling Creams (and a handful that ended up in
--      Oils & Serums / Edge Control / Mousse) into the new Leave-In leaf
--      so the leaf shows the true count from day one.
--
-- Co-Wash is intentionally NOT added — only 3 products match across the
-- whole catalogue, which isn't enough to populate a leaf. They stay
-- under Curl & Styling Creams until the catalogue grows.
-- ============================================================================

-- ── Step 1: phase 1.5 — clean the misses ──────────────────────────────────
update public.products
   set category = 'Hair Colour'
 where category = 'Shampoo & Conditioner'
   and status = 'published'
   and name ~* '\m(hair\s*colou?r|haircolou?r)\M';

update public.products
   set category = 'Hair Treatments & Masks'
 where category = 'Shampoo & Conditioner'
   and status = 'published'
   and name ~* '\m(restructuriz|hair\s+cream|hair\s+dress|hair\s+grease|growth\s+cream|scalp\s+therapy|scalp\s+(care|cream)|hair\s+&\s+scalp|hair\s+treatment|nourishing\s+cream|hair\s+strengthen)\M';

update public.products
   set category = 'Hair Oils & Serums'
 where category = 'Shampoo & Conditioner'
   and status = 'published'
   and (name ~* '\m(oils?|growth\s+oil|hair\s+oyl|healing\s+oyl)\M'
        and name !~* '\m(shampoo|conditioner|set|kit|combo|bundle|oil[- ]?free)\M');

update public.products
   set category = 'Curl & Styling Creams'
 where category = 'Shampoo & Conditioner'
   and status = 'published'
   and name ~* '\m(custard|styling\s+pudding)\M';

-- ── Step 2: add Shampoo / Conditioner / Leave-In categories ───────────────
-- Sort order interleaved with the existing 10-spaced sequence so the new
-- leaves read in product-journey order:
--   Shampoo (5) → Conditioner (7) → Shampoo & Conditioner combo (10)
--   → Leave-In Conditioner (15) → Hair Oils & Serums (20) → …
insert into public.categories (slug, label, description, taxon_id, sort_order)
select 'shampoo',
       'Shampoo',
       'Sulphate-free cleansers, clarifying shampoos and moisturising washes for every curl pattern.',
       t.id,
       5
  from public.taxons t where t.key = 'hair'
on conflict (slug) do nothing;

insert into public.categories (slug, label, description, taxon_id, sort_order)
select 'conditioner',
       'Conditioner',
       'Rinse-out conditioners — daily, weekly and deep treatments to detangle, soften and seal.',
       t.id,
       7
  from public.taxons t where t.key = 'hair'
on conflict (slug) do nothing;

insert into public.categories (slug, label, description, taxon_id, sort_order)
select 'leave-in-conditioner',
       'Leave-In Conditioner',
       'Leave-in conditioners, detangling sprays and pre-styling moisturisers — the foundation of every wash-day routine.',
       t.id,
       15
  from public.taxons t where t.key = 'hair'
on conflict (slug) do nothing;

-- ── Step 3: route leave-in products from other leaves into Leave-In ───────
-- Phase 1 sent leave-ins to Curl & Styling Creams via the detangler
-- pattern. Pull them back out. Also catches the handful that landed in
-- Hair Oils & Serums / Edge Control / Mousse.
update public.products
   set category = 'Leave-In Conditioner'
 where status = 'published'
   and subcategory = 'Hair Care'
   and category in ('Curl & Styling Creams', 'Hair Oils & Serums',
                    'Edge Control & Gels', 'Mousse & Hairspray',
                    'Shampoo & Conditioner')
   and name ~* '\mleave[- ]?in\M';

-- ── Step 4: split the remaining S&C into Shampoo / Conditioner ────────────
-- Order matters: detect combo packs FIRST so they stay under the
-- "Shampoo & Conditioner" combo leaf; only then bucket single-purpose
-- shampoos and conditioners.

-- Single-purpose Shampoo (no conditioner mention, not a set/kit)
update public.products
   set category = 'Shampoo'
 where category = 'Shampoo & Conditioner'
   and status = 'published'
   and name !~* '\mconditioner\M'
   and name !~* '\m(set|kit|duo|combo|bundle|pack\s+of|range)\M'
   and (
     name ~* '\mshampoo\M'
     or name ~* '\m(cleansing\s+(crème|creme)|clarifying\s+(cleanser|shampoo|wash))\M'
   );

-- Single-purpose Conditioner (no shampoo mention, not a set/kit)
update public.products
   set category = 'Conditioner'
 where category = 'Shampoo & Conditioner'
   and status = 'published'
   and name !~* '\mshampoo\M'
   and name !~* '\m(set|kit|duo|combo|bundle|pack\s+of|range)\M'
   and name ~* '\mconditioner\M';

-- Everything else stays in "Shampoo & Conditioner" — the leaf now only
-- holds true combo packs + a residual ~20 catalogue-junk products
-- (wigs / tools / electrical) that fall outside Aizel's hair-and-body
-- positioning. Those need a separate operator review.
