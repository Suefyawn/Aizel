-- Sent newsletter campaigns. The admin "Newsletter" page composes a subject +
-- body and mails it to every active newsletter_subscribers row; each send is
-- recorded here so the merchant has a history of what went out and to how
-- many people.
--
-- Sending is synchronous (admin server action), so a row is written once the
-- send loop finishes, with the final recipient/sent counts.

create table if not exists public.newsletter_campaigns (
  id              uuid primary key default gen_random_uuid(),
  subject         text not null,
  body            text not null,
  -- Active subscribers at send time vs. how many emails Resend accepted
  -- (lower when the daily free-tier cap is hit).
  recipient_count integer not null default 0,
  sent_count      integer not null default 0,
  sent_by         text,
  created_at      timestamptz not null default now()
);

create index if not exists newsletter_campaigns_created_idx
  on public.newsletter_campaigns (created_at desc);

-- Service-role only: the admin page reads + writes via supabaseAdmin(), which
-- bypasses RLS. No anon/authenticated policies — campaigns are never exposed
-- to the storefront.
alter table public.newsletter_campaigns enable row level security;
