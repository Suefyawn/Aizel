-- ============================================================================
-- Fix: percentage-coupon checkout rejected with "discount mismatch".
--
-- The storefront rounds a percentage discount to whole rupees
-- (Math.round → e.g. 635), but place_order rounded it to 2 decimals
-- (634.50). The discount + total guards then rejected the order because
-- client and server disagreed by the rounding remainder. PKR has no
-- circulating subunit, so the discount should be a whole rupee on both
-- sides — this rounds the server-side percentage discount to a whole
-- rupee, matching the client.
--
-- Only the percentage branch changes; everything else in place_order is
-- the migration-108 body verbatim.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.place_order(
  order_data jsonb,
  gift_card_code text DEFAULT NULL::text,
  points_redeem integer DEFAULT NULL::integer,
  referred_by_code text DEFAULT NULL::text
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
declare
  v_order              public.orders;
  v_item               jsonb;
  v_product_id         uuid;
  v_qty                integer;
  v_stock              integer;
  v_track              boolean;
  v_unit_price         numeric;
  v_coupon_code        text;
  v_coupon             public.coupons;
  v_payment            text;
  v_user_id            uuid;
  v_gc_taken           numeric := 0;
  v_recomputed_sub     numeric := 0;
  v_server_discount    numeric := 0;
  v_client_sub         numeric;
  v_client_total       numeric;
  v_client_shipping    numeric;
  v_client_discount    numeric;
  v_actor_email        text;
  v_actor_kind         text;
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
    select stock, price, track_inventory into v_stock, v_unit_price, v_track
      from public.products where id = v_product_id;
    if v_stock is null then raise exception 'product % not found', v_product_id; end if;
    if v_track and v_stock < v_qty then
      raise exception 'insufficient stock for product %: requested %, available %', v_product_id, v_qty, v_stock;
    end if;
    v_recomputed_sub := v_recomputed_sub + (v_unit_price * v_qty);
  end loop;

  v_client_sub      := coalesce((order_data->>'subtotal')::numeric, 0);
  v_client_shipping := coalesce((order_data->>'shipping')::numeric, 0);
  v_client_discount := coalesce((order_data->>'discount_amount')::numeric, 0);
  v_client_total    := coalesce((order_data->>'total')::numeric, 0);

  if v_client_shipping < 0 then raise exception 'shipping cannot be negative'; end if;
  if abs(v_recomputed_sub - v_client_sub) > 0.01 then
    raise exception 'subtotal mismatch: server=%, client=%', v_recomputed_sub, v_client_sub;
  end if;

  v_coupon_code := nullif(order_data->>'coupon_code', '');
  if v_coupon_code is not null then
    select * into v_coupon
      from public.coupons
      where upper(code) = upper(v_coupon_code)
      and active
      for update;
    if v_coupon.id is null then
      raise exception 'coupon % is not valid', v_coupon_code;
    end if;
    if v_coupon.expires_at is not null and v_coupon.expires_at < now() then
      raise exception 'coupon % has expired', v_coupon_code;
    end if;
    if v_coupon.max_uses is not null and v_coupon.used_count >= v_coupon.max_uses then
      raise exception 'coupon % has reached its usage limit', v_coupon_code;
    end if;
    if v_recomputed_sub < v_coupon.min_order then
      raise exception 'coupon % requires minimum order of %', v_coupon_code, v_coupon.min_order;
    end if;
    if v_coupon.max_order is not null and v_coupon.max_order > 0 and v_recomputed_sub > v_coupon.max_order then
      raise exception 'coupon % applies only to orders up to %', v_coupon_code, v_coupon.max_order;
    end if;

    if v_coupon.discount_type = 'free_shipping' then
      v_server_discount := 0;
    elsif v_coupon.discount_type = 'percent' or v_coupon.type = 'percent' then
      -- Whole-rupee rounding to match the storefront's Math.round (PKR has
      -- no circulating subunit). Was round(..., 2), which broke the
      -- discount / total guards for any non-integer percentage amount.
      v_server_discount := round(v_recomputed_sub * v_coupon.value / 100);
    else
      v_server_discount := v_coupon.value;
    end if;
    if v_server_discount > v_recomputed_sub then
      v_server_discount := v_recomputed_sub;
    end if;
  else
    if v_client_discount > 0 then
      raise exception 'discount supplied without coupon_code';
    end if;
    v_server_discount := 0;
  end if;

  if v_client_discount > v_server_discount + 0.01 then
    raise exception 'discount mismatch: server=%, client=%', v_server_discount, v_client_discount;
  end if;

  if abs(v_client_total - (v_recomputed_sub + v_client_shipping - v_server_discount)) > 0.01 then
    raise exception 'total mismatch: server=%, client=%',
      v_recomputed_sub + v_client_shipping - v_server_discount, v_client_total;
  end if;

  if v_user_id is not null and referred_by_code is not null and length(trim(referred_by_code)) > 0 then
    update public.profiles
      set referred_by_code = upper(trim(referred_by_code))
      where id = v_user_id and (referred_by_code is null or referred_by_code = '');
  end if;

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
    v_recomputed_sub + v_client_shipping - v_server_discount,
    order_data->'items',
    case when v_payment in ('cod','gift_card') then 'pending' else 'payment_pending' end,
    v_user_id,
    v_coupon_code,
    v_server_discount
  )
  returning * into v_order;

  v_actor_email := nullif(order_data->>'email', '');
  v_actor_kind  := case when v_user_id is null then 'system' else 'customer' end;

  for v_item in select * from jsonb_array_elements(order_data->'items') loop
    select track_inventory into v_track
      from public.products where id = (v_item->>'id')::uuid;
    if v_track then
      perform public.record_stock_change(
        p_product_id  => (v_item->>'id')::uuid,
        p_variant_id  => nullif(v_item->>'variant_id', '')::uuid,
        p_qty_delta   => -1 * (v_item->>'qty')::integer,
        p_reason      => 'order',
        p_order_id    => v_order.id,
        p_return_id   => NULL,
        p_actor_kind  => v_actor_kind,
        p_actor_email => v_actor_email,
        p_note        => NULL
      );
    end if;
  end loop;

  if v_coupon_code is not null then
    update public.coupons set used_count = used_count + 1 where id = v_coupon.id;
    insert into public.coupon_redemptions (coupon_id, user_id, email, order_id, amount)
    values (v_coupon.id, v_user_id, nullif(order_data->>'email', ''), v_order.id, v_server_discount)
    on conflict do nothing;
  end if;

  if gift_card_code is not null and length(trim(gift_card_code)) > 0 then
    v_gc_taken := public.redeem_gift_card(gift_card_code, v_order.total, v_order.id);
    insert into public.payments (order_id, gateway, amount, status, txn_ref)
    values (v_order.id, 'gift_card', v_gc_taken, 'succeeded', upper(trim(gift_card_code)));
  end if;

  if v_user_id is not null and points_redeem is not null and points_redeem > 0 then
    perform public.redeem_loyalty_points(v_user_id, points_redeem, v_order.id);
  end if;

  return v_order;
end;
$function$;
