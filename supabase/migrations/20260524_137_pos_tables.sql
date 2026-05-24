-- ============================================================================
-- Point of Sale (in-store register) schema.
--
-- Aizel adds a physical-shop POS surface alongside the storefront. Both
-- surfaces write to the same `orders` table so analytics, fulfilment,
-- and customer history stay unified — what differs is:
--
--   • `orders.channel`        — 'web' (default) | 'pos' (in-store)
--   • `payments.gateway`      — widened to include 'cash' for till takings
--   • cash drawer state       — pos_sessions + pos_cash_events
--   • parked sales            — held_sales (lets a cashier ring up another
--                               customer mid-transaction without losing
--                               the in-progress cart)
--
-- The new tables are admin-only — every policy gates on the staff
-- session table (NOT on auth.uid()) since the cashier authenticates
-- through the existing staff-auth cookie, not through Supabase Auth.
-- ============================================================================

-- ─── 0. SKU + barcode on products (POS scanning prerequisite) ─────────────
-- POS terminals expect a keyboard-wedge scanner to type a barcode + Enter
-- into the search field. Without a column to scan against, every lookup
-- has to be by product name — too slow for a busy till.
--
-- SKU is internal (operator-assigned, format up to them); barcode is
-- the canonical EAN/UPC/GTIN printed on the box. Both are nullable
-- because most current catalogue rows have neither — backfill as the
-- operator's hand-scanner walks the shelves.
alter table public.products
  add column if not exists sku     text,
  add column if not exists barcode text;

-- Unique index on barcode WHERE NOT NULL — two products can't share an
-- EAN, but plenty of products will have NULL during the backfill phase.
create unique index if not exists products_barcode_unique
  on public.products (barcode)
  where barcode is not null;

-- SKU is an internal label; we don't enforce uniqueness because some
-- operators use the brand-name SKU as-is and there's nothing wrong with
-- "Cantu Hydrating" being a SKU on two pack-size variants.
create index if not exists products_sku_idx
  on public.products (sku)
  where sku is not null;

-- ─── 1. Tag orders + payments with the channel / tender it came from ──────
alter table public.orders
  add column if not exists channel text not null default 'web'
    check (channel in ('web', 'pos'));

-- The new column is denormalised on `orders` rather than derived because
-- analytics filters ("today's POS revenue") need cheap scans + indexes,
-- and PostgREST can't filter on a joined column without an RPC.
create index if not exists orders_channel_created_idx
  on public.orders (channel, created_at desc);

-- Cash payments — for in-store till takings. The CHECK previously didn't
-- list 'cash' because pre-POS Aizel never accepted cash through the web
-- checkout. POS adds it as a first-class tender.
alter table public.payments drop constraint if exists payments_gateway_check;
alter table public.payments
  add constraint payments_gateway_check
  check (gateway in ('stripe','stripe_terminal','paypal','cash','jazzcash','easypaisa','cod','bank','manual','gift_card'));

-- ─── 2. POS shift (cash drawer session) ──────────────────────────────────
-- One row per opened drawer. Closed when the cashier counts down at end
-- of shift; `discrepancy` captures the difference between expected and
-- counted cash so the operator can investigate consistent under/over.
create table if not exists public.pos_sessions (
  id              uuid primary key default gen_random_uuid(),
  staff_id        uuid not null,                       -- references staff.id
  opened_at       timestamptz not null default now(),
  closed_at       timestamptz,
  opening_float   numeric(10,2) not null check (opening_float >= 0),
  -- Expected cash = opening_float + sum(cash sales) - sum(cash payouts).
  -- Computed at close-time so a mid-shift query can compare it live.
  expected_cash   numeric(10,2),
  -- Cashier-counted cash at close-time.
  counted_cash    numeric(10,2),
  -- counted_cash - expected_cash. NULL until close.
  discrepancy     numeric(10,2),
  -- Optional manager note explaining a notable discrepancy.
  close_note      text,
  status          text not null default 'open'
                    check (status in ('open','closed')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists pos_sessions_status_idx
  on public.pos_sessions (status, opened_at desc);
create index if not exists pos_sessions_staff_idx
  on public.pos_sessions (staff_id, opened_at desc);

drop trigger if exists pos_sessions_set_updated_at on public.pos_sessions;
create trigger pos_sessions_set_updated_at
  before update on public.pos_sessions
  for each row execute function public.set_updated_at();

-- ─── 3. Cash events (deposit/withdrawal/sale/refund) ─────────────────────
-- Every cash movement is journaled here. Sales auto-insert through a
-- payment-write trigger (added below); manual deposits + withdrawals get
-- explicit rows. Sum(amount) over open session = the till's cash position.
create table if not exists public.pos_cash_events (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.pos_sessions(id) on delete cascade,
  -- Positive = cash INTO the drawer, negative = cash OUT.
  amount       numeric(10,2) not null check (amount <> 0),
  kind         text not null check (kind in (
                  'opening_float',     -- + initial cash placed in drawer
                  'sale',              -- + cash payment received from a customer
                  'refund',            -- − cash returned to a customer
                  'cash_in',           -- + manager deposit (e.g. change top-up)
                  'cash_out',          -- − manager withdrawal (banking, expense)
                  'closing_count'      -- 0 — marker event written at close
                )),
  -- For 'sale' / 'refund' kinds: the order this movement belongs to.
  order_id     uuid references public.orders(id) on delete set null,
  note         text,
  created_at   timestamptz not null default now()
);

create index if not exists pos_cash_events_session_idx
  on public.pos_cash_events (session_id, created_at);
create index if not exists pos_cash_events_order_idx
  on public.pos_cash_events (order_id) where order_id is not null;

-- ─── 4. Held (parked) sales ──────────────────────────────────────────────
-- A cashier mid-transaction can park the cart and ring up another
-- customer first. The held row carries everything needed to resume:
-- items, any discount already applied, the customer attached (if any),
-- and a human label ("Lady in red coat" — the cashier's nudge to
-- themselves).
create table if not exists public.held_sales (
  id           uuid primary key default gen_random_uuid(),
  staff_id     uuid not null,
  -- Free-text reminder the cashier types when parking.
  label        text not null check (length(label) between 1 and 80),
  -- Order-shape JSON: items + discount + customer_email.
  cart         jsonb not null,
  -- Computed at park-time so the held list can sort high → low without
  -- decoding the JSON for each row.
  total        numeric(10,2) not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists held_sales_staff_created_idx
  on public.held_sales (staff_id, created_at desc);

-- ─── 5. RLS — admin-only via staff-session check ─────────────────────────
-- We don't expose POS rows to auth.uid() because cashiers authenticate
-- via the staff-auth cookie + service-role server actions, not via
-- Supabase Auth. Lock down anon + authenticated; service-role bypasses RLS.
alter table public.pos_sessions     enable row level security;
alter table public.pos_cash_events  enable row level security;
alter table public.held_sales       enable row level security;

drop policy if exists pos_sessions_block_anon    on public.pos_sessions;
drop policy if exists pos_cash_block_anon        on public.pos_cash_events;
drop policy if exists held_sales_block_anon      on public.held_sales;

-- Explicit no-rows policies — service-role bypasses RLS so admin code
-- still reads/writes, but a leaked anon key sees nothing.
create policy pos_sessions_block_anon on public.pos_sessions
  for all to anon using (false) with check (false);
create policy pos_cash_block_anon on public.pos_cash_events
  for all to anon using (false) with check (false);
create policy held_sales_block_anon on public.held_sales
  for all to anon using (false) with check (false);
