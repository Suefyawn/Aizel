-- ============================================================================
-- Phase 1.3: Order state machine + audit trail.
--   • Widens orders.status to cover the real payment lifecycle.
--   • Adds order_events: append-only log of every transition.
--   • Adds a trigger that records every status change automatically.
-- ============================================================================

-- ─── Widen status check ─────────────────────────────────────────────────────
-- Old status values: pending | processing | shipped | delivered | cancelled
-- New values add:    payment_pending | payment_failed | refunded | returned
alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (status in (
    'payment_pending',  -- order created, awaiting JazzCash/Easypaisa redirect callback
    'payment_failed',   -- gateway returned non-success or timed out
    'pending',          -- payment confirmed (or COD), awaiting fulfillment
    'processing',       -- merchant picking/packing
    'shipped',          -- handed to courier
    'delivered',        -- courier confirmed delivery
    'cancelled',        -- cancelled by customer or merchant before shipping
    'returned',         -- delivered then returned
    'refunded'          -- payment fully reversed (or store-credit issued)
  ));

-- ─── order_events ───────────────────────────────────────────────────────────
create table if not exists public.order_events (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  from_status   text,
  to_status     text not null,
  note          text,
  actor_kind    text not null check (actor_kind in ('customer','staff','system','gateway')),
  actor_id      text,                -- staff_members.id or auth.users.id or null for system
  metadata      jsonb,               -- gateway payload, tracking info, etc.
  created_at    timestamptz not null default now()
);

create index if not exists order_events_order_idx   on public.order_events (order_id, created_at);

alter table public.order_events enable row level security;
-- A customer can see their own order's events.
drop policy if exists order_events_select_own on public.order_events;
create policy order_events_select_own on public.order_events
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_events.order_id
        and o.user_id = auth.uid()
    )
  );

-- ─── Auto-log status changes ────────────────────────────────────────────────
create or replace function public.log_order_status_change()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.order_events (order_id, from_status, to_status, actor_kind, actor_id)
    values (new.id, null, new.status, 'system', null);
    return new;
  end if;

  if (tg_op = 'UPDATE' and (new.status is distinct from old.status)) then
    insert into public.order_events (order_id, from_status, to_status, actor_kind, actor_id, metadata)
    values (
      new.id,
      old.status,
      new.status,
      'staff',
      null,
      jsonb_build_object(
        'tracking_number', new.tracking_number,
        'courier',         new.courier
      )
    );
  end if;
  return new;
end $$;

drop trigger if exists orders_log_status on public.orders;
create trigger orders_log_status
  after insert or update of status on public.orders
  for each row execute function public.log_order_status_change();
