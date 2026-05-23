-- Migration 090 — turn audit_log into a full activity log.
--
-- audit_log already captures every admin write (via lib/audit.ts). But the
-- owner wants one feed of *everything happening in the system* — customer
-- signups, orders, reviews, subscriptions, newsletter joins, and every order
-- status change — not just staff actions.
--
-- Rather than instrument every code path (and miss the ones that change
-- later), this captures customer + system events with database triggers.
-- A trigger fires no matter which route, RPC, or cron made the write, so
-- the feed can't silently drift out of date.
--
-- The trigger body is wrapped in an exception guard: activity logging must
-- never roll back the real write (orders are inserted inside the place_order
-- SECURITY DEFINER function — a failed log there would fail the checkout).

-- 1. Allow 'customer' as an actor kind (was staff / owner / system only).
alter table public.audit_log drop constraint if exists audit_log_actor_kind_check;
alter table public.audit_log add constraint audit_log_actor_kind_check
  check (actor_kind in ('staff', 'owner', 'system', 'customer'));

-- 2. Generic activity-capture trigger. Branches on the source table.
create or replace function public.tg_log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action      text;
  v_entity      text;
  v_entity_id   text;
  v_actor_kind  text := 'customer';
  v_actor_id    text;
  v_actor_email text;
  v_diff        jsonb;
begin
  begin
    if tg_table_name = 'orders' then
      v_action := 'order.placed';
      v_entity := 'order';
      v_entity_id := new.id::text;
      v_actor_id := new.user_id::text;
      v_actor_email := new.email;
      v_diff := jsonb_build_object(
        'order_number', new.order_number, 'total', new.total,
        'pay_method', new.pay_method, 'status', new.status);

    elsif tg_table_name = 'order_events' then
      -- Skip the null -> pending creation row; order.placed already covers it.
      if new.from_status is null then return new; end if;
      v_action := 'order.status_changed';
      v_entity := 'order';
      v_entity_id := new.order_id::text;
      v_actor_kind := case when new.actor_kind = 'gateway' then 'system'
                           else coalesce(new.actor_kind, 'system') end;
      v_actor_id := new.actor_id::text;
      v_diff := jsonb_build_object('from', new.from_status, 'to', new.to_status, 'note', new.note);

    elsif tg_table_name = 'profiles' then
      v_action := 'customer.signup';
      v_entity := 'customer';
      v_entity_id := new.id::text;
      v_actor_id := new.id::text;
      v_diff := jsonb_build_object('first_name', new.first_name, 'last_name', new.last_name);

    elsif tg_table_name = 'product_reviews' then
      v_action := 'review.submitted';
      v_entity := 'review';
      v_entity_id := new.id::text;
      v_actor_id := new.user_id::text;
      v_actor_email := new.reviewer_email;
      v_diff := jsonb_build_object('product_id', new.product_id, 'rating', new.rating, 'approved', new.approved);

    elsif tg_table_name = 'reorder_subscriptions' then
      v_action := 'subscription.created';
      v_entity := 'subscription';
      v_entity_id := new.id::text;
      v_actor_id := new.user_id::text;
      v_actor_email := new.email;
      v_diff := jsonb_build_object('product_id', new.product_id, 'interval_days', new.interval_days);

    elsif tg_table_name = 'newsletter_subscribers' then
      v_action := 'newsletter.signup';
      v_entity := 'newsletter';
      v_entity_id := new.id::text;
      v_actor_email := new.email;
      v_diff := jsonb_build_object('source', new.source);

    else
      return new;
    end if;

    if v_action is not null then
      insert into public.audit_log (actor_kind, actor_id, actor_email, action, entity, entity_id, diff)
      values (v_actor_kind, v_actor_id, v_actor_email, v_action, v_entity, v_entity_id, v_diff);
    end if;
  exception when others then
    -- Activity logging must never block or roll back the real write.
    null;
  end;
  return new;
end $$;

-- 3. Wire the trigger onto every source table.
drop trigger if exists trg_activity on public.orders;
create trigger trg_activity after insert on public.orders
  for each row execute function public.tg_log_activity();

drop trigger if exists trg_activity on public.order_events;
create trigger trg_activity after insert on public.order_events
  for each row execute function public.tg_log_activity();

drop trigger if exists trg_activity on public.profiles;
create trigger trg_activity after insert on public.profiles
  for each row execute function public.tg_log_activity();

drop trigger if exists trg_activity on public.product_reviews;
create trigger trg_activity after insert on public.product_reviews
  for each row execute function public.tg_log_activity();

drop trigger if exists trg_activity on public.reorder_subscriptions;
create trigger trg_activity after insert on public.reorder_subscriptions
  for each row execute function public.tg_log_activity();

drop trigger if exists trg_activity on public.newsletter_subscribers;
create trigger trg_activity after insert on public.newsletter_subscribers
  for each row execute function public.tg_log_activity();

-- 4. Backfill historical activity so the feed isn't empty on first view.
--    Each insert is guarded by NOT EXISTS so re-running is a no-op, and
--    created_at is taken from the source row to keep the timeline accurate.
insert into public.audit_log (actor_kind, actor_id, actor_email, action, entity, entity_id, diff, created_at)
select 'customer', o.user_id::text, o.email, 'order.placed', 'order', o.id::text,
       jsonb_build_object('order_number', o.order_number, 'total', o.total, 'pay_method', o.pay_method, 'status', o.status),
       o.created_at
from public.orders o
where not exists (select 1 from public.audit_log a where a.action = 'order.placed' and a.entity_id = o.id::text);

insert into public.audit_log (actor_kind, actor_id, action, entity, entity_id, diff, created_at)
select 'customer', p.id::text, 'customer.signup', 'customer', p.id::text,
       jsonb_build_object('first_name', p.first_name, 'last_name', p.last_name), p.created_at
from public.profiles p
where not exists (select 1 from public.audit_log a where a.action = 'customer.signup' and a.entity_id = p.id::text);

insert into public.audit_log (actor_kind, actor_id, actor_email, action, entity, entity_id, diff, created_at)
select 'customer', r.user_id::text, r.reviewer_email, 'review.submitted', 'review', r.id::text,
       jsonb_build_object('product_id', r.product_id, 'rating', r.rating, 'approved', r.approved), r.created_at
from public.product_reviews r
where not exists (select 1 from public.audit_log a where a.action = 'review.submitted' and a.entity_id = r.id::text);

insert into public.audit_log (actor_kind, actor_id, action, entity, entity_id, diff, created_at)
select case when e.actor_kind = 'gateway' then 'system' else coalesce(e.actor_kind, 'system') end,
       e.actor_id::text, 'order.status_changed', 'order', e.order_id::text,
       jsonb_build_object('from', e.from_status, 'to', e.to_status, 'note', e.note), e.created_at
from public.order_events e
where e.from_status is not null
  and not exists (select 1 from public.audit_log a
                   where a.action = 'order.status_changed'
                     and a.entity_id = e.order_id::text and a.created_at = e.created_at);

insert into public.audit_log (actor_kind, actor_email, action, entity, entity_id, diff, created_at)
select 'customer', n.email, 'newsletter.signup', 'newsletter', n.id::text,
       jsonb_build_object('source', n.source), n.created_at
from public.newsletter_subscribers n
where not exists (select 1 from public.audit_log a where a.action = 'newsletter.signup' and a.entity_id = n.id::text);
