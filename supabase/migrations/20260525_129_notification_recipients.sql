-- Multi-recipient staff notifications.
--
-- Before this, every internal alert (new order, low stock, admin alerts)
-- went to a single inbox set via the OWNER_EMAIL env var. Owner could not
-- add staff to those alerts without redeploying.
--
-- This table lets the owner configure recipients in the admin UI. The
-- `events` text[] holds which event types each recipient subscribes to —
-- one row per email, multiple events per row.
--
-- Recommended event keys (helpers in lib/notification-recipients.ts):
--   'order.new'        — fan-out point: sendNewOrderEmail
--   'inventory.low'    — fan-out point: sendLowStockAlertEmail
--
-- The fan-out helper falls back to OWNER_EMAIL when no row subscribes to
-- a given event — existing behaviour stays intact until the owner adds at
-- least one recipient.

CREATE TABLE IF NOT EXISTS public.notification_recipients (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  events      text[] NOT NULL DEFAULT '{}',
  enabled     boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_recipients_email_format CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  CONSTRAINT notification_recipients_email_unique UNIQUE (email)
);

-- Lookup pattern: get all enabled recipients subscribed to a specific event.
-- GIN index supports the `events @> array['order.new']` containment check.
CREATE INDEX IF NOT EXISTS notification_recipients_events_idx
  ON public.notification_recipients USING GIN (events);

CREATE INDEX IF NOT EXISTS notification_recipients_enabled_idx
  ON public.notification_recipients (enabled) WHERE enabled = true;

-- Touch updated_at on row change so the admin list can sort by last-edited.
DROP TRIGGER IF EXISTS notification_recipients_touch ON public.notification_recipients;
CREATE TRIGGER notification_recipients_touch
  BEFORE UPDATE ON public.notification_recipients
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS: writes go through the service-role client (server actions are
-- staff-gated above). No public read is needed — this is admin-only data.
ALTER TABLE public.notification_recipients ENABLE ROW LEVEL SECURITY;
