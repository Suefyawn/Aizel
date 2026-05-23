# Cowork Handoff — Yellow Pink — Pre-Launch QA

**Goal:** the final full-site QA before going live. Verify everything works end
to end, catch regressions, and confirm the recent round of fixes holds up.

- **Storefront:** https://yellow-pink.vercel.app/  ·  **Admin:** `/admin`
- Ask the owner for the **owner login**. Create a **test customer** via signup.
- **Test on desktop _and_ mobile (~390–430px).** A large share of recent work
  was mobile-specific — give mobile a real pass, storefront and admin.
- It's a **live site**: test orders use **Cash on Delivery** or **Bank
  Transfer** only (no real money moves). Prefix test data with `TEST —`. Never
  delete real products / customers / orders. Cancel test orders when done.
- Watch the browser **console** and **network tab** throughout.

---

## How to report

One report. For every issue:

```
[SEVERITY] Area — short title
  Where:    URL / page / element
  Steps:    what you did
  Expected: what should happen
  Actual:   what happened (screenshot)
  Fix:      a concrete suggestion
```

Severity: **P0** blocker (checkout broken, crash, data loss, security) ·
**P1** major (a core flow or key page broken) · **P2** minor (awkward UX,
inconsistency, visual glitch) · **P3** polish · **CLEANUP** remove-this.
Group by area, sort by severity. **Flag anything that should block go-live as
P0/P1.**

---

## Known — do NOT report these

Owner-side configuration, already tracked in `.audit/OWNER_SETUP_CHECKLIST.md`:

- **Supabase Auth Site URL** is still `localhost` → customer **login / signup
  may fail**; guest-order linking can't be verified until it's fixed.
- **Resend sending domain / `NEXT_PUBLIC_SITE_URL`** not yet verified → emails
  may not actually send; an Email-log row showing `0 sent` is expected for now.
- **Resend webhook** not connected → the Email log won't show delivered/opened.
- **No bank accounts** entered → Bank Transfer won't appear at checkout.
- **Products not linked to vendors** → vendor cost/payout columns read blank.

---

## Part A — Storefront

### A1. Purchase journey (do this end to end, desktop + mobile)
Browse → open a PDP → add to cart → cart → checkout → place a **COD** order →
thank-you page. Confirm: totals add up, the order appears in `/admin/orders`,
the order number matches. Then place a second order using a **shade** product
(below) and a **coupon** (below).

### A2. Recently changed — verify specifically
- **Star ratings:** product cards (shop, homepage rails) and the PDP show a
  star rating + review count *for products that have approved reviews*;
  unreviewed products show nothing (not empty stars).
- **Shade pickers:** open NARS Light Reflecting Foundation, Rhode Peptide Lip
  Tints, SHEGLAM Liquid Blush. A **Shade** picker shows; picking a shade swaps
  price + image; the chosen shade name appears on the **cart line**, the
  **checkout summary**, and the placed **order**.
- **Coupon carry-over:** apply a coupon on `/cart` → "Proceed to checkout" →
  the discount is still applied. Refresh `/checkout` → still applied.
- **Blog:** article pages show a sticky **"On this page"** table-of-contents in
  the left margin on desktop; it scroll-spies and the anchors jump correctly.
- **Images:** shop / PDP / cart / search images load promptly from
  `*.supabase.co`; no lingering grey placeholders; none broken.
- **Search overlay:** type a query — every result thumbnail renders (no blank
  boxes).
- **Console:** with items in the cart, load homepage → a PDP → a blog post.
  **No `React error #418` / hydration errors** in the console.

### A3. Mobile storefront (~430px)
- Header **logo on one line**, not cramped; account + wishlist live in the
  hamburger menu.
- PDP **main image is square**, not zoomed/cropped; the product fills it
  naturally.
- Tapping a product from a scrolled shop/collection page opens the PDP **at the
  top**.
- No horizontal scroll on home / shop / PDP / cart / checkout.

---

## Part B — Admin

### B1. Full pass
Walk Dashboard, Orders, Products, Inventory, Returns, Customers, Coupons,
Promos, Blog, Reviews, Newsletter, Email log, Settings. Every page loads, no
console errors, actions work.

### B2. Recently changed — verify specifically
- **Dashboard "Orders by Status"** uses the same labels as the Orders list and
  Analytics ("Order received", "Preparing", …) — one consistent set.
- **Soft-delete (owner, ~30s):** delete a product that has order history → it
  becomes **Archived** (stays in the list with an "Archived" badge, leaves the
  storefront), it does **not** vanish. A product with no orders deletes
  normally. Analytics → Top Products shows real names, never "Unknown product
  (deleted)".
- **Newsletter** (`/admin/newsletter`): the subscriber count shows; compose a
  `TEST —` subject + body and send; confirm the sent row logs with a count.
  *(If `0 sent`, that's the Resend domain config — not a bug.)*
- **Email log** (`/admin/emails`): sent/failed emails are listed; the
  All/Sent/Failed/Skipped filter works; failed rows show a reason.
- **Reviews moderation, returns, coupons, promos** — spot-check each still
  works.

### B3. Mobile admin (test at ~430px)
- **Bottom nav bar** — Home / Orders / Products / Stock / More; "More" opens
  the full drawer; the Orders badge shows the pending count.
- **Filter pills** on Orders/Products are a single horizontally-scrolling row
  (not 2–3 wrapped rows).
- **FAB** — a floating "+" on the Products and Blog list pages opens the create
  form.
- **Skeleton loaders** — navigating between admin pages shows a skeleton, not a
  blank flash.
- **Cards** lead with a headline (order number / product name); Edit / Delete
  buttons are comfortably tappable.
- **Swipe** — on the Orders list, swipe a card left → a Processing / Shipped /
  Delivered panel appears; tapping one updates the order's status.

---

## Part C — Cross-cutting
- Console clean (no errors / uncaught exceptions) across the journeys above.
- No layout breakage at 320 / 375 / 430 px or on desktop.
- Network tab: no failed (4xx/5xx) requests during the purchase journey.

---

## Deliverable

One punch list, grouped by area, sorted by severity, led by the go-live
recommendation: **ready to launch — yes / no**, and if no, the exact P0/P1
items that must be fixed first.
