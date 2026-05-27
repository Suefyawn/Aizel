-- ============================================================================
-- Recategorise the "Shampoo & Conditioner" junk drawer.
--
-- 234 of 410 published Hair Care products live under "Shampoo & Conditioner",
-- but a survey of their names shows the leaf was being used as a catch-all
-- for anything tagged "Hair Care" without a tighter category: hair dyes,
-- hair oils, treatments, gels, mousse, styling creams etc. were all dumped
-- in. The result is a /shop/shampoo-conditioner leaf that's mostly NOT
-- shampoo or conditioner, plus zero traffic to the other (more accurate)
-- Hair Care leaves because the products that belong there are mis-tagged.
--
-- This migration runs name-regex reclassification passes over rows that
-- currently sit in "Shampoo & Conditioner" and moves the obvious misfits
-- out into their real leaves. Each pass is name-pattern-driven and
-- conservative — combo "shampoo & conditioner SET" rows are left where
-- they are. The leaves themselves don't change (no new categories yet —
-- that's phase 2; see notes in the PR).
--
-- Idempotent: every UPDATE filters `category = 'Shampoo & Conditioner'`
-- so re-running this migration after a hand-curated edit by an operator
-- will not flip a product they just moved.
--
-- Operations are ordered by SPECIFICITY descending so the most-specific
-- pattern wins (e.g. a "Hot Oil Treatment" matches the treatments pass
-- before the generic oils pass).
-- ============================================================================

-- ── Pass 1: Hair Colour ────────────────────────────────────────────────────
-- Permanent / semi-permanent dyes, bleach, peroxide, toner, developer,
-- colour remover, temporary chalk.
update public.products
   set category = 'Hair Colour'
 where category = 'Shampoo & Conditioner'
   and status = 'published'
   and name ~* '\m(hair\s+dye|hair\s+colou?r|semi[- ]permanent|permanent\s+colou?r|toner|bleach|peroxide|colou?r\s+remover|developer|hair\s+chalk|temporary\s+colou?r)\M';

-- ── Pass 2: Relaxers & Kits ────────────────────────────────────────────────
-- Lye / no-lye relaxers, texturisers, perm kits.
update public.products
   set category = 'Relaxers & Kits'
 where category = 'Shampoo & Conditioner'
   and status = 'published'
   and name ~* '\m(relaxer|texturi[zs]er?|no[- ]?lye|lye\s+relaxer|perm\s+kit)\M';

-- ── Pass 3: Hair Treatments & Masks ────────────────────────────────────────
-- Deep conditioners, masks, reconstructors, protein, hot-oil treatments,
-- heat protectants, scalp/growth/repair treatments, hair food, hair grease,
-- hair vitalizer, hair mayonnaise / mayo, scalp oils. Specifically NOT
-- ordinary leave-in conditioners (those stay).
update public.products
   set category = 'Hair Treatments & Masks'
 where category = 'Shampoo & Conditioner'
   and status = 'published'
   and name ~* '\m(deep\s+conditioner|deep\s+treatment|hair\s+mask|hair\s+masque|reconstructor|protein\s+treatment|hot\s+oil|heat\s+protect|scalp\s+treatment|growth\s+treatment|repair\s+treatment|hair\s+food|hair\s+vitalizer|hair\s+grease|hair\s+mayonnaise|hair\s+mayo|scalp\s+oil|amla\s+(treatment|hair))\M';

-- ── Pass 4: Hair Oils & Serums ─────────────────────────────────────────────
-- Anti-frizz serums, polishers, glossifiers, silken-seal sprays, plus any
-- single-purpose oil whose name doesn't already mention shampoo /
-- conditioner / set / kit / combo (those are combo packs and stay).
update public.products
   set category = 'Hair Oils & Serums'
 where category = 'Shampoo & Conditioner'
   and status = 'published'
   and (
     name ~* '\m(serum|polisher|glossifier|silken\s+seal|frizz\s+buster|frizz\s+control|hair\s+polish|hair\s+shine\s+spray)\M'
     or (
       name ~* '\moil\M'
       and name !~* '\m(shampoo|conditioner|set|kit|combo|bundle|oil[- ]free)\M'
     )
   );

-- ── Pass 5: Edge Control & Gels ────────────────────────────────────────────
-- Edge tamers, edge control, edge gel, pomades, gellies, hair wax, hair
-- gels (excluding combos that contain a shampoo / conditioner).
update public.products
   set category = 'Edge Control & Gels'
 where category = 'Shampoo & Conditioner'
   and status = 'published'
   and (
     name ~* '\m(edge\s+control|edge\s+tamer|edge\s+gel|edge\s+booster|pomade|gellie)\M'
     or (name ~* '\mwax\M' and name !~* '\m(shampoo|conditioner)\M')
     or (name ~* '\mgel\M'  and name !~* '\m(shampoo|conditioner)\M')
   );

-- ── Pass 6: Mousse & Hairspray ─────────────────────────────────────────────
-- Mousse, hairspray / hair spray, finishing / holding spray, setting
-- lotion, sea-salt texturising spray.
update public.products
   set category = 'Mousse & Hairspray'
 where category = 'Shampoo & Conditioner'
   and status = 'published'
   and name ~* '\m(mousse|hairspray|hair\s+spray|finishing\s+spray|holding\s+spray|setting\s+lotion|sea\s+salt\s+spray)\M';

-- ── Pass 7: Curl & Styling Creams ──────────────────────────────────────────
-- Defining/curl creams, custards, puddings, styling creams, leave-in
-- creams, hair-dressing creams, generic moisturisers, detanglers
-- (detanglers live with styling creams until a Leave-In leaf exists).
update public.products
   set category = 'Curl & Styling Creams'
 where category = 'Shampoo & Conditioner'
   and status = 'published'
   and (
     name ~* '\m(curl\s+(cream|pudding|defining|custard)|styling\s+cream|defining\s+cream|moisturi[sz]er|brylcre+m|hair\s+dressing\s+cream|moisture\s+cream|leave[- ]?in\s+cream)\M'
     or name ~* '\m(detangler|detangling\s+(spray|cream|leave))\M'
   );
