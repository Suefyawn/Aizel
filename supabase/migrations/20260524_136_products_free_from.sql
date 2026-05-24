-- ============================================================================
-- Products.free_from — kebab-case tokens describing what a product is
-- "free of" so the collection-page filter rail can surface a "Free from"
-- group of toggle chips.
--
-- UK Afro/textured-hair shoppers filter heavily on ingredient: a Type 4
-- low-porosity routine often skips silicones; a sensitive scalp skips
-- sulphates; pregnancy / clean-beauty skips parabens. Pinning the
-- claims to a text[] column (rather than M2M) is the right shape — small
-- closed vocabulary, never per-row variable enough to warrant a join.
--
-- Tokens (extend by adding to the CHECK below):
--   • sulphate-free
--   • silicone-free
--   • paraben-free
--   • mineral-oil-free
--   • cruelty-free
--   • vegan
--
-- Population: the admin product form (follow-up PR) will surface these as
-- a checkbox group. For now, leaving the column NULL is fine — the
-- collection filter only filters down if the shopper picks a chip.
-- ============================================================================

alter table public.products
  add column if not exists free_from text[];

-- Catch typos and rogue tokens at write-time. New tokens require both a
-- migration AND a UI change anyway, so the array is well-curated.
alter table public.products drop constraint if exists products_free_from_tokens;
alter table public.products
  add constraint products_free_from_tokens
  check (
    free_from is null
    or (
      -- Postgres array <@ checks that LEFT is a subset of RIGHT.
      free_from <@ array[
        'sulphate-free',
        'silicone-free',
        'paraben-free',
        'mineral-oil-free',
        'cruelty-free',
        'vegan'
      ]::text[]
    )
  );

-- GIN index supports the `free_from && '{sulphate-free,silicone-free}'`
-- intersection query the storefront filter issues — the filter is
-- "match every chip the user picked", which translates to a `@>` (all
-- of) operator on the same index. Either operator is sub-second at
-- six-figure catalogue volume thanks to GIN.
create index if not exists products_free_from_gin
  on public.products
  using gin (free_from);
