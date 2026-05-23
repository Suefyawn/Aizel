-- ============================================================================
-- Phase 1.11: Hardened guest-side order lookup for /track.
--
-- The current /track page (src/app/track/page.tsx) uses the anon Supabase
-- client to do `from('orders').select('*').eq('order_number', X).single()`
-- and then verifies the phone client-side. That works only because the
-- baseline RLS leaves anon read disabled — meaning the query silently
-- returns nothing, and the client can't actually verify.
--
-- This RPC fixes both problems: it does the order_number + phone check
-- server-side (SECURITY DEFINER), so the storefront keeps working under
-- RLS, and we never leak orders by enumeration.
-- ============================================================================

create or replace function public.lookup_order(p_order_number text, p_phone text)
returns table (
  id              uuid,
  order_number    text,
  first_name      text,
  last_name       text,
  phone           text,
  city            text,
  province        text,
  pay_method      text,
  subtotal        numeric,
  shipping        numeric,
  total           numeric,
  items           jsonb,
  status          text,
  tracking_number text,
  courier         text,
  created_at      timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_normalised_phone text := regexp_replace(p_phone, '[^0-9]', '', 'g');
begin
  return query
  select
    o.id, o.order_number, o.first_name, o.last_name, o.phone,
    o.city, o.province, o.pay_method,
    o.subtotal, o.shipping, o.total, o.items,
    o.status, o.tracking_number, o.courier, o.created_at
  from public.orders o
  where o.order_number = upper(trim(p_order_number))
    and regexp_replace(o.phone, '[^0-9]', '', 'g') = v_normalised_phone
  limit 1;
end $$;

grant execute on function public.lookup_order(text, text) to anon, authenticated;
