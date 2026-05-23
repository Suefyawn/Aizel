-- Newsletter subscribers. Captures opt-in email from the footer form, the
-- exit-intent / timed modal, and the post-purchase checkbox at checkout.
--
-- Single email-per-row pattern; if someone subscribes twice from different
-- sources we keep the original row (ON CONFLICT DO NOTHING) so we don't
-- reset the consent timestamp or accidentally re-add an unsubscribed user.

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL,
  source          text NOT NULL DEFAULT 'footer',
  -- Marketing consent at the moment of subscription. Customer can unsubscribe
  -- later via the link in each email; that flips `unsubscribed_at`.
  marketing_consent  boolean NOT NULL DEFAULT true,
  unsubscribed_at    timestamptz,
  -- Useful for de-duping + auditing later (one source per email keeps row).
  user_agent      text,
  ip_address      inet,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT newsletter_subscribers_email_lower_idx UNIQUE (email)
);

-- Find active (subscribed) addresses fast — used by the future Resend audience-
-- sync edge function.
CREATE INDEX IF NOT EXISTS newsletter_active_idx
  ON public.newsletter_subscribers (created_at DESC)
  WHERE unsubscribed_at IS NULL;

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Anon CAN insert their own email (server action runs as anon for guest
-- visitors). They cannot read or update; only the service role can.
DROP POLICY IF EXISTS "newsletter_anon_insert" ON public.newsletter_subscribers;
CREATE POLICY "newsletter_anon_insert" ON public.newsletter_subscribers
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "newsletter_service_read" ON public.newsletter_subscribers;
CREATE POLICY "newsletter_service_read" ON public.newsletter_subscribers
  FOR SELECT TO service_role USING (true);

COMMENT ON TABLE public.newsletter_subscribers IS
  'Opt-in email list. Source tracks where the user subscribed from. Email is unique; ON CONFLICT DO NOTHING keeps the original row.';
