# Yellow Pink — End-to-End Test Plan

You are a QA agent with **browser-only access**. You will be given:
- The deployed site URL (production or a `*.vercel.app` preview)
- The admin owner password (set as `ADMIN_PASSWORD` env var; ask the user)
- A test email + a Gmail-style alias you can use to register customer accounts

You do **not** have DB / log / API / MCP access. Everything you assert must be observable from the browser (UI, Network panel, View Source, DevTools console).

This is an enterprise-grade test pass. Be thorough. Treat every "Expected" failure as a bug worth filing — don't soften wording, don't skip ambiguous cases.

---

## Reporting format

For every failure, file:

```
## [SEV-X] Short title
**Route:** /path/here
**Steps:**
1. …
2. …
**Expected:** …
**Actual:** … (screenshot URL if you can attach one)
**Console / Network signal:** any errors, 4xx/5xx, slow requests
```

Severity:
- **SEV-0** — data loss, payment fraud path, auth bypass, anyone can see private data
- **SEV-1** — flow is broken (can't check out, can't sign in, can't admin a critical area)
- **SEV-2** — UX defect (visual break, a11y blocker, a flow works but is jarring)
- **SEV-3** — polish / nits

At the end, return: total tests run, pass count, fail count broken down by severity, and a top-10 list of the worst issues.

---

## Test accounts to create

1. **Owner** — log in via `/admin` using the `ADMIN_PASSWORD` you were given.
2. **Staff (limited)** — once owner is in, go to `/admin/team`, create a staff member with only the **Orders** permission. Note the temp password the UI shows.
3. **Staff (analytics-only)** — same, with only the **Analytics overview** permission.
4. **Customer A** — sign up at `/login` (Sign up tab) using your test email.
5. **Customer B** — sign up using `your+yp-test-b@gmail.com` (Gmail alias) so you can keep two sessions cleanly.
6. **Guest** — incognito window, no account.

Keep all six contexts open (Chrome profiles or incognito windows) and switch between them as needed.

---

## 1. Storefront — anonymous guest

### 1.1 Home (`/`)

Open `/`. Observe:
- Hero section loads with an image (LCP) within ~2.5s.
- Navigate via Tab — focus ring is visible on every link / button.
- **FLAG** if: any console error, hero image fails to load, focus ring missing.

### 1.2 Header + nav

- Click the **Shop** / **Blog** / category links. Each routes correctly.
- Open the **Search overlay** (magnifier icon). Type a partial product name. Verify suggestions appear and clicking one routes to the PDP.
- Open the **mobile menu** at viewport ≤ 767px. Verify it slides in from the left, dims the background, traps focus, closes on Esc + on overlay click + on a route change.
- Verify the **skip-to-main-content** link appears at the very top when you press Tab from a fresh page load.

### 1.3 Shop / Collection (`/shop`)

- Default render: shows a product grid (~48 per page) with pagination at the bottom.
- **Pagination buttons** must announce as "Previous page" / "Next page" / "Page 2" etc. to a screen reader — check via DevTools Accessibility tree or by running NVDA/VO. Active page must have `aria-current="page"`.
- **FLAG** if: prev/next reads as just "button"; active page not announced.
- Click **Filters** to open the side rail. Toggle: Category, Subcategory, Brand, Price range, In-stock only, On-sale only, Attribute facets (e.g. Shade, Size).
- After applying a filter, the URL updates (`?category=Makeup&brand=NARS&…`) and the grid re-renders.
- Sort by Featured / Price low→high / Price high→low / Name.
- Verify chips above the grid show active filters with × buttons that remove them individually.
- Search via `?q=cerave` (or use the search overlay). Verify the title shows "Search: cerave", canonical link in `<head>` is `noindex`, results are filtered.

### 1.4 Product detail page (PDP)

- Pick one product from the shop. Verify:
  - Hero image loads with `priority` (it should be the LCP element)
  - Gallery thumbnails switch the hero on click
  - Hover-zoom works on desktop
  - Brand + name + price + variants + Add-to-cart visible above the fold
  - Variant picker disables impossible combinations (struck-through pill / dimmed swatch)
  - "Pairs with" / related products grid appears below
- **JSON-LD check:** Right-click → View Page Source. Find `<script type="application/ld+json">` blocks. Verify:
  - `@type: "Product"` with `name`, `image`, `sku`, `brand`, `offers`
  - `offers` includes `priceCurrency: "PKR"`, `price`, `availability`, **`priceValidUntil`** (date 12 months out)
  - `offers.shippingDetails` + `offers.hasMerchantReturnPolicy` present
  - `@type: "BreadcrumbList"` with the chain Home → Shop → {Category} → {Product}
  - Breadcrumb URL for category uses `?category=` (NOT `?cat=`)
- **Keyboard test:** Tab to the **ProductTile** in the related-products grid. Pressing Enter must navigate to that PDP. Tab again should land on the **wishlist heart**; Enter toggles. The wishlist toggle must NOT trigger navigation. **FLAG** if either is broken — this is a known recent fix.
- Out-of-stock product: find one (`stock = 0`). Add-to-cart should be disabled and show "Notify me when back in stock" form instead.

### 1.5 Blog (`/blog`, `/blog/{slug}`)

- `/blog` lists posts with thumbnails, titles, excerpts.
- View source on `/blog`: should have its own title + description (NOT inheriting root metadata).
- Open a post. Body renders cleanly; related products grid at the bottom.
- JSON-LD: `@type: "Article"` with `datePublished`, **`dateModified`** (may differ from datePublished), `image`, `publisher.logo.url` ending in `.png` (NOT `.svg`).

### 1.6 Cart (`/cart`)

- Add 2-3 different products to cart from the PDP. Mini-cart slides in after each add.
- Open the full `/cart` page. Verify:
  - Each line item shows image, name, variant, qty stepper, line total, remove
  - **Stock clamp:** click the + button past available stock. Qty should not exceed `product.stock`. Counter should hit a ceiling silently.
  - Free-shipping progress bar at the top
  - Apply coupon code field at the bottom
- **Coupon edge cases:**
  - Try a code that doesn't exist → "Invalid or inactive coupon code"
  - Try an expired code (ask owner to create one with `expires_at` in the past) → "This coupon has expired"
  - Try a code with `min_order` higher than your cart → "Minimum order of PKR X required"
- Subtotal / discount / shipping / total math must add up.

### 1.7 Checkout (`/checkout`)

- Click Checkout from cart. Fill in: name, email, phone, address, city, province, ZIP.
- Pay method: pick **COD** (the only fully-working gateway right now).
- Submit. Should redirect to `/thank-you?order=YP-XXXXX`.
- **CRITICAL — price tampering test:** Before submitting, open DevTools → Network. Right-click the about-to-be-sent request to `/_supabase/.../rpc/place_order` (or whatever the network call is named). Use "Edit and Resend" / "Copy as fetch" to alter the body: change `subtotal: 5000` to `subtotal: 1` and `total: 5200` to `total: 1`. Re-send. **Expected: the server rejects with a "subtotal mismatch" error.** **FLAG SEV-0** if the order goes through at the tampered price.
- **Coupon tamper test:** Apply a real coupon (say WELCOME10 = 10% off PKR 3000 = 300 discount). Edit the request to change `discount_amount: 300` to `discount_amount: 2700`. Re-send. **Expected: rejected with "discount mismatch" error.** **FLAG SEV-0** if a 90% discount applies.

### 1.8 Thank-you (`/thank-you?order=…`)

- Shows the order number, total, items, est. delivery, "Track order" link.
- View source: should have `<meta name="robots" content="noindex">` (cart/checkout/thank-you should not be indexed).

### 1.9 Order tracking (`/track`)

- Enter the order number + the phone number you used at checkout. Hit Track.
- Verify status timeline shows the current state.
- **Tampering test:** enter the order number + a *different* phone number. Expected: "Order not found" (don't reveal that the order exists).
- **Brute-force test:** send 11 lookup requests in under a minute (refresh and resubmit). The 11th+ should hit the rate limiter (`429` or a "too many attempts" toast).

### 1.10 Wishlist (`/wishlist`)

- Visit anonymously. Should be empty with a "Browse products" CTA.
- Add a product from the shop. Open `/wishlist`. Item appears.
- "Add all to cart" — moves in-stock items, skips out-of-stock with no toast (acceptable but flag if confusing).
- View source: must have `<meta name="robots" content="noindex">`.

### 1.11 Newsletter

- Find the newsletter signup (footer or modal). Submit with a clearly invalid email like `notanemail`. Expected: HTML5 / inline validation rejects.
- Submit with a real email. Expected: success toast.
- Wait 60s, submit the *same* email again. Expected: handled gracefully ("Already subscribed" or similar — must not silently fail or duplicate).

### 1.12 SEO smoke

- Visit `/robots.txt`. Confirm `Disallow: /admin/` and `/account/` and `/cart` and `/wishlist` and `/track`. Confirm `Sitemap:` lines point at `yellowpink.pk`.
- Visit `/sitemap.xml`. Confirm category URLs use `?category=` (NOT `?cat=`).

### 1.13 Error pages

- Visit `/this-page-does-not-exist`. Expected: branded 404 with "Browse products" CTA and a recommended-products grid. The HTTP status must be 404 (check Network tab).
- View source: `<meta name="robots" content="noindex">`.

### 1.14 Visual / responsive

For each viewport (375 × 667, 768 × 1024, 1280 × 800):
- Home, Shop, PDP, Cart, Checkout, Blog index, Blog post, /account, /admin/dashboard
- **Look for:** horizontal scrollbar (page wider than viewport — bug), content cut off, overlapping elements, tappable areas < 40 × 40 px on mobile.
- **Specifically on mobile admin** (viewport ≤ 480 px): open `/admin/dashboard`, then open the sidebar drawer. Verify:
  - Drawer is **narrower than the viewport** (~280 px max)
  - When drawer is closed, the page uses the **full viewport width** (no phantom left margin)
  - The Recent Orders table can scroll horizontally inside its container

### 1.15 Performance smoke

- Open Chrome DevTools → Lighthouse → Mobile → Performance + Accessibility + SEO + Best Practices.
- Run against `/`, `/shop`, a PDP, `/blog`, a blog post.
- Note scores. **FLAG SEV-2** if any score is < 70 on a public page. **FLAG SEV-1** if < 50.
- Verify LCP image preloads (look for `<link rel="preload" as="image">` in the `<head>`).

---

## 2. Storefront — signed-in customer

Sign up as **Customer A** at `/login` (Sign up tab). Verify:
- Confirmation email arrives at the test inbox (check spam folder too).
- After signup you're either auto-signed in or asked to confirm via email link.
- Once signed in, the header should show an account icon / "Hi {name}" link.

### 2.1 Account dashboard (`/account`)

- Hub page with cards / links to Orders, Addresses, Profile, Rewards.
- Tab through every interactive element — focus visible everywhere.
- **A11y check:** open DevTools Accessibility tree. The page should have a `<main>` landmark (recent fix).

### 2.2 Profile (`/account/profile`)

- Edit name + phone. Save. Refresh page. Values persist.

### 2.3 Addresses (`/account/addresses`)

- Add a new address. Required fields validate.
- Edit it. Save.
- Add a second address.
- **Set the second as default.** Verify the first is no longer marked default.
- Delete the first. Confirm it's gone.
- **Tamper test:** Open DevTools, find the hidden `<input name="id">` in an address form. Change it to a UUID belonging to no address (e.g. `00000000-0000-0000-0000-000000000000`). Submit. Expected: silent no-op or "could not delete" — must NOT delete a row that doesn't belong to you.

### 2.4 Orders (`/account/orders`, `/account/orders/[id]`)

- Place a COD order from the storefront. Within 30s it should appear in this list.
- Click into the order detail. Verify: status timeline, items, totals, address, "Request return" button (if delivered).
- **Tamper test:** modify the URL to `/account/orders/<some-uuid-you-made-up>`. Expected: 404 or "Order not found" — must NOT show another user's order.

### 2.5 Returns (`/account/orders/returns/new?order_id=…`)

- Pick a delivered order (or have owner mark one delivered in admin). Request a return.
- Select reason, items, optional photo upload. Submit.
- Expected: confirmation, return request appears in admin queue.

### 2.6 Rewards (`/account/rewards`)

- Loyalty balance shows current points.
- Place a COD order. After it lands, points should update on the next page load.
- "Refer a friend" — copy the referral code, sign up Customer B using it, confirm Customer A's referral count goes up.

### 2.7 Auth flows

- **Sign out** — verify the account icon disappears and `/account` redirects to `/login`.
- **Forgot password** — request reset, click link in email, set new password, sign in.
- **Sign back in** with the new password.
- **Rate limit** — try logging in with the wrong password 6 times in 60s. The 6th+ attempt should show a rate-limit message.

### 2.8 Wishlist persistence

- As Customer A, add items to wishlist. Sign out. Sign back in. Items should persist (the wishlist is keyed on user id, not local storage alone).

---

## 3. Admin — owner (full access)

Visit `/admin`. Enter the `ADMIN_PASSWORD`. After login, you should land on `/admin/dashboard`.

**Cookie check (recent fix):** Open DevTools → Application → Cookies. The `admin_session` cookie value should look like `<base64url>.<base64url>` (a signed JWT-like payload) — **NOT** plain `base64(password)`. It must be `Secure`, `HttpOnly`, `SameSite=Lax`.

### 3.1 Dashboard (`/admin/dashboard`)

- KPI cards: Products, Orders, Revenue, Blog Posts.
- Revenue chart (30 days).
- Low-stock alert (if any product has stock ≤ 5). Capped at 50 items.
- Orders-by-status histogram + Top Products list (server-aggregated via `dashboard_kpis()` RPC — recent perf fix).
- Conversion funnel widget, PostHog widget, Top pages, Top events, Sentry widget. (May show "No data yet" — that's fine if traffic is fresh.)
- **Refresh Analytics** button at top-right. Click it. Should show "Refreshing…" then either "✓ Refreshed" or an error toast (probably an error toast if `POSTHOG_PERSONAL_API_KEY` isn't set in Vercel — flag if it crashes the page instead).
- Recent Orders table scrolls horizontally on mobile.

### 3.2 Products (`/admin/products`)

- Filter: category, status, stock-low, brand, search.
- Pagination works.
- **Create product:** all fields, image upload to Supabase Storage, save. Verify it appears in storefront `/shop`.
- **Edit product:** change price, add a variant. Save. Verify on PDP.
- **Variants:** verify the variant grid on mobile collapses to a card layout (recent mobile fix).
- **Delete product:** delete one. On success: redirected back with `?deleted=1`. On failure (try deleting one referenced by an order — should error): the URL should have `?error=…` and a toast/banner shows the message (recent silent-failure fix).
- **Bulk actions:** select multiple, bulk-update status. Toast shows "X products marked as Y".

### 3.3 Orders (`/admin/orders`)

- Filter by status, date range, search.
- Click into an order. Verify: customer details, items, totals, status timeline, payment info, audit log of status changes, **discount row** in the payment breakdown (recent fix — verify it shows for any order that used a coupon).
- Update status (Pending → Processing → Shipped → Delivered). Each transition should:
  - Save successfully
  - Send an email to the customer (have them check inbox)
  - Show as a new event in the timeline
- **Bulk update:** select 2+ orders, bulk-mark as Processing. Verify toast says "2 orders marked as processing".
- **Try a bulk action with one bad ID** (hard to trigger from UI; skip if not reproducible). The success toast should NOT fire if any update fails.
- **Print invoice** button — opens a print-ready view; verify discount row is also in the printable.

### 3.4 Customers (`/admin/users`)

- List of customer accounts with search + pagination.
- Click a customer. Verify: profile, address book, order history, lifetime spend, loyalty balance.

### 3.5 Segments (`/admin/segments`)

- Create a segment (e.g. "Bought NARS"). Verify member count.

### 3.6 Coupons (`/admin/coupons`)

- Create coupon `TEST10` — 10% off, min order PKR 1000, max uses 5, expires next week.
- Open `/cart` as Customer A. Add PKR 2000 of stuff. Apply `TEST10`. Verify PKR 200 discount.
- Cart with PKR 500 of stuff: applying TEST10 should error "Minimum order of PKR 1,000 required".
- Create coupon `EXPIRED` with `expires_at` set to yesterday. Applying it should error "expired".
- Create coupon `ONCE` with `max_uses = 1`. Apply it on Customer A's order, then try on a Customer B order. Second should error "usage limit reached".
- Create coupon `EMAILONLY` with `email_restrictions = ['*@yellowpink.pk']`. Applying it as Customer A (`@gmail.com`) should error.
- Toggle a coupon to inactive. Verify cart lookup returns "invalid" for it.
- Delete a coupon. Verify list updates and any cart lookup of that code returns "invalid".

### 3.7 Promos (`/admin/promos`)

- Create a top-bar promo with headline + CTA. Toggle "Enabled". Refresh storefront `/`. Bar appears.
- Toggle off. Refresh. Gone.
- Delete it. Gone permanently.

### 3.8 Blog (`/admin/blog`)

- Create a new post (title, slug, category, body, image). Save. Visit `/blog/{slug}` on storefront — appears.
- Edit. Save. Front updates.
- Delete. Gone from `/blog`.
- Verify the post's JSON-LD `dateModified` differs from `datePublished` after an edit.

### 3.9 Reviews (`/admin/reviews`)

- Visit. Pending reviews list.
- Approve a review. Verify it appears on the PDP it references.
- Delete a review. Verify it's gone from the PDP.

### 3.10 Audit log (`/admin/audit`)

- Should show a chronological list of admin actions (product creates, status updates, etc.) with timestamps + actor.

### 3.11 Team (`/admin/team`) — OWNER ONLY

- List of staff with their permissions.
- Create a staff member, grant only `Orders` permission. Note the temp password shown in the UI.
- Sign out of owner. Sign in as that new staff at `/admin` (use email + temp password). Verify:
  - **Only the Orders nav item is visible** (no Products, no Coupons, no Team, no Settings, no Analytics)
  - Trying to navigate directly to `/admin/products` should show a "No access" page or redirect to dashboard
  - **FLAG SEV-0** if a staff member without `coupons` permission can still see / use the coupon admin
- Sign back in as owner. Disable that staff member's `is_active`. Try to sign in as them — should fail.
- Reset their password — new temp password should be emailed; old one should no longer work.
- Delete them. Gone.

### 3.12 WP import (`/admin/import`) — OWNER ONLY

- The UI exists; don't run an import (it would mutate data). Just verify the page renders without errors and the upload form is present.

### 3.13 Settings (`/admin/settings`)

- Update store info (phone, address). Save. Verify it appears in the footer of the storefront.
- Update payment methods. Verify checkbox toggles take effect.
- Update shipping zones. Verify checkout uses the new rates.

### 3.14 Profile (`/admin/profile`) — staff (not owner)

- Sign in as a staff member (NOT owner). Visit `/admin/profile`.
- Change name. Save.
- Change password. Sign out, sign back in with new password.
- **Enable 2FA:** scan the QR with an authenticator app (or copy the secret). Confirm a 6-digit code. UI shows **10 backup codes** — write them down.
- Sign out. Sign in. Now requires a 2FA code. Submit a fresh TOTP — should work.
- Sign out. Sign in. Instead of TOTP, use one of the **backup codes**. Should work, and that code should now be consumed (try it again — should fail).
- Disable 2FA. Sign out. Sign in. No 2FA prompt.

### 3.15 Notifications bell

- Place an order as a customer. Sign back in as owner. The bell should show a `1` badge with a "New order" notification.
- Click it. Read state toggles. Badge clears (or count decrements).

---

## 4. Admin — limited staff perspective

### 4.1 Staff with only `analytics`

- Sign in. Dashboard renders (analytics widgets).
- Sidebar: should ONLY show Dashboard (and maybe Profile).
- Try direct URL `/admin/orders` — must redirect or show "No access".
- Try direct URL `/admin/team` — must redirect.
- **Refresh Analytics** button: should NOT be visible (requires `analytics_refresh`).

### 4.2 Staff with only `orders`

- Sign in. Sidebar: Dashboard (degraded — no widgets) + Orders.
- Cannot access Products, Coupons, Settings, Team.
- Can view orders, update status, mark shipped — verify each works.

### 4.3 Try to escalate via DevTools

- As a limited-perm staff, open DevTools. Find a form action for a coupon-create or product-delete from owner-only admin pages. Manually craft a POST to that server-action endpoint. **Expected: server returns "Unauthorized"** (recent fix added `assertPermission` to every mutating action). **FLAG SEV-0** if any privileged mutation succeeds.

---

## 5. Cross-cutting security probes

### 5.1 Direct access to disallowed paths

- Anonymous: `/admin/dashboard`, `/admin/orders`, `/account`, `/account/orders` — all must redirect to `/admin` or `/login`.
- Signed-in customer: `/admin/dashboard` — must redirect or show "No access".

### 5.2 Cookie-only auth gate bypass

- Sign out of customer. Open DevTools → Cookies. Manually create a cookie named `sb-XXX-auth-token` with value `"deadbeef"`. Visit `/account`. **Expected: redirect to `/login`** (recent middleware fix decodes the JWT body and checks expiry, not just presence). **FLAG SEV-1** if you can load `/account` shell with a forged cookie.

### 5.3 API endpoints

- `/api/health`: in production, hitting it directly (no auth) should return **401 Unauthorized** (recent fix). In dev/preview it should return 200 with stats. **FLAG SEV-2** if it returns 200 with env-var presence + table row counts on the production deployment without auth.
- `/api/cron/abandoned-cart` and `/api/cron/back-in-stock`: hitting without `Authorization: Bearer <CRON_SECRET>` should return 401 (recent fail-closed fix). **FLAG SEV-1** if it returns 200 unauth in prod.
- `/api/couriers/webhook` (POST): unauth should return 401.

### 5.4 Review photo upload

- As Customer A, submit a product review with a photo URL like `https://evil.example.com/img.jpg`. **Expected: the photo is dropped from the saved review** (recent fix restricts to Supabase Storage prefix).
- Submit with a legitimate Supabase Storage URL. Should accept.

### 5.5 XSS / injection probes

- In any free-text field (product name as admin, review body as customer, address line as customer), submit `<script>alert(1)</script>` and `"><img src=x onerror=alert(1)>`. After saving, verify the rendered page shows the literal text (no popup). **FLAG SEV-0** if any popup fires.
- In a coupon code field, try `'; DROP TABLE products; --`. Should be rejected by the input validator (`/^[A-Z0-9_-]+$/`).

### 5.6 Sensitive headers

- Open DevTools → Network on any storefront page. Click the document request. Check Response Headers for:
  - `Strict-Transport-Security` (HSTS) present
  - `X-Frame-Options: SAMEORIGIN` or `DENY` present
  - `X-Content-Type-Options: nosniff` present
  - `Referrer-Policy` present
  - `Permissions-Policy` present
- **FLAG SEV-2** if any are missing.

---

## 6. Visual / a11y / SEO sweep

### 6.1 Pink-text contrast (recent fix)

- On `/login`, the "Forgot password?" link and "Sign up" / "Sign in" toggle buttons should render in a darker pink (~ `#C5286A`). Run DevTools → Lighthouse contrast check. Must pass 4.5:1 on white background.
- Same check on `/account/orders` (order total in pink), `/account/addresses` ("Default" badge), `/account/rewards` (point values).

### 6.2 Multiple H1s / heading order

- View every storefront page. There should be **exactly one `<h1>`** per page.
- Run a quick scan via Chrome DevTools → Elements → search for `<h1`. Should find one.

### 6.3 Image alt text

- On `/shop`, every product tile image must have alt text matching brand + name. Inspect the `<img>` tags.
- Brand logos in marketing sections should have meaningful alt (brand name).
- Decorative-only images should have `alt=""` (NOT missing alt).

### 6.4 Lighthouse a11y + SEO

- Run Lighthouse a11y on `/`, `/shop`, a PDP, `/checkout`. Target ≥ 95.
- Run Lighthouse SEO on the same routes. Target = 100.

### 6.5 Mobile drawer cross-check

- At viewport 375 × 667 on the admin dashboard:
  - Drawer closed: content should fill the full width.
  - Drawer open: drawer is ~280 px, content visible to the right is dimmed by an overlay, Esc closes the drawer.
  - **FLAG SEV-2** if there's a phantom blank column on the left when drawer is closed, OR if the drawer is full-width when open.

---

## 7. End-to-end flow recap (do this at the end)

Full happy-path E2E:
1. Anonymous: home → category → PDP → add to cart → cart → checkout (COD) → thank-you
2. Email arrives at the test inbox with order confirmation
3. Owner: dashboard shows the new order in Recent Orders; bell shows a notification
4. Owner: update status to Processing → email arrives → Shipped → email arrives → Delivered → email arrives
5. Customer A: account/orders shows the order, status timeline matches, "Request return" button appears
6. Customer A: requests a return; admin/returns shows it in the queue

Time end-to-end. **FLAG SEV-1** if any step takes > 30s of user-perceived latency.

---

## 8. Things to specifically verify are FIXED (recent batch)

Cross-reference with `.audit/FINDINGS.md` in the repo. The following should all pass:

- **staff_members RLS:** sign in as Customer A. Open DevTools Console. Run:
  ```js
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js')
  const sb = createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)
  console.log(await sb.from('staff_members').select('email, password_hash'))
  ```
  (URLs are visible in any page's script tags.) **Expected: empty array or RLS error.** **FLAG SEV-0** if you see any staff rows.
- **place_order price tampering:** see 1.7 above.
- **Payment callback amount tampering:** can't easily test without real gateway credentials — skip.
- **Legacy admin cookie:** `admin_session` is signed JWT, not base64 password — see 3 above.
- **Customer middleware JWT validation:** see 5.2 above.
- **Coupon discount tampering:** see 1.7 above.
- **Cart stock clamp:** see 1.6 above.
- **ProductTile keyboard nav:** see 1.4 above.
- **Pagination aria:** see 1.3 above.

---

## 9. What NOT to do

- Do not run the WP import or any "danger zone" bulk action that would mutate the live catalog beyond what your test cases above describe.
- Do not enter real credit card numbers anywhere. COD is the only payment method to test end-to-end.
- Do not delete the owner staff member or change the `ADMIN_PASSWORD`.
- Do not test sending mass newsletters or trigger crons manually (those send to real customers).
- Do not load-test (no Lighthouse "Throttling: 3G slow" 100 times in a row, no scripted bot).

---

## 10. When you finish

Produce one final report containing:
1. **Summary** — total tests run, pass/fail/severity breakdown
2. **Top 10 worst issues** — title + severity + 1-line description
3. **Full bug list** — every failure with the report-format block from §"Reporting format"
4. **A short note** on overall feel — does the site feel production-ready to you, what would block your launch
