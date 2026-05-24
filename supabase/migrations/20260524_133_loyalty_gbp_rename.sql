-- ============================================================================
-- Rename loyalty settings keys from PKR to GBP.
--
-- Background: migration 030 named the loyalty earn-rate and redeem-rate
-- settings `loyalty_points_per_pkr` / `loyalty_pkr_per_point` — leftover
-- from the YellowPink/Pakistan template. The store is now UK-only (GBP),
-- so the PKR-named keys both confuse operators reading the DB and mean a
-- fresh install pulls the right values under the wrong name.
--
-- Strategy:
--   1. Insert the new keys with values copied from the old ones (if they
--      exist), otherwise fall back to the migration-030 defaults so a
--      fresh install lands sensibly.
--   2. Drop the old PKR keys.
--   3. Replace the award_points_on_delivery trigger to read the new key.
-- ============================================================================

-- ─── 1. Migrate values from old key to new key ──────────────────────────────
insert into public.site_settings (key, value)
select 'loyalty_points_per_gbp',
       coalesce(
         (select value from public.site_settings where key = 'loyalty_points_per_pkr'),
         '0.1'  -- migration-030 default
       )
where not exists (select 1 from public.site_settings where key = 'loyalty_points_per_gbp');

insert into public.site_settings (key, value)
select 'loyalty_gbp_per_point',
       coalesce(
         (select value from public.site_settings where key = 'loyalty_pkr_per_point'),
         '1'    -- migration-030 default
       )
where not exists (select 1 from public.site_settings where key = 'loyalty_gbp_per_point');

-- ─── 2. Drop the old PKR-named keys ─────────────────────────────────────────
delete from public.site_settings where key in ('loyalty_points_per_pkr', 'loyalty_pkr_per_point');

-- ─── 3. Update the auto-award trigger to read the GBP key ───────────────────
create or replace function public.award_points_on_delivery()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rate     numeric;
  v_points   integer;
begin
  if new.status = 'delivered' and (old.status is distinct from 'delivered') and new.user_id is not null then
    select value::numeric into v_rate from public.site_settings where key = 'loyalty_points_per_gbp';
    if coalesce(v_rate, 0) > 0 then
      v_points := floor(new.total * v_rate)::integer;
      if v_points > 0 then
        perform public.grant_loyalty_points(new.user_id, v_points, 'order_delivered', new.id);
      end if;
    end if;

    -- Referral reward (paid out when first delivery, not when order is placed).
    if (select count(*) from public.orders where user_id = new.user_id and status = 'delivered') = 1 then
      perform public.award_referral_for_user(new.user_id);
    end if;
  end if;
  return new;
end $$;
