-- Migration 085 — rewrite key_benefits[].icon from emoji glyphs to
-- stable icon names. Storefront now renders a branded inline-SVG icon
-- set (src/components/ui/BenefitIcon.tsx) instead of the system emoji
-- font; the data must carry name strings so the renderer can look up
-- the right path.
--
-- 13 emojis in use across the 109 products → 13 named icons. The
-- BenefitIcon component also keeps an emoji → name fallback map so
-- stale rows never break rendering.

WITH mapped AS (
  SELECT p.id,
         jsonb_agg(
           jsonb_build_object(
             'icon', CASE kb->>'icon'
               WHEN '🛡️' THEN 'shield'
               WHEN '🛡'  THEN 'shield'
               WHEN '🌿' THEN 'leaf'
               WHEN '✨' THEN 'sparkle'
               WHEN '💧' THEN 'droplet'
               WHEN '💪' THEN 'pulse'
               WHEN '🌸' THEN 'flower'
               WHEN '🧴' THEN 'bottle'
               WHEN '💛' THEN 'heart'
               WHEN '💜' THEN 'heart'
               WHEN '⚡' THEN 'bolt'
               WHEN '☀️' THEN 'sun'
               WHEN '☀'  THEN 'sun'
               WHEN '🌙' THEN 'moon'
               WHEN '🧬' THEN 'dna'
               WHEN '🔥' THEN 'flame'
               ELSE COALESCE(kb->>'icon', 'sparkle')
             END,
             'text', kb->>'text'
           )
           ORDER BY ord
         ) AS new_kb
    FROM public.products p,
         jsonb_array_elements(p.key_benefits) WITH ORDINALITY AS arr(kb, ord)
   WHERE p.key_benefits IS NOT NULL
     AND jsonb_typeof(p.key_benefits) = 'array'
   GROUP BY p.id
)
UPDATE public.products p
   SET key_benefits = m.new_kb
  FROM mapped m
 WHERE p.id = m.id;
