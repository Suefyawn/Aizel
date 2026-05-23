-- ============================================================================
-- Phase 3.2: Recommendation helpers.
--
-- frequently_bought_with(p_product_id, p_limit) — returns the products that
-- most often appear in the *same order* as the given product. Used by the
-- PDP "Frequently bought together" widget.
--
-- The orders.items JSONB shape is [{ id: <uuid>, qty, price, ... }, ...].
-- We unnest twice — once for the matching line, once for the co-purchased
-- lines — and count.
-- ============================================================================

create or replace function public.frequently_bought_with(
  p_product_id uuid,
  p_limit      integer default 4
) returns table (
  product_id  uuid,
  co_count    bigint
)
language sql
stable
security definer
set search_path = public
as $$
with anchor_orders as (
  -- orders that contain the anchor product
  select o.id
  from public.orders o
  cross join lateral jsonb_array_elements(o.items) item
  where o.status not in ('cancelled','payment_pending','payment_failed')
    and (item ->> 'id')::uuid = p_product_id
),
co_items as (
  -- every other product in those same orders
  select (item ->> 'id')::uuid as product_id
  from public.orders o
  cross join lateral jsonb_array_elements(o.items) item
  where o.id in (select id from anchor_orders)
    and (item ->> 'id')::uuid is not null
    and (item ->> 'id')::uuid <> p_product_id
)
select c.product_id, count(*)::bigint as co_count
from co_items c
group by c.product_id
order by co_count desc
limit greatest(1, p_limit);
$$;

grant execute on function public.frequently_bought_with(uuid, integer) to anon, authenticated;
