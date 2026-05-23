# Deep QA Hand-off — Admin Cleanup (May 23, 2026)

Five PRs landed across the admin and a migration-tracking bug got fixed:

| PR | Title | Branch |
|---|---|---|
| #167 | A — Sidebar reorg into 5 labeled groups | merged |
| #168 | B — Settings split into 8 sub-pages + Promo dedupe | merged |
| #172 | C — Multi-recipient staff notifications | merged |
| #173 | D — Shipping zones UI + live Integrations status | merged |
| #171 | E — PostHog user-journey widgets on Analytics | merged |
| #174 | Fix duplicate `_120_` migration prefix | merged |

Supabase migrations 124–129 were applied directly to production after merge. All schema changes are live.

The points of highest risk are the storefront promo banner (driven by a DB migration), the email fan-out (now reads from a new table), and per-zone shipping (a new path through checkout). Test those first.

---

## 0. Pre-flight setup

Before testing, the QA tester needs:

- [ ] **Owner login** for `/admin` (production)
- [ ] **A non-owner staff account** with limited permissions — ideally a staff account assigned to **Customer Support** role (one of the seeded built-in roles). If none exists, create one in **Admin → Team → Add staff member** during testing.
- [ ] **A test phone** that can receive an OTP / make a checkout
- [ ] **A test email inbox** that's NOT `OWNER_EMAIL` (gmail+alias works) for the notifications test
- [ ] **A second browser / private window** so owner and staff sessions can run in parallel
- [ ] Phone/tablet for mobile checks (or DevTools device toolbar)
- [ ] PostHog access (the linked project) to verify session-recording links open the right thing

---

## 1. Sidebar reorg (PR A)

The 18 admin links are now organized into 5 labeled groups: **Insights · Sell · People · Marketing · Store**.

- [ ] Sign in as **owner**. Sidebar shows all five group headers with all items underneath. No item is missing.
- [ ] Confirm the order: **Insights** (Dashboard, Analytics) → **Sell** (Orders, Products, Inventory, Vendors, Returns) → **People** (Customers, Segments, Coupons) → **Marketing** (Promos, Blog, Reviews, Newsletter, Email log) → **Store** (Activity log, Team, Settings).
- [ ] Sign out, sign in as a **Customer Support** staff member. The **Sell** group shows only what that role permits (Orders, Returns). The **Marketing** and **Insights** groups should be hidden (zero links visible) OR collapsed away cleanly with no empty group header showing.
- [ ] The active-route highlight (pink left-border + light background) still shows on whichever link is active.
- [ ] **Pending-orders red badge** still appears on the Orders link when there are unfulfilled orders. Place a test order to verify.
- [ ] Open on a phone. The hamburger menu still toggles the sidebar; clicking a link closes it via `onClose`.

> **If a group label appears with no items underneath** — that's a permission-filter bug. Report with a screenshot.

---

## 2. Settings split into 8 sub-pages (PR B)

The 651-line monolith is gone. Settings is now a left-rail layout with 8 focused sub-pages.

### 2.1 Navigation
- [ ] Visit `/admin/settings`. You should be **redirected to `/admin/settings/profile`** (the new landing).
- [ ] The left rail shows 8 items: **Store profile · Branding & theme · Homepage · Shipping & tax · Payments · Loyalty · Notifications · Integrations**.
- [ ] Click each in turn. URL changes, content swaps, the rail highlights the active item with a pink left border and `aria-current="page"`.
- [ ] On mobile (< 900 px viewport), the left rail collapses to a **horizontal scrollable strip** above the content. Each item is reachable; active item is underlined.

### 2.2 Per-page save
For each sub-page (profile, branding, homepage, shipping, payments, loyalty):
- [ ] Open the sub-page; modify one field (e.g. on Profile, change "Store Name" to "Yellow Pink TEST"; remember to change it back).
- [ ] Hit **Save changes**.
- [ ] After the action, the page reloads at the **same sub-page URL** (verify the URL bar still shows `/admin/settings/profile`, not `/admin/settings`).
- [ ] A green "Settings saved" banner appears.
- [ ] Reload the page → the new value persists.
- [ ] Change it back, save again.

### 2.3 Promo Banner is gone from Settings
- [ ] There is **no Promo Banner card** anywhere in any Settings sub-page.
- [ ] Visit `/admin/settings/homepage` — there's a blue "Promotional banners moved" callout linking to `/admin/promos`.
- [ ] Visit `/admin/promos` — the storefront promo CMS still works. Editing a promo here is the only way to manage banners now.

### 2.4 Promo migration verification (storefront)
- [ ] Open the public storefront homepage in a fresh browser (or incognito). Verify that the **hero strip banner is NOT showing** (matches the migration result — `promo_active` was `'false'` so nothing should be migrated as live).
- [ ] In the admin, go to `/admin/promos`. Verify there's **no leftover "Up to 30% off" promo** with priority 100. (If there is, the migration accidentally created one. Report it.)

### 2.5 Stub-page reality check
- [ ] Visit `/admin/settings/notifications` — should now be the **real notifications UI** (tested separately in §3). NOT a "Coming next" stub.
- [ ] Visit `/admin/settings/integrations` — should be the **live status page** (tested separately in §5). NOT a "Coming next" stub.

> If either still shows "Coming next", the page wasn't re-deployed. Force a Vercel redeploy.

---

## 3. Multi-recipient notifications (PR C)

### 3.1 Empty-state behaviour
- [ ] Visit `/admin/settings/notifications`. You should see a **blue fallback explainer** with the OWNER_EMAIL value, and **"No recipients yet — alerts go to the fallback address above."**
- [ ] Place a real test order (small total, COD). Verify the new-order email arrives at `OWNER_EMAIL` (production owner inbox).

### 3.2 Add a recipient
- [ ] Enter a real test email (e.g. your `+test@gmail.com` alias) → tick **New orders** only → **Add recipient**.
- [ ] After save, the recipient appears as a card. Toggle still says "Active".
- [ ] Place another test order. Verify the email arrives at the **new test email**, NOT at `OWNER_EMAIL`. (This is the critical fan-out check.)

### 3.3 Multi-recipient
- [ ] Add a second recipient, also subscribed to "New orders".
- [ ] Place another test order. Verify the email arrives at **both** addresses. (Resend's `to: string[]` will put both in the To header.)

### 3.4 Pause and event scoping
- [ ] Edit one recipient → uncheck "New orders" → save. Place a test order. That recipient should NOT receive it; the other still does.
- [ ] Toggle one recipient to **Paused** (uncheck the Active toggle in the card header) → save. Place a test order. The paused recipient should NOT receive it.

### 3.5 Validation errors
- [ ] Try to add a recipient with an invalid email (`not-an-email`) — server should reject with "Please enter a valid email address."
- [ ] Try to add a recipient with **no events ticked** — server should reject with "Pick at least one event for this recipient."
- [ ] Try to add a **duplicate** email — server should reject with "X is already on the list — edit it instead."

### 3.6 Delete
- [ ] On a recipient card, click **Delete** → click "Yes, delete" to confirm → recipient disappears from the list.
- [ ] If all recipients are deleted, the next test order falls back to `OWNER_EMAIL` again.

### 3.7 Audit log
- [ ] Open `/admin/audit` (Activity log). Verify there are entries for `notification_recipient.create`, `.update`, `.delete` from your test actions. Owner-attributed.

---

## 4. Shipping zones (PR D)

### 4.1 Existing zone visible
- [ ] Visit `/admin/settings/shipping`. Below the **Default fallback** card, you should see the **"Pakistan — Nationwide"** zone listed with rate **200** and free-shipping threshold **2500**.

### 4.2 Add a zone
- [ ] Click **+ Add a zone**. Fill in: Name "Karachi", rate 150, free-shipping threshold 2000, est. min 1, est. max 3, Active enabled.
- [ ] Click **Create zone**. The new card appears in the list.

### 4.3 Edit
- [ ] On the Karachi card, change rate to 180 → **Save zone**. Reload the page → value persists at 180.

### 4.4 Active toggle
- [ ] Uncheck **Active** on Karachi → Save. Card greys out (opacity ~0.6) with an "Inactive" pill in the header.

### 4.5 Delete with FK cascade
- [ ] Delete the Karachi zone → confirm prompt → row disappears from the list.
- [ ] Verify in admin via SQL or by inspection that the corresponding `shipping_rates` row was also removed (the FK cascade should handle it).

### 4.6 Validation
- [ ] Try to add a zone with a duplicate name ("Pakistan — Nationwide") — server should reject with "A zone named X already exists."
- [ ] Try with negative rate — rejected.
- [ ] Free-shipping threshold blank — should be accepted (means "never free").

### 4.7 Checkout impact (regression check)
- [ ] Add a "Karachi" zone with rate 150 again. Map at least one province → that zone via your direct DB knowledge (or rely on the existing nationwide mapping for now).
- [ ] Place a test checkout with a Karachi address. Verify the shipping rate displayed and charged matches **150 PKR**.
- [ ] Place another with a different province. Verify it falls back to the nationwide 200 PKR.
- [ ] After testing, delete the Karachi test zone.

---

## 5. Integrations status (PR D)

- [ ] Visit `/admin/settings/integrations`. See 8 cards: Resend, PostHog, Sentry, Upstash, JazzCash, Easypaisa, Search Console, WhatsApp.
- [ ] Each card has a status badge: **Configured** (green), **Partial** (amber), or **Not configured** (grey).
- [ ] **Summary row at the top** shows counts: X configured / Y partial / Z not configured. Numbers match the cards below.
- [ ] For each Env var listed, `✓` if set, `✗` if missing. Spot-check 1–2 known-set env vars to confirm green ticks.
- [ ] **SECURITY-CRITICAL:** View page source (Ctrl-U). Confirm **no env-var VALUE** (e.g. no actual API key text) appears anywhere in the rendered HTML. Only var **names** and tick marks. *Severity: SEV-1 if any value leaks.*
- [ ] For PostHog and Sentry, the "Last sync" field shows a time (e.g. "12m ago" or "—" if cache empty). Hit **Refresh analytics** on `/admin/dashboard`, wait, return to Integrations — Last sync should update to **"just now"**.

---

## 6. PostHog journey widgets (PR E)

### 6.1 Refresh first
- [ ] Go to `/admin/dashboard` → click **Refresh analytics** → wait for toast.

### 6.2 Widgets render
- [ ] Open `/admin/analytics` → click the **Customers** tab.
- [ ] You should see **4 new widgets** in addition to the existing ones:
  - **Top user journeys** — bar-chart-style list of path sequences (e.g. `/ → /shop → /product/foo`) with session counts.
  - **Weekly active users** — sparkline with 4 dots, dates below, counts above.
  - **Funnel by traffic source** — table with sources × funnel stages × end-to-end conversion column.
  - **Latest session recordings** — list of 10 cards, each a clickable PostHog viewer link.

### 6.3 Data sanity
- [ ] For **Top user journeys**, the bars should be proportional. The longest bar should be the most-trafficked sequence.
- [ ] For **Funnel by source**, the rightmost "Conv." column should show 0–100% values. **direct** is typically the largest source row.
- [ ] For **Weekly active users**, the 4 dots should be roughly equidistant. Last week's value should be on the right.
- [ ] For **Session recordings**, click one. It should open `https://us.posthog.com/project/429225/replay/<id>` in a new tab. Verify the recording loads in PostHog. *(If PostHog gives a 404, the recording was deleted — that's PostHog retention, not a bug.)*

### 6.4 Permission gate
- [ ] Sign in as a staff member **without** `analytics_traffic` permission (e.g. Customer Support role). Verify the 4 new widgets do **not** render. The Customers tab still loads with the other widgets.

### 6.5 Empty-state behaviour
- [ ] If you've never refreshed analytics, the widgets show empty-state copy ("No journey data yet — refresh analytics from the dashboard to populate") instead of crashing the page.

---

## 7. Cross-cutting regression sweep

These check that the cleanup didn't break anything pre-existing.

### 7.1 Storefront sanity (no admin)
- [ ] Public homepage loads, no console errors.
- [ ] No leftover top-bar announcement showing from the removed Promo Banner.
- [ ] Add to cart, go to checkout, see shipping cost calculated. (Don't have to place an order unless you want to.)

### 7.2 Admin Team & Roles (gated on migrations 124/125/127)
- [ ] Visit `/admin/team`. The **Roles panel** is populated with 5 system roles: Manager, Marketer, Customer support, Inventory, Analyst.
- [ ] Each role has a description and a permission set. Click "Edit" on Customer support — its permissions should include `orders.view`, `orders.edit`, `orders.delete`, `customers.view`, `customers.edit`, `customers.delete`, `returns` (7 items).
- [ ] Try creating a staff member with the "Customer support" role. Sign in as them in a private window. Verify they CAN see Orders, Customers, Returns — but CANNOT see Products, Settings, Team.

### 7.3 Customers list (gated on migration 126)
- [ ] Visit `/admin/users` (Customers). Each customer row should show order count and lifetime spend columns populated. Top customer should be ~PKR 10,694 (the verification number from migration 126 application).
- [ ] Sort by lifetime spend. Top spenders rise to the top.

### 7.4 Email log still working
- [ ] Visit `/admin/emails`. Recent email events from the notification fan-out (your test orders during §3) appear with `status=sent` and the correct recipient.

### 7.5 Audit log working
- [ ] Visit `/admin/audit`. Every settings save, recipient change, and shipping-zone change from this QA session is logged with the actor's name.

---

## 8. Production data sanity (read-only SQL)

If you have Supabase SQL access, run these to confirm schema is healthy. Every row count should be > 0 for the tables marked *(expected)*:

```sql
-- Roles seed (5 rows)
SELECT name, is_system, cardinality(permissions) AS perms FROM public.roles ORDER BY name;

-- Notification recipients (0 or N depending on what you added)
SELECT email, events, enabled FROM public.notification_recipients ORDER BY created_at;

-- Promo dedupe (should be 0 legacy keys)
SELECT key FROM public.site_settings WHERE key LIKE 'promo_%';

-- Shipping zones (at least 1: Pakistan — Nationwide)
SELECT z.name, z.active, r.rate, r.free_shipping_threshold
FROM public.shipping_zones z LEFT JOIN public.shipping_rates r ON r.zone_id = z.id
ORDER BY z.sort_order, z.name;

-- Migration tracker — no duplicate version strings
SELECT version, count(*) AS dupe_count FROM supabase_migrations.schema_migrations
GROUP BY version HAVING count(*) > 1;
-- Expected: 0 rows.

-- PostHog cache freshness — should have 9 keys including 4 new ones
SELECT key, updated_at FROM public.analytics_cache
WHERE key LIKE 'posthog%'
ORDER BY key;
-- Expected keys: posthog, posthog_top_pages, posthog_top_events,
-- posthog_top_referrers, posthog_funnel, posthog_journeys,
-- posthog_funnel_by_source, posthog_retention, posthog_recordings
```

---

## 9. Security & permission boundary tests

These verify that none of the new server actions can be invoked by an unauthorized user.

- [ ] Sign in as a **non-owner** with `customers.view` only.
- [ ] Try to navigate directly to `/admin/settings/notifications` by typing the URL. You should be **redirected to `/admin/dashboard`** (the Settings layout's owner gate).
- [ ] Try `/admin/settings/shipping`, `/admin/settings/integrations` — same redirect.
- [ ] Sign in as **owner**. Open Notifications. Open DevTools → Network. Add a recipient. Inspect the server-action request: the form data should NOT include the `_redirect` field naming a path outside `/admin/settings` (that defence is in `actions.ts`).
- [ ] (Optional, advanced) Use `curl` or DevTools to forge a POST against the server actions with a non-owner cookie. Confirm 401/redirect.

---

## 10. Mobile sweep (375 × 812 viewport)

- [ ] Sidebar opens via hamburger; tapping a link closes it.
- [ ] **Settings left rail** becomes a horizontal scroller above content. All 8 items are reachable.
- [ ] Each Settings sub-page form is usable: inputs are sized correctly, labels don't wrap awkwardly, Save button is reachable without keyboard occlusion.
- [ ] **Shipping zone cards** stack vertically and are tappable.
- [ ] **Integrations cards** stack vertically; env-var ticks remain readable.
- [ ] **PostHog widgets**: User Journeys list is scannable; Funnel-by-source table is horizontally scrollable; Retention sparkline scales.

---

## 11. Known limitations & documented follow-ups

These are intentionally out of scope — don't file bugs:

- **Multi-rate-per-zone**: each shipping zone supports exactly one rate (label = "Standard"). Standard + Express within one zone is a follow-up.
- **Per-province → zone mapping UI**: the `province_zones` table is seeded to map every PK province to "Pakistan — Nationwide". There's no admin UI yet to remap a province to a different zone. Workaround until then: direct SQL.
- **Notification events** are currently `order.new` and `inventory.low`. Other planned events (`order.cancelled`, `payment.failed`) are wired only at the `NotificationEvent` type level; no email sender currently fires them.

---

## Severity legend for bug reports

When filing issues found during this QA pass:

- **SEV-1** — customer-visible data loss / wrong charge / leaked secret / can't place orders
- **SEV-2** — admin-side data loss / wrong audit log / broken permission gate
- **SEV-3** — UI defect, copy issue, broken responsive layout, console error without functional impact
- **SEV-4** — nit / polish

Report each issue with: PR # if relevant, exact URL, steps, expected vs actual, screenshot, browser / viewport.

---

## Smoke-test shortlist (10 min)

If time is tight, run these 8 checks first:

1. `/admin/settings` redirects to `/admin/settings/profile`
2. Each of 8 sub-pages loads without error as **owner**
3. Settings → Notifications: add a recipient → place a test order → email arrives at recipient instead of OWNER_EMAIL
4. Settings → Shipping: existing "Pakistan — Nationwide" zone visible with rate 200
5. Settings → Integrations: no env-var VALUE visible in page source
6. `/admin/team` Roles panel shows 5 system roles
7. `/admin/users` Customers list shows order counts and lifetime spend
8. `/admin/analytics` Customers tab — after a Refresh analytics — shows 4 new widgets with real data

If any of those 8 fail, halt deeper testing and report.
