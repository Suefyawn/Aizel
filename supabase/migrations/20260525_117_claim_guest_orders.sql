-- Guest checkout writes orders with user_id = null. If the shopper already
-- has (or later creates) an account with the same email, those orders never
-- show up under "My Orders" because orders_select_own RLS keys on
-- auth.uid() = user_id.
--
-- claim_guest_orders() back-fills user_id on any unclaimed order whose email
-- matches the caller's own confirmed email. It is SECURITY DEFINER so it can
-- write past RLS, but it can only ever touch rows matching the JWT's own
-- identity — a caller cannot claim a stranger's orders. Requiring a confirmed
-- email means an unverified signup on someone else's address can't harvest
-- their order history.

create or replace function public.claim_guest_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_count integer := 0;
begin
  if v_uid is null then
    return 0;
  end if;

  select lower(email)
    into v_email
    from auth.users
   where id = v_uid
     and email_confirmed_at is not null;

  if v_email is null then
    return 0;
  end if;

  update public.orders
     set user_id = v_uid
   where user_id is null
     and email is not null
     and lower(email) = v_email;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.claim_guest_orders() from anon;
grant execute on function public.claim_guest_orders() to authenticated;
