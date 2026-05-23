# Production Audit — 2026-05-18

Five-agent parallel audit + DB introspection. Findings deduplicated and ranked.

## P0 — Block production launch

### Security
1. **`staff_members` has RLS disabled** — confirmed via `pg_class`. Password hashes (scrypt), TOTP secrets, plaintext backup codes all readable with the anon key that ships to every browser. **Fix shipped:** migration enables RLS with service-role-only policy; staff-auth lib switched to service-role client.
2. **`place_order` RPC trusts client `subtotal`/`shipping`/`total`** (migrations `20260517_002` and `20260520_031`). Client can post `total: 1` for any cart. **Fix shipped:** RPC recomputes from `products.price * qty` server-side; rejects mismatch >1 paisa.
3. **Payment callbacks don't verify gateway amount against order.total** (`jazzcash/callback/route.ts`, `easypaisa/callback/route.ts`). **Fix shipped:** amount assertion before status flip.
4. **Payment callbacks not idempotent** — replayed callback can flip cancelled/refunded back to pending. **Fix shipped:** conditional UPDATE gated on `status='payment_pending'`.
5. **`refreshAnalytics()`, `coupon-actions.ts`, `promo-actions.ts` server actions have no auth gate.** Anyone can drain MCP quota / mint 100% coupons / inject promos. **Fix shipped:** `assertOwner()` on all of them.
6. **Backup codes stored plaintext** in `staff_members.backup_codes`. **Fix shipped:** hash on enrollment, compare on use, single-use deletion.

### Performance / availability
7. **Root layout exports `dynamic = 'force-dynamic'`** — neutralises every page-level `revalidate`. Home, shop, PDP, blog all re-render per request. **Fix shipped:** removed; added `revalidate` to leaf routes.
8. **Admin dashboard pulls unbounded `select('*')` from orders + products on every render.** Will degrade linearly with catalog/order count. **Fix shipped:** aggregated via SQL; low-stock capped at 50.

## P1 — Fix in next 7 days

### Security
9. **Legacy `ADMIN_PASSWORD` cookie is unsalted base64**, no signature, 7-day life (`admin/actions.ts:38-45`). Cookie `secure` flag gated on NODE_ENV — rides plaintext on previews. **Recommend:** retire entirely; staff_members covers it. If kept, sign with HMAC + timestamp.
10. **`STAFF_SESSION_SECRET` falls back to `'yp-staff-dev-secret'`** at module load (`lib/staff-auth.ts:7`). Forge anyone's session if env var missed. **Fix:** throw at load when missing in prod.
11. **Customer `/account` middleware gate is cookie-presence-only** (`proxy.ts:128-135`). **Fix:** validate via `supabase.auth.getUser`.
12. **Cron + courier-webhook endpoints fail open when secret unset** (`api/cron/*`, `api/couriers/webhook`). **Fix:** require unconditionally.
13. **Anonymous `submitReview` accepts arbitrary `photo_urls`** (`product/[slug]/actions.ts:59-72`). **Fix:** restrict to Supabase-storage prefix.
14. **`redeem_gift_card` RPC granted to anon with no auth.uid() binding** (`20260520_030:372`). **Fix:** revoke from anon, call only from `place_order`.

### Code-quality / data integrity
15. **Many admin server actions silently swallow Supabase errors** — `deleteProduct`, `deleteBlogPost`, `bulkUpdateOrderStatus`, `toggleStaffActive`, `deleteStaffMember`, `setDefaultAddress`, `approveReview`, `deleteReview`. UI says success after a failed delete.
16. **`CartContext.addToCart` / `updateQty` have no stock clamp** — eventually oversells.
17. **Coupon validator misses half the rules** — no check on `usage_limit_per_user`, `email_restrictions`, `product_ids`, `excluded_product_ids`, `category_ids`, `individual_use`.

### SEO
18. **`/blog` index has no metadata** — falls back to root canonical.
19. **Sitemap uses `?cat=`, canonicals + breadcrumbs use `?category=`** — duplicate signal.
20. **`/cart`, `/wishlist`, `/track`, `/forgot-password`, `/reset-password` need `noindex`**.

### A11y
21. **`ProductTile` is `<div onClick>` with no keyboard handler** — entire shop unusable for keyboard/AT users.
22. **`brand-pink` (#E8487F) used as text on white = 3.4:1** — fails WCAG AA on every "Sign up", "Forgot password" link, account-page totals.
23. **`#9ca3af` body text on white = 2.85:1** — fails WCAG AA.
24. **Pagination buttons (`←` / `→`) have no `aria-label`**.
25. **Account/admin pages lack `<main>` landmark**.

### Perf
26. **Shop page client component holds entire catalog (~500KB JSON)** — `CollectionPage.tsx`. Should be server-paginated.
27. **`getProducts()` has no limit** — unbounded as catalog grows.
28. **Sentry replay loaded eagerly even when not sampled** — 50-80KB gz for 95% of visits.

## P2 — Backlog (significant but not launch-blocking)

- `/api/health` enumerates env vars + table row counts unauth'd.
- Coupon codes readable to anon (info disclosure, not breach).
- Payment `error_message` stored verbatim — XSS-ish via gateway-controlled string.
- In-memory rate limiter fallback when Upstash unset — defeated by Vercel cold starts.
- `redirect`/`order_events` audit log writes are best-effort — silently drop on RLS reject.
- AggregateOffer / single-variant Offer missing `priceValidUntil`.
- Organization JSON-LD logo is SVG (Google wants PNG ≥112px).
- Article schema has no `dateModified` distinct from `datePublished`.
- Multiple home-page H1s (Treat Melasma, Clear Skin, etc.) — should be H2.
- Hover-only color change on header nav has no keyboard focus equivalent.

## P3 — Polish

(See full per-agent reports; ~50 items.)
