-- P0-1 fix: staff_members has been readable to anyone with the anon key since
-- its creation in 20260507_create_staff_members.sql. Enable RLS now and add
-- a service-role-only policy. The codebase has been updated in the same
-- commit to route every staff_members read through the service-role client
-- (src/lib/supabase.ts:supabaseAdmin), so this migration will not break the
-- admin login or team management flows.
--
-- After this lands: anon-key callers see zero rows. Authenticated end-user
-- callers also see zero rows (correct — customers should never read this).

alter table public.staff_members enable row level security;

drop policy if exists "staff_members_service_all" on public.staff_members;
create policy "staff_members_service_all" on public.staff_members
  for all to service_role using (true) with check (true);

comment on table public.staff_members is
  'Admin/staff accounts. RLS: service-role only. All reads/writes must use
   supabaseAdmin() client (NEVER the browser-shipped anon client).';
