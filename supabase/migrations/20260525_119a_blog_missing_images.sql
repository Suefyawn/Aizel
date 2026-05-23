-- Five blog posts came over from the WordPress import with no featured image,
-- so `image_url` was null and the storefront fell back to the grey gradient
-- placeholder on the /blog grid, the post hero, and the og:image/sitemap.
--
-- Editorial cover images were generated for each and uploaded to this
-- project's Supabase Storage `images` bucket under `blog/`. This migration
-- repoints `image_url` at those files. Idempotent — the `is null` guard means
-- re-running matches no rows.

update public.blog_posts
set image_url = 'https://cngsjtthiexcfpjpcpsg.supabase.co/storage/v1/object/public/images/blog/creatine-monohydrate-pakistan.webp'
where slug = 'creatine-monohydrate-pakistan-complete-guide-gym-goers-2026' and image_url is null;

update public.blog_posts
set image_url = 'https://cngsjtthiexcfpjpcpsg.supabase.co/storage/v1/object/public/images/blog/zinc-deficiency-pakistan.webp'
where slug = 'zinc-deficiency-pakistan-signs-solutions-supplements' and image_url is null;

update public.blog_posts
set image_url = 'https://cngsjtthiexcfpjpcpsg.supabase.co/storage/v1/object/public/images/blog/liver-milk-thistle-pakistan.webp'
where slug = 'liver-health-milk-thistle-pakistan-natural-detox-guide' and image_url is null;

update public.blog_posts
set image_url = 'https://cngsjtthiexcfpjpcpsg.supabase.co/storage/v1/object/public/images/blog/biotin-hair-loss-pakistan.webp'
where slug = 'biotin-hair-loss-pakistan-women-supplement-guide' and image_url is null;

update public.blog_posts
set image_url = 'https://cngsjtthiexcfpjpcpsg.supabase.co/storage/v1/object/public/images/blog/ashwagandha-pakistan.webp'
where slug = 'ashwagandha-benefits-pakistan-stress-energy-guide' and image_url is null;
