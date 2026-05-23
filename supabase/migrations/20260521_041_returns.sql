-- ============================================================================
-- Phase 5.8: Lightweight returns / refund flow.
--
-- Customer requests a return for some (or all) line items in a delivered
-- order. Admin approves or rejects. On approval the customer can choose
-- store credit (loyalty_ledger top-up via grant_loyalty_points) or a
-- coupon refund — implemented in the action layer, not here.
-- ============================================================================

create table if not exists public.return_requests (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,
  email         text,                                  -- guests reference orders by phone+ord# elsewhere
  reason        text not null check (length(reason) between 5 and 1000),
  items         jsonb not null,                       -- [{ product_id, qty, name, price }]
  status        text not null default 'pending' check (status in (
    'pending','approved','rejected','received','refunded','cancelled'
  )),
  refund_amount numeric(10,2),
  refund_method text check (refund_method in ('store_credit','coupon','original','cod_deduct')),
  admin_note    text,
  customer_note text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists return_requests_order_idx  on public.return_requests (order_id);
create index if not exists return_requests_user_idx   on public.return_requests (user_id) where user_id is not null;
create index if not exists return_requests_status_idx on public.return_requests (status, created_at desc);

drop trigger if exists return_requests_set_updated_at on public.return_requests;
create trigger return_requests_set_updated_at
  before update on public.return_requests
  for each row execute function public.set_updated_at();

alter table public.return_requests enable row level security;

drop policy if exists return_requests_select_own on public.return_requests;
drop policy if exists return_requests_insert_own on public.return_requests;
create policy return_requests_select_own on public.return_requests
  for select using ( auth.uid() is not null and auth.uid() = user_id );
create policy return_requests_insert_own on public.return_requests
  for insert with check ( auth.uid() is not null and auth.uid() = user_id );
