# Cowork Full Test — Yellow Pink (start to end)

The complete end-to-end QA + UX audit of Yellow Pink. Walk the **entire
site** — storefront and admin — as a real user and as a UX professional,
and produce one punch list the dev team works straight from.

This is the current, comprehensive plan. It folds in the storefront
journey, the admin functional + UX audit, regression of every fix shipped
to date, the new features, and cross-cutting checks.

- **Storefront:** https://yellow-pink.vercel.app/  · **Admin:** /admin
- Ask the user for the **owner login**. Create a **test customer** via
  signup with a real inbox you control (to verify emails).
- Test on **desktop** and **mobile (≈390px)**; spot-check **tablet**.
- It's a live site: test orders use **Cash on Delivery** or **Bank
  Transfer** (no real money moves); prefix test data ("TEST —…"); never
  delete real products / customers / orders.

---

## How to report

One report. For every issue:

```
[SEVERITY] Area — short title
  Where:    URL / page / element
  Steps:    what you did
  Expected: what should happen
  Actual:   what happened (screenshot)
  Fix:      a concrete suggestion (for UX items)
```

Severity: **P0** blocker (checkout broken, crash, data loss, security) ·
**P1** major (a core flow or key page broken/unusable) · **P2** minor
(awkward UX, inconsistency, visual glitch) · **P3** polish · **CLEANUP**
remove-this. Group by area, sort by severity. End with the deliverable
in the last section.

---

## Part A — Storefront (the customer journey)

Walk the whole purchase journey end to end. Watch the browser console for
errors and the network tab for failed requests throughout.

### A1. Home & navigation
- Homepage: every section renders with real products, no placeholders.
- The **trust bar** under the hero — four distinct relevant icons.
- Header **mega-menu**: hover each taxon (Makeup / Skincare / Wellness /
  Bundles) — the dropdown opens and you can move down into it and click an
  item without it closing. All nav links sit on one baseline.
- The header **wishlist heart** opens `/wishlist`.
- On scroll: the announcement bar scrolls away, the header stays pinned.
- **"From the Journal"** section — three recent blog posts, each links to
  its post; "Read the Journal" opens `/blog`.
- Click every header + footer link — all resolve. Footer says delivery is
  nationwide.

### A2. Shop & discovery
- `/shop`: each top tab (All / Makeup / Skincare / Wellness / Bundles); the
  sub-category chip row shows only non-empty categories — click each, all
  return products.
- Sort options; pagination — page 2 jumps the viewport to the top.
- **Search** (overlay): a product name, a brand, a category word, gibberish
  — results relevant, empty state intentional.
- Product tiles: hover, quick-add, wishlist heart.
- The **"In stock"** filter and **"On sale"** filter (`/shop?sale=1`) both
  work; no out-of-stock product is buyable unless it's vendor-managed.

### A3. Product page
- Open several PDPs incl. a no-brand product and one with a long name.
  Gallery image is a sensible size on desktop, no horizontal scroll,
  breadcrumb has no empty segment.
- **PDP opens at the top** — on mobile, scroll the homepage / `/shop`
  well down, tap a product: the PDP must open at the **top**, never on
  its footer.
- Variants, image gallery/zoom, key benefits, FAQ, reviews section, related
  products, Subscribe & Save (wellness PDPs), sticky mobile buy-bar.
- Opening/closing the how-to-use & ingredients accordions must **not**
  resize the gallery image.
- **Wellness product copy** — open a spread of wellness PDPs (a syrup,
  drops, an effervescent, a tablet, a cream): the description reads as
  clean prose (no "Description / Composition / Frequently Asked Questions"
  dump), "How to use" matches the real form (no "swallow a tablet" on a
  syrup or a cream), ingredients are real, four key-benefit chips show
  with icons. No raw `&#…;` HTML entities anywhere.
- **Imported products** — open SimZee Zinc Syrup, Hydrating Face Wash,
  Vitamin C Serum, Rooposh Feminine Wash: each shows its photo (not a
  placeholder) and reads cleanly.

### A4. Cart & checkout
- Mini-cart drawer: free-shipping progress bar; line items link to the PDP.
- `/cart`: change qty, remove an item.
- Coupon: `WELCOME10`, `SUBSCRIBE10`, an invalid code, a below-minimum code
  — messages correct. (Gift-card / referral fields are intentionally gone.)
- **Payment methods** — only the methods enabled in Admin → Settings →
  Payments appear.
- **Bank Transfer** — select it: the list of bank / wallet accounts shows
  inline at checkout. Place a Bank Transfer order → the order-confirmation
  page shows those accounts **with the order number as the payment
  reference**, and the confirmation email shows them too.
- Complete a **COD** checkout → `/thank-you`. Confirm the order
  confirmation email arrives **with the logo showing** (not broken).

### A5. Account & post-purchase
- **Sign up, log out, log in.** Confirm a logged-in customer can reach
  `/account`, `/account/orders`, order detail, `/account/addresses`
  (add/edit/delete/default), `/account/profile`, `/account/rewards`,
  `/account/subscriptions` — **none bounce back to `/login`**.
- `/account/rewards`: points balance, tier, history, referral code.
- Track an order via `/track`. Wishlist add/remove. Submit a review →
  it enters moderation (not visible until approved).

### A6. Content
- `/blog` + a post — filter chips show the clean categories, no
  "Uncategorized"; clean text, no `&amp;`/`&#…` entities.
- Newsletter modal/signup; static `/page/...` pages; WhatsApp buttons open
  a chat to **+92 300 4374577**.

---

## Part B — Admin (every page: does it work, and is it good UX?)

Log into `/admin`. Visit **every** sidebar item. For each: confirm it loads,
shows real data, every button/action works and gives feedback — **and**
judge its UX against this lens:

> Clarity · sensible layout & hierarchy · **consistency** with other admin
> pages (cards, headers, buttons, tables, spacing, empty states) · tables
> have a sensible default sort and real empty states · forms are grouped,
> labelled, with clear save + success/error feedback · destructive actions
> confirm · usable at tablet width · no cramped/misaligned polish issues.

Pages: **Dashboard, Analytics, Products** (list + create/edit + CSV
import), **Inventory, Orders** (list + detail), **Vendors, Returns,
Customers** (list + profile), **Segments, Coupons, Promos, Blog** (list +
editor), **Reviews, Activity log, Team** (list + editing a staff member),
**Settings, Profile**, and the `/admin` login.

Then exercise the feature flows below.

### B1. Vendors, cost & payouts
- Add a vendor with a **commission %** and a **settlement direction**
  (vendor-collects / we-collect). Edit a vendor's terms inline → saves.
- On a product (create or edit), the **"Vendor & sourcing"** section: pick
  a vendor → the **margin readout** shows; enter a per-product **vendor
  cost** → margin recalculates from the cost.
- On an order: "Mark customer-confirmed", then dispatch to a vendor. The
  order page shows the **settlement** (vendor cost, our margin, amount
  due). The **Vendors → Payouts** table lists it; "Mark settled" works and
  the per-vendor outstanding total updates.

### B2. Product form
- Sectioned layout; **Key benefits** & **FAQ** are add/remove row editors
  (no JSON) — adding/removing rows saves, an existing product's rows
  pre-load.
- **"Inventory managed externally"** toggle — when on, the Stock field is
  replaced with "Managed externally"; the product still saves and stays
  sellable on the storefront; it's excluded from low-stock alerts and the
  Inventory screen, and the Products table shows a "Managed externally"
  badge.

### B3. Settings
- **Sale card** — toggle the sale on, set a title/subtitle/CTA, save →
  the homepage shows the **Sale Collection** band; toggle off → it's gone.
- **Payments → Bank Transfer** — the multi-account editor: add a bank and
  a wallet (Easypaisa / JazzCash), save → they appear at checkout.
- Section jump-nav pills scroll to their cards; the sticky save bar works.

### B4. Mobile admin (≈390px)
- The data tables — **Orders, Products, Vendors, Customers, Coupons, Blog,
  Team, Segments, Audit** — collapse into one **card per row** (no
  sideways scroll, every field labelled and readable). Row links/buttons
  still work.

For each page, report functional bugs **and** UX punch-list items
separately. Flag any page that's confusing, inconsistent, or unfinished.

---

## Part C — Regression: confirm prior fixes still hold

Mark PASS / FAIL for each:

- Signed-in customers reach `/account` (no `/login` bounce) · order-email
  logo renders · no mobile horizontal scroll · `/shop` pagination
  scroll-to-top · no "Skincare" chip clash · PDP gallery sized right ·
  PDP image steady when accordions toggle · **PDP opens at the top** ·
  product copy form-correct & free of `&#…;` entities · product-edit
  Category pre-fills · order-status dropdown stays in sync · Analytics
  segments match the Segments page · invoice prints **only the invoice
  card** · header mega-menu hover · trust-bar icons · settings jump-nav +
  sticky save · admin tables become cards on mobile · imported products
  show real photos.

(Full fix list with PR references: `.audit/COWORK_HANDOFF.md`.)

## Part D — New features to exercise

- **Vendor cost / margin / payouts** — see B1.
- **Inventory managed externally** — see B2.
- **Centralized sale** — see B3 (Settings → Sale) + A1 (homepage Sale
  Collection) + A2 (`/shop?sale=1`).
- **Bank Transfer accounts** — see B3 (Settings → Payments) + A4
  (checkout, confirmation page, confirmation email).
- **Homepage blog** — see A1 ("From the Journal").
- **Vendor order dispatch over WhatsApp** — Admin → Vendors, then an
  order's "Send on WhatsApp".

## Part E — Cross-cutting

- **Console & network** — report every JS error / failed request, with the
  page.
- **Responsive** — repeat the core journey at phone width; check the admin
  at phone + tablet width; report overflow, breakage, unusable controls.
- **Consistency** — pick card style / page header / primary button / table
  header / empty state and list every page that deviates.
- **Performance** — flag any slow page.
- **SEO/meta** — flag missing/wrong titles or broken share previews.
- **Empty states** — every list should look intentional when empty.

## Part F — Config / data to confirm

- `NEXT_PUBLIC_SITE_URL` set in Vercel? (email/og-image origin)
- Analytics: dashboard "Refresh analytics" returns `{ ok: true }`; the
  Sentry + PostHog widgets populate.
- WhatsApp buttons open +92 300 4374577.
- **Vendors** have commission % / settlement direction set, and wellness
  products are linked to a vendor (so margins/payouts populate).
- **Argivital** and **Energy Boost** have real prices (they had none on
  the source site).
- At least one **bank account** is configured under Settings → Payments.

---

## Deliverable

One report, grouped Storefront / Admin, sorted by severity, every issue in
the format above. End with:
- The **Part C** PASS/FAIL regression checklist.
- A **CLEANUP** list (anything to remove).
- The **worst-first priority list** — the top 5–8 things to fix first.
- A one-line **verdict**: is Yellow Pink ready to take real customers?
