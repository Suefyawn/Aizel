-- Migration 092 — fix checkout (P0): drop the broken order-confirmation
-- webhook trigger.
--
-- Cowork QA found every checkout failing at place_order with:
--   null value in column "url" of relation "http_request_queue"
--   violates not-null constraint
--
-- Root cause: the AFTER INSERT trigger on_order_created → notify_order_
-- confirmation() called
--   net.http_post(url := current_setting('app.supabase_url', true)
--                          || '/functions/v1/send-order-confirmation', ...)
-- The `app.supabase_url` GUC is unset, so `current_setting(..., true)`
-- returned NULL, the url concatenated to NULL, and pg_net's
-- http_request_queue.url is NOT NULL — so the enqueue aborted the whole
-- place_order transaction. No order could be created.
--
-- The trigger is also redundant: the checkout server action already sends
-- both the customer confirmation and the owner notification via Resend
-- (src/app/checkout/actions.ts → sendOrderConfirmationEmail / sendNewOrderEmail).
-- So this DB-trigger → edge-function path is dropped entirely, not repaired.

drop trigger if exists on_order_created on public.orders;
drop function if exists public.notify_order_confirmation();
