-- Full-featured inventory management — re-order points, stocktakes,
-- and lightweight purchase-order / receiving.
--
-- Re-order point: per-product threshold. Replaces the hard-coded
-- LOW_STOCK_THRESHOLD=5 in the admin so a fast-moving SKU can sit at
-- "low" while a slow-mover at the same level stays "in stock".
--
-- Stocktake: an operator-initiated physical count session. Lines hold
-- the system-vs-counted delta; finalising the session writes the
-- adjustments through to inventory_ledger + the products.stock column.
--
-- Purchase order: a record of incoming stock. Receiving a PO bumps each
-- line's product stock and creates an `import`-reason ledger row tied
-- to the PO. Cost is captured for future margin reporting.

-- ─── Re-order points on products ─────────────────────────────────────
alter table products
  add column if not exists reorder_point integer;

comment on column products.reorder_point is
  'Per-product re-order threshold. When stock drops at or below this number, the product appears on the low-stock dashboard / inventory "needs attention" view. NULL = inherit the system default (5).';

-- ─── Stocktakes ──────────────────────────────────────────────────────
create table if not exists stocktakes (
  id          uuid primary key default gen_random_uuid(),
  status      text not null default 'open' check (status in ('open', 'finalised', 'cancelled')),
  opened_by   text,                                   -- staff name / email captured at open time
  opened_at   timestamptz not null default now(),
  closed_at   timestamptz,
  note        text,
  -- Snapshot count of lines we'll touch so the finalise step can show
  -- "12 products counted, 3 with discrepancies" without re-querying.
  total_lines integer not null default 0
);
comment on table stocktakes is
  'Physical-count sessions. Lines (stocktake_lines) record system-vs-counted delta; finalise writes the adjustment to inventory_ledger.';

create index if not exists stocktakes_status_idx     on stocktakes (status);
create index if not exists stocktakes_opened_at_idx  on stocktakes (opened_at desc);

create table if not exists stocktake_lines (
  id            uuid primary key default gen_random_uuid(),
  stocktake_id  uuid not null references stocktakes(id) on delete cascade,
  product_id    uuid not null references products(id) on delete restrict,
  system_qty    integer not null,                     -- snapshot at count time
  counted_qty   integer not null,                     -- what the cashier counted
  delta         integer generated always as (counted_qty - system_qty) stored,
  note          text,
  counted_at    timestamptz not null default now(),
  unique (stocktake_id, product_id)
);
create index if not exists stocktake_lines_st_idx on stocktake_lines (stocktake_id);

-- ─── Purchase orders ─────────────────────────────────────────────────
create table if not exists purchase_orders (
  id              uuid primary key default gen_random_uuid(),
  supplier_name   text not null,
  reference       text,                               -- supplier's PO/invoice number, optional
  status          text not null default 'draft'
    check (status in ('draft', 'sent', 'received', 'cancelled')),
  created_at      timestamptz not null default now(),
  created_by      text,
  received_at     timestamptz,
  received_by     text,
  note            text
);
create index if not exists po_status_idx     on purchase_orders (status);
create index if not exists po_created_at_idx on purchase_orders (created_at desc);

create table if not exists purchase_order_lines (
  id          uuid primary key default gen_random_uuid(),
  po_id       uuid not null references purchase_orders(id) on delete cascade,
  product_id  uuid not null references products(id) on delete restrict,
  qty         integer not null check (qty > 0),
  unit_cost   numeric(12,2),                          -- £ paid per unit; optional, used for margin
  note        text
);
create index if not exists pol_po_idx       on purchase_order_lines (po_id);
create index if not exists pol_product_idx  on purchase_order_lines (product_id);

-- ─── RLS — admin-only, anon SELECT denied ────────────────────────────
alter table stocktakes              enable row level security;
alter table stocktake_lines         enable row level security;
alter table purchase_orders         enable row level security;
alter table purchase_order_lines    enable row level security;

-- No policies = service role only (which is what the admin pages use
-- via supabaseAdmin()). Matches the rest of the back-office tables
-- (pos_sessions, audit_log, etc.).
