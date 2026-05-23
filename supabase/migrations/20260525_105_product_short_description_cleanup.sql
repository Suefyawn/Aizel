-- ============================================================================
-- Clean up product `short_description` text.
--
-- 1. 21 products carried raw HTML numeric entities (&#8217; &#8230; &#8211;
--    &#8220; &#8221;) left over from a WordPress export — they rendered
--    literally as "&#8217;" on the storefront instead of ’ … – “ ”.
-- 2. One product — Energy Boost — had a `short_description` that was OCR
--    garbage describing an unrelated topical pain-relief product
--    ("sore muscles", "me Ue ah siz", stray pipes). Its real `description`,
--    `ingredients` and `key_benefits` all describe an anti-fatigue energy
--    supplement, so the blurb is rewritten to match the actual product.
-- ============================================================================

-- 1. Decode the leftover HTML entities.
update public.products
set short_description = replace(replace(replace(replace(replace(
      short_description,
      '&#8217;', '’'),
      '&#8230;', '…'),
      '&#8211;', '–'),
      '&#8220;', '“'),
      '&#8221;', '”')
where short_description like '%&#%';

-- 2. Replace the garbled Energy Boost blurb with copy that matches its
--    real description and key benefits (B-complex + CoQ10 energy support).
update public.products
set short_description = $$Energy Boost is a revitalizing supplement that helps combat fatigue and sharpen physical and mental performance. Its B-complex and CoQ10 blend supports metabolism, eases tiredness, and promotes lasting stamina and alertness.$$
where id = 'd53916a1-e90f-4ed7-8786-22e67f77db99';
