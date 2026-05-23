-- Migration 126 — get_customer_order_stats: per-customer order aggregates for
-- the admin Customers list (order count, lifetime spend, last order date).
--
-- The Customers list previously showed only account fields (email / name /
-- phone / joined). This RPC lets it carry commercial signal and sort by
-- customer value. SECURITY DEFINER so the admin page can read order totals
-- without a broad grant on the RLS-locked orders table; granted to
-- service_role only — it exposes revenue data and must never reach anon.

create or replace function public.get_customer_order_stats()
returns table (
  user_id       uuid,
  order_count   bigint,
  total_spent   numeric,
  last_order_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    o.user_id,
    count(*)                                                         as order_count,
    coalesce(sum(o.total) filter (where o.status <> 'cancelled'), 0) as total_spent,
    max(o.created_at)                                                as last_order_at
  from public.orders o
  where o.user_id is not null
  group by o.user_id;
$$;

revoke all on function public.get_customer_order_stats() from public, anon, authenticated;
grant execute on function public.get_customer_order_stats() to service_role;
