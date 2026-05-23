-- The three "(All Shades)" makeup products (NARS Light Reflecting Foundation,
-- Rhode Peptide Lip Tints, SHEGLAM Liquid Blush) were imported as `variable`
-- products with per-shade product_variants rows (price, stock, image), but the
-- variants were never linked to attribute values. The PDP derives its shade
-- picker from variant_attribute_values -> attribute_values -> product_attributes,
-- so with no links the picker never rendered and shoppers couldn't choose a
-- shade.
--
-- This back-fills the missing data from the live WooCommerce catalogue
-- (yellowpink.pk Store API): one shared global "Shade" attribute, one
-- attribute_value per shade, and a variant_attribute_values link per variant
-- (matched on wp_variation_id). Idempotent — safe to re-run.

insert into public.product_attributes (slug, name, visible_on_pdp, usable_in_filter, sort_order)
values ('shade', 'Shade', true, false, 10)
on conflict (slug) do nothing;

do $$
declare
  v_attr_id uuid;
begin
  select id into v_attr_id from public.product_attributes where slug = 'shade';

  create temp table _shade_map (
    wp_variation_id bigint,
    value           text,
    slug            text,
    sort_order      integer
  ) on commit drop;

  insert into _shade_map (wp_variation_id, value, slug, sort_order) values
    -- Rhode Peptide Lip Tints
    (2012, 'Toast',          'toast',           1),
    (2013, 'Raspberry Jelly','raspberry-jelly', 2),
    (2014, 'Espresso',       'espresso',        3),
    (2015, 'Ribbon',         'ribbon',          4),
    -- SHEGLAM Liquid Blush
    (1939, 'Float On',       'float-on',        1),
    (1940, 'Risky Business', 'risky-business',  2),
    (1941, 'Hush Hush',      'hush-hush',       3),
    (1942, 'Love Cake',      'love-cake',       4),
    (1943, 'Birthday Suit',  'birthday-suit',   5),
    (1944, 'Devoted',        'devoted',         6),
    (1945, 'Rose Ritual',    'rose-ritual',     7),
    (1946, 'Swipe Right',    'swipe-right',     8),
    (1947, 'Real Deal',      'real-deal',       9),
    (1948, 'Cutie Pie',      'cutie-pie',      10),
    (1949, 'Hot Topic',      'hot-topic',      11),
    (1950, 'Orange Peel',    'orange-peel',    12),
    (1951, 'Petal Talk',     'petal-talk',     13),
    (1952, 'On-Point',       'on-point',       14),
    -- NARS Light Reflecting Foundation
    (1970, 'Oslo',           'oslo',            1),
    (1971, 'Siberia',        'siberia',         2),
    (1972, 'Mont Blanc',     'mont-blanc',      3),
    (1973, 'Yukon',          'yukon',           4),
    (1974, 'Gobi',           'gobi',            5),
    (1975, 'Salzburg',       'salzburg',        6),
    (1976, 'Deauville',      'deauville',       7),
    (1977, 'Vienna',         'vienna',          8),
    (1978, 'Fiji',           'fiji',            9),
    (1979, 'Punjab',         'punjab',         10),
    (1980, 'Vallauris',      'vallauris',      11),
    (1981, 'Santa Fe',       'santa-fe',       12),
    (1982, 'Sahel',          'sahel',          13),
    (1983, 'Stromboli',      'stromboli',      14),
    (1984, 'Vanuatu',        'vanuatu',        15),
    (1985, 'Barcelona',      'barcelona',      16),
    (1986, 'Valencia',       'valencia',       17),
    (1987, 'Aruba',          'aruba',          18),
    (1988, 'Syracuse',       'syracuse',       19),
    (1989, 'Tahoe',          'tahoe',          20),
    (1990, 'Moorea',         'moorea',         21),
    (1991, 'Huahine',        'huahine',        22),
    (1992, 'Cadiz',          'cadiz',          23),
    (1993, 'Caracas',        'caracas',        24),
    (1994, 'Belem',          'belem',          25),
    (1995, 'Macao',          'macao',          26),
    (1996, 'Marquises',      'marquises',      27),
    (1997, 'Manaus',         'manaus',         28),
    (1998, 'New Caledonia',  'new-caledonia',  29),
    (1999, 'Iguacu',         'iguacu',         30),
    (2000, 'Majorca',        'majorca',        31),
    (2001, 'Mali',           'mali',           32),
    (2002, 'Anguilla',       'anguilla',       33);

  insert into public.attribute_values (attribute_id, slug, value, sort_order)
  select v_attr_id, slug, value, sort_order from _shade_map
  on conflict (attribute_id, slug)
    do update set value = excluded.value, sort_order = excluded.sort_order;

  insert into public.variant_attribute_values (variant_id, attribute_value_id)
  select pv.id, av.id
  from _shade_map sm
  join public.product_variants pv on pv.wp_variation_id = sm.wp_variation_id
  join public.attribute_values av
    on av.attribute_id = v_attr_id and av.slug = sm.slug
  on conflict (variant_id, attribute_value_id) do nothing;
end $$;
