-- Expand the legacy single-resource grants 'orders' / 'products' / 'customers'
-- into the view·edit·delete permissions introduced alongside this migration.
--
-- A row that held 'orders' is expanded to all three orders.* permissions, so
-- existing staff and roles keep exactly the access they have today; the owner
-- can then narrow a role to e.g. orders.view-only from the Team UI. Applies to
-- both roles.permissions and staff_members.permissions. getStaffSession also
-- expands legacy tokens on read, so this migration and the code deploy are
-- order-independent.

update public.roles r
set permissions = (
  select coalesce(array_agg(distinct e), '{}')
  from unnest(r.permissions) as orig
  cross join lateral unnest(
    case orig
      when 'orders'    then array['orders.view','orders.edit','orders.delete']
      when 'products'  then array['products.view','products.edit','products.delete']
      when 'customers' then array['customers.view','customers.edit','customers.delete']
      else array[orig]
    end
  ) as e
)
where r.permissions && array['orders','products','customers'];

update public.staff_members s
set permissions = (
  select coalesce(array_agg(distinct e), '{}')
  from unnest(s.permissions) as orig
  cross join lateral unnest(
    case orig
      when 'orders'    then array['orders.view','orders.edit','orders.delete']
      when 'products'  then array['products.view','products.edit','products.delete']
      when 'customers' then array['customers.view','customers.edit','customers.delete']
      else array[orig]
    end
  ) as e
)
where s.permissions && array['orders','products','customers'];
