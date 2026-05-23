-- ============================================================================
-- Phase 5.9: Staff 2FA columns.
-- Phase 5.10: Granular RBAC table for resource×action permissions.
-- ============================================================================

-- ─── 2FA columns on staff_members ──────────────────────────────────────────
alter table public.staff_members
  add column if not exists totp_secret    text,            -- base32 RFC 4648, null = 2FA off
  add column if not exists totp_enabled   boolean not null default false,
  add column if not exists backup_codes   text[] not null default '{}';   -- one-time hex codes

-- ─── Optional granular permission grid ─────────────────────────────────────
-- The existing string-array in staff_members.permissions ('analytics',
-- 'orders', …) stays as the coarse-grained gate (it's what every NoAccess
-- page and assert*() helper already checks). This table layers resource×
-- action grants ('orders:refund', 'products:delete', etc.) for when you
-- want finer control. A scope of '*' means "any action".
create table if not exists public.staff_grants (
  staff_id   uuid not null references public.staff_members(id) on delete cascade,
  resource   text not null,                              -- 'product' | 'order' | 'coupon' | …
  action     text not null,                              -- 'read' | 'write' | 'refund' | 'delete' | '*'
  primary key (staff_id, resource, action)
);

alter table public.staff_grants enable row level security;
-- App-side reads via service-role; no public policies.
