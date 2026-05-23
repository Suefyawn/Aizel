-- Perf P1: the admin dashboard previously did
--   supabase.from('orders').select('total, status, items')
-- with no limit, then aggregated in JS. With every order's `items` JSONB
-- shipped to Node on every render, this degrades linearly with order
-- count. Replace with a single SQL aggregator that returns:
--   total_revenue      — sum(total) excluding cancelled, all time
--   order_count        — count(*) all time
--   status_counts      — { pending:N, processing:N, shipped:N, … }
--   top_products       — [{ id, name, brand, qty }] top-5 by qty sold
--
-- All four roll out of one orders scan in Postgres instead of pulling
-- every row into the app. Service-role only; the dashboard page is
-- itself gated on the `analytics` permission so no public exposure.

create or replace function public.dashboard_kpis()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
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
    select (item->>'id')         as id,
           (item->>'name')       as name,
           (item->>'brand')      as brand,
           coalesce((item->>'qty')::int, 0) as qty
      from public.orders o, jsonb_array_elements(o.items) item
      where status <> 'cancelled'
  ),
  top as (
    select id, name, brand, sum(qty) as qty
      from items_flat
      group by id, name, brand
      order by sum(qty) desc
      limit 5
  ),
  top_arr as (
    select coalesce(
      jsonb_agg(jsonb_build_object('id', id, 'name', name, 'brand', brand, 'qty', qty)),
      '[]'::jsonb
    ) as arr
    from top
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
$$;

revoke execute on function public.dashboard_kpis() from anon, authenticated;
grant execute on function public.dashboard_kpis() to service_role;

comment on function public.dashboard_kpis() is
  'Aggregated admin-dashboard KPIs (revenue, order_count, status_counts,
   top_products). Replaces the unbounded select * from orders the page
   did pre-2026-05-24 (audit perf P1).';
