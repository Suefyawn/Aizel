-- ============================================================================
-- Phase 1.1: Payment records for JazzCash / Easypaisa / future gateways.
--
-- Each order can have N payment attempts. A successful payment flips the
-- order from 'payment_pending' to 'pending' (handled in the route handler
-- src/app/api/payments/<gateway>/callback/route.ts).
-- ============================================================================

create table if not exists public.payments (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders(id) on delete cascade,
  gateway         text not null check (gateway in ('jazzcash','easypaisa','cod','bank','manual','gift_card')),
  amount          numeric(10,2) not null check (amount >= 0),
  currency        text not null default 'PKR',
  status          text not null check (status in ('initiated','succeeded','failed','refunded','cancelled')),
  -- Gateway txn reference / our own random transaction id.
  txn_ref         text,
  -- Unique per (gateway, txn_ref) — used as idempotency key for callbacks.
  raw_payload     jsonb,
  error_message   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists payments_order_idx    on public.payments (order_id);
create index if not exists payments_status_idx   on public.payments (status);
-- Idempotency: a gateway callback should not insert the same txn twice.
create unique index if not exists payments_gateway_txn_unique
  on public.payments (gateway, txn_ref)
  where txn_ref is not null;

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

alter table public.payments enable row level security;
-- A customer can see their own order's payment attempts.
drop policy if exists payments_select_own on public.payments;
create policy payments_select_own on public.payments
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = payments.order_id
        and o.user_id = auth.uid()
    )
  );
