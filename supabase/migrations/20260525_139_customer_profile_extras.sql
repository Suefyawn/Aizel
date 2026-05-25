-- 139 — staff-curated extras on a customer profile.
--
-- Two columns the storefront doesn't surface but the cashier and CSR want
-- on the till / customer detail page:
--   • notes  — freeform staff note ("buys for daughter", "allergic to fragrance")
--   • tags   — short chip-style labels ("VIP", "Wholesale", "Influencer")
--
-- Kept in a sidecar table rather than columns on `profiles` so the
-- storefront-facing profile API doesn't have to opt out of them. The PK
-- IS the user_id, so there's always at most one row per customer.

CREATE TABLE IF NOT EXISTS public.customer_profile_extras (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  notes       TEXT,
  tags        TEXT[] NOT NULL DEFAULT '{}',
  -- Who last touched the row + when. We don't need a full audit history
  -- here — every write also gets a row in audit_log via logAudit().
  updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Service-role-only. The /admin/users/[id] page and POS customer-lookup
-- both go through supabaseAdmin() with permission checks; no need to
-- expose a row-level policy to the anon / authenticated roles.
ALTER TABLE public.customer_profile_extras ENABLE ROW LEVEL SECURITY;

-- Tag filtering (e.g. "show me everyone tagged 'VIP'") uses && on
-- text[] — a GIN index keeps that cheap as the customer count grows.
CREATE INDEX IF NOT EXISTS customer_profile_extras_tags_idx
  ON public.customer_profile_extras USING GIN (tags);
