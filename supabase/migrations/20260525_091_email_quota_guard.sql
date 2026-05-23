-- Migration 091 — daily email-send quota guard.
--
-- Resend's free tier allows 100 emails/day. The daily cron's batch jobs
-- (review requests, reorder reminders, abandoned-cart drips, low-stock)
-- could grow to crowd that cap and silently drop a transactional *order*
-- email — the worst thing to lose.
--
-- email_quota counts sends per day. claim_email_send() is called from the
-- central send() helper in lib/email.ts: transactional mail always claims
-- a slot; batch/marketing mail is refused once the day's count reaches the
-- cap, so order confirmations keep their headroom.

create table if not exists public.email_quota (
  day  date primary key default current_date,
  sent integer not null default 0
);

alter table public.email_quota enable row level security;
-- No policies — internal infra counter, written only via the service-role
-- client through claim_email_send().

create or replace function public.claim_email_send(p_kind text, p_cap integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sent integer;
begin
  insert into public.email_quota (day, sent) values (current_date, 0)
    on conflict (day) do nothing;
  select sent into v_sent from public.email_quota where day = current_date for update;

  -- Batch/marketing mail yields once the day's budget is spent;
  -- transactional mail always sends.
  if p_kind <> 'transactional' and v_sent >= p_cap then
    return false;
  end if;

  update public.email_quota set sent = sent + 1 where day = current_date;
  return true;
end $$;

grant execute on function public.claim_email_send(text, integer) to service_role;
