-- ============================================================================
-- Phase 5.7: Courier / shipment workflow.
--
-- shipments — one row per courier dispatch attached to an order. Most
-- orders will have exactly one; a split shipment has many.
-- shipment_events — append-only timeline (webhook ingest target).
-- ============================================================================

create table if not exists public.shipments (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders(id) on delete cascade,
  courier         text not null,                       -- 'TCS' | 'Leopards' | 'M&P' | 'BlueEx' | 'Other'
  tracking_number text not null,
  status          text not null default 'created' check (status in (
    'created','picked_up','in_transit','out_for_delivery','delivered','returned','failed','cancelled'
  )),
  weight_grams    integer,
  cost            numeric(10,2),
  shipped_at      timestamptz default now(),
  delivered_at    timestamptz,
  raw_label_url   text,                               -- PDF of the label (when courier API returns one)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists shipments_order_idx     on public.shipments (order_id);
create index if not exists shipments_tracking_idx  on public.shipments (courier, tracking_number);

drop trigger if exists shipments_set_updated_at on public.shipments;
create trigger shipments_set_updated_at
  before update on public.shipments
  for each row execute function public.set_updated_at();

alter table public.shipments enable row level security;
drop policy if exists shipments_select_own on public.shipments;
create policy shipments_select_own on public.shipments
  for select using (
    exists (select 1 from public.orders o where o.id = shipments.order_id and o.user_id = auth.uid())
  );

create table if not exists public.shipment_events (
  id           uuid primary key default gen_random_uuid(),
  shipment_id  uuid not null references public.shipments(id) on delete cascade,
  status       text not null,
  description  text,
  occurred_at  timestamptz not null default now(),
  raw_payload  jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists shipment_events_shipment_idx on public.shipment_events (shipment_id, occurred_at desc);

alter table public.shipment_events enable row level security;
drop policy if exists shipment_events_select_own on public.shipment_events;
create policy shipment_events_select_own on public.shipment_events
  for select using (
    exists (
      select 1 from public.shipments s
      join public.orders o on o.id = s.order_id
      where s.id = shipment_events.shipment_id and o.user_id = auth.uid()
    )
  );

-- When a shipment is created, mirror the tracking_number + courier onto
-- the parent order for the existing /track flow (which queries orders).
create or replace function public.sync_order_tracking_from_shipment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.orders
    set tracking_number = coalesce(new.tracking_number, tracking_number),
        courier         = coalesce(new.courier, courier),
        status          = case
                            when new.status = 'delivered' then 'delivered'
                            when new.status in ('picked_up','in_transit','out_for_delivery') then 'shipped'
                            else status
                          end
    where id = new.order_id;
  return new;
end $$;

drop trigger if exists shipments_sync_order on public.shipments;
create trigger shipments_sync_order
  after insert or update on public.shipments
  for each row execute function public.sync_order_tracking_from_shipment();
