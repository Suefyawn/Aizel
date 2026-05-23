-- ============================================================================
-- The Analytics "Customer segments" panel and the /admin/segments page
-- disagreed: each computed customer segments independently — the analytics
-- RPC used RFM quintiles, the page used the v_customer_segments view — so
-- the same customer landed in different buckets and the counts didn't match.
--
-- analytics_rfm_segments now aggregates v_customer_segments, the single
-- source of truth, so the two surfaces always agree.
-- ============================================================================

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
  select
    segment::text                       as segment,
    count(*)::bigint                    as customers,
    coalesce(sum(revenue), 0)::numeric  as total_revenue
  from public.v_customer_segments
  group by segment
  order by count(*) desc;
$$;
grant execute on function public.analytics_rfm_segments() to anon, authenticated;
