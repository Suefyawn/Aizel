-- 20260525_073_security_hardening.sql
--
-- Closes the rest of the Supabase Database Linter findings:
--
-- 1. Drops wide-open `admin write/update/delete` policies that target the
--    `anon` role on products / blog_posts / orders. These were left over
--    from an earlier RLS pattern that pre-dated the service-role admin
--    client; the admin client bypasses RLS, so anything granted to
--    `anon` here is pure attack surface.
-- 2. Drops duplicate read / insert policies that have an identical
--    sibling (`*_read_all` vs `public read *`, `reviews_insert_any` vs
--    `insert own review`, etc.).
-- 3. Drops the `anyone can insert orders` policy — `place_order` is
--    SECURITY DEFINER and is the only sanctioned write path.
-- 4. Converts the two analytics views (`v_customer_segments` +
--    `v_orders_revenue`) from SECURITY DEFINER to `security_invoker`
--    so they honour the caller's RLS.
-- 5. Pins an immutable `search_path` on the four trigger / helper
--    functions the linter flagged as `function_search_path_mutable`.
--
-- Idempotent: every drop uses IF EXISTS so re-running is a no-op.

begin;

-- ── 1. Wide-open admin write policies on anon role ──────────────────────────

drop policy if exists "admin delete blog_posts" on public.blog_posts;
drop policy if exists "admin update blog_posts" on public.blog_posts;
drop policy if exists "admin write blog_posts"  on public.blog_posts;

drop policy if exists "admin delete products"   on public.products;
drop policy if exists "admin update products"   on public.products;
drop policy if exists "admin write products"    on public.products;

drop policy if exists "admin update orders"     on public.orders;

-- ── 2. Duplicate read / insert policies ──────────────────────────────────────

drop policy if exists "public read blog_posts" on public.blog_posts;
drop policy if exists "public read products"   on public.products;

drop policy if exists "reviews_insert_any"     on public.product_reviews;
drop policy if exists "reviews_read_approved"  on public.product_reviews;

-- ── 3. Duplicate INSERT path on orders ──────────────────────────────────────
-- place_order() is SECURITY DEFINER and the only sanctioned write path.

drop policy if exists "anyone can insert orders" on public.orders;

-- ── 4. Duplicate analytics_cache policy on `public` role ────────────────────
-- analytics_cache_service_all (service_role only) is the kept policy.

drop policy if exists "service role full access" on public.analytics_cache;

-- ── 5. Convert SECURITY DEFINER views to security_invoker ───────────────────
-- Both views aggregate orders. Staff queries them via supabaseAdmin()
-- (service_role bypasses RLS), so the SECURITY DEFINER wrapping was
-- accidental — security_invoker is the correct posture.

alter view public.v_customer_segments set (security_invoker = on);
alter view public.v_orders_revenue    set (security_invoker = on);

-- ── 6. Pin search_path on flagged functions ─────────────────────────────────
-- Defense in depth: with a mutable search_path, a malicious schema in the
-- caller's path could shadow public.* table references and exfiltrate.

alter function public.set_updated_at()                   set search_path = public, pg_temp;
alter function public.touch_updated_at()                 set search_path = public, pg_temp;
alter function public.decrement_stock(uuid, integer)     set search_path = public, pg_temp;
alter function public.notify_order_confirmation()        set search_path = public, pg_temp;

commit;
