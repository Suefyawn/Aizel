-- Migrate the legacy single-banner Settings form into the promos table.
--
-- Background: the old /admin/settings page had a "Promo Banner" card with
-- nine inputs (promo_active, promo_label, promo_headline, …) that wrote to
-- site_settings. /admin/promos was added later as a proper scheduled CMS
-- writing to the `promos` table. The two surfaces duplicated each other and
-- the storefront had to fall back through both — confusing for the owner.
--
-- This migration:
--   1. If promo_active = 'true', copies the nine settings into a single new
--      row in `promos` (position='hero_strip', kind='promo', priority=100
--      so it wins over any future rows until the owner re-orders).
--   2. Deletes all nine promo_* keys from site_settings.
--
-- Idempotent: after the keys are deleted, a second run finds no source data
-- and does nothing. Safe to re-apply.

DO $$
DECLARE
  v_active     text;
  v_headline   text;
  v_subline    text;
  v_label      text;
  v_cta_text   text;
  v_cta_url    text;
  v_bg         text;
  v_fg         text;
  v_end_date   text;
  v_end_ts     timestamptz;
BEGIN
  SELECT value INTO v_active FROM public.site_settings WHERE key = 'promo_active';

  IF v_active = 'true' THEN
    SELECT value INTO v_headline FROM public.site_settings WHERE key = 'promo_headline';
    SELECT value INTO v_subline  FROM public.site_settings WHERE key = 'promo_subline';
    SELECT value INTO v_label    FROM public.site_settings WHERE key = 'promo_label';
    SELECT value INTO v_cta_text FROM public.site_settings WHERE key = 'promo_cta_text';
    SELECT value INTO v_cta_url  FROM public.site_settings WHERE key = 'promo_cta_url';
    SELECT value INTO v_bg       FROM public.site_settings WHERE key = 'promo_bg_color';
    SELECT value INTO v_fg       FROM public.site_settings WHERE key = 'promo_text_color';
    SELECT value INTO v_end_date FROM public.site_settings WHERE key = 'promo_end_date';

    -- datetime-local stored value is "YYYY-MM-DDTHH:mm". Coerce to timestamptz
    -- if non-empty; bad values are swallowed so the migration always succeeds.
    v_end_ts := NULL;
    IF v_end_date IS NOT NULL AND v_end_date <> '' THEN
      BEGIN
        v_end_ts := v_end_date::timestamptz;
      EXCEPTION WHEN OTHERS THEN
        v_end_ts := NULL;
      END;
    END IF;

    INSERT INTO public.promos (
      kind, position, label, headline, subline,
      cta_text, cta_url, bg_color, text_color,
      end_at, show_countdown,
      enabled, priority
    ) VALUES (
      'promo',
      'hero_strip',
      NULLIF(v_label, ''),
      COALESCE(NULLIF(v_headline, ''), 'Up to 30% off'),
      NULLIF(v_subline, ''),
      COALESCE(NULLIF(v_cta_text, ''), 'Shop Sale'),
      COALESCE(NULLIF(v_cta_url, ''), '/shop'),
      COALESCE(NULLIF(v_bg, ''), '#E8487F'),
      COALESCE(NULLIF(v_fg, ''), '#ffffff'),
      v_end_ts,
      v_end_ts IS NOT NULL,
      true,
      100
    );
  END IF;

  -- Always drop the legacy keys, even if promo_active wasn't 'true'. The
  -- new Settings UI has no surface for them, so leaving them around just
  -- accumulates dead rows in site_settings.
  DELETE FROM public.site_settings WHERE key IN (
    'promo_active', 'promo_headline', 'promo_subline', 'promo_label',
    'promo_cta_text', 'promo_cta_url', 'promo_bg_color', 'promo_text_color',
    'promo_end_date'
  );
END $$;
