-- Email delivery log. Every send() attempt writes a row here (sent / failed /
-- skipped), and the Resend webhook (/api/webhooks/resend) fills in the
-- delivery lifecycle — delivered, opened, clicked, bounced, complained — by
-- matching on resend_id. Gives the admin one place to see what mail went out
-- and what happened to it.

create table if not exists public.email_log (
  id            uuid primary key default gen_random_uuid(),
  recipient     text not null,
  subject       text not null,
  kind          text not null default 'transactional',  -- transactional | batch
  status        text not null,                          -- sent | failed | skipped
  resend_id     text,                                   -- Resend message id
  error         text,
  -- Lifecycle timestamps, set from Resend webhook events.
  delivered_at  timestamptz,
  opened_at     timestamptz,
  clicked_at    timestamptz,
  bounced_at    timestamptz,
  complained_at timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists email_log_created_idx on public.email_log (created_at desc);
create index if not exists email_log_resend_idx  on public.email_log (resend_id) where resend_id is not null;
create index if not exists email_log_status_idx  on public.email_log (status);

-- Service-role only: written by send() and the webhook, read by the admin
-- page — all via supabaseAdmin(). Never exposed to the storefront.
alter table public.email_log enable row level security;
