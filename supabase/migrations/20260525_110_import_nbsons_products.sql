-- ============================================================================
-- Import new products from the vendor catalogue (nbsons.com).
--
-- nbsons.com's catalogue beyond what Yellow Pink already lists is mostly
-- poultry / livestock supplements, which do not belong on a beauty + wellness
-- store. After filtering those out, four genuinely new, on-brand products are
-- added here as published items: a children's zinc syrup and three skincare
-- products. (A fifth, "Lumilit Serum", is omitted — the vendor lists no
-- description for it, so it can't be described accurately.)
--
-- The skincare items have no vendor-supplied copy; their descriptions here are
-- written from the product type and kept deliberately modest.
-- ============================================================================

insert into public.products
  (brand, name, slug, price, original_price, category, stock, status, kind, image_url,
   description, short_description, how_to_use, ingredients, key_benefits, faq)
values
  (
    null,
    'SimZee Zinc Syrup 60ml',
    'simzee-zinc-syrup',
    180, null,
    'Kids',
    50, 'published', 'simple',
    'https://cdn.shopify.com/s/files/1/0723/5597/1257/files/Mockups-10.jpg?v=1759223635',
    $d$SimZee is a zinc gluconate syrup formulated as nutritional zinc support for children. Each 5 ml teaspoon provides 20 mg of elemental zinc — useful when a child's appetite is low or minerals have been depleted by an upset stomach. It supports immunity, appetite and healthy growth in an easy-to-take syrup.$d$,
    $s$Children's zinc gluconate syrup — 20 mg elemental zinc per 5 ml. Supports immunity, appetite and healthy growth in an easy-to-dose syrup.$s$,
    $h$Shake well before use. Children: 1–2 teaspoons (5–10 ml) twice daily, ideally after meals, or as directed by your child's physician. Measure with a clean dosing spoon.$h$,
    $i$Each 5 ml contains Elemental Zinc (as Zinc Gluconate) 20 mg.$i$,
    $kb$[{"icon":"shield","text":"Supports immune health"},{"icon":"bolt","text":"Helps appetite and growth"},{"icon":"droplet","text":"Easy-to-dose syrup"},{"icon":"pulse","text":"Replenishes depleted zinc"}]$kb$::jsonb,
    $fq$[{"q":"Will SimZee improve my child's appetite?","a":"Zinc plays a role in taste and appetite, and many parents notice improved appetite with regular use — though this varies from child to child."},{"q":"Should it be taken before or after meals?","a":"It is usually given after meals to avoid any stomach unease. Shake well and measure with a clean dosing spoon."},{"q":"Is it suitable for adults?","a":"SimZee syrup is formulated for children. Adults are usually better served by a zinc tablet, which carries a higher dose."}]$fq$::jsonb
  ),
  (
    null,
    'Hydrating Face Wash',
    'hydrating-face-wash',
    1500, null,
    'Cleansers & Treatments',
    50, 'published', 'simple',
    'https://cdn.shopify.com/s/files/1/0723/5597/1257/files/FACEWASHMOCKUP.jpg?v=1761713580',
    $d$A gentle hydrating face wash that lifts away dirt, oil and makeup without stripping the skin. Its mild, moisturising formula leaves skin feeling soft, fresh and comfortable, and is suitable for daily morning and evening use.$d$,
    $s$Gentle hydrating face wash that cleanses without stripping — leaves skin soft, fresh and comfortable.$s$,
    $h$Massage a small amount onto damp skin in circular motions, avoiding the eyes, then rinse with water. Use morning and evening.$h$,
    $i$Please refer to the product packaging for the full ingredient list.$i$,
    $kb$[{"icon":"droplet","text":"Hydrating, non-stripping cleanse"},{"icon":"sparkle","text":"Removes dirt, oil and makeup"},{"icon":"leaf","text":"Gentle enough for daily use"},{"icon":"flower","text":"Leaves skin soft and fresh"}]$kb$::jsonb,
    null
  ),
  (
    null,
    'Vitamin C Serum',
    'vitamin-c-serum',
    2000, null,
    'Cleansers & Treatments',
    50, 'published', 'simple',
    'https://cdn.shopify.com/s/files/1/0723/5597/1257/files/VITAMIN_C_MOCKUP.jpg?v=1761719912',
    $d$A vitamin C facial serum that targets dullness and uneven tone. Used daily, vitamin C's antioxidant action helps brighten the complexion and supports a smoother, more radiant-looking finish.$d$,
    $s$Vitamin C facial serum that helps brighten dullness and even out skin tone for a radiant look.$s$,
    $h$After cleansing, smooth a few drops over the face and neck, avoiding the eye area. Use once daily; follow with moisturiser, and with sunscreen in the morning.$h$,
    $i$Please refer to the product packaging for the full ingredient list.$i$,
    $kb$[{"icon":"sparkle","text":"Brightens dull skin"},{"icon":"shield","text":"Antioxidant vitamin C"},{"icon":"flower","text":"Helps even skin tone"},{"icon":"droplet","text":"Lightweight daily serum"}]$kb$::jsonb,
    null
  ),
  (
    null,
    'Rooposh Feminine Wash',
    'rooposh-feminine-wash',
    800, null,
    'Women''s Health',
    50, 'published', 'simple',
    'https://cdn.shopify.com/s/files/1/0723/5597/1257/files/FEMININE_WASH_MOCKUP.jpg?v=1761716430',
    $d$Rooposh Feminine Wash is a gentle intimate hygiene wash, formulated to cleanse and refresh while respecting the skin's natural balance. Mild and soap-free, it is designed for comfortable everyday use.$d$,
    $s$Gentle intimate hygiene wash — cleanses and refreshes while respecting the skin's natural balance.$s$,
    $h$Apply a small amount to the external intimate area during your daily shower, lather gently and rinse thoroughly. For external use only.$h$,
    $i$Please refer to the product packaging for the full ingredient list.$i$,
    $kb$[{"icon":"flower","text":"Gentle intimate cleanse"},{"icon":"leaf","text":"Soap-free, mild formula"},{"icon":"droplet","text":"Refreshes and comforts"},{"icon":"shield","text":"Respects natural balance"}]$kb$::jsonb,
    null
  );
