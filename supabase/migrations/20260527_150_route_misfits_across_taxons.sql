-- ============================================================================
-- Route cross-taxon misfits surfaced by the post-taxonomy audit.
--
-- After the Hair Care + Styling cleanup (migrations 146–148), a sweep for
-- product names that conflict with their parent taxon turned up nine
-- final mis-tags:
--
--   • 7 Bigen Men Beard Colour SKUs sat in Hair Care > Hair Colour even
--     though Beard Colour is a beard-care product, not scalp hair dye.
--     Moves them to Grooming > Beard Care so beard-shopping customers
--     actually find them.
--
--   • Palmer's Cocoa Butter Set (Shampoo + Conditioner + Leave-In, 3pc)
--     was filed under Leave-In Conditioner because the leave-in pattern
--     matched the name. It's a real combo pack — moves to the
--     Shampoo & Conditioner combo leaf instead.
--
--   • Palmer's Cocoa Butter Collection (Lotion, Oil, Shampoo + more) was
--     filed under Shampoo for the same regex reason. The "Cocoa Butter"
--     headline is the dominant framing — moves it to Body Care > Cocoa
--     & Shea Butter where Palmer's belongs in shoppers' mental model.
--
-- Idempotent — each UPDATE filters by exact source leaf, so re-running
-- after an operator hand-curates won't flip them back.
-- ============================================================================

-- ── Bigen Men Beard Colour → Grooming > Beard Care ────────────────────────
update public.products
   set category = 'Beard Care', subcategory = 'Grooming'
 where category = 'Hair Colour' and status = 'published'
   and name ilike 'Bigen Men%Beard Col%';

-- ── Palmer's Cocoa Butter 3pc set → Shampoo & Conditioner combo leaf ──────
update public.products
   set category = 'Shampoo & Conditioner', subcategory = 'Hair Care'
 where category = 'Leave-In Conditioner' and status = 'published'
   and name ilike 'Palmer%s Cocoa Butter Shampoo%Conditioner%Leave-In%Set%';

-- ── Palmer's Cocoa Butter Collection → Body Care > Cocoa & Shea Butter ───
update public.products
   set category = 'Cocoa & Shea Butter', subcategory = 'Body Care'
 where category = 'Shampoo' and status = 'published'
   and name ilike 'Palmer%s Cocoa Butter Collection%';
