-- ============================================================================
-- Order confirmation + vendor dispatch workflow.
--
-- Flow: a new order arrives → staff confirm it with the customer over
-- WhatsApp → mark it customer-confirmed → pick a vendor and forward the
-- order to that vendor over WhatsApp.
--
--   vendors          — the suppliers the store dispatches orders to.
--   orders.confirmed_at   — set when the customer confirms the order.
--   orders.vendor_id      — the vendor the order was dispatched to.
--   orders.vendor_sent_at — set when staff forward the order to the vendor.
-- ============================================================================

create table if not exists public.vendors (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text not null,
  notes       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Admin-only table: RLS on with no policy means every access must use the
-- service-role client (same pattern as coupons / staff_members).
alter table public.vendors enable row level security;

alter table public.orders
  add column if not exists confirmed_at   timestamptz,
  add column if not exists vendor_id      uuid references public.vendors(id) on delete set null,
  add column if not exists vendor_sent_at timestamptz;
