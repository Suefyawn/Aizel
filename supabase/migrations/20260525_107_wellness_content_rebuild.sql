-- ============================================================================
-- Rebuild wellness product content from the live WordPress / WooCommerce store.
--
-- The 44 wellness products had `description` polluted with the WordPress page
-- body (a "Description" heading + "Composition" list + a full FAQ Q&A dump),
-- and their `short_description`, `key_benefits`, `ingredients` and `how_to_use`
-- frequently described the WRONG product (e.g. the cognitive supplement
-- Citowit was sold as kidney-stone prevention; the topical cream Ultrapin
-- was tagged as a calcium tablet).
--
-- Each product below is rebuilt from its authoritative WordPress description:
-- a clean `description`, a concise `short_description`, the real `ingredients`
-- (composition), form-correct `how_to_use`, and `key_benefits` derived from
-- the genuine product. This supersedes migration 104/105 for these products.
-- Two categories that clearly clashed with the real product are corrected
-- (Flex-4 -> Men's Health, Semofer -> Kids); `faq` is rebuilt only where the
-- stored Q&A was about the wrong product.
-- ============================================================================

update public.products set
  description = $d$M-Sol Sachet is a fertility support supplement for women, built around myo-inositol with melatonin and folic acid. It is formulated to support healthy ovulation, improve egg quality and help regulate the menstrual cycle — making it a useful aid for women trying to conceive, including those managing PCOS.$d$,
  short_description = $s$Women's fertility sachet with myo-inositol (2000 mg), melatonin and folic acid. Supports healthy ovulation, egg quality and regular cycles.$s$,
  ingredients = $i$Myo-Inositol 2000 mg, Melatonin 1 mg, Folic Acid 200 mcg. Please check the pack for the complete formulation.$i$,
  how_to_use = $h$Empty one sachet into a glass of water, stir well and drink once daily, or as directed by your gynaecologist. Best taken consistently as part of a preconception routine.$h$,
  key_benefits = $kb$[{"icon": "flower", "text": "Supports healthy ovulation"}, {"icon": "dna", "text": "Helps improve egg quality"}, {"icon": "pulse", "text": "Aids regular menstrual cycles"}, {"icon": "heart", "text": "Useful in PCOS-related fertility"}]$kb$::jsonb
where wp_product_id = 2727;

update public.products set
  description = $d$X-Fit is an all-in-one men's vitality supplement that blends L-arginine, Tribulus terrestris, vitamin E, zinc and selenium. It is formulated to support healthy blood flow, natural testosterone, stamina and energy — helping men feel more active and confident day to day.$d$,
  short_description = $s$Men's vitality tablet with L-arginine, Tribulus, vitamin E, zinc and selenium. Supports blood flow, stamina, energy and natural testosterone.$s$,
  ingredients = $i$L-Arginine 100 mg, Tribulus Terrestris 300 mg, Vitamin E 100 mg, Zinc (as OptiZinc) 40 mg, Selenium 33 mcg.$i$,
  how_to_use = $h$Take one tablet daily with water, or as directed by your physician. Use consistently for ongoing support.$h$,
  key_benefits = $kb$[{"icon": "pulse", "text": "Supports healthy blood flow"}, {"icon": "bolt", "text": "Boosts energy and stamina"}, {"icon": "flame", "text": "Aids natural testosterone"}, {"icon": "heart", "text": "Supports male vitality"}]$kb$::jsonb
where wp_product_id = 2730;

update public.products set
  description = $d$Argivital Sachet is a powder supplement that dissolves into water, combining L-arginine with lycopene and coenzyme Q10. The blend supports nitric oxide production and healthy circulation, cellular energy and antioxidant protection — useful for cardiovascular wellness and male reproductive health.$d$,
  short_description = $s$Dissolvable sachet with L-arginine (2 g), CoQ10 (50 mg) and lycopene (15 mg). Supports circulation, cellular energy and antioxidant protection.$s$,
  ingredients = $i$L-Arginine 2 g, Lycopene 15 mg, Coenzyme Q10 50 mg.$i$,
  how_to_use = $h$Empty one sachet into a glass of cold water, stir well and drink immediately, once daily or as directed by your physician.$h$,
  key_benefits = $kb$[{"icon": "pulse", "text": "Supports nitric oxide and blood flow"}, {"icon": "heart", "text": "Aids cardiovascular wellness"}, {"icon": "bolt", "text": "Supports cellular energy"}, {"icon": "shield", "text": "Antioxidant protection"}]$kb$::jsonb
where wp_product_id = 2733;

update public.products set
  description = $d$Trimo-M is a herbal men's wellness supplement that brings together Ashwagandha, Tribulus terrestris, horny goat weed, fenugreek and zinc. This adaptogenic blend is formulated to support stamina, natural testosterone and resilience to everyday stress.$d$,
  short_description = $s$Herbal men's vitality blend with Ashwagandha, Tribulus, horny goat weed, fenugreek and zinc. Supports stamina, testosterone and stress resilience.$s$,
  ingredients = $i$Horny Goat Weed Extract 200 mg, Tribulus Terrestris Extract 120 mg, Quebracho Extract 200 mg, Fenugreek Extract 110 mg, Ashwagandha Root Extract 200 mg, Zinc Citrate 10 mg.$i$,
  how_to_use = $h$Take one tablet daily with water, or as directed by your physician. Use consistently for best results.$h$,
  key_benefits = $kb$[{"icon": "leaf", "text": "Adaptogenic herbal blend"}, {"icon": "flame", "text": "Aids natural testosterone"}, {"icon": "bolt", "text": "Supports stamina and energy"}, {"icon": "shield", "text": "Helps with everyday stress"}]$kb$::jsonb
where wp_product_id = 2735;

update public.products set
  description = $d$Repro-F is a comprehensive preconception multivitamin for women, combining folic acid with vitamins D3, E, C and the B-complex, plus iron, zinc, magnesium, selenium, L-arginine and inositol. It is formulated to support hormonal balance, egg quality and the nutritional needs of women planning a pregnancy.$d$,
  short_description = $s$Complete preconception multivitamin for women — folic acid, vitamins, minerals, L-arginine and inositol. Supports hormonal balance and egg quality.$s$,
  ingredients = $i$Folic Acid 400 mcg, Vitamin D3 600 IU, Vitamin E 30 mg, Vitamin C 90 mg, B-complex vitamins, Biotin 150 mcg, Iron 14 mg, Zinc 15 mg, Magnesium 60 mg, Selenium 50 mcg, Iodine 140 mcg, Copper 1 mg, L-Arginine 100 mg, Inositol 50 mg.$i$,
  how_to_use = $h$Take one tablet daily with water and a meal, or as directed by your gynaecologist. Ideally begin a few months before trying to conceive.$h$,
  key_benefits = $kb$[{"icon": "flower", "text": "Supports female fertility"}, {"icon": "dna", "text": "Aids egg quality"}, {"icon": "pulse", "text": "Helps hormonal balance"}, {"icon": "leaf", "text": "Complete preconception nutrition"}]$kb$::jsonb
where wp_product_id = 2738;

update public.products set
  description = $d$Repro-M is an advanced male fertility formula built around Peruvian maca, L-carnitine and coenzyme Q10, with a broad spectrum of antioxidant vitamins and minerals. It is formulated to support sperm count and motility, hormonal balance and overall reproductive wellness.$d$,
  short_description = $s$Advanced male fertility formula with Peruvian maca, L-carnitine, CoQ10 and antioxidants. Supports sperm count, motility and reproductive wellness.$s$,
  ingredients = $i$Peruvian Maca Extract 250 mg, L-Carnitine 50 mg, Coenzyme Q10, Lycopene, Pine Bark Extract, Siberian Ginseng, Inositol, L-Arginine, Vitamins A, C, D3, E and B-complex, Zinc 15 mg, Selenium 150 mcg, Iron, Magnesium, Copper, Manganese, Chromium.$i$,
  how_to_use = $h$Take once daily with water and a meal, or as directed by your fertility specialist. Use consistently — sperm health responds over a two-to-three-month cycle.$h$,
  key_benefits = $kb$[{"icon": "dna", "text": "Supports sperm count and motility"}, {"icon": "pulse", "text": "Aids hormonal balance"}, {"icon": "shield", "text": "Antioxidant protection for sperm"}, {"icon": "bolt", "text": "Supports reproductive energy"}]$kb$::jsonb
where wp_product_id = 2740;

update public.products set
  description = $d$Fol Chew is a chewable fertility supplement for women, combining folic acid with coenzyme Q10, vitamins D, E, B6 and B12, maca and lycopene. The chewable format is easy to take and is formulated to support reproductive health, hormonal balance and egg quality.$d$,
  short_description = $s$Chewable fertility booster with folic acid, CoQ10, vitamins D, E, B6, B12, maca and lycopene. Supports reproductive health and egg quality.$s$,
  ingredients = $i$Folic Acid, Coenzyme Q10, Vitamin D, Vitamin E, Vitamin B6, Vitamin B12, Maca Extract, Lycopene Extract.$i$,
  how_to_use = $h$Chew one tablet daily — it can be taken with or without food, or as directed by your physician.$h$,
  key_benefits = $kb$[{"icon": "flower", "text": "Supports reproductive health"}, {"icon": "dna", "text": "Aids egg quality"}, {"icon": "pulse", "text": "Helps hormonal balance"}, {"icon": "sparkle", "text": "Easy chewable format"}]$kb$::jsonb
where wp_product_id = 2742;

update public.products set
  description = $d$Fybosim is a natural dietary fibre supplement that supports healthy digestion and regular bowel movements. By helping you feel fuller for longer it also aids appetite control and weight management, and supports balanced cholesterol and blood sugar as part of a healthy diet.$d$,
  short_description = $s$100% natural fibre supplement for healthy digestion and regularity. Helps curb appetite and supports weight management and gut health.$s$,
  ingredients = $i$Natural dietary fibre blend. Please check the pack for the complete ingredient list and serving size.$i$,
  how_to_use = $h$Stir one serving into a full glass of water or juice and drink straight away, then follow with more water. Once or twice daily, or as directed on the pack.$h$,
  key_benefits = $kb$[{"icon": "leaf", "text": "Natural dietary fibre"}, {"icon": "pulse", "text": "Supports digestive regularity"}, {"icon": "droplet", "text": "Helps curb appetite"}, {"icon": "shield", "text": "Aids weight management"}]$kb$::jsonb
where wp_product_id = 2744;

update public.products set
  description = $d$Gluthic pairs glutathione, the body's master antioxidant, with vitamin C to support radiant, firmer-looking skin from within. It is formulated to help even skin tone, support skin elasticity and protect cells against oxidative stress, while also supporting the liver's natural detoxification.$d$,
  short_description = $s$Glutathione (500 mg) with vitamin C for skin radiance from within. Supports even tone, elasticity, antioxidant protection and liver health.$s$,
  ingredients = $i$Glutathione 500 mg, Vitamin C 50 mg.$i$,
  how_to_use = $h$Take one capsule daily with water, preferably in the morning on an empty stomach, or as directed by your physician.$h$,
  key_benefits = $kb$[{"icon": "sparkle", "text": "Glutathione for skin radiance"}, {"icon": "shield", "text": "Master antioxidant protection"}, {"icon": "leaf", "text": "Supports liver detox"}, {"icon": "flower", "text": "Helps even, firm skin"}]$kb$::jsonb
where wp_product_id = 2746;

update public.products set
  description = $d$MORR is a moringa supplement made from concentrated Moringa oleifera leaf extract — a plant naturally rich in vitamins, minerals and antioxidants. It is formulated to support immunity, natural energy, healthy digestion and overall daily nutrition.$d$,
  short_description = $s$Concentrated Moringa oleifera supplement, naturally rich in vitamins, minerals and antioxidants. Supports immunity, energy and daily nutrition.$s$,
  ingredients = $i$Moringa Oleifera Leaf Extract 500 mg.$i$,
  how_to_use = $h$Take one capsule daily with water, or as directed by your physician.$h$,
  key_benefits = $kb$[{"icon": "leaf", "text": "Nutrient-dense moringa"}, {"icon": "shield", "text": "Supports immunity"}, {"icon": "bolt", "text": "Natural energy support"}, {"icon": "pulse", "text": "Aids healthy digestion"}]$kb$::jsonb
where wp_product_id = 2748;

update public.products set
  description = $d$Cee is a chewable vitamin C tablet delivering 500 mg of vitamin C per tablet. It is formulated to support daily immunity, antioxidant protection and collagen formation — helping the body fight seasonal illness and supporting skin, gums and overall wellness.$d$,
  short_description = $s$Chewable vitamin C (500 mg) for daily immune support. Provides antioxidant protection and supports collagen, skin and energy.$s$,
  ingredients = $i$Vitamin C (Ascorbic Acid) 500 mg.$i$,
  how_to_use = $h$Chew one tablet daily — it can be taken with or without food, or as directed by your physician.$h$,
  key_benefits = $kb$[{"icon": "shield", "text": "Daily immune support"}, {"icon": "sparkle", "text": "Supports collagen and skin"}, {"icon": "leaf", "text": "Antioxidant protection"}, {"icon": "bolt", "text": "Helps everyday energy"}]$kb$::jsonb
where wp_product_id = 2750;

update public.products set
  description = $d$Simzyme is a coenzyme Q10 (CoQ10) supplement. CoQ10 is found in the body's cells, where it plays a key role in producing cellular energy and acts as an antioxidant. Simzyme is formulated to help reduce fatigue and support overall cardiovascular wellness.$d$,
  short_description = $s$Coenzyme Q10 (CoQ10) capsule that supports cellular energy and acts as an antioxidant. Helps reduce fatigue and supports heart health.$s$,
  ingredients = $i$Coenzyme Q10 (CoQ10) 100 mg.$i$,
  how_to_use = $h$Take one capsule daily with water and a meal containing some fat, which aids absorption — or as directed by your physician.$h$,
  key_benefits = $kb$[{"icon": "bolt", "text": "Supports cellular energy"}, {"icon": "heart", "text": "Aids cardiovascular wellness"}, {"icon": "shield", "text": "Antioxidant protection"}, {"icon": "pulse", "text": "Helps reduce fatigue"}]$kb$::jsonb
where wp_product_id = 2752;

update public.products set
  description = $d$Calco Fit is a magnesium supplement providing 500 mg of magnesium glycinate, a gentle, well-absorbed form of magnesium. It is formulated to support muscle relaxation, healthy nerve function, restful sleep and calmness, and to help maintain the body's overall mineral balance.$d$,
  short_description = $s$Magnesium glycinate (500 mg) — a gentle, well-absorbed magnesium. Supports muscle relaxation, nerve function, restful sleep and calm.$s$,
  ingredients = $i$Magnesium Glycinate 500 mg.$i$,
  how_to_use = $h$Take one tablet daily with a meal, which aids absorption — ideally in the evening — or as directed by your physician.$h$,
  key_benefits = $kb$[{"icon": "pulse", "text": "Eases muscle tension and cramps"}, {"icon": "moon", "text": "Supports restful sleep"}, {"icon": "leaf", "text": "Promotes calm"}, {"icon": "shield", "text": "Aids nerve and bone health"}]$kb$::jsonb
where wp_product_id = 2754;

update public.products set
  description = $d$Calosent is an effervescent supplement that combines two forms of calcium with vitamins D3, C and B6. Dropped into water it makes a pleasant daily drink, formulated to support strong bones, immunity, tissue repair and overall wellness.$d$,
  short_description = $s$Effervescent calcium drink with vitamins D3, C and B6. Supports strong bones, immunity, recovery and everyday wellness.$s$,
  ingredients = $i$Calcium Lactate Gluconate 1000 mg, Calcium Carbonate 300 mg, Vitamin D3 400 IU, Vitamin C 500 mg, Vitamin B6 10 mg.$i$,
  how_to_use = $h$Drop one effervescent tablet into a glass of water, let it dissolve completely, then drink. Once daily after a meal, or as directed by your physician.$h$,
  key_benefits = $kb$[{"icon": "shield", "text": "Strengthens bones"}, {"icon": "sun", "text": "Vitamin D for absorption"}, {"icon": "leaf", "text": "Supports immunity"}, {"icon": "bolt", "text": "Aids recovery and wellness"}]$kb$::jsonb
where wp_product_id = 2756;

update public.products set
  description = $d$Multiflux is a comprehensive multivitamin and mineral supplement, available as a syrup and as a tablet. With a broad blend of vitamins, minerals, antioxidants and omega-3, it is formulated to support immunity, energy, healthy blood formation and overall daily wellbeing.$d$,
  short_description = $s$Comprehensive multivitamin and mineral formula. Supports immunity, energy, healthy blood formation and overall daily wellbeing.$s$,
  ingredients = $i$A broad multivitamin and mineral blend including Vitamins A, C, D3, E, K and the B-complex, plus Calcium, Phosphorus, Magnesium, Zinc, Iodine, Selenium, Chromium, Lutein, Lycopene and Omega-3. Check the pack for the complete formulation.$i$,
  how_to_use = $h$Shake the bottle well before use. Take the dose marked on the pack using the measuring cap, after a meal, or as directed by your physician.$h$,
  key_benefits = $kb$[{"icon": "shield", "text": "Supports immunity"}, {"icon": "bolt", "text": "Boosts energy and vitality"}, {"icon": "pulse", "text": "Aids healthy blood formation"}, {"icon": "leaf", "text": "Complete daily nutrition"}]$kb$::jsonb
where wp_product_id = 2758;

update public.products set
  description = $d$Asco-C is an effervescent vitamin C drink, each serving delivering a high dose of vitamin C alongside calcium carbonate. Dissolved in water it makes a refreshing daily drink, formulated to support immunity, energy, healthy skin and strong bones.$d$,
  short_description = $s$Effervescent vitamin C and calcium drink. Supports immunity, energy, healthy skin and strong bones.$s$,
  ingredients = $i$Ascorbic Acid (Vitamin C) 1100 mg, Calcium Carbonate 300 mg, Anhydrous Citric Acid.$i$,
  how_to_use = $h$Dissolve one tablet or sachet in a glass of water and drink once daily, preferably after a meal, or as directed by your physician.$h$,
  key_benefits = $kb$[{"icon": "shield", "text": "High-strength vitamin C"}, {"icon": "bolt", "text": "Supports energy and immunity"}, {"icon": "sparkle", "text": "Aids skin and healing"}, {"icon": "leaf", "text": "Antioxidant protection"}]$kb$::jsonb
where wp_product_id = 2761;

update public.products set
  description = $d$S-Lyte is an oral rehydration salts (ORS) sachet, formulated with a balanced blend of glucose and electrolytes. It is used to replace fluids and electrolytes lost through diarrhoea, vomiting, heat or physical exertion, helping the body rehydrate quickly.$d$,
  short_description = $s$Oral rehydration salts (ORS) sachet with balanced glucose and electrolytes. Rapidly replaces fluids lost to diarrhoea, vomiting or heat.$s$,
  ingredients = $i$Anhydrous Glucose 20 g, Sodium Chloride 3.5 g, Sodium Citrate 2.9 g, Potassium Chloride 1.5 g.$i$,
  how_to_use = $h$Dissolve one sachet in the amount of clean drinking water stated on the pack, stir well and drink. Use within 24 hours; do not add sugar, juice or milk.$h$,
  key_benefits = $kb$[{"icon": "droplet", "text": "Rapid rehydration"}, {"icon": "pulse", "text": "Replenishes electrolytes"}, {"icon": "leaf", "text": "Gentle on the stomach"}, {"icon": "bolt", "text": "Supports recovery"}]$kb$::jsonb
where wp_product_id = 2763;

update public.products set
  description = $d$Semofer Drops are an iron supplement formulated for infants and children, combining iron polymaltose with folic acid, zinc, biotin and vitamin B12. Given with the dropper provided, they help prevent and address iron deficiency, supporting healthy blood, growth and immunity.$d$,
  short_description = $s$Children's iron drops with iron polymaltose, folic acid, zinc and B12. Help prevent iron deficiency and support healthy growth.$s$,
  ingredients = $i$Iron Polymaltose 50 mg, Folic Acid, Zinc, Biotin, Vitamin B12.$i$,
  how_to_use = $h$Using the dropper provided, give the dose advised by your child's paediatrician — it can be mixed into a little water or juice.$h$,
  key_benefits = $kb$[{"icon": "pulse", "text": "Supports healthy iron levels"}, {"icon": "heart", "text": "Aids red blood cell formation"}, {"icon": "shield", "text": "Supports immunity"}, {"icon": "bolt", "text": "Helps energy and growth"}]$kb$::jsonb,
  category = $c$Kids$c$
where wp_product_id = 2765;

update public.products set
  description = $d$Puratin is a melatonin supplement providing 4 mg per dose. Melatonin is the hormone that regulates the body's natural sleep-wake cycle, and Puratin is formulated to help you fall asleep more easily and improve sleep quality — useful for occasional sleeplessness, shift work or jet lag.$d$,
  short_description = $s$Melatonin (4 mg) sleep support. Helps regulate your natural sleep cycle for easier, better-quality sleep.$s$,
  ingredients = $i$Melatonin 4 mg.$i$,
  how_to_use = $h$Take one tablet about 30–60 minutes before bedtime, or as directed by your physician. Use the lowest dose that works for you.$h$,
  key_benefits = $kb$[{"icon": "moon", "text": "Supports restful sleep"}, {"icon": "pulse", "text": "Regulates the sleep cycle"}, {"icon": "leaf", "text": "Non-habit-forming"}, {"icon": "sparkle", "text": "Wake refreshed, not groggy"}]$kb$::jsonb
where wp_product_id = 2767;

update public.products set
  description = $d$F.lium Drops are a paediatric supplement delivering folic acid in an easy-dose liquid. Given with the dropper provided, they support healthy neural development, red blood cell production, immunity and overall growth in infants and children.$d$,
  short_description = $s$Children's folic acid drops in an easy-dose liquid. Support healthy growth, blood formation and immunity.$s$,
  ingredients = $i$Folic Acid 30 mcg per dose.$i$,
  how_to_use = $h$Using the dropper provided, give the dose advised by your child's paediatrician — it can be mixed into a little water or juice.$h$,
  key_benefits = $kb$[{"icon": "dna", "text": "Supports neural development"}, {"icon": "heart", "text": "Aids red blood cell production"}, {"icon": "shield", "text": "Supports immunity"}, {"icon": "bolt", "text": "Promotes healthy growth"}]$kb$::jsonb
where wp_product_id = 2769;

update public.products set
  description = $d$Simdac Drops are a paediatric vitamin D supplement, combining vitamin D3 with vitamins A and C in a kid-friendly liquid. Given with the dropper provided, they support strong bones and teeth, immunity and healthy growth, and are free from artificial preservatives.$d$,
  short_description = $s$Children's vitamin D drops with vitamins A and C. Support strong bones, immunity and healthy growth.$s$,
  ingredients = $i$Vitamin D3 400 IU, Vitamin A 100 IU, Vitamin C 25 mg.$i$,
  how_to_use = $h$Using the dropper provided, give the dose advised by your child's paediatrician — it can be given directly or mixed into a little water or juice.$h$,
  key_benefits = $kb$[{"icon": "sun", "text": "Vitamin D for strong bones"}, {"icon": "shield", "text": "Supports immunity"}, {"icon": "bolt", "text": "Promotes healthy growth"}, {"icon": "sparkle", "text": "Kid-friendly, preservative-free"}]$kb$::jsonb
where wp_product_id = 2771;

update public.products set
  description = $d$Kidogest Drops are a herbal digestive support liquid for infants and children, blending traditional soothing extracts such as fennel, ginger, peppermint and cardamom. They are formulated to ease colic, gas and tummy discomfort and support healthy digestion.$d$,
  short_description = $s$Herbal digestive drops for infants — fennel, ginger, peppermint and cardamom. Gently ease colic, gas and tummy discomfort.$s$,
  ingredients = $i$Cumin Extract 25 mg, Fennel Extract 15 mg, Peppermint Extract 15 mg, Ginger Extract 15 mg, Cardamom (Amomum) Extract 10 mg.$i$,
  how_to_use = $h$Using the dropper provided, give the dose advised by your child's paediatrician — it can be given directly or mixed into a little water. Shake well before use.$h$,
  key_benefits = $kb$[{"icon": "leaf", "text": "Traditional soothing herbs"}, {"icon": "pulse", "text": "Eases colic and gas"}, {"icon": "droplet", "text": "Gentle digestive support"}, {"icon": "sparkle", "text": "Easy-dose dropper"}]$kb$::jsonb
where wp_product_id = 2773;

update public.products set
  description = $d$Ferosim is an iron supplement formulated to prevent and address iron-deficiency anaemia. It combines gentle iron bisglycinate with L-methylfolate and vitamin C — the vitamin C helping the body absorb iron — to support healthy haemoglobin, energy and immunity.$d$,
  short_description = $s$Gentle iron supplement with iron bisglycinate, methylfolate and vitamin C. Helps prevent anaemia and supports energy — gentle on digestion.$s$,
  ingredients = $i$Iron Bisglycinate 130 mg, L-Methylfolate 200 mcg, Vitamin C 50 mg.$i$,
  how_to_use = $h$Take one tablet daily with water, after a meal. Avoid taking it alongside tea or coffee, which reduce iron absorption — or follow your physician's advice.$h$,
  key_benefits = $kb$[{"icon": "pulse", "text": "Supports healthy iron levels"}, {"icon": "heart", "text": "Aids haemoglobin and blood health"}, {"icon": "bolt", "text": "Helps reduce fatigue"}, {"icon": "leaf", "text": "Gentle on digestion"}]$kb$::jsonb
where wp_product_id = 2775;

update public.products set
  description = $d$Greelac is a lactation support supplement for breastfeeding mothers, blending traditional galactagogue herbs — fenugreek, blessed thistle, fennel and shatavari — with vitamin B12, calcium and vitamin D. It is formulated to help support and maintain a healthy breast-milk supply and maternal nutrition.$d$,
  short_description = $s$Lactation support for breastfeeding mothers — fenugreek, blessed thistle, fennel and shatavari with B12, calcium and vitamin D.$s$,
  ingredients = $i$Fenugreek 610 mg, Blessed Thistle, Fennel Seed Extract, Shatavari Root, Vitamin B12, Calcium, Vitamin D.$i$,
  how_to_use = $h$Take daily as directed on the pack or by your gynaecologist, alongside regular feeding or pumping to support milk supply.$h$,
  key_benefits = $kb$[{"icon": "flower", "text": "Supports healthy milk supply"}, {"icon": "leaf", "text": "Traditional galactagogue herbs"}, {"icon": "bolt", "text": "Aids maternal energy"}, {"icon": "heart", "text": "Supports postpartum recovery"}]$kb$::jsonb
where wp_product_id = 2784;

update public.products set
  description = $d$Simfolic combines 2,000 mg of myo-inositol with 400 mcg of folic acid — two nutrients with well-studied roles in women's reproductive health. It is formulated to support fertility, healthy ovulation and prenatal care, and helps reduce the risk of neural tube defects when taken before and during early pregnancy.$d$,
  short_description = $s$Myo-inositol (2000 mg) with folic acid (400 mcg). Supports fertility, ovulation and prenatal care; aids healthy early pregnancy.$s$,
  ingredients = $i$Myo-Inositol 2000 mg, Folic Acid 400 mcg.$i$,
  how_to_use = $h$Take one tablet daily with water and a meal, or as directed by your gynaecologist — ideally started before and continued through early pregnancy.$h$,
  key_benefits = $kb$[{"icon": "flower", "text": "Supports fertility and ovulation"}, {"icon": "dna", "text": "Folic acid for prenatal health"}, {"icon": "pulse", "text": "Aids metabolic balance"}, {"icon": "heart", "text": "Helps healthy early pregnancy"}]$kb$::jsonb
where wp_product_id = 2786;

update public.products set
  description = $d$Leukaz is a herbal supplement for women, blending traditional plant extracts — fenugreek, asafoetida, ashwagandha and turmeric. This time-honoured combination is used to support women's everyday wellness and balance.$d$,
  short_description = $s$Herbal women's wellness supplement with fenugreek, asafoetida, ashwagandha and turmeric extracts.$s$,
  ingredients = $i$Fenugreek (Trigonella Foenum-graecum) Extract 20 mg, Turmeric (Curcuma Longa) Extract 20 mg, Ashwagandha (Withania Somnifera) Extract 8 mg, Asafoetida (Ferula Assafoetida) Extract 2 mg.$i$,
  how_to_use = $h$Take one tablet daily with water, or as directed by your physician.$h$,
  key_benefits = $kb$[{"icon": "leaf", "text": "Traditional herbal blend"}, {"icon": "flower", "text": "Supports women's wellness"}, {"icon": "pulse", "text": "Aids everyday balance"}, {"icon": "shield", "text": "Plant-based formula"}]$kb$::jsonb
where wp_product_id = 2788;

update public.products set
  description = $d$Femeez is a women's wellness supplement that combines chasteberry (Vitex) with magnesium, vitamins B6 and B12, and soothing ginger and chamomile extracts. It is formulated to support hormonal balance, menstrual comfort and a smoother transition through perimenopause and menopause.$d$,
  short_description = $s$Women's wellness blend with chasteberry, magnesium, B6, B12, ginger and chamomile. Supports hormonal balance and menstrual comfort.$s$,
  ingredients = $i$Chasteberry (Vitex) Extract 40 mg, Ginger Extract 200 mg, Chamomile Extract 100 mg, Magnesium Oxide 100 mg, Vitamin B6 50 mg, Vitamin B12 2.5 mg.$i$,
  how_to_use = $h$Take one tablet daily with water and a meal, or as directed by your gynaecologist.$h$,
  key_benefits = $kb$[{"icon": "flower", "text": "Supports hormonal balance"}, {"icon": "pulse", "text": "Aids menstrual comfort"}, {"icon": "leaf", "text": "Soothing herbal extracts"}, {"icon": "moon", "text": "Eases the menopause transition"}]$kb$::jsonb
where wp_product_id = 2791;

update public.products set
  description = $d$Syror is a women's wellness supplement providing 50 mg of soy isoflavones — plant compounds with phytoestrogen and antioxidant properties. It is formulated to support hormonal balance and overall female vitality, particularly during menopause and times of hormonal change.$d$,
  short_description = $s$Soy isoflavones (50 mg) for women's wellness. Plant-based support for hormonal balance, especially during menopause.$s$,
  ingredients = $i$Soy Isoflavones 50 mg.$i$,
  how_to_use = $h$Take one tablet daily with water, or as directed by your physician. Use consistently for ongoing support.$h$,
  key_benefits = $kb$[{"icon": "flower", "text": "Supports hormonal balance"}, {"icon": "leaf", "text": "Plant-based phytoestrogens"}, {"icon": "shield", "text": "Antioxidant properties"}, {"icon": "moon", "text": "Eases menopausal change"}]$kb$::jsonb
where wp_product_id = 2793;

update public.products set
  description = $d$Movin is a nutritional support powder for women, combining dietary fibre with a broad blend of essential vitamins and minerals. It is formulated to support healthy digestion, daily energy and metabolism, and to help the body absorb nutrients — rounding out everyday nutrition.$d$,
  short_description = $s$Women's nutritional support powder — fibre plus essential vitamins and minerals. Supports digestion, energy and everyday wellness.$s$,
  ingredients = $i$Dietary fibre with a multivitamin and mineral blend including Vitamins A, C, D3, E, K2 and the B-complex, plus Calcium, Magnesium, Zinc, Iron, Iodine, Selenium and other trace minerals.$i$,
  how_to_use = $h$Stir one serving into a glass of water and drink, once daily or as directed on the pack.$h$,
  key_benefits = $kb$[{"icon": "leaf", "text": "Fibre for digestive health"}, {"icon": "bolt", "text": "Supports energy and metabolism"}, {"icon": "flower", "text": "Rounds out women's nutrition"}, {"icon": "pulse", "text": "Aids nutrient absorption"}]$kb$::jsonb
where wp_product_id = 2795;

update public.products set
  description = $d$Flex-4 is a men's wellness tablet formulated to support reproductive health and overall male vitality. It blends Tongkat Ali and Tribulus terrestris with vitamin E and zinc — botanicals and nutrients traditionally used to support stamina, hormonal balance and vitality in adult men.$d$,
  short_description = $s$Men's vitality tablet with Tongkat Ali, Tribulus, vitamin E and zinc. Supports reproductive health, stamina and overall male wellness.$s$,
  ingredients = $i$Tongkat Ali 200 mg, Tribulus Terrestris 250 mg, Vitamin E, Zinc, OS Extract.$i$,
  how_to_use = $h$Take one tablet daily with water, or as directed by your physician. Use consistently for ongoing support.$h$,
  key_benefits = $kb$[{"icon": "flame", "text": "Supports male vitality"}, {"icon": "bolt", "text": "Aids stamina and energy"}, {"icon": "pulse", "text": "Helps hormonal balance"}, {"icon": "heart", "text": "Supports reproductive health"}]$kb$::jsonb,
  category = $c$Men's Health$c$
where wp_product_id = 2806;

update public.products set
  description = $d$Stevoice is a natural sweetener made from stevia leaf extract (steviol glycosides) — compounds many times sweeter than sugar but with zero calories. It lets you sweeten drinks and food without raising blood sugar, making it a good choice for diabetics and anyone reducing sugar.$d$,
  short_description = $s$Natural zero-calorie sweetener from stevia leaf extract. Sweetens without raising blood sugar — ideal for diabetics and low-sugar diets.$s$,
  ingredients = $i$Stevia (Stevia rebaudiana) leaf extract (steviol glycosides).$i$,
  how_to_use = $h$Use in place of sugar to sweeten tea, coffee, drinks or food. A little goes a long way — stevia is far sweeter than sugar, so add gradually to taste.$h$,
  key_benefits = $kb$[{"icon": "leaf", "text": "Natural plant-based sweetener"}, {"icon": "sparkle", "text": "Zero calories"}, {"icon": "pulse", "text": "Doesn't spike blood sugar"}, {"icon": "shield", "text": "Suitable for diabetics"}]$kb$::jsonb
where wp_product_id = 2808;

update public.products set
  description = $d$Finkuff is a herbal dry-cough syrup for adults and children, blending traditional respiratory botanicals such as tulsi, vasaka, licorice and clove. It is formulated to soothe a dry, tickly cough, calm throat irritation and support easier breathing — without causing drowsiness.$d$,
  short_description = $s$Herbal dry-cough syrup for adults and kids. Soothes a dry, tickly cough and throat irritation — non-drowsy.$s$,
  ingredients = $i$Tinospora Cordifolia 35 mg, Ocimum Sanctum (Tulsi) 30 mg, Syzygium Aromaticum (Clove) 15 mg, Elettaria Cardamom 15 mg, Adhatoda Vasica (Vasaka) 15 mg, Glycyrrhiza Glabra (Licorice) 15 mg, Viola Odorata 10 mg.$i$,
  how_to_use = $h$Shake the bottle well before use. Take the dose marked on the pack using the measuring cap, or as directed by your physician.$h$,
  key_benefits = $kb$[{"icon": "leaf", "text": "Herbal respiratory blend"}, {"icon": "pulse", "text": "Soothes a dry cough"}, {"icon": "droplet", "text": "Calms throat irritation"}, {"icon": "sparkle", "text": "Non-drowsy formula"}]$kb$::jsonb
where wp_product_id = 2812;

update public.products set
  description = $d$Pelargonium Ivy Leaf is a herbal cough syrup combining Pelargonium sidoides and ivy leaf extracts. Pelargonium supports the immune response to respiratory infections while ivy leaf works as a natural expectorant — together easing cough, clearing chest congestion and supporting comfortable breathing.$d$,
  short_description = $s$Herbal cough syrup with Pelargonium sidoides and ivy leaf extract. Eases cough, clears chest congestion and supports easy breathing.$s$,
  ingredients = $i$Pelargonium Sidoides Extract 100 mg, Ivy Leaf (Hedera Helix) Extract 100 mg.$i$,
  how_to_use = $h$Shake the bottle well before use. Take the dose marked on the pack using the measuring cap, or as directed by your physician.$h$,
  key_benefits = $kb$[{"icon": "leaf", "text": "Pelargonium + ivy leaf herbs"}, {"icon": "pulse", "text": "Eases cough"}, {"icon": "droplet", "text": "Helps clear chest congestion"}, {"icon": "shield", "text": "Supports respiratory immunity"}]$kb$::jsonb
where wp_product_id = 2814;

update public.products set
  description = $d$NB Cal is an effervescent calcium supplement providing 500 mg of USP-grade calcium carbonate per serving. Dropped into water it dissolves into a pleasant drink that is easy to absorb, supporting strong bones and teeth, healthy muscle and nerve function.$d$,
  short_description = $s$Effervescent calcium (500 mg calcium carbonate) for strong bones and teeth. Dissolves into an easy-to-absorb daily drink.$s$,
  ingredients = $i$Calcium Carbonate 500 mg.$i$,
  how_to_use = $h$Drop one effervescent tablet into a glass of water, let it dissolve completely, then drink. Once daily after a meal, or as directed by your physician.$h$,
  key_benefits = $kb$[{"icon": "shield", "text": "Strengthens bones and teeth"}, {"icon": "pulse", "text": "Supports muscle and nerve function"}, {"icon": "droplet", "text": "Fast-absorbing effervescent"}, {"icon": "bolt", "text": "Easy daily calcium"}]$kb$::jsonb
where wp_product_id = 2816;

update public.products set
  description = $d$Simrid is a chesty-cough syrup built around ivy leaf extract, a well-established herbal remedy for productive coughs. It works as a natural expectorant to loosen thick mucus and calm coughing fits, helping to clear the chest and support easier, more comfortable breathing.$d$,
  short_description = $s$Herbal chesty-cough syrup with ivy leaf extract. Loosens mucus, calms coughing fits and helps clear the chest.$s$,
  ingredients = $i$Ivy Leaf Extract 35 mg.$i$,
  how_to_use = $h$Shake the bottle well before use. Take the dose marked on the pack using the measuring cap, or as directed by your physician.$h$,
  key_benefits = $kb$[{"icon": "leaf", "text": "Herbal ivy leaf extract"}, {"icon": "droplet", "text": "Loosens chest mucus"}, {"icon": "pulse", "text": "Calms coughing fits"}, {"icon": "moon", "text": "Helps you rest easier"}]$kb$::jsonb
where wp_product_id = 2820;

update public.products set
  description = $d$Cranblue is a cranberry and blueberry sachet formulated to support urinary tract health. The cranberry extract is rich in proanthocyanidins (PACs), which help stop bacteria adhering to the urinary tract — making Cranblue useful for preventing recurring UTIs, alongside antioxidant support.$d$,
  short_description = $s$Cranberry and blueberry sachet for urinary tract health. Helps prevent recurring UTIs with antioxidant support.$s$,
  ingredients = $i$Cranberry Juice Extract 250 mg, Blueberry Extract 200 mg.$i$,
  how_to_use = $h$Empty one sachet into a glass of water, stir and drink once daily — follow the pack, or as directed by your physician. Staying well hydrated helps it work.$h$,
  key_benefits = $kb$[{"icon": "shield", "text": "Helps prevent UTIs"}, {"icon": "droplet", "text": "Supports urinary tract health"}, {"icon": "leaf", "text": "Cranberry + blueberry antioxidants"}, {"icon": "flower", "text": "Daily preventive support"}]$kb$::jsonb
where wp_product_id = 2824;

update public.products set
  description = $d$Eletcid is a herbal antacid syrup that blends soothing oils — anise, peppermint, cardamom, eucalyptus and dill with menthol. It is formulated to relieve heartburn and acidity, neutralise excess stomach acid and ease bloating and gas, supporting comfortable digestion after meals.$d$,
  short_description = $s$Herbal antacid syrup with anise, peppermint and cardamom oils. Relieves heartburn, acidity, bloating and gas.$s$,
  ingredients = $i$Anise Oil 0.5 ml, Menthol 0.5 ml, Dill Extract 0.4 ml, Eucalyptus Oil 0.35 ml, Cardamom Oil 0.3 ml, Peppermint Oil 0.2 ml (per dose).$i$,
  how_to_use = $h$Shake the bottle well before use. Take the dose marked on the pack using the measuring cap, after meals or when needed, or as directed by your physician.$h$,
  key_benefits = $kb$[{"icon": "flame", "text": "Relieves heartburn fast"}, {"icon": "droplet", "text": "Neutralises excess acid"}, {"icon": "leaf", "text": "Soothing herbal oils"}, {"icon": "pulse", "text": "Eases bloating and gas"}]$kb$::jsonb
where wp_product_id = 2826;

update public.products set
  description = $d$Marixtizer is a natural appetite and digestion syrup that supports healthy weight gain. Blending fenugreek with fennel, ginger and soothing oils, it is formulated to gently stimulate appetite, improve digestion and nutrient absorption, and ease bloating and nausea — helping the body build strength over time.$d$,
  short_description = $s$Natural syrup that supports healthy appetite, digestion and weight gain. Blends fenugreek, fennel and ginger to help you eat and absorb more.$s$,
  ingredients = $i$Fenugreek Extract 1.5 mg, Fennel Extract 0.75 mg, Peppermint Oil 0.5 mg, Cardamom Oil 0.25 mg, Eucalyptus Oil 0.25 mg, Ginger Extract 0.25 mg (per 10 ml).$i$,
  how_to_use = $h$Shake the bottle well before use. Take the dose marked on the pack using the measuring cap, or as directed by your physician.$h$,
  key_benefits = $kb$[{"icon": "leaf", "text": "Naturally stimulates appetite"}, {"icon": "pulse", "text": "Supports healthy weight gain"}, {"icon": "droplet", "text": "Aids digestion and absorption"}, {"icon": "sparkle", "text": "Eases bloating and nausea"}]$kb$::jsonb
where wp_product_id = 2828;

update public.products set
  description = $d$Citowit is a brain and cognition supplement combining Ginkgo biloba and Panax ginseng extracts. It is formulated to support healthy blood flow to the brain, sharpen memory, focus and mental clarity, and help maintain a balanced, positive mood under everyday stress.$d$,
  short_description = $s$Cognitive support supplement with Ginkgo biloba and Panax ginseng. Supports memory, focus, mental clarity and mood.$s$,
  ingredients = $i$Ginkgo Biloba Extract 120 mg, Panax Ginseng Extract 150 mg.$i$,
  how_to_use = $h$Take one tablet daily with water, or as directed by your physician. Use consistently for ongoing cognitive support.$h$,
  key_benefits = $kb$[{"icon": "bolt", "text": "Supports focus and mental clarity"}, {"icon": "sparkle", "text": "Aids memory and learning"}, {"icon": "pulse", "text": "Improves blood flow to the brain"}, {"icon": "leaf", "text": "Herbal Ginkgo + ginseng blend"}]$kb$::jsonb,
  faq = $fq$[{"q": "What is Citowit used for?", "a": "Citowit is a cognitive support supplement. Its Ginkgo biloba and Panax ginseng help support memory, focus, mental clarity and a balanced mood."}, {"q": "When should I take it?", "a": "Take one tablet daily with water. Many people prefer the morning; use it consistently, as the benefits build over time."}, {"q": "How long until I notice a difference?", "a": "Herbal cognitive support is gradual — most people use Citowit consistently for several weeks. Consult your physician if you have any concerns."}]$fq$::jsonb
where wp_product_id = 2830;

update public.products set
  description = $d$Meth-D is a supplement that combines methylcobalamin — the active form of vitamin B12 — with vitamin D3. Together they support healthy nerve function, red blood cell production and cognitive clarity, while the vitamin D3 supports calcium absorption and bone density.$d$,
  short_description = $s$Methylcobalamin (active vitamin B12) with vitamin D3. Supports nerve health, healthy blood, cognitive clarity and strong bones.$s$,
  ingredients = $i$Methylcobalamin (Vitamin B12), Vitamin D3 (Cholecalciferol).$i$,
  how_to_use = $h$Take one tablet daily with water and a meal containing some fat, which helps absorb vitamin D — or as directed by your physician.$h$,
  key_benefits = $kb$[{"icon": "pulse", "text": "Supports healthy nerve function"}, {"icon": "heart", "text": "Aids red blood cell production"}, {"icon": "sparkle", "text": "Supports cognitive clarity"}, {"icon": "sun", "text": "Vitamin D3 for strong bones"}]$kb$::jsonb
where wp_product_id = 2838;

update public.products set
  description = $d$Artibro is a joint support supplement that combines glucosamine and chondroitin sulphate with hyaluronic acid, manganese, vitamin C and a turmeric extract. It is formulated to help rebuild and protect cartilage, lubricate the joints and ease stiffness — supporting comfortable, flexible movement.$d$,
  short_description = $s$Joint support with glucosamine, chondroitin, hyaluronic acid and turmeric. Helps rebuild cartilage, lubricate joints and ease stiffness.$s$,
  ingredients = $i$Glucosamine Sulphate 500 mg, Chondroitin Sulphate 400 mg, Vitamin C (Ascorbic Acid) 100 mg, Curcuma Xanthorrhiza (Turmeric) Extract 100 mg, Hyaluronic Acid 55 mg, Manganese 2 mg.$i$,
  how_to_use = $h$Take one capsule daily with food and a glass of water, or as directed by your physician. Joint and cartilage support builds up with consistent daily use.$h$,
  key_benefits = $kb$[{"icon": "shield", "text": "Helps rebuild cartilage"}, {"icon": "droplet", "text": "Supports joint lubrication"}, {"icon": "pulse", "text": "Eases joint stiffness"}, {"icon": "leaf", "text": "Turmeric for inflammation comfort"}]$kb$::jsonb
where wp_product_id = 2840;

update public.products set
  description = $d$Calin-G is a bone health supplement pairing 500 mg of calcium carbonate with 400 IU of vitamin D3. The vitamin D3 helps the body absorb the calcium, so the two work together to support bone strength and density — useful for maintaining healthy bones through adulthood and later life.$d$,
  short_description = $s$Bone health tablet with calcium carbonate (500 mg) and vitamin D3 (400 IU). Supports strong, dense bones.$s$,
  ingredients = $i$Calcium Carbonate 500 mg, Vitamin D3 400 IU.$i$,
  how_to_use = $h$Take one tablet daily with water after a meal, or as directed by your physician.$h$,
  key_benefits = $kb$[{"icon": "shield", "text": "Strengthens bones"}, {"icon": "sun", "text": "Vitamin D3 for absorption"}, {"icon": "pulse", "text": "Supports bone density"}, {"icon": "bolt", "text": "Easy daily tablet"}]$kb$::jsonb,
  faq = $fq$[{"q": "What is in Calin-G?", "a": "Each Calin-G tablet provides 500 mg of calcium carbonate with 400 IU of vitamin D3."}, {"q": "Why is vitamin D3 included?", "a": "Vitamin D3 helps your body absorb calcium, so pairing the two makes the calcium in Calin-G more effective for bone strength."}, {"q": "When should I take it?", "a": "Take one tablet daily with water after a meal, which aids absorption, or as directed by your physician."}]$fq$::jsonb
where wp_product_id = 2842;

update public.products set
  description = $d$Ultrapin is a topical pain-relief cream for muscle and joint pain. Powered by menthol and camphor, it delivers a cooling, soothing sensation when massaged into the skin — providing fast-acting relief from body aches, joint stiffness, soreness and minor injuries.$d$,
  short_description = $s$Topical pain-relief cream with menthol and camphor. Massage in for fast, cooling relief from muscle and joint pain.$s$,
  ingredients = $i$Menthol, Camphor. For external use only — see the pack for the full ingredient list.$i$,
  how_to_use = $h$For external use only. Gently massage a small amount onto the affected area up to 3–4 times a day. Wash hands after use, and avoid broken skin and the eyes.$h$,
  key_benefits = $kb$[{"icon": "sparkle", "text": "Cooling, soothing relief"}, {"icon": "pulse", "text": "Eases muscle and joint pain"}, {"icon": "bolt", "text": "Fast-acting on contact"}, {"icon": "leaf", "text": "Menthol + camphor formula"}]$kb$::jsonb,
  faq = $fq$[{"q": "How do I use Ultrapin?", "a": "Ultrapin is for external use only. Massage a small amount gently into the affected muscle or joint up to three to four times a day, then wash your hands."}, {"q": "Where should I not apply it?", "a": "Avoid broken or irritated skin, the eyes and other sensitive areas. If irritation develops, stop using it."}, {"q": "How quickly does it work?", "a": "The cooling sensation from menthol is felt almost immediately; comfort from soreness and stiffness builds with regular use."}]$fq$::jsonb
where wp_product_id = 2846;

update public.products set
  description = $d$Vit KD is a bone-health supplement combining high-strength vitamin D3 with vitamin K2. The two fat-soluble vitamins work together — D3 helps the body absorb calcium, while K2 helps direct that calcium into the bones rather than the arteries — supporting both skeletal and cardiovascular health.$d$,
  short_description = $s$High-strength vitamin D3 with K2. D3 helps absorb calcium; K2 directs it to your bones — supporting bone and heart health.$s$,
  ingredients = $i$Vitamin D3 10,000 IU, Vitamin K2 180 mcg.$i$,
  how_to_use = $h$Take once daily with water and a meal containing some fat, which helps absorb vitamins K2 and D3 — or as directed by your physician.$h$,
  key_benefits = $kb$[{"icon": "sun", "text": "High-strength vitamin D3"}, {"icon": "shield", "text": "K2 directs calcium to bone"}, {"icon": "heart", "text": "Supports cardiovascular health"}, {"icon": "pulse", "text": "Aids bone density"}]$kb$::jsonb
where wp_product_id = 2848;
