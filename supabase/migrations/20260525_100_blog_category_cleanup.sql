-- ============================================================================
-- Blog category cleanup. The WP import left the blog with 10 overlapping /
-- noise categories — "Uncategorized", "General" vs "General Wellness",
-- "Female Health" vs "Women Health", "Men Health", a one-post
-- "Allergies & Immunity" — which surfaced as messy filter chips on /blog.
-- Consolidate into 6 canonical categories. The admin BlogForm now offers
-- exactly this set as a dropdown so the taxonomy can't drift again.
-- ============================================================================

update public.blog_posts set category = 'Wellness'
  where category in ('Uncategorized', 'General', 'General Wellness', 'Allergies & Immunity')
     or category is null or category = '';

update public.blog_posts set category = 'Bone & Joint'      where category = 'Bone Health';
update public.blog_posts set category = 'Fertility'         where category = 'Fertility Support';
update public.blog_posts set category = 'Men''s Health'     where category = 'Men Health';
update public.blog_posts set category = 'Women''s Health'   where category in ('Female Health', 'Women Health');
update public.blog_posts set category = 'Beauty & Skincare' where category = 'Health & Beauty';
