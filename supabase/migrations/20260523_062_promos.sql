-- Promo / announcement CMS.
--
-- One table for both bar styles (slim "announcement" and richer "promo"
-- card). Each row picks ONE position slot (top_bar OR hero_strip) and an
-- audience filter; the storefront's getActivePromo() resolver returns the
-- single best-fit row per slot per request.
--
-- This replaces the site_settings-based promo configuration we used during
-- bootstrap. site_settings remains the fallback if no row matches (so an
-- empty `promos` table doesn't blank the announcement strip).

CREATE TABLE IF NOT EXISTS public.promos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Visual treatment + slot.
  kind          text NOT NULL CHECK (kind IN ('announcement', 'promo')),
  position      text NOT NULL CHECK (position IN ('top_bar', 'hero_strip')),

  -- Copy + linkage.
  label         text,                 -- "SALE", "NEW", etc. (pill on promo cards)
  headline      text NOT NULL,        -- the main line
  subline       text,
  cta_text      text,
  cta_url       text,

  -- Colors. Hex strings; storefront falls back to brand defaults if null.
  bg_color      text,
  text_color    text,

  -- Schedule (both nullable = always live).
  start_at      timestamptz,
  end_at        timestamptz,
  -- Countdown timer for promo cards (uses end_at if set).
  show_countdown boolean NOT NULL DEFAULT false,

  -- Audience filter. NULL = everyone. 'guest' = no auth cookie. 'logged_in'
  -- = signed-in. 'first_time' = no orders yet (resolved server-side). 'returning'
  -- = at least 1 order.
  audience      text CHECK (audience IS NULL OR audience IN ('guest','logged_in','first_time','returning')),

  -- Display rules.
  enabled       boolean NOT NULL DEFAULT true,
  priority      integer NOT NULL DEFAULT 0,  -- higher wins when multiple rows match

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Common lookup: pull all live + enabled promos for a position, ranked.
CREATE INDEX IF NOT EXISTS promos_live_idx ON public.promos (position, enabled, priority DESC);

-- Updated-at trigger so the admin list can sort by last-edited.
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS promos_touch ON public.promos;
CREATE TRIGGER promos_touch
  BEFORE UPDATE ON public.promos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS: anon reads only enabled + currently-live rows. Service role does all
-- writes (admin actions run as service role).
ALTER TABLE public.promos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "promos_anon_read_live" ON public.promos;
CREATE POLICY "promos_anon_read_live" ON public.promos
  FOR SELECT TO anon, authenticated
  USING (
    enabled = true
    AND (start_at IS NULL OR start_at <= now())
    AND (end_at   IS NULL OR end_at   >  now())
  );

DROP POLICY IF EXISTS "promos_service_all" ON public.promos;
CREATE POLICY "promos_service_all" ON public.promos
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.promos IS
  'Scheduled, audience-targeted announcement + promo CMS. Storefront resolves one row per position per request.';
