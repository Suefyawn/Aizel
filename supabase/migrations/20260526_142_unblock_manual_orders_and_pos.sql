-- 26 May 2026: P0 fixes to unblock manual orders + POS sales.
--
-- The production audit found that no manual order or POS sale had ever
-- successfully inserted into the orders table because the CHECK constraints
-- still reflected the pre-rebrand Pakistan flow and didn't recognise the
-- `manual`, `cash`, `split` pay-methods the new code writes. Same shape of
-- issue blocked POS shift-close (`pos_cash_events.amount <> 0` rejected the
-- `closing_count` row with amount 0) and POS returns (`payments.amount >= 0`
-- rejected the negative refund row, and the code also tried to write a
-- `pos_cash_events.actor_id` column that did not exist).
--
-- Each statement is idempotent: drop the existing CHECK by name, recreate
-- with the widened predicate; `ADD COLUMN IF NOT EXISTS` for the new col.

-- ── orders.pay_method ─────────────────────────────────────────────────────
-- Add `manual` (admin/manual-orders), `cash` (POS in-person), `split` (POS
-- mixed-tender — part cash + part card on the same sale).
alter table public.orders
  drop constraint if exists orders_pay_method_check;
alter table public.orders
  add constraint orders_pay_method_check
  check (pay_method = any (array[
    'cod','card','bank','jazzcash','easypaisa','gift_card',
    'manual','cash','split'
  ]));

-- ── payments.amount ───────────────────────────────────────────────────────
-- Allow negative values so POS in-store refunds can persist a `payments`
-- row with `amount < 0` (the convention `processPosReturn` writes). The
-- `status='refunded'` flag on the row is what marks intent; the sign on
-- amount makes the running total in the order panel sum correctly.
alter table public.payments
  drop constraint if exists payments_amount_check;
-- No replacement CHECK — amount can now be any numeric. If a stricter
-- invariant is wanted later, add `CHECK ((amount > 0 AND status != 'refunded')
-- OR (amount < 0 AND status = 'refunded'))` — but we deliberately do not
-- enforce it here because in-place capture/refund flows can be ambiguous.

-- ── pos_cash_events.amount ────────────────────────────────────────────────
-- Allow zero so `closeShift` can write a `closing_count` event whose only
-- purpose is to flush the till summary into the shift journal. The original
-- `amount <> 0` was an over-tight invariant — the journal works fine with
-- a zero-amount audit row that simply records "shift closed, expected = X".
alter table public.pos_cash_events
  drop constraint if exists pos_cash_events_amount_check;
-- No replacement CHECK — zero is now legitimate for the `closing_count` kind.

-- ── pos_cash_events.actor_id ──────────────────────────────────────────────
-- The POS code expects to stamp every cash event with the staff member who
-- triggered it (cash in/out, refund at till, opening float). Without this
-- column those writes were silently failing with a PostgREST "column does
-- not exist" error and the till audit trail was incomplete.
alter table public.pos_cash_events
  add column if not exists actor_id uuid references public.staff_members(id) on delete set null;

create index if not exists idx_pos_cash_events_actor_id
  on public.pos_cash_events(actor_id)
  where actor_id is not null;
