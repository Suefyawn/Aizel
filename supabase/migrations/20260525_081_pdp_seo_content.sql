-- Migration 081 — PDP content + SEO fields.
--
-- Adds admin-editable content blocks that flesh out the product page
-- (key benefits, FAQ, usage tips, social proof) plus explicit SEO
-- override fields (title, description, og image) so editors don't have
-- to fight the brand+name auto-templating when they want to target a
-- specific keyword.
--
-- Why JSONB for key_benefits + faq:
--   - The shape is fixed (small array of {q,a} or {icon,text}) but the
--     length varies per product. A side table (product_faqs) would
--     give us better filterability but the admin UX is one editor
--     surface, not "FAQ admin". JSON wins on round-trip simplicity.
--   - Both end up in JSON-LD anyway (FAQPage schema, no relational
--     traversal needed).

ALTER TABLE public.products
  -- SEO overrides — null = use the auto-generated value.
  ADD COLUMN IF NOT EXISTS seo_title        text,
  ADD COLUMN IF NOT EXISTS seo_description  text,
  ADD COLUMN IF NOT EXISTS og_image_url     text,
  -- Long-form content blocks rendered on the PDP between the gallery
  -- and the existing description/how-to/ingredients tabs.
  ADD COLUMN IF NOT EXISTS key_benefits     jsonb,
  ADD COLUMN IF NOT EXISTS faq              jsonb,
  ADD COLUMN IF NOT EXISTS usage_tips       text,
  ADD COLUMN IF NOT EXISTS social_proof     text;

ALTER TABLE public.products
  ADD CONSTRAINT products_key_benefits_chk
    CHECK (key_benefits IS NULL OR jsonb_typeof(key_benefits) = 'array');

ALTER TABLE public.products
  ADD CONSTRAINT products_faq_chk
    CHECK (faq IS NULL OR jsonb_typeof(faq) = 'array');

COMMENT ON COLUMN public.products.seo_title       IS 'Optional override for the SEO meta title; falls back to "<Brand> <Name>" when null.';
COMMENT ON COLUMN public.products.seo_description IS 'Optional override for the meta description; falls back to short_description / description / generic when null.';
COMMENT ON COLUMN public.products.og_image_url    IS 'Optional override for og:image; falls back to image_url when null.';
COMMENT ON COLUMN public.products.key_benefits    IS 'Array of {icon?:string, text:string} rendered as a benefit bar on the PDP.';
COMMENT ON COLUMN public.products.faq             IS 'Array of {q:string, a:string} rendered as PDP FAQ + FAQPage JSON-LD.';
COMMENT ON COLUMN public.products.usage_tips      IS 'Longer-form usage / care text, rendered below the how-to-use tab.';
COMMENT ON COLUMN public.products.social_proof    IS 'Short testimonial or press quote, rendered above the reviews section.';
