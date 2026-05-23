-- ============================================================================
-- Phase 5.4: Analytics views + RPCs powering /admin/analytics.
--
-- All views exclude cancelled / payment_failed / payment_pending orders
-- since those didn't represent revenue. Refunded orders count as zero.
-- ============================================================================

create or replace view public.v_orders_revenue as
select
  o.id,
  o.created_at,
  case when o.status = 'refunded' then 0 else o.total end as revenue,
  o.user_id,
  lower(o.email) as email,
  o.status
from public.orders o
where o.status not in ('cancelled','payment_pending','payment_failed');

-- ─── Daily revenue / order count / AOV for the last 90 days ────────────────
create or replace function public.analytics_daily(
  p_days integer default 30
) returns table (
  day date,
  orders bigint,
  revenue numeric,
  aov numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select (now() - (p_days || ' days')::interval)::date as start_day,
           current_date as end_day
  ),
  series as (
    select generate_series((select start_day from bounds), (select end_day from bounds), '1 day')::date as day
  )
  select
    s.day,
    count(o.id)::bigint as orders,
    coalesce(sum(o.revenue), 0)::numeric as revenue,
    case when count(o.id) > 0 then (sum(o.revenue) / count(o.id))::numeric else 0::numeric end as aov
  from series s
  left join public.v_orders_revenue o
    on date_trunc('day', o.created_at)::date = s.day
  group by s.day
  order by s.day;
$$;
grant execute on function public.analytics_daily(integer) to anon, authenticated;

-- ─── Top KPIs (last N days + lifetime) ──────────────────────────────────────
create or replace function public.analytics_kpis(p_days integer default 30)
returns table (
  total_orders         bigint,
  total_revenue        numeric,
  aov                  numeric,
  unique_customers     bigint,
  repeat_purchase_rate numeric,
  lifetime_orders      bigint,
  lifetime_revenue     numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with recent as (
    select * from public.v_orders_revenue
    where created_at >= now() - (p_days || ' days')::interval
  ),
  customers as (
    -- A customer is identified by user_id (preferred) or email.
    select coalesce(user_id::text, email) as cust_key, count(*) as order_count
    from public.v_orders_revenue
    group by 1
  )
  select
    (select count(*)::bigint from recent) as total_orders,
    coalesce((select sum(revenue) from recent), 0)::numeric as total_revenue,
    case when (select count(*) from recent) > 0 then ((select sum(revenue) from recent) / (select count(*) from recent))::numeric else 0::numeric end as aov,
    (select count(distinct coalesce(user_id::text, email)) from recent)::bigint as unique_customers,
    case
      when (select count(*) from customers) > 0
      then ((select count(*) from customers where order_count > 1)::numeric / (select count(*) from customers)::numeric)
      else 0::numeric
    end as repeat_purchase_rate,
    (select count(*)::bigint from public.v_orders_revenue) as lifetime_orders,
    coalesce((select sum(revenue) from public.v_orders_revenue), 0)::numeric as lifetime_revenue;
$$;
grant execute on function public.analytics_kpis(integer) to anon, authenticated;

-- ─── Orders by status breakdown ─────────────────────────────────────────────
create or replace function public.analytics_orders_by_status()
returns table (status text, count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select status, count(*)::bigint
  from public.orders
  group by status
  order by count(*) desc;
$$;
grant execute on function public.analytics_orders_by_status() to anon, authenticated;

-- ─── Top products by units sold (last N days) ──────────────────────────────
create or replace function public.analytics_top_products(
  p_days integer default 30,
  p_limit integer default 10
) returns table (
  product_id uuid,
  units bigint,
  revenue numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (item ->> 'id')::uuid as product_id,
    sum((item ->> 'qty')::int)::bigint as units,
    sum((item ->> 'qty')::int * (item ->> 'price')::numeric)::numeric as revenue
  from public.v_orders_revenue o
  cross join lateral jsonb_array_elements(
    (select items from public.orders where id = o.id)
  ) as item
  where o.created_at >= now() - (p_days || ' days')::interval
    and (item ->> 'id') is not null
  group by 1
  order by units desc
  limit p_limit;
$$;
grant execute on function public.analytics_top_products(integer, integer) to anon, authenticated;

-- ─── RFM segmentation (last 365 days, simple 5-bucket recency, freq, monetary) ─
create or replace function public.analytics_rfm_segments()
returns table (
  segment text,
  customers bigint,
  total_revenue numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with per_customer as (
    select
      coalesce(user_id::text, email) as cust_key,
      max(created_at) as last_order_at,
      count(*) as freq,
      sum(revenue) as monetary
    from public.v_orders_revenue
    where created_at >= now() - interval '365 days'
    group by 1
  ),
  scored as (
    select
      cust_key,
      ntile(5) over (order by last_order_at desc) as r,    -- 1 = most recent
      ntile(5) over (order by freq desc) as f,             -- 1 = most frequent
      ntile(5) over (order by monetary desc) as m,         -- 1 = highest spend
      monetary
    from per_customer
  ),
  labelled as (
    select
      case
        when r = 1 and f = 1 and m = 1 then 'VIP'
        when r = 1 and f <= 2 then 'Loyal'
        when r = 1 then 'New / Recent'
        when r <= 2 and f <= 2 then 'Engaged'
        when r >= 4 and f <= 2 then 'At risk'
        when r = 5 then 'Lapsed'
        else 'Casual'
      end as segment,
      monetary
    from scored
  )
  select segment, count(*)::bigint as customers, coalesce(sum(monetary), 0)::numeric as total_revenue
  from labelled
  group by segment
  order by customers desc;
$$;
grant execute on function public.analytics_rfm_segments() to anon, authenticated;

-- ─── Monthly cohort retention (orders made by month of first order) ────────
create or replace function public.analytics_cohort_retention(p_months integer default 6)
returns table (
  cohort_month date,
  month_offset integer,
  customers bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with first_order as (
    select coalesce(user_id::text, email) as cust_key,
           date_trunc('month', min(created_at))::date as cohort_month
    from public.v_orders_revenue
    where coalesce(user_id::text, email) is not null
    group by 1
  ),
  recent as (
    select date_trunc('month', current_date)::date - ((p_months - 1) || ' months')::interval as start_month
  )
  select
    f.cohort_month,
    (extract(year from o.created_at)::int * 12 + extract(month from o.created_at)::int)
      - (extract(year from f.cohort_month)::int * 12 + extract(month from f.cohort_month)::int) as month_offset,
    count(distinct f.cust_key)::bigint as customers
  from first_order f
  join public.v_orders_revenue o
    on coalesce(o.user_id::text, o.email) = f.cust_key
  where f.cohort_month >= (select start_month from recent)::date
  group by f.cohort_month,
           (extract(year from o.created_at)::int * 12 + extract(month from o.created_at)::int)
             - (extract(year from f.cohort_month)::int * 12 + extract(month from f.cohort_month)::int)
  order by f.cohort_month, month_offset;
$$;
grant execute on function public.analytics_cohort_retention(integer) to anon, authenticated;
