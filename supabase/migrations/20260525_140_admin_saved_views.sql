-- 140 — per-staff saved filter views.
--
-- Pattern lifted from Linear / Jira: the operator filters a list page,
-- names the current filter, and gets a one-click button to re-apply it.
-- Each row stores:
--   • user_id   — the staff member who owns the view (NOT the customer)
--   • surface   — which page the view belongs to ('orders' for v1; the
--                 column lets us extend to products / customers without
--                 another migration)
--   • name      — what the operator typed
--   • query     — the URL query string we re-apply, e.g. "status=pending"
--   • is_shared — false = private, true = visible to every staffer.
--                 We don't expose the shared-views toggle in the v1 UI
--                 (avoids accidental "everyone sees my filter" surprises),
--                 but the column is there so we don't need a follow-up
--                 migration when we do.
--
-- Service-role-only — both read + write go through admin actions, no
-- need to expose the table to anon / authenticated.

CREATE TABLE IF NOT EXISTS public.admin_saved_views (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  surface     TEXT NOT NULL,
  name        TEXT NOT NULL,
  query       TEXT NOT NULL DEFAULT '',
  is_shared   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_saved_views ENABLE ROW LEVEL SECURITY;

-- A staff member can't have two views with the same name on the same
-- surface — keeps the dropdown free of duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS admin_saved_views_uniq
  ON public.admin_saved_views (user_id, surface, lower(name));

-- The "load my views" query filters by user_id + surface.
CREATE INDEX IF NOT EXISTS admin_saved_views_user_surface_idx
  ON public.admin_saved_views (user_id, surface, created_at DESC);
