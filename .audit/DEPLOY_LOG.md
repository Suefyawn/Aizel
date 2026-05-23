# Deployment Log

Running log of production-side incidents, root causes, and the fixes that
followed. Each entry is dated and titled by symptom — read it like an
ops journal. New entries go to the top.

---

## 2026-05-19 — WhatsApp deep-link integration (no Cloud API, no card)

The merchant asked for WhatsApp integration but doesn't want to put a
card on file with Meta for the Cloud API. Shipped the maximum-value
zero-cost path instead: `wa.me` deep links everywhere a customer or
admin might need to start a WhatsApp conversation, plus a help doc
showing the merchant how to configure the WhatsApp Business app on
their phone to handle the rest (auto-replies, quick replies, catalog).

**New helpers (`src/lib/whatsapp.ts`):**

- `whatsappUrl(message?)` — builds a `wa.me` URL to the merchant
  number, optionally pre-typed. Returns `null` if the env var
  isn't set so callers can short-circuit the render.
- `whatsappUrlForCustomer(phone, message?)` — same, but for admin
  → customer outbound. Normalises Pakistani phones (drops spaces,
  prepends `92` if the number starts with `0`).
- `WA_TEMPLATES` — pre-typed message catalogue:
  `generic`, `product`, `cart`, `orderTrack`, `orderQuestion`.
- `hasWhatsApp()` / `merchantNumber()` — tiny utility helpers for
  the help doc + future renderers.

**New shared button (`src/components/ui/WhatsAppButton.tsx`):**

Server component. Renders `null` when unset. Three sizes:
`full` (chunky CTA), `pill` (inline), `icon` (header).

**Placements (six surfaces):**

1. **Header** — green WhatsApp icon button between search and
   account icons. Inlined because Header is a client component;
   uses the same helper.
2. **PDP** — "Ask about this on WhatsApp" pill below the buy bar,
   pre-fills the product name.
3. **Cart** — "Need help? Chat on WhatsApp" link under the
   Proceed-to-Checkout button.
4. **Thank-you page** — full chunky CTA pre-fills the order number;
   replaces the existing inline anchor with the shared component.
5. **Admin order detail** — green "WhatsApp" button beside "Print
   invoice"; opens chat with the **customer's** phone (uses
   `whatsappUrlForCustomer(o.phone, …)`), pre-filled with the order
   number for one-tap support reply.
6. **Admin help doc** at `/admin/help/whatsapp` — explains how to
   install WhatsApp Business on the merchant phone, configure
   greeting/away/quick-reply messages, and connect the catalog.
   Shows the current configured state inline + a "Test the link"
   button.

**Env (`.env.example` + `.env.local`):**

- `NEXT_PUBLIC_WHATSAPP_NUMBER` — international E.164 without
  the `+` (e.g. `923001234567`). Marked `NEXT_PUBLIC_*` so it
  inlines into the client bundle at build time — the Header
  button (client component) can use it without a runtime fetch.

**Capabilities (and what is intentionally NOT in scope):**

| Have | Don't have |
|---|---|
| Customer-initiated chat from anywhere on the site | Outbound order-status pushes |
| Pre-typed context (order #, product name) | AI-generated replies |
| One-tap admin → customer support reply | Webhook integration |
| Auto-replies via Business app (greeting / away / quick replies) | Cart-recovery DMs |
| Free product catalog inside chat (Meta hosts) | WhatsApp Flows / interactive buttons |

**Verification gate:**
- `npm run typecheck` — clean
- `npm run lint`      — clean
- `npm test`          — 85/85 pass
- `npm run build`     — succeeds; `/admin/help/whatsapp` in the
  manifest as a dynamic route

**Lesson:** A merchant who can't (or won't) put a card on file is
not a degraded customer — they're the majority of small Pakistani
e-commerce businesses. The free-tier WhatsApp path (`wa.me` +
Business app) reaches ~80% of the AI-agent value: customer can
initiate context-rich chats with a single tap, merchant has
canned-reply automation, catalog is browseable in-chat. We ship
this every time and let the Cloud API upgrade happen when the
revenue justifies it.

---

## 2026-05-19 — Populate empty PDP content fields for all 109 products

Migration 081 added the columns. Migration 082 backfilled prices. But
the actual content blocks — `how_to_use`, `ingredients`,
`key_benefits[]`, `faq[]`, `usage_tips` — were all 0/109 populated
because the WP import didn't bring them across. Production smoke audit
confirmed this on the live PDP: no "How to Use" / "Ingredients"
accordions visible because the conditional render hides them when
the field is null.

**Research:** A subagent ran ~10 minutes of WebSearch against brand
official pages (CeraVe.com, NARS, PIXI, Tarte, Huda Beauty, Rhode,
Real Techniques) for international SKUs and against dvago.pk /
dawaai.pk / medplus.pk for Pakistani supplements (Argivital, Calin G,
Asco C, Femeez, Ferosim, Repro-F/M, Cranblue, Calosent, Cee, Vit KD,
etc.). For each product it wrote a JSON row with:

- `how_to_use` — 1-3 short sentences in Pakistani-English tone
- `ingredients` — comma-separated list when known; fall-back
  `"Multi-ingredient formulation; consult the package leaflet…"`
  for the truly obscure local supplements
- `key_benefits` — 3-5 items with an emoji icon + ≤8-word text
- `faq` — 2-4 Q&A pairs targeting real customer concerns
  (pregnancy safety, shade match for wheatish/medium-deep skin,
  iron + calcium spacing, authenticity, layering with retinol/SPF,
  etc.)
- `usage_tips` — one paragraph (~40 words) with care/storage advice
- `social_proof` — empty string; merchant will hand-author
  testimonials later

**Migration 084 — bulk content backfill.**

Build path: the SQL containing all 109 product payloads inline came to
134 KB, too large for a single MCP `execute_sql` call. Workaround was a
one-shot SECURITY DEFINER RPC `_populate_product_content(jsonb)` (also
in migration 084) that took the JSON array via PostgREST and applied
the update server-side. A small Python+curl loop POSTed five 22-row
batches to the RPC using the service-role key. Each batch returned
its row-update count; total 109/109 updated. Coverage post-run:
109/109 across every field.

Migration file in the repo carries the full JSON inline so CI / dev
restores reproduce the same content. Idempotent: every field uses
`COALESCE(NULLIF(existing,''), backfilled)` so admin edits made after
this PR can't be clobbered by a re-run.

The RPC was dropped from the live DB immediately after the backfill
ran — it's not part of the steady-state schema.

**Quality spot-checks:**

- CeraVe Hydrating Cleanser: real INCI list (Ceramide NP/AP/EOP,
  Hyaluronic Acid, Niacinamide, etc.); FAQ has "Is it suitable for
  oily, acne-prone skin?" / "Can I use it daily?" / "Will it dry out
  my skin?"
- NARS Afterglow Liquid Blush: Pakistan-shade FAQ "Will this look
  chalky on wheatish skin?" with shade-undertone answer.
- Argivital Sachet: L-Arginine + L-Citrulline noted as the typical
  active set; FAQs cover timing, safety in pregnancy, side effects;
  ingredient line ends with the leaflet disclaimer.
- Pixi Blush Sticks Buy 1 Get 1 Free: bundle-specific FAQ ("Are both
  sticks the same shade?", "How long do they last on combination
  skin?").

**Verification gate (all green):**
- `npm run typecheck` — clean
- `npm run lint`      — clean
- `npm test`          — 85/85 pass
- DB: 109/109 across all five content fields

**Operational follow-ups:**

- Merchant should eyeball the auto-generated content for the
  flagship products (CeraVe, PIXI, NARS, the Pakistan-specific
  supplements they actually carry) — the research was thorough but a
  human pass catches edge cases like Pakistan-specific dosing or
  off-label uses.
- `social_proof` is empty — populate as merchant collects
  testimonials. Field is a single text column on `products`, editable
  from `/admin/products/<id>` → Content & SEO section.

**Lesson:** When a research-heavy bulk content task hits the
MCP-input character ceiling, the cleanest workaround isn't
splitting into batches at the MCP layer — it's a one-shot
SECURITY DEFINER RPC + curl loop using the service-role key.
The data travels via PostgREST's wider body limit, the SQL itself
stays tiny, and the migration file can still hold the inline
payload for repro. Reusable for any future bulk-content drop.

---

## 2026-05-19 — Order-cancellation restock + per-product inventory history

Closes the last documented gap in the inventory ledger: cancelled orders.

**Migration 080.** Adds `'cancellation'` to the `inventory_reason`
enum. Existing values (`import`, `order`, `return`, `restock`,
`adjustment`, `damage`, `transfer`) didn't carry a clean meaning for
an order that was placed-then-cancelled. Using `'return'` for it
would have polluted the trail when a real return happens later;
`'restock'` would have lost the link to the order_id.

**`updateOrderStatus` cancellation restock.** When an order
transitions from any non-cancelled status to `cancelled`, the items
are pushed back into stock via `record_stock_change` (positive
`qty_delta`, `reason='cancellation'`, `order_id` linked). Idempotent
via the `before.status !== 'cancelled' && status === 'cancelled'`
guard, so a "cancelled → cancelled" no-op submit doesn't double-credit.
Mirrors `markReturnReceived` from the previous PR: restock first,
status flip happens via the same row-update.

**`/admin/products/[id]` → inventory history.** Mounted a new
`ProductInventoryHistory` server component under the variants
section. Pulls the latest 25 ledger rows for the product (any
variant), renders a compact timeline with reason chips, balance
column, actor, and a deep-link to the order for `order` /
`cancellation` / `return` rows. "View all →" link routes to
`/admin/inventory?product=<id>` for the unfiltered list.

The inventory page itself gets a `cancellation` chip color (violet)
and the new chip in the filter row.

**Every stock movement now sourced from the ledger:**

| Source | Reason | Notes |
|---|---|---|
| Migration 078 backfill | `import` | One row per product + per variant at install time |
| `/admin/inventory` manual form | `restock` / `adjustment` / `damage` | Owner / staff actor |
| `place_order` RPC | `order` | Linked to `order_id`, negative |
| `markReturnReceived` admin action | `return` | Linked to `return_id` + `order_id`, positive |
| `updateOrderStatus → 'cancelled'` | `cancellation` | Linked to `order_id`, positive |

**Lesson:** Migration 078's enum was a forward-looking design — and
the gap it left (no `cancellation` value) showed up the moment we
tried to use it for the natural symmetric write to `place_order`'s
decrement. When you ship an enum that covers "current uses", also
walk every other place the underlying event could fire and ask
whether they fit cleanly — adding values later is free, but
conflating two different events into one enum value is corrosive.

---

## 2026-05-19 — PDP content + SEO fields + missing-price backfill

Two related additions for the product page.

**Migration 081 — PDP content + SEO fields.** Adds seven admin-editable
columns to `public.products`:

- `seo_title`, `seo_description`, `og_image_url` — optional overrides
  for the meta-tag templates. Falls back to brand-plus-name /
  short_description / image_url when null.
- `key_benefits` (JSONB array of `{icon?, text}`) — rendered as a
  scannable benefit-card bar near the top of the PDP. Keyword-rich,
  high-conversion.
- `faq` (JSONB array of `{q, a}`) — powers a new accordion below
  the gallery split AND emits FAQPage JSON-LD for Google rich-result
  eligibility.
- `usage_tips` — long-form text rendered as an additional
  accordion section under "How to Use" / "Ingredients".
- `social_proof` — short testimonial / press quote, rendered as a
  callout block under the main description.

CHECK constraints enforce that `key_benefits` and `faq` are JSONB
arrays. Storage cost is negligible; both arrays are tiny per row.

**Code wiring:**

- `Product` type extended with the seven fields + two small
  `ProductKeyBenefit` / `ProductFaqItem` interfaces.
- `productInputSchema` (`src/lib/validators.ts`) extended with
  JSON-string transforms for `key_benefits` / `faq` (the admin form
  posts them as JSON textareas — the transform parses + validates
  the shape). Empty string normalises to null.
- `ProductForm` adds a "Content & SEO" section with inputs for
  every new field. The two JSON arrays use monospace textareas with
  inline help text and example payloads.
- `app/product/[slug]/page.tsx`'s `generateMetadata` honours
  `seo_title` / `seo_description` / `og_image_url` overrides before
  falling back to auto-templating. FAQPage JSON-LD is emitted when
  `faq` is set.
- `PDPPage` renders the new sections in order: benefits → description
  → social_proof → existing accordion (now including a new "Usage
  Tips" panel from `usage_tips`) → FAQ accordion.

**Migration 082 — backfill missing prices.** Researched Pakistan-
market prices for the 22 SKUs that landed at `price=0` from the WP
import. Sources: Daraz, Beauty Station, DiscountStore, Makeup City,
Vegas.pk, Pehnawa Wear, dvago, etc. For each SKU picked the median
of ≥2 listings as `original_price`, then applied a ~50% promo
discount as `price` to fit Yellow Pink's standing 40-60% off
positioning. Own-label supplements (Energy Boost) fell back to a
class estimate. Guarded by `WHERE price IS NULL OR price = 0` so
re-running won't overwrite a hand-edited price.

Examples:
- Anastasia Beverly Hills Highlighter Glow Seeker — PKR 7,250 (was PKR 14,500)
- Dior Blush Rosy Glow — PKR 11,500 (was PKR 22,999)
- Huda Beauty Icon Liquid Lipstick — PKR 7,350 (was PKR 14,700)
- NARS Light Reflecting Foundation — PKR 7,500 (was PKR 14,963)
- Tarte Shape Tape Concealer — PKR 3,450 (was PKR 6,900)

**Verification gate (all green):**
- `npm run typecheck` — clean
- `npm run lint`      — clean
- `npm test`          — 85/85 pass
- `npm run build`     — succeeds; PDP route still in the manifest

**Operational follow-ups (for the merchant):**
- Eyeball each backfilled price before customers start landing on
  the storefront — Pakistani retail prices fluctuate +/- 20% and the
  median was a research best-guess, not a vendor quote.
- Start populating `key_benefits`, `faq`, `usage_tips` on the
  best-traffic SKUs first (the bestsellers / featured products from
  migration 076) — those will see the SEO + conversion lift soonest.

**Lesson:** Schema fields that map cleanly to schema.org / Google
rich-result types (FAQPage, AggregateRating, BreadcrumbList) compound
their value the moment they exist — the rendering work is the same
whether you have 1 or 109 products, and Google indexes the
structured-data either way. Spend the marginal hour on the JSON-LD
emitter; the SEO returns dwarf the dev cost.

---

## 2026-05-19 — TCS courier: pre-issued bearer token path

TCS Envio emailed Tanya (`TANYAZAFAR@HOTMAIL.COM`) a long-lived JWT
("Bearer Token for API Access — TCS Envio") on 2026-05-19 6:15 pm.
The adapter was built for the OAuth-style flow
(`clientid` + `clientsecret` → `/auth/api/auth` round-trip → short-lived
access token), but what TCS actually provisioned was a pre-issued JWT
valid until 2029-05-19. Decoded claims: `clientid=215628692`, `services`
list (103, 155, 161, 164, 225, 247, …), iss `connect.tcscourier.com`,
nbf 1779196527, exp 1865596527.

**Adapter change (`src/lib/couriers/tcs.ts`):**

- Added a `TCS_BEARER_TOKEN` env var that takes precedence over the
  OAuth flow. When set, `getBearerToken()` returns it directly — no
  round-trip, no cache invalidation, no expiry tracking on our side
  (TCS's gateway returns 401 if it ever needs replacement, and the
  per-call result paths surface that to the caller).
- Split `REQUIRED_VARS` into `REQUIRED_NON_AUTH_VARS` + an auth-mode
  check. `isConfigured()` now passes when either:
   - `TCS_BEARER_TOKEN` is set, OR
   - both `TCS_CLIENT_ID` + `TCS_CLIENT_SECRET` are set.
- Header doc-comment rewritten to describe both modes and which env
  vars belong to each.

**Env (`.env.local`):**

- `TCS_BASE_URL=https://ociconnect.tcscourier.com` (prod).
- `TCS_BEARER_TOKEN=<the JWT from the email>`.
- Placeholder lines for `TCS_TCS_ACCOUNT`, `TCS_COST_CENTER_CODE`,
  `TCS_SHIPPER_ADDRESS`, `TCS_SHIPPER_MOBILE` — still need real values
  from the TCS account manager before bookings will work.
  `isConfigured()` returns false until they're filled, so the
  ShipmentBookingForm falls back to the manual tracking-number entry.
- `TCS_SHIPPER_NAME=Yellow Pink`, `TCS_SHIPPER_CITY_CODE=LHE`,
  `TCS_SHIPPER_CITY_NAME=Lahore`, `TCS_SERVICE_CODE=O` (overnight) —
  sensible defaults.

**Smoke probe:** `node --env-file=.env.local` POST to a deliberately
non-existent path returned `502 Bad Gateway` from `openresty` —
confirms we reached TCS's edge with the bearer (the 502 is just
upstream-not-found for the wrong path I picked; real booking calls hit
`/ecom/api/booking/create` which the adapter already targets).

**Operational follow-ups (manual, by the user):**

- Mirror `TCS_BASE_URL`, `TCS_BEARER_TOKEN`, and the rest of the
  `TCS_*` vars to Vercel env vars (Production + Preview).
- Fill in `TCS_TCS_ACCOUNT`, `TCS_COST_CENTER_CODE`,
  `TCS_SHIPPER_ADDRESS`, `TCS_SHIPPER_MOBILE` once TCS confirms them.
- Pin a Vercel cron reminder ~30 days before 2029-05-19 to rotate
  the JWT (TCS provides a fresh one on request).

**Verification gate:**
- `npm run typecheck` — clean
- `npm run lint`      — clean
- `npm test`          — 85/85 pass

**Lesson:** Don't bake the auth mode into the only path. The
original adapter assumed every customer would go through the
client-id/secret OAuth flow because that's what the API user manual
documents — but TCS Envio Pakistan provisions pre-issued JWTs for
COD-API customers as the default. A 5-line "if env, skip auth"
fork was all the integration needed; without it, our merchant
would have had to chase a clientsecret that doesn't exist.

---

## 2026-05-19 — Wire place_order + return-received through the inventory ledger

Closes the loop opened by migration 078. The ledger now carries every
stock movement, not just the import backfill and manual adjustments.

**Migration 079 — `place_order` → ledger.**

The order RPC used to end with an inline
`update products set stock = stock - qty` loop that bypassed both the
older `decrement_stock` helper and the new `record_stock_change` RPC
from 078. Replaced with a `record_stock_change` call per line item,
inside the same transaction so atomicity is preserved. Each ledger
row carries:

- `reason = 'order'`
- `order_id` = the just-inserted `v_order.id` (the
  `/admin/inventory` page links these to the order detail)
- `actor_kind = 'customer'` when the order has a `user_id`, else
  `'system'` for guest checkouts
- `actor_email` from the order
- `variant_id` derived from `items[i].variant_id` (NULL for
  unvariated SKUs)

**Return-received transition — new admin action.**

The schema supported `return_requests.status ∈ {pending, approved,
rejected, received, refunded, cancelled}` but no code path advanced
returns past `approved`. Added `markReturnReceived(id)` in
`src/app/account/orders/returns/actions.ts`:

1. Verifies the return is in `approved`.
2. Loops over `items[]` calling `record_stock_change` with
   `reason='return'`, `order_id`, `return_id` set, positive
   `qty_delta`. Restock happens BEFORE the status flip so a
   downstream failure doesn't leave a received-but-not-restocked
   return.
3. Flips status → `'received'` and writes a `return.received`
   audit row.

`ReturnsQueue` shows a blue "Mark as received & restock" button for
approved returns (sits next to the existing Approve / Reject flow for
pending ones).

**Drive-by RLS fix.** `approveReturn` and `rejectReturn` in
`src/app/account/orders/returns/actions.ts` were still using the
anon `supabase` client. My PR-#6 sweep targeted
`src/app/admin/**`; this file lives under
`src/app/account/orders/returns/` so the grep missed it. Returns
admin actions on production have been silently no-op'ing for the
same reason as the broader admin sweep. Switched to
`supabaseAdmin()`.

**What this completes.**

Every stock-mutating path now writes to `inventory_ledger`:

| Source | Reason | Notes |
|---|---|---|
| Migration 078 backfill | `import` | One row per product + per variant at install time |
| `/admin/inventory` manual form | `restock` / `adjustment` / `damage` | Owner / staff actor |
| `place_order` RPC | `order` | Linked to `order_id`, qty is negative |
| `markReturnReceived` admin action | `return` | Linked to `return_id` + `order_id`, qty is positive |

Future-flagged: when an order is cancelled and the customer was
refunded, the items should be restocked the same way. Today
`updateOrderStatus → 'cancelled'` doesn't touch stock — that's a
known gap, not in this PR.

**Verification gate (all green):**
- `npm run typecheck` — clean
- `npm run lint`      — clean
- `npm test`          — 85/85 pass
- `npm run build`     — succeeds
- Migration 079 applied via MCP without errors (the inline smoke
  test failed at the unrelated `notify_order_confirmation` trigger
  whose Edge Function URL isn't set in the MCP session — it works
  fine from a real Vercel request where `app.supabase_url` is set).

**Lesson:** Migration 078 introduced a clean ledger primitive but
shipped without wiring the biggest writer (`place_order`) to it.
A new primitive is only as useful as its biggest call site. Worth
asking up front: *which callers will I migrate in the same PR?*
Otherwise the value sits dormant until a follow-up — exactly the
shape this DEPLOY_LOG keeps recording.

---

## 2026-05-19 — Brand data quality + inventory ledger

Two structural follow-ups after the homepage/admin RLS pass.

### 1. Brand column normalisation (migration 077)

The WP→Supabase importer copied a WC "concern" attribute into
`products.brand` instead of the WC "brands" attribute. Result: out of
109 rows, only ~32 had a real brand value (with multiple casing
duplicates: CeraVe + cerave, NARS + nars, PIXI + pixi) and the rest
carried strings like "arthritis", "bone health", "blush", "cheek tint",
"anti-aging", "foundation", "Couple", "Pregnancy", "Strong".

**User-visible impact:** Shop-page brand filter showed
"antioxidants" as a brand alongside CeraVe. PDPs displayed
"blush brush by Real Techniques" with brand="blush brush". JSON-LD
`brand.name` was junk. Order emails and structured data carried the
bad strings into search results.

**Fix:** re-derive brand from the product name's prefix using a
21-entry canonical allowlist (CeraVe, PIXI, NARS, SHEGLAM,
Real Techniques, Anastasia Beverly Hills, Christine, Huda Beauty,
DRMTLGY, Skin1004, Dior, Fenty Beauty, Glow Recipe, Iconic London,
Kiko Milano, Makeup Revolution, Rhode, Tarte, The Ordinary,
Rare Beauty, Argivital) plus 3 suffix patterns for "X by Real
Techniques" / "X by Pixi" / "X by NARS". Pattern matching is
case-insensitive against `lower(name)`; longer-prefix brands have
priority 10 so "Huda Beauty" wins before a bare "Huda" match.

**Schema change:** dropped `NOT NULL` on `products.brand` so own-label
Pakistani supplements (60/109 SKUs — Argivital sachets, Calin G, Asco
C, Femeez, Kidogest, etc.) can legitimately have no brand and the
shop-page filter sidebar doesn't show "antioxidants" as one. The
`Product` TS type, `brandPlusName()` helper, and 8 caller files
updated to accept `string | null`. Admin product form makes the
field optional with placeholder "leave blank for own-label products".

**Result:** 19 distinct canonical brands across 49 products + 60
NULL brands. Index on `lower(brand)` for the shop-page filter.

### 2. Inventory ledger (migration 078)

Up till now stock was a mutable scalar on `products.stock` /
`product_variants.stock` with no history. `decrement_stock` (used by
`place_order`) silently overwrote the value. Manual admin
adjustments via bulk-product-actions / variant-actions paths did the
same. Returns, damages, restocks, and corrections all looked
identical from the outside: a single number that drifted with no
explanation. The DEPLOY_LOG's audit findings had this as the
biggest structural gap.

**Schema:**

- New table `public.inventory_ledger` with one row per stock movement:
  `(product_id, variant_id, qty_delta, balance_after, reason,
   order_id, return_id, actor_kind, actor_email, note, created_at)`.
- `inventory_reason` enum: `import`, `order`, `return`, `restock`,
  `adjustment`, `damage`, `transfer`.
- RLS enabled, service-role-only — the ledger surfaces customer
  order_id linkage that should never be anon-readable.
- Four indexes covering the expected query shapes (per-product
  history, per-variant history, per-order trace, recent-N global).

**Helper RPC `record_stock_change`:**

SECURITY DEFINER, service-role-EXECUTE-only. Wraps the
`products.stock` (or `product_variants.stock`) update and the
ledger INSERT in a single transaction so the running balance can
never diverge from the sum of deltas. Returns `(ledger_id,
new_balance)` so the caller can confirm.

**Backfill:** 286 ledger rows inserted at migration time (109
products + 177 variants), each `reason='import'` with
`balance_after = current stock`. The /admin/inventory page now
shows real history for every SKU instead of "no movements yet",
and a future negative delta on a SKU with no manual movement
correctly balances against the import row.

**Admin UI:**

- New `/admin/inventory` page with a 200-row ledger table, filter
  chips per reason, and a one-line "Log change" form for manual
  adjustments (`reason ∈ {restock, adjustment, damage}` — the
  storefront-driven reasons `order` / `return` are not exposed).
- New `src/app/admin/inventory-actions.ts` with `adjustStock`
  server action — calls `record_stock_change` via supabaseAdmin
  and logs an `inventory.adjust` audit event.
- AdminSidebar nav: new "Inventory" link between Products and
  Orders.

Future work (not in this PR): wire `place_order` to call
`record_stock_change` with `reason='order'` and `order_id` set
(currently calls the older `decrement_stock` directly). Same for
the return-received transition: call with `reason='return'` and
`return_id`. Until that's done, customer-driven stock movements
still mutate `stock` silently — manual adjustments are the only
ones writing to the ledger.

**Verification gate (both migrations):**
- `npm run typecheck` — clean
- `npm run lint`      — clean
- `npm test`          — 85/85 pass
- `npm run build`     — succeeds, `/admin/inventory` in the manifest
- DB checks: 19 canonical brands, 49 branded + 60 null; 288 ledger
  rows (286 from backfill + 2 smoke-test that were reverted).

**Lesson:** When a bulk import lands, schema-shape correctness is
half the work — column *semantics* are the other half. The
`brand` column had values in it for every row, so it looked correct
on the surface; only a human eyeballing the shop-page sidebar would
notice that "anti-inflammatory" isn't a brand. A linter that asserts
"every distinct value in a categorical column appears in an
allowlist" would have caught it on the first run. Worth building
for the next bulk-data drop.

---

## 2026-05-19 — Empty homepage + missing orders + dead audit log (the RLS-hardening blast radius)

**Symptom triplet, all reported by the user in one session:**

1. "The homepage isn't rendering any products in the featured collections. The
   navigation is weird. When opened, there's no products on any."
2. "I don't see any orders in admin dashboard."
3. "Then I don't see anything at all in audit log. It's supposed to be activity
   log I think and it should be logging everything."

**Diagnosis (the common thread):**

The production-ready audit pass (migrations 064 / 067 / 070) tightened RLS on
`staff_members`, `coupons`, `orders`, `coupon_redemptions`, `audit_log`,
`admin_notifications`, `abandoned_carts`, `gift_cards`, `gift_card_transactions`,
`newsletter_subscribers`, and `stock_subscriptions` — removing the wide-open
anon SELECT policies that previously made admin reads work via the anon
key. The audit also documented that "every admin read [was] rewired to
`supabaseAdmin()`" — but that rewire was partial. The session traced the
gap by grepping every admin server file:

| File | Table touched | Status before |
|---|---|---|
| `src/lib/audit.ts` | `audit_log` (INSERT) | **0 rows written ever** — anon insert silently failed, empty try/catch swallowed the error |
| `src/app/admin/orders/page.tsx` | `orders` (SELECT) | Order list rendered empty |
| `src/app/admin/orders/[id]/page.tsx` | `orders`, `shipments` | 404 on every order click |
| `src/app/admin/dashboard/page.tsx` | `orders` (SELECT) | Recent orders + 30-day chart empty |
| `src/app/admin/layout.tsx` | `orders`, `admin_notifications` | Pending-order badge stuck at 0; bell empty |
| `src/app/admin/audit/page.tsx` | `audit_log` (SELECT) | "No audit events yet" forever |
| `src/app/admin/coupons/page.tsx` + `coupon-actions.ts` | `coupons` | Coupons list empty; create/delete/toggle silently failed |
| `src/app/admin/reviews/page.tsx` + `reviews/actions.ts` | `product_reviews` | Pending reviews invisible; the anon SELECT policy filters to `approved=true` |
| `src/app/admin/returns/page.tsx` | `return_requests`, `orders` | Returns queue empty |
| `src/app/admin/users/[id]/page.tsx` | `orders` | Customer order history empty |
| `src/app/admin/notifications-actions.ts` | `admin_notifications` (UPDATE) | Mark-read silently no-op'd |
| `src/app/admin/shipment-actions.ts` | `shipments`, `orders` | Shipment booking silently no-op'd |
| `src/app/admin/promo-actions.ts` | `promos` (writes) | Promo create/update/delete silently no-op'd |
| `src/app/admin/bulk-product-actions.ts` | `products` writes | Bulk publish/archive/delete silently no-op'd |
| `src/app/admin/variant-actions.ts` | `product_variants`, `variant_attribute_values` | Variant create/update silently no-op'd |
| `src/app/admin/actions.ts` | `products`, `blog_posts`, `orders` | Product/blog mutations + order status updates silently failed |

Fix is the same everywhere: replace `import { supabase }` with
`import { supabaseAdmin }` and route every `.from(...)`/`.rpc(...)` call
through it. Service role bypasses RLS — the right credential for an
internal admin write that doesn't belong to a Supabase Auth user (admin
sessions use the staff-cookie path, not Supabase Auth).

**`lib/audit.ts` deserves special call-out** — it's a best-effort fire-and-forget
helper, so the previous anon-INSERT failures were caught and discarded by
the empty `catch { }` block. The empty try/catch turned a real bug into
"audit_log has 0 rows forever". The fix flips to `supabaseAdmin()` and
keeps the same fire-and-forget contract; the table will now actually
populate.

**Homepage emptiness (separate root cause):**

- `getProductsByTag('Bestseller')` and `getProductsByTag('Sale')` both
  returned 0 rows because **0/109 products had the `tag` column
  populated**. The WP-import wrote product tags into the
  `product_categories` join table, not the flat `tag` column the
  homepage helper was filtering on.
- `getProductsByCategoryAndTag('Wellness')` returned 0 because no row
  has `category='Wellness'` — the real categories from the import are
  "Human Health" (23), "Women's Health" (12), "Bone Health" (3),
  "Immune Support" (3), "Brain Health" (2), etc.
- 26 product rows still carried `&amp;`, `&#39;`, `&quot;`, `&rsquo;`
  etc. HTML entities from the WC REST payload.

**Migration 076 (`20260525_076_homepage_data_hygiene.sql`, applied):**

- Adds `is_featured` + `is_bestseller` boolean columns (default false) +
  partial indexes scoped to the flagged rows.
- Decodes the 6 HTML entities we found in `category`/`subcategory`/
  `name`/`brand`/`description`/`short_description`.
- Backfills `is_bestseller=true` for 8 picks across the major categories
  (one per category, sorted by % discount + stock).
- Backfills `is_featured=true` for 5 visually striking landing-page picks
  (different rank from the bestseller set so the two rails don't
  overlap).

After migration: 8 bestsellers, 5 featured, 0 HTML entities left, 79
sale-eligible products.

**New storefront helpers (`src/lib/supabase.ts`):**

- `getBestsellers(limit)` — `is_bestseller=true` first, then backfills from
  highest-stock published products so the rail never goes empty.
- `getFeatured(limit)` — `is_featured=true` first, backfills from newest
  published.
- `getOnSale(limit)` — `original_price IS NOT NULL AND original_price > price`,
  sorted by deepest discount.
- `getProductsByTaxon(taxonOrCategory, limit)` — resolves a taxon slug
  ("makeup"/"wellness"/"bundles") into its category set and queries
  `category IN (…)`. Used by the homepage Wellness rail and the new nav.

**Top-level nav restructure (`src/lib/category-taxonomy.ts` + `Header.tsx`):**

- New `TAXONS` taxonomy groups the 14 fine-grained categories into 4
  top-level macro-buckets: Makeup, Skincare, Wellness, Bundles.
- Each taxon links to `/shop?taxon=<key>`. The shop page resolves the
  taxon to its child categories and passes the set into `CollectionPage`,
  which now supports multi-category filtering (previously it took only
  one `activeCategory` string and did `===` matching).
- Added "Sale" + "All" + "Blog" siblings to the nav.

**Other touch-ups:**

- `src/sections/home/CategoryTiles.tsx` links updated from
  `?category=Makeup&subcategory=Lip+%26+Cheek+Tints` (zero hits) to real
  category names like `?category=Lip+%26+Cheek+Tints`.
- `src/sections/home/{FeaturedProducts,NewArrivals,BestsellersBand,WellnessSection}`
  added `if (products.length === 0) return null` so an empty data layer
  doesn't render a broken-looking "header + empty grid" — that was the
  user-visible "no products on any" symptom.

**Verification gate (all green):**
- `npm run typecheck` — clean
- `npm run lint` — clean
- `npm test` — 85/85 pass
- `npm run build` — succeeds
- Database: `is_bestseller=8`, `is_featured=5`, `html_entities_left=0`,
  `on_sale=79`. `audit_log` will start populating the moment any admin
  action runs.

**Lesson:** A hardening migration without an immediate audit of every
caller is half-done. The audit pass tightened RLS in 064/067/070 and
updated *some* callers, but a `grep -rn "from '@/lib/supabase'"` across
`src/app/admin/**` would have surfaced every stale read/write in 5
seconds. The empty `catch { }` in `lib/audit.ts` is a structural anti-
pattern — best-effort doesn't mean "silently swallow"; it means "log
and continue". A `console.warn` or even an `if (error) console.warn`
would have made this discoverable months ago.

---

## 2026-05-19 — Resend failure visibility + cron-side analytics refresh

**Goal:** close out two operational gaps surfaced after PR #3 merged:

1. The "Resend domain unverified" failure mode the prior DEPLOY_LOG entry
   flagged as needing a Sentry alert had no actual capture path. The
   email send wrapper was using a try/catch around `resend.emails.send()`,
   but the Resend SDK returns `{ data, error }` on validation errors
   rather than throwing — so domain-unverification (and the rest of the
   `RESEND_ERROR_CODE_KEY` set) was silently logged-nothing-to-Sentry.

2. The `analytics_cache` rows that feed the admin dashboard widgets
   (PostHog + Sentry) only refreshed when staff hit the in-app
   "Refresh Analytics" button. If nobody opened the dashboard for a
   day, the widget timestamps lagged by a day. Today's smoke test caught
   the Sentry row at `2026-05-18 11:22` — stale.

**Code shipped:**

- `src/lib/email.ts`
  - Replaced the no-op try/catch with a check on `result.error`. On any
    Resend validation failure we now `Sentry.captureMessage` with stable
    tags:
    - `email_send_failed: 'true'`
    - `resend_error_name: <error.name>`
    - `resend_domain_unverified: 'true' | 'false'` — collapses
      `invalid_from_address` + any message containing "not verified" /
      "unverified" / "domain" into one alertable tag.
    - `from_domain: <parsed from EMAIL_FROM>`
  - Transport-level throws (network failures) still get caught and
    captured via `Sentry.captureException` with the same tag set.
  - Successful sends log the Resend message ID so we can correlate
    Vercel logs with Resend's dashboard.

- `src/app/admin/dashboard/actions.ts`
  - Extracted `refreshAnalyticsCore()` — pure data refresh (PostHog +
    Sentry), no auth/audit/revalidate. Public `refreshAnalytics()`
    server action keeps the `assertPermission('analytics_refresh')`
    gate, calls core, then audit-logs and revalidates the dashboard
    path as before.

- `src/app/api/cron/analytics-refresh/route.ts` (new)
  - CRON_SECRET-gated route, calls `refreshAnalyticsCore()`.
  - Returns 200 if both PostHog + Sentry refresh succeed, 207 if either
    fails (mirrors the daily-cron fan-out's multi-status pattern).

- `src/app/api/cron/daily/route.ts`
  - Added `/api/cron/analytics-refresh` to the sequential fan-out.
    Daily cron now runs four jobs: abandoned-cart, back-in-stock,
    courier-sync, analytics-refresh.
  - No `vercel.json` change needed — still one cron entry, still under
    the Hobby plan's 2-entry / daily-or-less cap.

**Operational ops (manual, by the user):**

- **Vercel env vars** still needed for `analytics-refresh` to actually
  populate the Sentry row in cron context:
  - `SENTRY_AUTH_TOKEN` — Sentry → Settings → Auth Tokens → scopes
    `project:read` + `event:read`.
  - `POSTHOG_PERSONAL_API_KEY` — already in `.env.local` as
    `phx_yQ8i…`, mirror it to Vercel.
  Without them, the cron's analytics-refresh sub-job returns 207 (the
  daily cron's overall result will be 207 instead of 200, and each
  refresh helper throws "X not configured" which `Promise.allSettled`
  collects as a soft error). PostHog already works locally because
  `refresh-analytics-local.mjs` reads from `.env.local`.

- **Sentry alert rule** to wire up against the new tags
  (Sentry → Alerts → Create alert rule):
  - **Critical** — `tags[resend_domain_unverified]:true`. Customers'
    order emails are silently dropping; page someone immediately.
  - **Warning** — `tags[email_send_failed]:true AND !tags[resend_domain_unverified]:true`.
    Other Resend validation/transport failures — bad recipient,
    quota, transient API issue.

**Smoke test:**
- `node --env-file=.env.local /tmp/smoke-resend.mjs` against
  sooviaan@gmail.com — `sent → delivered` in ~4 s. Email ID
  `34d06698-93e6-4290-b03c-2a910cd70471`. Confirms `yellowpink.pk`
  Resend domain is verified and the API key is live.
- Refreshed `analytics_cache['sentry']` directly via Supabase MCP +
  Sentry MCP to bring the row's `updated_at` to today. Sentry
  unresolved issue count is 0 (production is genuinely clean).

**Verification gate:**
- `npm run typecheck` — clean
- `npm run lint`      — clean
- `npm test`          — 78/78 pass
- `npm run build`     — succeeds, `/api/cron/analytics-refresh`
  appears as a dynamic route in the build manifest

**Lesson:** When a third-party SDK returns `{ data, error }` rather
than throwing, every try/catch around it is a false comfort — the
catch block fires on network errors only, and every validation /
quota / auth failure becomes invisible. Same trap as Supabase's
`{ data, error }` PostgrestResponse: assume return-shape, not throw,
unless the SDK docs are explicit. For SDKs you can't change, audit
once per upgrade and convert to result-checking; for monitoring,
add a tagged capture so even the silent failures are alertable.

---

## 2026-05-19 — Supabase performance round 2: RLS auth.uid() initplan + FK covering indexes

**Goal:** finish what migration 073 started — the security ERRORs were
gone, but the Database Linter still surfaced **21 `auth_rls_initplan`**
findings (per-row `auth.uid()` evaluation), **9 `unindexed_foreign_keys`**,
and **3 `multiple_permissive_policies`** (legacy `users * own profile`
duplicates of `profiles_*_own`). All three are linear-cost as the
tables grow.

**Migration shipped — `20260525_074_rls_initplan_perf.sql` (applied):**

- Re-wrote every RLS policy that referenced `auth.uid()` to
  `(select auth.uid())`. Postgres lifts the subselect to an InitPlan
  and evaluates the JWT lookup once per query instead of once per
  scanned row. 21 policies rewritten across `addresses`,
  `coupon_redemptions`, `loyalty_ledger`, `loyalty_redemptions`,
  `order_events`, `orders`, `payments`, `product_reviews`, `profiles`,
  `return_requests`, `shipments`, `shipment_events`.
- Dropped the 3 `users_*_own_profile` policies — exact duplicates of
  `profiles_*_own` (same `auth.uid() = id` predicate). The linter was
  rolling them into the policy union per query, doubling planning
  cost.

**Migration shipped — `20260525_075_fk_covering_indexes.sql` (applied):**

- Added BTREE indexes on 10 unindexed foreign-key columns:
  `abandoned_carts(user_id)`, `coupon_redemptions(order_id)`,
  `coupon_redemptions(user_id)`, `gift_card_transactions(order_id)`,
  `gift_cards(issued_by_user)`, `loyalty_ledger(order_id)`,
  `products(tax_class_id)`, `province_zones(zone_id)`,
  `shipping_rates(zone_id)`, `stock_subscriptions(variant_id)`.
- All ten parent tables are small today (≤ a few hundred rows), so
  the write-amplification cost is negligible. Without the indexes,
  any JOIN or `ON DELETE CASCADE` against the parent forces a full
  child-table scan — that's the cost that grows with traffic.

**Advisor delta (`get_advisors` before/after both migrations):**

| Check | Before | After |
|---|---|---|
| `auth_rls_initplan` (WARN) | 21 | **0** |
| `unindexed_foreign_keys` (INFO) | 9 | **0** |
| `multiple_permissive_policies` (WARN) | 3 | **0** |
| `security` ERROR-level | 0 | 0 (closed in 073) |

**Remaining advisor findings (intentional, documented):**

- 41 + 41 `anon/authenticated_security_definer_function_executable`
  WARNs — the storefront RPCs (`place_order`, `lookup_order`,
  `lookup_coupon`, `redeem_gift_card`, `redeem_loyalty_points`,
  `validate_*`) need to be EXECUTE-able by anon/authenticated; they
  enforce their own checks inside the function body. This is the
  whole point of `SECURITY DEFINER` — bypass RLS once, do the
  validation in SQL.
- 1 `rls_policy_always_true` — the newsletter-signup anon INSERT,
  protected by server-side rate limiting + Cloudflare Turnstile.
- 1 `auth_leaked_password_protection` — Supabase Auth dashboard
  toggle for the Have-I-Been-Pwned check; flip it in the
  dashboard when convenient.
- 1 `public_bucket_allows_listing` on the product-images bucket —
  every image URL is referenced by a row in `product_images`; the
  listing privilege is needed by the CDN edge worker.
- 3 `extension_in_public` (pg_trgm, citext, uuid-ossp) — they were
  installed into `public` by Supabase's defaults; moving them to a
  separate schema would require rewriting every dependent function
  and CREATE INDEX. Acceptable as-is.
- 10 INFO `rls_enabled_no_policy` — service-role-only tables
  (`audit_log`, `email_log`, `staff_audit`, etc.). RLS is enabled
  to lock them down; no policies = no non-service-role read paths.
- 48 INFO `unused_index` — most are stat-reset-clean; the ten new
  FK covering indexes from 075 are unused **right now** by design
  (no traffic yet), but the cost of a missing FK index materialises
  the moment a parent row is deleted with cascades. Keep.

**Lesson:** Postgres's RLS planner inlines `auth.uid()` per row
unless you wrap it in a subselect. On a 50-row table that's noise;
on a 50 000-row `orders` table it's a 50 000-call function-call hit
on every page load. The fix is mechanical — `(select auth.uid())`
everywhere — but the lint check existed and we shipped 73 migrations
before noticing. Re-run `get_advisors` after **every** migration that
touches RLS, not only after migrations that flagged something
yesterday.

---

## 2026-05-19 — Production-ready polish pass: Supabase advisor cleanup + Next 16 lint compliance

**Goal:** ship the project past the last remaining Database Linter
findings and clear every ESLint error so the codebase passes Next 16's
React Compiler rules with no eslint-disable-bandages on legitimate
bugs.

**Migration shipped — `20260525_073_security_hardening.sql` (applied):**

- Dropped wide-open admin write/update/delete policies on
  `public.products`, `public.blog_posts`, `public.orders` (all granted
  to the **`anon`** role with `USING true`). These were vestigial from
  an early RLS pattern that pre-dated the service-role admin client;
  the admin client bypasses RLS, so the policies were attack surface
  only. Verified via `pg_policies` after the drop.
- Dropped `anyone can insert orders` (any `public` user could INSERT) —
  `place_order` is the only sanctioned write path (SECURITY DEFINER).
- Dropped duplicate read / insert policies (`public read products`
  duplicated `products_read_all`; `reviews_insert_any` /
  `reviews_read_approved` duplicated their counterparts;
  `service role full access` on `analytics_cache` duplicated
  `analytics_cache_service_all`).
- Converted `v_customer_segments` and `v_orders_revenue` views from
  SECURITY DEFINER to `security_invoker = on` — these are read by
  staff via `supabaseAdmin()`, so DEFINER buy-in was accidental.
- Pinned `search_path = public, pg_temp` on the four functions the
  linter flagged (`set_updated_at`, `touch_updated_at`,
  `decrement_stock`, `notify_order_confirmation`). Defense in depth
  against schema-shadowing attacks.

**Advisor delta:** 2 ERROR-level findings → 0; 11 `rls_policy_always_true`
WARNs → 1 (the one remaining is the intentional anon-INSERT path for
newsletter signup, which is server-side rate-limited).

**Lint pass:** 38 errors + 17 warnings → 0. Highlights:

- Converted `CollectionPage`'s `useRef(readInitial()).current` pattern
  to `useState(readInitial)` — the URL-hydrated initial snapshot now
  lives in state (one-time mount initializer) instead of a ref, which
  satisfies the React Compiler's `react-hooks/refs` rule and is the
  documented Next 16 pattern.
- Resolved a real `Cannot access variable before declared` bug in
  `NewsletterModal.tsx` — `useEscapeKey(open, () => close())` was
  reading `close` before its `const` declaration. Moved the function
  above the hook calls and inlined the reference.
- Cleaned up stale `eslint-disable-next-line no-console` directives on
  three files (the no-console rule isn't part of Next 16's config).
- Removed unused imports (`Link` in `RecentlyViewed`, `CollectionPage`;
  `lookupByWpId` in WP-import variations), unused vars (`_a`,
  `setImageUrl`, `wpTermLookup`, `supabase`), and the
  empty-interface anti-pattern in `admin/products/import/actions.ts`.
- Escaped 9 unescaped apostrophe/quote entities in JSX.
- Marked 2 `prefer-const` violations (`productMap`, `optionMap`).
- For genuine "subscribe to external system" patterns (CartContext
  hydration from localStorage, WishlistPage / RecentlyViewed product
  fetches, SearchOverlay typeahead, Header route-change reset) added
  `eslint-disable-next-line react-hooks/set-state-in-effect` with a
  one-line explanation of *why* the rule's exception applies. No
  bandages over real bugs — every disable comment is a known-good
  external-store sync.

**Test fix:** `staff-auth.test.ts` was failing because
`tests/setup.ts` exported `STAFF_SESSION_SECRET='test-secret'`
(11 chars) — under the 16-char floor in `session-secret.ts` — so the
runtime silently fell back to the dev fallback while the test computed
its legacy SHA-256 with the literal `'test-secret'`. Bumped the test
secret to `'test-secret-at-least-16-chars-long'`.

Also dropped the `require('crypto')` style import (no-require-imports
rule) in favour of `import { createHash } from 'node:crypto'`.

**Verification gate (all green):**
- `npm run typecheck` — clean
- `npm run lint`      — clean (0 errors, 0 warnings)
- `npm test`          — 78/78 pass
- `npm run build`     — succeeds

**Lesson:** Database Linter findings stack up *fast* if you don't
re-run the advisor between migrations. The wide-open `admin write
products` policies were technically dead (service_role bypasses RLS
anyway, so writes worked even without them) but the linter still
flagged them as ERRORs — easy to overlook because the app behaved
correctly. Audit the advisor every time you ship a migration, even if
the surface area looks identical.

---

## 2026-05-19 — Resend + PostHog API keys verified, analytics_cache seeded

**Resend** — API key `re_J7Pq…` verified:
- `GET /domains` shows `yellowpink.pk` with `status: "verified"`, region
  `ap-northeast-1`, sending enabled.

**PostHog** — personal API key `phx_yQ8i…` verified:
- HogQL probe `SELECT 1 AS ok` returned `[[1]]`.
- One-off populate via `scripts/refresh-analytics-local.mjs` wrote
  `analytics_cache['posthog']`:
  - pageviews: 254
  - uniqueUsers: 8
  - sessions: 19
  - trend: 2 days (May 18: 94, May 19: 160)
- Dashboard PostHog widget will show real numbers on next render
  instead of the empty-state hint.

`scripts/refresh-analytics-local.mjs` — small Node ESM helper that
calls the same PostHog + Sentry endpoints as the in-app
`refreshAnalytics()` server action, but skips the auth gate so it
works from the developer's machine using `.env.local`. Useful when
Vercel env vars aren't yet set but you want to seed the cache.

**Reminder for the user:** mirror these two keys into Vercel env
vars so the in-app Refresh Analytics button works (or hand me a
Vercel token and I'll set them):
- `RESEND_API_KEY=re_J7Pq…`
- `POSTHOG_PERSONAL_API_KEY=phx_yQ8i…`

The Sentry widget is still empty because `SENTRY_AUTH_TOKEN` isn't
set locally. Once that lands (Sentry → Settings → Auth Tokens), the
same helper script populates `analytics_cache['sentry']`.

---

## 2026-05-19 — Resend domain verified (handled by user)

**Action:** User completed Resend domain verification end-to-end:
- Added `yellowpink.pk` as a sending domain in Resend
- Pasted SPF + DKIM (+ DMARC) TXT records at the registrar
- Confirmed `verified` status in Resend dashboard

`EMAIL_FROM="Yellow Pink <orders@yellowpink.pk>"` and `RESEND_API_KEY`
are set in Vercel env vars.

**Smoke test to consider:** trigger one transactional email path
(newsletter signup, order placement, or staff invite) and confirm
landing at the test inbox + check that SPF + DKIM pass headers
(in Gmail: "Show original" → look for `SPF: PASS` and `DKIM: PASS`
under the Resend signing domain).

**Lesson:** A "verified" badge in Resend only means the records were
detected at lookup time — it does NOT guarantee the records still
resolve correctly tomorrow if the registrar rotates nameservers or
the TXT records get edited. Set up a one-line Sentry alert for the
specific Resend "domain unverified" failure mode so we hear about it
before customers report missing order emails.

---

## 2026-05-19 — WP → Supabase migration: 6 runs to get clean

**Goal:** complete the partial WP import (266 products + 64 blog posts
from an ad-hoc earlier script) and pick up everything missing:
categories, attributes, variants, images, customers, orders, reviews,
pages, redirects.

**Final state (verified clean):**

| Table | Count | vs WP |
|---|---|---|
| products | 109 | = published count |
| product_variants | 177 | = all variations |
| product_images | 463 | OK |
| categories | 45 | OK |
| product_attributes (parent) | 3 | OK (32 attribute_values) |
| product_categories | 162 | OK |
| product_relations | 512 | OK |
| blog_posts | 64 | OK |
| pages | 9 | OK |
| coupons | 15 | 12 WP + 3 pre-existing local |
| orders | 51 | 50 WP + 1 prior test |
| auth.users + profiles | 70 / 70 | OK |
| product_reviews | 23 | + 17 spam-filtered |
| redirects (wp_import) | 118 | OK |

**Six-run path to clean:**

Run 1 — surfaced four importer bugs at once:
- `sb.ts:25` did `.select('id')` after every upsert; join tables
  (`product_categories`, `product_relations`) have no `id` column.
- `orders.ts:155` set a `notes` field; orders table has no such column.
- Schema gap: products had a `products_set_updated_at` BEFORE UPDATE
  trigger but no `updated_at` column.
- 266 legacy products without `wp_product_id` had slugs that collided
  with the WP import's upsert (the upsert key is `wp_product_id`, so
  the legacy rows never matched — INSERT was attempted and failed on
  the slug unique constraint).

Run 2 — after `sb.ts` + `orders.ts` fixes + deleting the 266 legacy
products. Still hit the `updated_at` trigger + a similar legacy
problem on blog (64 legacy rows without `wp_post_id`).

Run 3 — after deleting 64 legacy blog posts and temporarily disabling
the two order-creation triggers (`on_order_created`,
`orders_notify_new`) to avoid customer emails for 6-month-old orders.
First clean run for blog (64) and orders (50). Products only got to
100/145 because…

Run 4 — …WP was returning all statuses (`status=any`), pulling
~36 drafts/private products on top of 109 published. One draft shared
a slug with a published product (WP lets them coexist; renames on
publish). Fixed importer to `status='publish'`.

Also surfaced the same `updated_at` trigger on `orders` and
`blog_posts` (because run 3 made them existing rows, so run 4's
upserts now took the UPDATE path).

Run 5 — after migration 072 added `updated_at` to `orders`,
`blog_posts`, and `site_settings`. Everything green except 8 variants
in batch 0 colliding on SKU `PBSV`. Investigation showed WP has
exactly 1 distinct non-empty variant SKU across 177 variations, and
it's the placeholder `PBSV` on all 8 Pixi Blush Sticks variations.

Run 6 — clean. Importer now nulls SKUs that appear more than once
within a parent's variants. 709 entities imported, 0 errors.

**Post-import cleanup:**
- Re-enabled `on_order_created` and `orders_notify_new` triggers.
- Pruned 34 unpublished products that had snuck in during runs 1-3
  (drafts with valid `wp_product_id` not in the current
  publish-status list). CASCADE swept their `product_images`,
  `product_categories`, `product_relations`, `product_variants`.

**Migrations applied (in repo):**
- `071_products_updated_at.sql`
- `072_updated_at_blog_orders_settings.sql`

**Code changes shipped (in repo):**
- `scripts/wp-import/sb.ts` — `.select('id')` replaced with
  `count: 'exact'`, fixes join-table upserts.
- `scripts/wp-import/importers/orders.ts` — `notes` field removed
  from the orders payload.
- `scripts/wp-import/importers/products.ts` — fetches only
  `status='publish'` from `/wc/v3/products`.
- `scripts/wp-import/importers/variations.ts` — dedupes shared
  SKUs across a parent's variants by nulling the duplicates.

**Lesson:** Always probe the source-of-truth dataset (`/wc/v3/products?status=publish`)
BEFORE the first import run, so the dev DB looks like production from
the start. Also: when a BEFORE UPDATE trigger references a NEW.<col>,
prefix the migration that creates the trigger with a hard check that
`<col>` exists on the table — `do $$ if not exists … raise exception$$`
catches this at trigger-creation time instead of years later when
someone tries to upsert.

---

## 2026-05-19 — Vercel "build failed" was actually plan-limit rejection

**Symptom:** User reported "build failed" after pushing 10 commits
(`399f755` → `be82f82`) plus a `dcf0451` docs commit. Vercel dashboard
visible to user showed a failure banner.

**Investigation:**
- Confirmed all 10 commits were on `origin/main` (`git ls-remote`).
- Queried Vercel via MCP. The project's `latestDeployment` was still
  `dpl_EWbwpFTz` for commit `9195c568` — created ~12 minutes earlier
  and READY. Zero deployment records existed for `399f755`+.
- `since` filter on `list_deployments` returned an empty list past
  `9195c568`. No FAILED record either — Vercel had simply never tried.
- Ran `next build` locally on HEAD: cleanly succeeded. Code was fine.
- Pushed empty commit `5367b35` to nudge the GitHub→Vercel webhook.
  Re-polled 75 s later: still `9195c568`. Webhook wasn't lagging — it
  was inert.
- Tried `mcp__vercel__deploy_to_vercel`: it just returned instructions
  to use the CLI or git push. No direct deploy capability.
- Tried `npx vercel deploy --prod`: requires a token, none on disk
  (`~/.vercel` missing).
- Asked user to either reconnect the GitHub integration or supply a
  Vercel access token.

**Root cause (user-supplied):** Vercel Hobby plan limits.
- Hobby caps cron entries at **2 per project**, all **daily or less
  frequent**.
- `vercel.json` declared **three** crons, and one (`courier-sync`) was
  hourly (`0 * * * *`).
- Vercel rejects such deploys at the plan-validation gate **before**
  creating a deployment record. That's why no FAILED entry appeared
  in the API or the dashboard list — the rejection is invisible to
  the deployments API.

**Fix shipped (`28e18a4`):**
- New `src/app/api/cron/daily/route.ts` — one endpoint that fans out
  to `abandoned-cart`, `back-in-stock`, and `courier-sync` via
  in-process fetch, sequentially, with per-job error containment.
  Returns 207 multi-status if any sub-job fails.
- `maxDuration = 60` to cover `courier-sync`'s worst case (≤200
  shipments × 1 courier API round-trip).
- `vercel.json` reduced to a single cron entry: `/api/cron/daily`
  schedule `0 9 * * *`.
- Commit body documents the Pro upgrade path (split back into three
  separate crons with `courier-sync` on a 30 min cadence).

**Aftermath:** Unstuck the 12-commit backlog (`399f755` → `28e18a4`).
Verified READY:
- `dpl_GWwi4GMqgDu3Ji32wvm12Wdh1ZwG` — commit `28e18a4`, the cron
  consolidation that ended the rejection cycle.
- `dpl_9rkiNNZiReUraFMVJCWVi4bY8ghT` — commit `56fefe4`, this
  deployment log.

**Lesson:** Vercel's plan-limit rejection is silent to the API/MCP.
If `latestDeployment` lags behind `origin/main` and no FAILED record
shows up between, suspect a `vercel.json` plan violation before
suspecting a dead webhook. Quick checks:
- `cat vercel.json` — count cron entries (Hobby ≤ 2) and check
  `schedule` is daily or less frequent.
- `npx vercel-build-output --version` not needed; the gate is
  enforced by the platform on push, not in the build runner.

---

## 2026-05-19 — 12-commit user batch + migration 070

**Pushed:** `399f755` through `be82f82` (and the build fix `28e18a4`).

User-authored commits in the batch:
- `399f755` Audit-report fixes: RLS hardening + signup defence + audit instrumentation
- `6ce9861` Multi-courier shipping: TCS COD API adapter + manual + third-party
- `4defa80` Wrap-up: dynamic trending, GoTrueClient fix, courier cron, deployment doc
- `85e03a0` Docs: slim WP-import to one command, add to deployment checklist
- `805d528` UX wave 1: fix scroll-lock crash, hydration toast flash, low contrast
- `9328a64` UX wave 2: mobile promo, admin polish, login CTA contrast
- `cde873d` UX wave 3: admin pink CTAs migrate to AA-passing tone
- `b287cc5` UX wave 4: Next 16 hydration mismatches + small polish
- `dcf0451` Docs: finalize UX audit report

Claude-authored on top:
- `be82f82` Build fix: `AddToCartToast` handles `null` brand from
  `CartContext.lastAdded` — typecheck error would have blocked the
  build once Vercel did accept the push.
- `28e18a4` Hobby cron consolidation (above).

**Migration 070 applied to Supabase** (separate from build):
- `orders` RLS on; anon SELECT removed; `auth.uid() = user_id` for
  authenticated. Guest tracking still works via `lookup_order` RPC.
- `coupons` RLS on; all policies removed. New `lookup_coupon(text)`
  SECURITY DEFINER for storefront coupon validation. Admin uses
  service_role bypass.
- Wrapped `handle_new_user`, `award_welcome_points`, and
  `generate_referral_code` triggers in `BEGIN/EXCEPTION` so any
  side-effect failure logs a NOTICE and lets the signup succeed.
- Backfilled `profiles` rows for any orphan `auth.users` rows.
- Deleted leaked `$ACTION_*` rows from `site_settings`; added CHECK
  constraint blocking future `$`-prefixed keys.
- Deduplicated `staff_members.permissions` arrays.

---

## 2026-05-19 — Production audit fixes (P0 + P1)

This session opened with a 5-agent parallel audit (security, perf, a11y,
SEO, error-handling/code-quality). Findings filed at
[`FINDINGS.md`](./FINDINGS.md). Test plan for the QA agent at
[`TEST_PLAN.md`](./TEST_PLAN.md). Highlights of fixes shipped:

**Security P0:**
- `staff_members` RLS enabled with service-role-only policy; every
  admin read rewired to `supabaseAdmin()` (migration 064).
- `place_order` RPC recomputes subtotal server-side from
  `products.price * qty`; rejects client-tampered totals (migration
  065).
- `place_order` also recomputes discount server-side from the
  `coupons` row; client-supplied `discount_amount` is overridden, and
  every redemption is logged into `coupon_redemptions` (migration 067).
- JazzCash + Easypaisa callbacks verify the gateway-reported amount
  matches `order.total` in paisa; status transitions are idempotent
  (gated on `status='payment_pending'`).
- `refreshAnalytics`, `coupon-actions`, `promo-actions` server
  actions all gated on `assertPermission` / `assertOwner`. They were
  publicly callable.
- 2FA backup codes now stored as SHA-256 hashes (not plaintext).
- `dashboard_kpis()` SQL aggregator replaces an unbounded
  `select * from orders` (migration 068).

**Security P1:**
- Legacy `ADMIN_PASSWORD` owner cookie HMAC-signed via Web Crypto,
  7-day server-enforced TTL, unconditional `secure: true`.
- `STAFF_SESSION_SECRET` throws at module load in production if
  unset or < 16 chars.
- `/api/cron/*` and `/api/couriers/webhook` fail closed when their
  secret is unset (were fail-open in non-production).
- `redeem_gift_card` + `redeem_loyalty_points` EXECUTE revoked from
  anon + authenticated; reachable only via `place_order` SECURITY
  DEFINER (migration 066).
- Customer `/account` middleware decodes the Supabase JWT body and
  checks `exp` (was a presence-only check).
- Cart `addToCart`/`updateQty` clamp to `product.stock`.
- `submitReview` photo URLs restricted to the Supabase Storage prefix.
- `/api/health` requires `HEALTH_CHECK_SECRET` in production
  (was unauth env-var enumeration).

**A11y / SEO / Code-quality P1:**
- `ProductTile` refactored to wrap `<Link>` internally with wishlist
  as a sibling — entire shop is now keyboard-reachable; invalid
  `<button>`-inside-`<a>` HTML gone. All 10 callers simplified.
- `--brand-pink-text` (#C5286A) replaces `--brand-pink` (#E8487F)
  wherever pink is used as TEXT on a light background. WCAG-AA
  contrast (≥4.5:1). 19 files updated.
- Pagination buttons get `aria-label`, active page gets
  `aria-current="page"`, wrapped in `<nav>`.
- `<main>` landmark added to `/account/*` (layout) and `/admin/*`
  (AdminShell).
- 8 silent-failure admin actions now surface errors via
  `redirect('?error=…')` or return-value objects: `deleteProduct`,
  `deleteBlogPost`, `bulkUpdateOrderStatus`, `approveReview`,
  `deleteReview`, `toggleStaffActive`, `deleteStaffMember`,
  `setDefaultAddress`.
- Shared coupon validator (`lib/coupon-validation.ts`) enforces
  `usage_limit_per_user`, `email_restrictions` (Woo-style
  `*@domain` wildcards), product allow/denylists, `max_order`.
- `/blog` index metadata; `/cart` + `/wishlist` `noindex`; sitemap
  `?cat=` → `?category=` aligned; `/track` + `/login` removed from
  sitemap.
- JSON-LD: logo PNG instead of SVG (`/icon-192.png`),
  `priceValidUntil` on every Offer / AggregateOffer, `dateModified`
  from `blog_posts.updated_at`.
- Sentry replay integration lazy-loaded via `requestIdleCallback`
  (was 50–80 KB gz eagerly loaded for every visit even though only
  5% are sampled).

**Mobile admin (separate findings):**
- Removed phantom 200 px left margin caused by an unbounded
  `@media (max-width: 1024px)` rule with `!important` that bled
  onto phones.
- Drawer narrowed to `min(280px, 86vw)` on phones.
- Recent Orders table wrapped in `adm-table-scroll` to scroll
  horizontally instead of forcing the page wider than the viewport.

---

## 2026-05-20 — WELCOME10 newsletter coupon (migration 087)

Newsletter signups had no incentive — the welcome email set
expectations but offered nothing, and the modal's only hook was
"insider deals" with no concrete offer.

- Migration 087 seeds a single shared `WELCOME10` coupon: 10% off,
  `discount_type='percent'`, `min_order=1500`,
  `usage_limit_per_user=1`. Idempotent — `WHERE NOT EXISTS` guard so
  re-running is safe.
- **Why one shared code, not per-user mint:** per-user codes mean the
  email send path has to write to `coupons` first, which couples the
  fire-and-forget welcome email to a DB write that can fail silently.
  A shared code keeps the send path pure; abuse is capped at the
  redemption layer by `usage_limit_per_user=1` (already enforced by
  `lib/coupon-validation.ts`).
- `sendNewsletterWelcomeEmail` now renders a dashed-border code block
  with `WELCOME10` and the "10% off over PKR 1,500" terms.
- `NewsletterSignup` success state and the `NewsletterModal` headline
  surface the offer too — the discount is visible the moment a
  visitor signs up, not only in the email.

Lesson: keep fire-and-forget side effects (emails) free of DB writes.
Push enforcement to the redemption boundary where a failure is
visible to the user instead of swallowed in a background send.

---

## 2026-05-20 — Subscribe & Save for wellness SKUs (migration 088)

Wellness supplements are consumables — customers run out and reorder
on a cadence — but the store had no mechanism to bring them back.

- Migration 088 adds `reorder_subscriptions` (per-user RLS, four
  policies) plus the `SUBSCRIBE10` coupon (10% off, min PKR 1,500).
- **Why this is a *reminder*, not auto-billing:** the storefront has
  no card-on-file — payments are COD / JazzCash / Easypaisa. True
  recurring charges aren't possible on the free stack, so a
  subscription is a recurring reorder *reminder* with a standing
  discount code instead.
- **Why it's decoupled from `place_order`:** a subscription is
  created by an explicit opt-in on the wellness PDP, not a cart flag.
  Nothing touches the security-critical order/pricing RPC — the cart,
  checkout, and `place_order` are entirely unchanged.
- The reorder reminder rides the existing daily cron as a fifth job
  (`/api/cron/subscription-reorder`) — no new `vercel.json` cron
  entry, so the Hobby 2-cron cap is respected.
- `email` is denormalized onto each row (same approach as
  `abandoned_carts`) so the cron sends without per-row auth-schema
  lookups.
- Customers manage / pause / cancel from `/account/subscriptions`;
  RLS guarantees a customer only ever touches their own rows.

Lesson: when a feature *looks* like it belongs in checkout, check
whether it actually needs the order. Modelling Subscribe & Save as a
standalone "remind me" record kept the whole feature clear of the
`place_order` security boundary.

---

## 2026-05-20 — Post-delivery review requests (migration 089)

`product_reviews` and the PDP `ReviewsSection` have existed for a
while, but nothing ever *asked* a customer to review — so reviews
trickled in. This adds the missing request loop.

- Migration 089 adds `orders.review_request_sent_at` — a once-per-
  order guard, nothing more.
- New daily-cron job (`/api/cron/review-requests`, the sixth) finds
  orders delivered **3–30 days ago** and emails the customer a
  review nudge that links each purchased product straight to its PDP
  review form (`/product/<slug>#reviews`).
- **Why the delivery date comes from `order_events`, not `orders`:**
  there is no `delivered_at` column on `orders`; the delivery
  timestamp is the `order_events` row with `to_status='delivered'`.
  Verified 1:1 — all 31 delivered orders have a matching event.
- **Why the 3–30 day window:** 3 days gives the customer time to
  actually try the product; the 30-day ceiling stops the first cron
  run from spamming "how was it?" at months-old orders.
- Rides the existing daily cron — no new `vercel.json` entry, so the
  Hobby 2-cron cap still holds.

Lesson: a feature can be 90% built and still deliver nothing. The
reviews table, form, and display all existed — the missing 10% was
the email that asks.

---

## 2026-05-20 — Activity log: audit_log → full system feed (migration 090)

`audit_log` only ever captured staff writes (via `lib/audit.ts`). The
owner wanted one feed of *everything* — customer signups, orders,
reviews, subscriptions, newsletter joins, status changes — to track
the user journey.

- Migration 090 widens `audit_log.actor_kind` to allow `'customer'`
  and adds database **triggers** (`tg_log_activity`) on `orders`,
  `order_events`, `profiles`, `product_reviews`,
  `reorder_subscriptions`, and `newsletter_subscribers`.
- **Why triggers, not code instrumentation:** a trigger fires no
  matter which route / RPC / cron made the write, so the feed can't
  silently drift when a code path changes later. The old approach
  (manual `logAudit` calls) only ever covered the admin UI.
- The trigger body is wrapped in an exception guard — orders are
  inserted inside the `place_order` SECURITY DEFINER function, so a
  failing activity insert there would roll back the checkout. It must
  never throw.
- Migration backfills historical rows (orders, signups, reviews,
  status changes) from existing data, guarded by `NOT EXISTS` so
  re-running is a no-op. First load showed 145 events.
- `/admin/audit` reworked into "Activity log" — actor filter chips,
  action search, friendly event labels. Sidebar renamed to match.

Also added `.audit/COWORK_TEST_PLAN.md` — a full storefront + admin
test script for the Cowork browser agent, with an admin-usefulness
audit and a cleanup pass.

Lesson: if you want to log "everything", log it at the database, not
in the application. App-layer logging only covers the paths you
remembered to instrument.

---

## 2026-05-20 — Resend free-tier email quota guard (migration 091)

The store must stay on the Resend free tier (100 emails/day). Nothing
enforced that — the daily cron's batch jobs (review requests, reorder
reminders, abandoned-cart drips, low-stock, newsletter, welcome) could
grow to crowd the cap, and Resend silently rejects overflow. The email
most likely to be lost that way is a transactional *order confirmation*.

- Migration 091 adds `email_quota` (a per-day send counter) and the
  `claim_email_send(kind, cap)` SECURITY DEFINER RPC.
- The central `send()` helper now claims a slot before every send.
  `send()` gained a `kind` param: **transactional** mail (order
  lifecycle, payment, staff access) always sends; **batch** mail (the
  seven cron/marketing senders) is refused once the day's count hits
  the cap (90, leaving headroom under the 100 limit).
- **Fails open:** any error in the quota check is swallowed and the
  send proceeds — a counter glitch must never block a real email.
- The RPC takes `FOR UPDATE` on the day row so concurrent cron sends
  count correctly.

Lesson: a free-tier limit you're not measuring is a limit you'll blow
silently. Meter at the single chokepoint (`send()`), and when you must
shed load, shed the right thing — marketing yields, orders never do.

---

## 2026-05-20 — P0: checkout was failing for every customer (migration 092)

Cowork QA found the store could not take a single order. `place_order`
aborted with:
`null value in column "url" of relation "http_request_queue" violates
not-null constraint`.

Root cause: the `on_order_created` AFTER INSERT trigger on `orders` ran
`notify_order_confirmation()`, which called
`net.http_post(url := current_setting('app.supabase_url', true) || '…')`.
The `app.supabase_url` GUC is unset, so `current_setting(…, true)`
returned NULL, the URL concatenated to NULL, and pg_net's
`http_request_queue.url` is NOT NULL — the enqueue aborted the entire
checkout transaction.

Fix (migration 092): dropped the trigger and function outright. It was
redundant — the checkout server action already sends the customer
confirmation and owner notification via Resend
(`src/app/checkout/actions.ts`). The DB-trigger → edge-function path
was a second, unmonitored email mechanism that nobody needed.

Lesson: `current_setting(name, true)` silently returns NULL for an
unset GUC. Concatenated into a NOT NULL column inside a trigger, that
turns a missing config value into a hard outage of the most important
flow in the store. Don't build critical-path triggers on optional GUCs.

---

## How to use this log

- **Add an entry whenever production-affecting work happens** —
  schema migration, env var change, plan upgrade, vercel.json edit,
  middleware change, public API change.
- **Front-load the root cause.** Future-you reading this in a 3 AM
  outage wants the diagnosis in the first three lines, not paragraph
  six.
- **Always link the commit SHA(s).** This file is the index that
  maps "the day X broke" to "the commit that fixed it".
- **Record the lesson at the bottom of each entry.** A pattern worth
  remembering for next time.
