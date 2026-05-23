-- ============================================================================
-- Phase 5.3: Admin audit log.
--
-- Append-only record of every write performed by staff via the admin UI.
-- Powered by a tiny lib/audit.ts helper that's called from server actions.
-- ============================================================================

create table if not exists public.audit_log (
  id           uuid primary key default gen_random_uuid(),
  actor_kind   text not null check (actor_kind in ('staff','owner','system')),
  actor_id     text,                                -- staff_members.id or 'owner'
  actor_email  text,
  action       text not null,                       -- e.g. 'product.update', 'order.refund'
  entity       text,                                -- 'product' | 'order' | 'coupon' | …
  entity_id    text,
  diff         jsonb,                               -- { before: {…}, after: {…} } or arbitrary metadata
  ip           text,
  user_agent   text,
  created_at   timestamptz not null default now()
);

create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_entity_idx  on public.audit_log (entity, entity_id, created_at desc);
create index if not exists audit_log_actor_idx   on public.audit_log (actor_id, created_at desc) where actor_id is not null;

alter table public.audit_log enable row level security;
-- No public-read; only service-role (used by /admin/audit page).
