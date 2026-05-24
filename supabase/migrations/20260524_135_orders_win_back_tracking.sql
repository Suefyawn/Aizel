-- ============================================================================
-- Tracking column for the win-back email cron.
--
-- The job in src/app/api/cron/win-back finds customers whose most recent
-- delivered order is 60–90 days old AND who haven't placed a follow-up
-- order, then sends them a soft nudge email ("It's been a minute — here's
-- what's new"). Idempotency lives in this column: once a win-back fires
-- for an order, we never fire one for the same order again.
--
-- We don't need a customer-level "lifetime win_back_sent_at" because the
-- cron joins by user_id and skips anyone whose most-recent order has the
-- flag set. The next time the same customer comes back, places an order,
-- and lapses again, that NEW order qualifies for its own win-back.
-- ============================================================================

alter table public.orders
  add column if not exists win_back_sent_at timestamptz;

-- Partial index on the tracking column so the cron's nightly scan
-- (`win_back_sent_at IS NULL AND status='delivered' AND created_at > N`)
-- stays sub-second even at six-figure order volume.
create index if not exists orders_win_back_pending_idx
  on public.orders (created_at)
  where win_back_sent_at is null and status = 'delivered';
