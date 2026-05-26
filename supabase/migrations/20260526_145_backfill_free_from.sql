-- ============================================================================
-- Backfill products.free_from from product copy + brand defaults.
--
-- Migration 136 added the column with no population path — the admin
-- product form's checkbox group was deferred — so every existing row
-- carries free_from=NULL and the storefront's "Free from" filter chips
-- match nothing. This migration mirrors the heuristic that lives in
-- src/lib/free-from.ts (deriveFreeFromClaims) in SQL so the live catalogue
-- gets a sensible first-pass tagging without an operator review queue.
--
-- The CollectionPage rail also self-prunes chips that match zero products
-- in the current view (see the freeFromAvailable computation in the same
-- file), so any token this backfill misses will simply hide rather than
-- mislead the shopper.
--
-- IDEMPOTENT: only touches rows where free_from is NULL or empty, so an
-- operator who later curates a SKU through the (forthcoming) admin form
-- won't have their hand-tagged claims overwritten on a re-run.
-- ============================================================================

with src as (
  select id,
         lower(
           coalesce(name, '') || ' ' ||
           coalesce(short_description, '') || ' ' ||
           coalesce(description, '') || ' ' ||
           coalesce(ingredients, '')
         ) as text,
         lower(coalesce(brand, '')) as brand,
         lower(coalesce(category, '')) as cat
    from public.products
   where free_from is null
      or array_length(free_from, 1) is null
),
derived as (
  select id,
         -- Build a candidate array per row; NULL slots get removed below
         -- so distinct claims survive. Patterns mirror deriveFreeFromClaims
         -- in src/lib/free-from.ts byte-for-byte where Postgres POSIX regex
         -- allows; `\y` is the Postgres-specific word-boundary metachar
         -- (POSIX `\b` is backspace, not boundary).
         array_remove(array[
           case when text ~* '(sulphate|sulfate)[ -]?free|no sulph?ates|without sulph?ates' then 'sulphate-free' end,
           case when text ~* 'silicone[ -]?free|no silicones?|without silicones?'           then 'silicone-free' end,
           case when text ~* 'paraben[ -]?free|no parabens|without parabens'                then 'paraben-free' end,
           case when text ~* 'mineral[ -]?oil[ -]?free|no mineral oil|without mineral oil'  then 'mineral-oil-free' end,
           case when text ~* 'cruelty[ -]?free|not tested on animals'                       then 'cruelty-free' end,
           case when text ~* '\yvegan\y'                                                    then 'vegan' end,
           -- Brand / category defaults (loose, demo-grade). Operators can
           -- override per-SKU once the admin form ships.
           case when brand = 'cantu'   and cat like '%curl%' then 'sulphate-free'    end,
           case when brand = 'cantu'   and cat like '%curl%' then 'mineral-oil-free' end,
           case when brand = 'as i am'                       then 'sulphate-free'    end,
           case when brand = 'as i am'                       then 'paraben-free'     end
         ]::text[], null) as claims
    from src
)
update public.products p
   set free_from = (
         select array(select distinct unnest(d.claims))
           from derived d
          where d.id = p.id
       )
  from derived d
 where p.id = d.id
   and array_length(d.claims, 1) > 0;
