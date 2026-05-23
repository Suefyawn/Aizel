-- Migration 127 — re-seed the five built-in roles.
--
-- Migration 124 created the roles table and seeded the same five rows, but on
-- production the seed didn't take (QA reports the admin Team → Roles panel is
-- empty). Re-running the inserts here, idempotently, fixes the gap without
-- touching anything else. Safe to apply on environments that already have the
-- rows: the unique constraint on `name` plus `on conflict do nothing` means
-- this is a no-op when the rows already exist, and any custom edits the owner
-- has made to a built-in role's permission set are preserved.

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
