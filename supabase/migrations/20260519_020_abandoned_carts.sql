-- ============================================================================
-- Phase 3.1: Abandoned-cart recovery.
--
--   • abandoned_carts — captured when the user types an email at checkout.
--   • A restore_token gives a one-click link back into a populated cart.
--   • A cron job (see src/app/api/cron/abandoned-cart/route.ts) reads this
--     table and fires staged reminder emails (1 h, 24 h, 72 h with discount).
--   • Set recovered=true automatically when an order is placed with the
--     same email + within the same hour as the most recent activity.
-- ============================================================================

create table if not exists public.abandoned_carts (
  id              uuid primary key default gen_random_uuid(),
  email           citext not null,
  user_id         uuid references auth.users(id) on delete set null,
  cart_items      jsonb not null,                  -- snapshot of CartItem[]
  subtotal        numeric(10,2) not null,
  -- Stable per-cart token so reminder emails are link-only (no signed-in needed).
  restore_token   text not null unique default encode(gen_random_bytes(16), 'hex'),
  -- Tracks which reminders have been sent.
  reminder_tier   integer not null default 0 check (reminder_tier between 0 and 3),
  last_emailed_at timestamptz,
  -- Set true once the customer comes back and places an order, or staff dismisses.
  recovered       boolean not null default false,
  -- Auto-refreshed on every upsert so the cron job can find "stale enough" rows.
  last_activity_at timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index if not exists abandoned_carts_email_idx          on public.abandoned_carts (email);
create index if not exists abandoned_carts_recoverable_idx    on public.abandoned_carts (last_activity_at) where not recovered;
create index if not exists abandoned_carts_token_idx          on public.abandoned_carts (restore_token);

alter table public.abandoned_carts enable row level security;
-- Anon writes go through a SECURITY DEFINER RPC (see capture_abandoned_cart
-- below). The owner sees their own row via service-role; staff via admin.
-- No public-read policy.

-- ─── capture_abandoned_cart RPC ─────────────────────────────────────────────
-- Anon-callable. Upserts the user's cart snapshot (by email). Returns the
-- restore token so the client can stash it (optional).
create or replace function public.capture_abandoned_cart(
  p_email     text,
  p_cart      jsonb,
  p_subtotal  numeric,
  p_user_id   uuid default null
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if p_email is null or length(trim(p_email)) = 0 then
    raise exception 'email is required';
  end if;
  if jsonb_typeof(p_cart) <> 'array' or jsonb_array_length(p_cart) = 0 then
    raise exception 'cart must be a non-empty array';
  end if;

  insert into public.abandoned_carts (email, user_id, cart_items, subtotal)
  values (lower(trim(p_email)), p_user_id, p_cart, p_subtotal)
  on conflict (email) do update
    set cart_items       = excluded.cart_items,
        subtotal         = excluded.subtotal,
        user_id          = coalesce(excluded.user_id, public.abandoned_carts.user_id),
        last_activity_at = now(),
        -- Reset the reminder cadence when the cart changes — we want to
        -- start the 1h timer over.
        reminder_tier    = 0,
        last_emailed_at  = null,
        recovered        = false
    returning restore_token into v_token;

  if v_token is null then
    select restore_token into v_token from public.abandoned_carts
      where email = lower(trim(p_email));
  end if;

  return v_token;
end $$;

-- email is the upsert key.
create unique index if not exists abandoned_carts_email_unique
  on public.abandoned_carts (email);

grant execute on function public.capture_abandoned_cart(text, jsonb, numeric, uuid) to anon, authenticated;

-- ─── restore_abandoned_cart RPC ─────────────────────────────────────────────
-- Anon-callable. Given a token, return the cart snapshot (no PII beyond what
-- the user already had). Used by /cart?restore=<token>.
create or replace function public.restore_abandoned_cart(p_token text)
returns table (cart_items jsonb, subtotal numeric)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select c.cart_items, c.subtotal
  from public.abandoned_carts c
  where c.restore_token = p_token
    and not c.recovered
  limit 1;
end $$;

grant execute on function public.restore_abandoned_cart(text) to anon, authenticated;

-- ─── Mark recovered when an order is placed with a matching email ──────────
create or replace function public.mark_abandoned_cart_recovered()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is null or length(new.email) = 0 then
    return new;
  end if;
  update public.abandoned_carts
    set recovered = true
    where email = lower(trim(new.email))
      and not recovered;
  return new;
end $$;

drop trigger if exists orders_mark_abandoned_cart_recovered on public.orders;
create trigger orders_mark_abandoned_cart_recovered
  after insert on public.orders
  for each row execute function public.mark_abandoned_cart_recovered();
