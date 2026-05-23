-- ============================================================================
-- Vendor cost / margin / payout system.
--
-- Each product can be sourced from one vendor. The vendor's cut is recorded
-- two ways, for flexibility:
--   * `vendors.commission_pct` — the % of the sale price Yellow Pink keeps
--     (applies to every product from that vendor), and/or
--   * `products.vendor_cost` — an exact per-product cost, which overrides the
--     vendor's commission % when set.
--
-- `vendors.settlement_direction` says who collects the customer's payment:
--   * 'vendor_collects' — the vendor ships + collects; they owe us our margin.
--   * 'we_collect'      — we collect; we owe the vendor their cost.
--
-- When an order is dispatched to a vendor, a `vendor_settlements` row records
-- the financial split for that order so payouts can be tracked and settled.
-- ============================================================================

alter table public.vendors
  add column if not exists commission_pct numeric(5,2)
    check (commission_pct is null or (commission_pct >= 0 and commission_pct <= 100)),
  add column if not exists settlement_direction text not null default 'we_collect'
    check (settlement_direction in ('vendor_collects', 'we_collect'));

comment on column public.vendors.commission_pct is
  'Percentage of the sale price Yellow Pink keeps on this vendor''s products. '
  'Used when a product has no explicit vendor_cost.';
comment on column public.vendors.settlement_direction is
  'vendor_collects = vendor collects payment and owes us our margin; '
  'we_collect = we collect payment and owe the vendor their cost.';

alter table public.products
  add column if not exists vendor_id uuid references public.vendors(id) on delete set null,
  add column if not exists vendor_cost numeric(12,2) check (vendor_cost is null or vendor_cost >= 0);

comment on column public.products.vendor_cost is
  'Exact amount Yellow Pink pays the vendor per unit. Overrides the vendor''s '
  'commission_pct when set.';

create index if not exists products_vendor_id_idx on public.products(vendor_id);

-- One settlement per (order, vendor) — created when an order is dispatched.
create table if not exists public.vendor_settlements (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id)  on delete cascade,
  vendor_id    uuid not null references public.vendors(id) on delete cascade,
  gross_amount numeric(12,2) not null default 0,  -- customer-paid for this vendor's items
  vendor_cost  numeric(12,2) not null default 0,  -- the vendor's share
  our_margin   numeric(12,2) not null default 0,  -- gross_amount - vendor_cost
  direction    text not null check (direction in ('vendor_collects', 'we_collect')),
  amount_due   numeric(12,2) not null default 0,  -- the net to settle
  due_to       text not null check (due_to in ('us', 'vendor')),
  status       text not null default 'pending' check (status in ('pending', 'settled')),
  settled_at   timestamptz,
  created_at   timestamptz not null default now(),
  unique (order_id, vendor_id)
);

-- Admin-only, like `vendors`: RLS on with no policy → reachable only via the
-- service-role client.
alter table public.vendor_settlements enable row level security;

create index if not exists vendor_settlements_vendor_idx on public.vendor_settlements(vendor_id);
create index if not exists vendor_settlements_status_idx on public.vendor_settlements(status);
