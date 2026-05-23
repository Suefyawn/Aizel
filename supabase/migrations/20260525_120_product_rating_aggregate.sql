-- Denormalised review aggregate on products so the storefront can show a
-- star rating + count on product cards and the PDP without joining or
-- re-aggregating product_reviews on every query. Maintained by a trigger so
-- every existing `select *` product query picks the values up for free.
--
-- `rating` is NULL when a product has no approved reviews; `review_count` is
-- then 0. Only approved reviews count.

alter table public.products
  add column if not exists rating numeric(2,1),
  add column if not exists review_count integer not null default 0;

create or replace function public.recalc_product_rating(p_product_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.products p
  set review_count = sub.cnt,
      rating       = sub.avg_rating
  from (
    select count(*)::int               as cnt,
           round(avg(rating)::numeric, 1) as avg_rating
    from public.product_reviews
    where product_id = p_product_id and approved
  ) sub
  where p.id = p_product_id;
$$;

create or replace function public.product_reviews_rating_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalc_product_rating(old.product_id);
    return old;
  end if;
  perform public.recalc_product_rating(new.product_id);
  -- product_id reassignment is rare, but refresh the old product too.
  if tg_op = 'UPDATE' and old.product_id is distinct from new.product_id then
    perform public.recalc_product_rating(old.product_id);
  end if;
  return new;
end;
$$;

drop trigger if exists product_reviews_rating_sync on public.product_reviews;
create trigger product_reviews_rating_sync
after insert or update or delete on public.product_reviews
for each row execute function public.product_reviews_rating_sync();

-- Backfill existing approved reviews.
update public.products p
set review_count = coalesce(sub.cnt, 0),
    rating       = sub.avg_rating
from (
  select product_id,
         count(*)::int               as cnt,
         round(avg(rating)::numeric, 1) as avg_rating
  from public.product_reviews
  where approved
  group by product_id
) sub
where p.id = sub.product_id;
