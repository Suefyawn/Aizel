-- ============================================================================
-- Widen search_products matching: the previous WHERE clause only matched the
-- query against name + brand, so a search for a concern that lives in the
-- category, subcategory, or description (e.g. "serum") returned nothing even
-- when a relevant product existed. Now the substring match also spans
-- category / subcategory / description, with a tiered similarity score so
-- name/brand hits still rank above category hits, which rank above
-- description-only hits.
-- ============================================================================

create or replace function public.search_products(p_query text, p_limit integer default 8)
returns table (
  id          uuid,
  brand       text,
  name        text,
  slug        text,
  price       numeric,
  image_url   text,
  category    text,
  similarity  real
)
language sql
stable
security definer
set search_path = public
as $$
  with q as (select trim(p_query) as q)
  select
    p.id, p.brand, p.name, p.slug, p.price, p.image_url, p.category,
    greatest(
      similarity(p.name,  (select q from q)),
      similarity(p.brand, (select q from q)),
      case when coalesce(p.category, '')    ilike '%' || (select q from q) || '%' then 0.5  else 0 end,
      case when coalesce(p.subcategory, '') ilike '%' || (select q from q) || '%' then 0.5  else 0 end,
      case when coalesce(p.short_description, p.description, '') ilike '%' || (select q from q) || '%' then 0.35 else 0 end
    )::real as similarity
  from public.products p
  where (select q from q) <> ''
    and (
      p.name  ilike '%' || (select q from q) || '%'
      or p.brand ilike '%' || (select q from q) || '%'
      or coalesce(p.category, '')    ilike '%' || (select q from q) || '%'
      or coalesce(p.subcategory, '') ilike '%' || (select q from q) || '%'
      or coalesce(p.short_description, p.description, '') ilike '%' || (select q from q) || '%'
      or p.name  % (select q from q)
      or p.brand % (select q from q)
    )
    and (p.status is null or p.status = 'published')
  order by similarity desc, p.created_at desc nulls last
  limit greatest(1, least(p_limit, 50));
$$;
grant execute on function public.search_products(text, integer) to anon, authenticated;
