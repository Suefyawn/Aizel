-- `original_price` is the strikethrough "was" price. It must be NULL (not on
-- sale) or strictly greater than `price`. An import left one product with
-- original_price = 0, which the storefront rendered as a stray "0" next to
-- the price. Null out any original_price that isn't a genuine higher price.
update public.products
set original_price = null
where original_price is not null and original_price <= price;
