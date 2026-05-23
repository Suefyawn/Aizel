-- ============================================================================
-- Phase 5.5: Customer segments (derived view + per-customer fast lookup).
-- Phase 5.6: Admin notifications inbox + triggers that feed it.
-- ============================================================================

-- ─── Customer segment view ─────────────────────────────────────────────────
-- One row per identifiable customer (auth user_id OR email for guests) with
-- the metrics we use to bucket them. Backs the /admin/segments page.
create or replace view public.v_customer_segments as
with per_customer as (
  select
    coalesce(o.user_id::text, lower(o.email)) as cust_key,
    o.user_id,
    lower(o.email) as email,
    max(o.created_at) as last_order_at,
    min(o.created_at) as first_order_at,
    count(*)          as orders,
    sum(case when o.status = 'refunded' then 0 else o.total end) as revenue
  from public.orders o
  where o.status not in ('cancelled','payment_pending','payment_failed')
    and coalesce(o.user_id::text, o.email) is not null
  group by 1, 2, 3
)
select
  cust_key,
  user_id,
  email,
  orders,
  revenue,
  last_order_at,
  first_order_at,
  case
    when orders >= 5 and revenue >= 25000 then 'VIP'
    when orders >= 3                                                  then 'Loyal'
    when last_order_at >= now() - interval '30 days' and orders = 1   then 'New / Recent'
    when last_order_at >= now() - interval '90 days'                  then 'Engaged'
    when last_order_at <  now() - interval '180 days'                 then 'Lapsed'
    when last_order_at <  now() - interval '90 days'                  then 'At risk'
    else 'Casual'
  end as segment
from per_customer;

-- ─── Admin notifications ───────────────────────────────────────────────────
create table if not exists public.admin_notifications (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in (
    'new_order','low_stock','payment_failed','return_request','new_review','staff_added'
  )),
  title        text not null,
  body         text,
  link         text,
  entity_id    text,
  read         boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists admin_notifications_unread_idx on public.admin_notifications (read, created_at desc) where not read;
create index if not exists admin_notifications_created_idx on public.admin_notifications (created_at desc);

alter table public.admin_notifications enable row level security;
-- No public-read. Admin pages query via service role.

-- ─── Triggers feeding the inbox ────────────────────────────────────────────
-- New order
create or replace function public.notify_new_order()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.admin_notifications (kind, title, body, link, entity_id)
  values (
    'new_order',
    'New order ' || new.order_number,
    new.first_name || ' ' || new.last_name || ' · PKR ' || new.total::text,
    '/admin/orders/' || new.id::text,
    new.id::text
  );
  return new;
end $$;
drop trigger if exists orders_notify_new on public.orders;
create trigger orders_notify_new
  after insert on public.orders
  for each row execute function public.notify_new_order();

-- Order payment_failed
create or replace function public.notify_payment_failed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'payment_failed' and (old.status is distinct from 'payment_failed') then
    insert into public.admin_notifications (kind, title, body, link, entity_id)
    values (
      'payment_failed',
      'Payment failed: ' || new.order_number,
      coalesce(new.email, new.phone),
      '/admin/orders/' || new.id::text,
      new.id::text
    );
  end if;
  return new;
end $$;
drop trigger if exists orders_notify_payment_failed on public.orders;
create trigger orders_notify_payment_failed
  after update of status on public.orders
  for each row execute function public.notify_payment_failed();

-- Low stock (single product crosses below threshold)
create or replace function public.notify_low_stock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.stock < 5 and (old.stock is null or old.stock >= 5) then
    insert into public.admin_notifications (kind, title, body, link, entity_id)
    values (
      'low_stock',
      'Low stock: ' || new.brand || ' ' || new.name,
      'Only ' || new.stock::text || ' left',
      '/admin/products/' || new.id::text,
      new.id::text
    );
  end if;
  return new;
end $$;
drop trigger if exists products_notify_low_stock on public.products;
create trigger products_notify_low_stock
  after update of stock on public.products
  for each row execute function public.notify_low_stock();

-- New review pending moderation
create or replace function public.notify_new_review()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not new.approved then
    insert into public.admin_notifications (kind, title, body, link, entity_id)
    values (
      'new_review',
      'New review pending moderation',
      new.author_name || ' · ' || new.rating::text || '★',
      '/admin/reviews',
      new.id::text
    );
  end if;
  return new;
end $$;
drop trigger if exists reviews_notify_new on public.product_reviews;
create trigger reviews_notify_new
  after insert on public.product_reviews
  for each row execute function public.notify_new_review();

-- New return request
create or replace function public.notify_return_request()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.admin_notifications (kind, title, body, link, entity_id)
  values (
    'return_request',
    'Return requested',
    left(coalesce(new.reason, ''), 80),
    '/admin/returns',
    new.id::text
  );
  return new;
end $$;
drop trigger if exists returns_notify_new on public.return_requests;
create trigger returns_notify_new
  after insert on public.return_requests
  for each row execute function public.notify_return_request();
