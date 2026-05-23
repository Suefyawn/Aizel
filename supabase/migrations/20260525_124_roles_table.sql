-- Named, saved roles for staff access. Replaces the in-code role-template
-- presets with owner-editable rows: the owner defines a role once (a name plus
-- a permission set), assigns it to staff, and edits it in one place — every
-- staff member who holds the role picks up the change on their next request.
--
-- A staff member either carries a role_id (effective permissions = the role's
-- permissions) or has role_id = NULL and runs on its own permissions[] column
-- ("Custom"). Existing rows default to role_id = NULL, so they keep their
-- current permissions unchanged.

create table if not exists public.roles (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null unique,
  description text        not null default '',
  permissions text[]      not null default '{}',
  -- Built-in roles seeded below. is_system protects them from deletion in the
  -- UI; the owner can still edit their permission sets.
  is_system   boolean     not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Service-role only: the admin Team page reads + writes via supabaseAdmin(),
-- which bypasses RLS. No anon/authenticated policies — roles are never exposed
-- to the storefront.
alter table public.roles enable row level security;

-- Nullable FK so existing staff rows keep working (role_id = NULL = "Custom").
-- ON DELETE SET NULL: deleting a role detaches its staff, who fall back to
-- their own permissions[] column rather than losing access abruptly.
alter table public.staff_members
  add column if not exists role_id uuid references public.roles(id) on delete set null;

create index if not exists staff_members_role_id_idx on public.staff_members (role_id);

-- Seed the five built-in roles. (Owner is the isOwner flag, not a role;
-- "Custom" is role_id = NULL, not a row.) Permission sets mirror the
-- ROLE_TEMPLATES presets the in-code permission module previously carried.
insert into public.roles (name, description, permissions, is_system) values
  ('Manager',
   'Full operational access — everything except platform settings.',
   array['orders','products','customers','coupons','returns','blog','promos','reviews','newsletter','analytics','analytics_traffic','analytics_errors','analytics_refresh'],
   true),
  ('Marketer',
   'Content, promos, coupons, and traffic insights — no orders or customer PII.',
   array['blog','promos','reviews','newsletter','coupons','analytics','analytics_traffic'],
   true),
  ('Customer support',
   'Orders, customers, and returns — no editorial or catalog changes.',
   array['orders','customers','returns'],
   true),
  ('Inventory',
   'Products only — catalog + stock management.',
   array['products'],
   true),
  ('Analyst',
   'Read-only access to every analytics + monitoring surface.',
   array['analytics','analytics_traffic','analytics_errors','analytics_refresh'],
   true)
on conflict (name) do nothing;

-- Backfill: attach existing staff to a seeded role when their permissions array
-- exactly matches that role's set (set comparison — order and duplicates are
-- ignored). Non-matching rows stay role_id = NULL and keep running on their
-- own permissions[] column.
update public.staff_members s
set role_id = r.id
from public.roles r
where s.role_id is null
  and r.permissions <@ s.permissions
  and s.permissions <@ r.permissions;
