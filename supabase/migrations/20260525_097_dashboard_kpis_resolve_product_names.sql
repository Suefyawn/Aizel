-- Migration 097 — dashboard "Top Products" showed corrupted names.
--
-- Cowork QA saw "float on SHEGLAM Liquid Blush", "antioxidants Repro-M",
-- "mont blanc NARS …" in the dashboard Top Products widget. Root cause:
-- the order `items` JSONB snapshots have a wrong `brand` value (a shade
-- name — "Float On", "Mont Blanc" — landed in `brand`). dashboard_kpis()
-- grouped by the snapshot's id/name/brand and returned that junk.
--
-- Fix: aggregate top sellers by product id only, then resolve the *current*
-- name + brand from the products table. Order snapshots stay untouched
-- (they're records of what was sold); only the dashboard display is
-- corrected. The id regex guard keeps one malformed item id from breaking
-- the whole KPI query.

create or replace function public.dashboard_kpis()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  with revenue as (
    select coalesce(sum(total), 0) as v, count(*) as n
      from public.orders
      where status <> 'cancelled'
  ),
  counts as (
    select status, count(*) as n
      from public.orders
      group by status
  ),
  status_obj as (
    select jsonb_object_agg(status, n) as obj from counts
  ),
  items_flat as (
    select (item->>'id') as id,
           coalesce((item->>'qty')::int, 0) as qty
      from public.orders o, jsonb_array_elements(o.items) item
      where status <> 'cancelled'
  ),
  top as (
    select id, sum(qty) as qty
      from items_flat
      where id is not null and id ~ '^[0-9a-fA-F-]{36}$'
      group by id
      order by sum(qty) desc
      limit 5
  ),
  top_arr as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id',    t.id,
          'name',  coalesce(p.name, 'Unknown product'),
          'brand', p.brand,
          'qty',   t.qty
        )
        order by t.qty desc
      ),
      '[]'::jsonb
    ) as arr
    from top t
    left join public.products p on p.id = t.id::uuid
  ),
  total_orders as (
    select count(*) as n from public.orders
  )
  select jsonb_build_object(
    'total_revenue', (select v from revenue),
    'order_count',   (select n from total_orders),
    'status_counts', coalesce((select obj from status_obj), '{}'::jsonb),
    'top_products',  (select arr from top_arr)
  );
$function$;
