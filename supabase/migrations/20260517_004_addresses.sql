-- ============================================================================
-- Phase 1.7: Customer address book.
--
-- A signed-in customer can save multiple shipping addresses, one marked
-- default, and reuse them at checkout instead of re-typing.
-- ============================================================================

create table if not exists public.addresses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  label        text,                                          -- "Home", "Office", etc.
  first_name   text not null,
  last_name    text not null,
  phone        text not null,
  line1        text not null,
  line2        text,
  city         text not null,
  province     text,
  zip          text,
  is_default   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists addresses_user_idx on public.addresses (user_id);
-- At most one default per user.
create unique index if not exists addresses_one_default_per_user
  on public.addresses (user_id) where is_default;

drop trigger if exists addresses_set_updated_at on public.addresses;
create trigger addresses_set_updated_at
  before update on public.addresses
  for each row execute function public.set_updated_at();

alter table public.addresses enable row level security;

drop policy if exists addresses_select_own on public.addresses;
drop policy if exists addresses_insert_own on public.addresses;
drop policy if exists addresses_update_own on public.addresses;
drop policy if exists addresses_delete_own on public.addresses;

create policy addresses_select_own on public.addresses
  for select using ( auth.uid() = user_id );
create policy addresses_insert_own on public.addresses
  for insert with check ( auth.uid() = user_id );
create policy addresses_update_own on public.addresses
  for update using ( auth.uid() = user_id );
create policy addresses_delete_own on public.addresses
  for delete using ( auth.uid() = user_id );
