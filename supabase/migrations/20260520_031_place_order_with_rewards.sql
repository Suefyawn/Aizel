-- ============================================================================
-- Extends place_order to atomically apply rewards on order placement:
--   • Optional gift_card_code → redeems up to `total` from the card.
--   • Optional points_redeem  → debits the user's loyalty balance.
--   • Optional referred_by_code → stamped onto profiles for the trigger
--     that pays out the referrer on first delivered order.
--
-- The function signature stays additive — passing only `order_data` still
-- works for legacy callers.
-- ============================================================================

create or replace function public.place_order(
  order_data       jsonb,
  gift_card_code   text default null,
  points_redeem    integer default null,
  referred_by_code text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order      public.orders;
  v_item       jsonb;
  v_product_id uuid;
  v_qty        integer;
  v_stock      integer;
  v_coupon     text;
  v_payment    text;
  v_user_id    uuid;
  v_gc_taken   numeric := 0;
  v_pkr_per_pt numeric;
begin
  if order_data is null or jsonb_typeof(order_data->'items') <> 'array' then
    raise exception 'order_data.items must be an array';
  end if;
  if jsonb_array_length(order_data->'items') = 0 then
    raise exception 'cart is empty';
  end if;

  v_payment := order_data->>'pay_method';
  if v_payment not in ('cod','card','bank','jazzcash','easypaisa','gift_card') then
    raise exception 'invalid pay_method: %', v_payment;
  end if;

  v_user_id := nullif(order_data->>'user_id', '')::uuid;

  -- Lock product rows (deterministic order).
  perform 1
  from public.products
  where id = any (
    select (i->>'id')::uuid
    from jsonb_array_elements(order_data->'items') i
    order by 1
  )
  for update;

  -- Verify stock.
  for v_item in select * from jsonb_array_elements(order_data->'items') loop
    v_product_id := (v_item->>'id')::uuid;
    v_qty        := coalesce((v_item->>'qty')::integer, 0);
    if v_qty <= 0 then raise exception 'invalid quantity for product %', v_product_id; end if;
    select stock into v_stock from public.products where id = v_product_id;
    if v_stock is null then raise exception 'product % not found', v_product_id; end if;
    if v_stock < v_qty then
      raise exception 'insufficient stock for product %: requested %, available %', v_product_id, v_qty, v_stock;
    end if;
  end loop;

  -- Stamp referral on the profile if provided and unset.
  if v_user_id is not null and referred_by_code is not null and length(trim(referred_by_code)) > 0 then
    update public.profiles
      set referred_by_code = upper(trim(referred_by_code))
      where id = v_user_id and (referred_by_code is null or referred_by_code = '');
  end if;

  -- Insert order.
  insert into public.orders (
    order_number, email, first_name, last_name, phone,
    address, city, province, zip,
    pay_method, subtotal, shipping, total,
    items, status, user_id, coupon_code, discount_amount
  ) values (
    order_data->>'order_number',
    nullif(order_data->>'email', ''),
    order_data->>'first_name',
    order_data->>'last_name',
    order_data->>'phone',
    order_data->>'address',
    order_data->>'city',
    nullif(order_data->>'province', ''),
    nullif(order_data->>'zip', ''),
    v_payment,
    (order_data->>'subtotal')::numeric,
    (order_data->>'shipping')::numeric,
    (order_data->>'total')::numeric,
    order_data->'items',
    case when v_payment in ('cod','gift_card') then 'pending' else 'payment_pending' end,
    v_user_id,
    nullif(order_data->>'coupon_code', ''),
    coalesce((order_data->>'discount_amount')::numeric, 0)
  )
  returning * into v_order;

  -- Decrement stock.
  for v_item in select * from jsonb_array_elements(order_data->'items') loop
    update public.products
      set stock = stock - (v_item->>'qty')::integer
      where id = (v_item->>'id')::uuid;
  end loop;

  -- Bump coupon usage.
  v_coupon := nullif(order_data->>'coupon_code', '');
  if v_coupon is not null then
    update public.coupons set used_count = used_count + 1 where code = v_coupon;
  end if;

  -- Apply gift card (after the order exists so we can ref order_id).
  if gift_card_code is not null and length(trim(gift_card_code)) > 0 then
    -- Take up to v_order.total — store the actual amount taken.
    v_gc_taken := public.redeem_gift_card(gift_card_code, v_order.total, v_order.id);
    -- Insert a record into payments so it shows up in reconciliation.
    insert into public.payments (order_id, gateway, amount, status, txn_ref)
    values (v_order.id, 'gift_card', v_gc_taken, 'succeeded', upper(trim(gift_card_code)));
  end if;

  -- Apply loyalty points.
  if v_user_id is not null and points_redeem is not null and points_redeem > 0 then
    -- redeem_loyalty_points raises if balance is insufficient.
    perform public.redeem_loyalty_points(v_user_id, points_redeem, v_order.id);
  end if;

  return v_order;
end $$;

-- Re-grant since CREATE OR REPLACE preserves but we want to be explicit.
grant execute on function public.place_order(jsonb, text, integer, text) to anon, authenticated;
