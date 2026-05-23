-- ============================================================================
-- Rewrite product `how_to_use` for the 30 wellness products that carried
-- generic "take one tablet/capsule" text — regardless of the real form.
-- A kids' iron DROPS, a SYRUP, an EFFERVESCENT calcium and a FIBRE powder
-- were all telling customers to swallow a pill.
--
-- Each entry below is now form-correct and specific to the product's
-- purpose. Dosage is deliberately deferred to the packaging / physician —
-- exact mg/ml are real product data and are not invented here.
-- ============================================================================

update public.products set how_to_use = $$Take one tablet daily with food and a glass of water, or as directed by your physician. Joint and cartilage support builds up with consistent daily use.$$ where id = 'f376311d-532b-44d1-8c98-95b1285488cc'; -- Artibro
update public.products set how_to_use = $$Take once daily with water, with or after a meal — follow the dose printed on the pack, or your physician's advice.$$ where id = '97520dc1-edb6-42e6-9cf9-3b681b45a0d7'; -- Asco C
update public.products set how_to_use = $$Take one tablet daily with water, ideally after a meal or in the evening, or as directed by your physician.$$ where id = '542902e2-4ac5-4b8d-8a00-4b3ada84698a'; -- Calco Fit
update public.products set how_to_use = $$Take one tablet daily with water after a meal, or as directed by your physician.$$ where id = '138ac003-2125-4b45-9804-3c6dea8d01fe'; -- Calin G
update public.products set how_to_use = $$Take once daily with water after a meal — follow the dose on the pack, or as advised by your physician.$$ where id = 'ba9e0268-3dbb-4bfb-8bee-ac155a5ccdf9'; -- Calosent
update public.products set how_to_use = $$Take one tablet daily with water, after a meal, or as directed by your physician.$$ where id = 'eebbc10e-a8ae-4f68-bfd2-815cc91a5c79'; -- Cee
update public.products set how_to_use = $$Take with a full glass of water once or twice daily, as directed on the pack or by your physician. Staying well hydrated through the day helps it work.$$ where id = 'c6eca929-e48a-426f-9f4f-e4cb5ec113db'; -- Citowit
update public.products set how_to_use = $$Take once daily with water — follow the dose printed on the pack, or as directed by your physician.$$ where id = '309f45d8-f764-4c33-b7b4-ec8c67a56e9a'; -- Cranblue
update public.products set how_to_use = $$Use as directed on the packaging, or as advised by your physician.$$ where id = 'd53916a1-e90f-4ed7-8786-22e67f77db99'; -- Energy Boost
update public.products set how_to_use = $$Take one tablet daily with water and a meal, or as directed by your gynaecologist.$$ where id = '888c3fce-aa39-4a5e-b249-b4580e4bfd3f'; -- Femeez
update public.products set how_to_use = $$Take one tablet daily with water, after a meal. Avoid taking it alongside tea or coffee, which reduce iron absorption — or follow your physician's advice.$$ where id = '3f822cff-41a8-4489-a2c1-274f13235fe0'; -- Ferosim
update public.products set how_to_use = $$Take one tablet daily with water, or as directed by your physician. Use consistently for ongoing joint support.$$ where id = '86b3b60c-011c-42f1-8542-acb871a03a28'; -- Flex-4
update public.products set how_to_use = $$Chew one tablet daily — it can be taken with or without food, or as directed by your physician.$$ where id = 'adaee694-26ea-485c-89e8-4ea94872fd4a'; -- Fol Chew
update public.products set how_to_use = $$Stir one serving of the fibre into a full glass of water or juice and drink straight away, then follow with more water. Once or twice daily, or as directed on the pack.$$ where id = 'f6d81676-1983-4291-b4c1-a5dc6b38901c'; -- Fybosim
update public.products set how_to_use = $$Take one capsule daily with water, preferably in the morning on an empty stomach, or as directed by your physician.$$ where id = 'fc3c38ad-3d24-4f58-a11b-1cda359f43e9'; -- Gluthic
update public.products set how_to_use = $$Take daily as directed on the pack or by your gynaecologist, alongside regular feeding or pumping to support milk supply.$$ where id = 'db91c24d-4731-428a-acfa-f5126d4f4ff6'; -- Greelac
update public.products set how_to_use = $$Take one tablet daily with water, or as directed by your physician.$$ where id = '4ee2982d-7ee7-4dcc-b6e1-51ac2a887937'; -- Leukaz
update public.products set how_to_use = $$Take with water just before or with a meal, once daily or as directed by your physician.$$ where id = 'c3fb767a-03a5-44fc-b05a-074223dbe69d'; -- Marixtizer
update public.products set how_to_use = $$Take once daily with water and a meal containing some fat, which helps absorb vitamin D — or as directed by your physician.$$ where id = '2501c858-3cc3-41ed-a0ab-e2f2af60cb2b'; -- Meth D
update public.products set how_to_use = $$Take one tablet daily with water, or as directed by your physician.$$ where id = '2a42687c-5f00-4e9f-b838-bfbfe501d624'; -- Movin
update public.products set how_to_use = $$Shake the bottle well before use. Take the dose marked on the pack using the measuring cap, or as directed by your physician.$$ where id = '184c1a1b-6a23-4fdb-bba7-d155d808dc38'; -- Multiflux (syrup)
update public.products set how_to_use = $$Drop one effervescent tablet into a glass of water, let it dissolve completely, then drink. Once daily after a meal, or as directed by your physician.$$ where id = 'ca84e163-1f6f-4b80-ae34-6d43ddf38ec1'; -- NB Cal (effervescent)
update public.products set how_to_use = $$Take one tablet about 30–60 minutes before bedtime, or as directed by your physician. Use the lowest dose that works for you.$$ where id = '423d9981-1c5e-40f8-8ba9-d8d6c1fc5f75'; -- Puratin (melatonin)
update public.products set how_to_use = $$Take once daily with water and a meal, or as directed by your fertility specialist. Best started a few months before trying to conceive.$$ where id = 'bbbae4cc-238e-43d8-950a-ab0cee1428f0'; -- Repro F
update public.products set how_to_use = $$Take once daily with water and a meal, or as directed by your fertility specialist. Use consistently — sperm health responds over a two-to-three-month cycle.$$ where id = '6e20f906-e654-4812-ae86-32ae95ded60a'; -- Repro-M
update public.products set how_to_use = $$Using the dropper provided, give the dose advised by your child's paediatrician — it can be mixed into a little water or juice. Shake well before use.$$ where id = 'a4ef7773-d189-408c-aa8a-62b5c46dd188'; -- Semofer (kids drops)
update public.products set how_to_use = $$Take one tablet daily with water and a meal, or as directed by your gynaecologist — ideally started before and continued through early pregnancy.$$ where id = '1952391d-d7a5-4585-8708-4f5335449174'; -- Simfolic
update public.products set how_to_use = $$Take one capsule daily with water and a meal containing some fat, which aids absorption — or as directed by your physician.$$ where id = 'cbe288dd-ebba-42d8-9e44-f307f00783af'; -- Simzyme (CoQ10 capsule)
update public.products set how_to_use = $$Take one tablet daily with water, or as directed by your physician.$$ where id = '643397e8-5b9a-4706-af12-e652b4085125'; -- Ultrapin
update public.products set how_to_use = $$Take once daily with water and a meal containing some fat, which helps absorb vitamins K2 and D3 — or as directed by your physician.$$ where id = '47c05c71-6af5-4592-a675-44630bfb67f3'; -- Vit KD
