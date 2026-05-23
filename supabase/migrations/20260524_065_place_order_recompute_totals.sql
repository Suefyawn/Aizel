-- P0-2 fix: place_order previously trusted client-supplied subtotal / total
-- verbatim, letting a tampered cart submit `total: 1` for any number of
-- products. This redefines the RPC to:
--
--   1. Recompute subtotal server-side as SUM(products.price * qty) using the
--      same locked rows it already SELECT…FOR UPDATEs for stock.
--   2. Reject if the client-supplied subtotal diverges by more than 1 paisa.
--   3. Reject if total ≠ subtotal + shipping - discount_amount (±1 paisa).
--
-- The function signature is preserved so all existing callers still work.
-- Coupon discount cross-check vs the coupon's actual value is deliberately
-- left as a follow-up (P1) so this migration stays focused.

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
  v_order              public.orders;
  v_item               jsonb;
  v_product_id         uuid;
  v_qty                integer;
  v_stock              integer;
  v_unit_price         numeric;
  v_coupon             text;
  v_payment            text;
  v_user_id            uuid;
  v_gc_taken           numeric := 0;
  v_recomputed_sub     numeric := 0;
  v_client_sub         numeric;
  v_client_total       numeric;
  v_client_shipping    numeric;
  v_client_discount    numeric;
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

  -- Lock product rows (deterministic order) and stock + price-check in one pass.
  perform 1
  from public.products
  where id = any (
    select (i->>'id')::uuid
    from jsonb_array_elements(order_data->'items') i
    order by 1
  )
  for update;

  for v_item in select * from jsonb_array_elements(order_data->'items') loop
    v_product_id := (v_item->>'id')::uuid;
    v_qty        := coalesce((v_item->>'qty')::integer, 0);
    if v_qty <= 0 then raise exception 'invalid quantity for product %', v_product_id; end if;
    select stock, price into v_stock, v_unit_price
      from public.products where id = v_product_id;
    if v_stock is null then raise exception 'product % not found', v_product_id; end if;
    if v_stock < v_qty then
      raise exception 'insufficient stock for product %: requested %, available %', v_product_id, v_qty, v_stock;
    end if;
    -- P0-2: server-truth subtotal
    v_recomputed_sub := v_recomputed_sub + (v_unit_price * v_qty);
  end loop;

  -- P0-2: validate client-supplied totals against server truth.
  v_client_sub      := coalesce((order_data->>'subtotal')::numeric, 0);
  v_client_shipping := coalesce((order_data->>'shipping')::numeric, 0);
  v_client_discount := coalesce((order_data->>'discount_amount')::numeric, 0);
  v_client_total    := coalesce((order_data->>'total')::numeric, 0);

  if v_client_shipping < 0 then raise exception 'shipping cannot be negative'; end if;
  if v_client_discount < 0 then raise exception 'discount cannot be negative'; end if;
  if v_client_discount > v_recomputed_sub then
    raise exception 'discount % exceeds subtotal %', v_client_discount, v_recomputed_sub;
  end if;

  if abs(v_recomputed_sub - v_client_sub) > 0.01 then
    raise exception 'subtotal mismatch: server=%, client=%', v_recomputed_sub, v_client_sub;
  end if;

  if abs(v_client_total - (v_recomputed_sub + v_client_shipping - v_client_discount)) > 0.01 then
    raise exception 'total mismatch: server=%, client=%',
      v_recomputed_sub + v_client_shipping - v_client_discount, v_client_total;
  end if;

  -- Stamp referral on the profile if provided and unset.
  if v_user_id is not null and referred_by_code is not null and length(trim(referred_by_code)) > 0 then
    update public.profiles
      set referred_by_code = upper(trim(referred_by_code))
      where id = v_user_id and (referred_by_code is null or referred_by_code = '');
  end if;

  -- Insert order using SERVER-COMPUTED subtotal/total (defence in depth in
  -- case the validation above is bypassed by a future code path).
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
    v_recomputed_sub,
    v_client_shipping,
    v_recomputed_sub + v_client_shipping - v_client_discount,
    order_data->'items',
    case when v_payment in ('cod','gift_card') then 'pending' else 'payment_pending' end,
    v_user_id,
    nullif(order_data->>'coupon_code', ''),
    v_client_discount
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

  -- Apply gift card.
  if gift_card_code is not null and length(trim(gift_card_code)) > 0 then
    v_gc_taken := public.redeem_gift_card(gift_card_code, v_order.total, v_order.id);
    insert into public.payments (order_id, gateway, amount, status, txn_ref)
    values (v_order.id, 'gift_card', v_gc_taken, 'succeeded', upper(trim(gift_card_code)));
  end if;

  -- Apply loyalty points.
  if v_user_id is not null and points_redeem is not null and points_redeem > 0 then
    perform public.redeem_loyalty_points(v_user_id, points_redeem, v_order.id);
  end if;

  return v_order;
end;
$$;

comment on function public.place_order(jsonb, text, integer, text) is
  'Place an order with server-side subtotal recompute (P0-2 fix 2026-05-24).
   subtotal/total are computed from products.price*qty regardless of client
   input; mismatched client values raise an exception.';
