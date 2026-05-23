# Cowork Test Plan — Yellow Pink (Round 2)

You are testing **Yellow Pink**, a custom-built Pakistani beauty + wellness
e-commerce site (Next.js 16 + Supabase + Vercel). This is the **second** QA
round. Round 1 produced a report; every confirmed issue from it has since been
fixed and merged. Your job now is twofold:

1. **Regression check** — re-test the round-1 fixes and confirm they actually
   hold in production.
2. **Fresh pass** — test the new features shipped since round 1, and keep
   hunting for anything still broken, half-built, confusing, or useless.

You can use a browser and have access to everything except GitHub. Use it.

---

## 1. Mission

Same three goals as round 1, in priority order:

1. **Find what is broken or unfinished.** Crashes, errors, dead buttons, empty
   pages, forms that don't submit, wrong data, broken layouts.
2. **Judge whether each page is genuinely useful** — especially the admin.
   Ask of every admin screen: *"If I ran this business, would this screen
   help me make a decision?"*
3. **Flag clutter** — anything redundant, confusing, or pointless that should
   be removed.

## 2. Environment & access

- **Production storefront:** https://yellow-pink.vercel.app/
- **Admin:** https://yellow-pink.vercel.app/admin
- **Admin login:** ask the user for the owner credentials — do not guess.
- **Test customer account:** create your own via storefront signup, or ask the
  user. Use a real inbox you control so you can verify emails.
- You may inspect the Supabase database and Vercel logs directly to confirm a
  bug (e.g. "did the order row actually get written?").

**Safety:** this is a live site. You may create test orders (Cash on Delivery),
test accounts, and test reviews. Do **not** delete real products, customers, or
orders. Prefix all test data so it's obvious ("TEST —…").

## 3. How to report findings

One structured report. For every issue use this format:

```
[SEVERITY] Area — short title
  Where:     URL / page / element
  Steps:     what you did
  Expected:  what should happen
  Actual:    what happened (attach a screenshot)
  Notes:     console errors, network failures, anything relevant
```

Severity: **P0** blocker · **P1** major · **P2** minor · **P3** polish ·
**CLEANUP** remove-this. Group the report Storefront / Admin, sorted by
severity. For each round-1 regression item below, explicitly mark it
**PASS** (fix holds) or **FAIL** (regressed — file it as a fresh issue).

---

## Part A — Regression: confirm round-1 fixes hold

Walk each item and mark PASS / FAIL.

### A1. Checkout & orders
- Complete a full **Cash on Delivery** checkout → reach `/thank-you`. Order
  must be created and the confirmation email must arrive.
- Apply `WELCOME10` and `SUBSCRIBE10`; try an invalid code and a code below
  its minimum order — messages must be correct, discount must be right.
- In admin, open the new order. Change its status; confirm the change shows
  in the **Activity log** and the customer gets the status email.

### A2. Storefront fixes
- **Search:** search a product name, a brand, a category word (e.g. "serum",
  "immunity", "lip"), and gibberish. Results must be relevant; the empty
  state must look intentional.
- **Mini-cart:** add items, open the drawer — clicking a product's thumbnail
  or name must open its product page and close the drawer.
- **Shop pagination:** on `/shop`, scroll down, click page 2 — the view must
  jump back to the top of the grid.
- **PDP breadcrumb:** open several products, including any with no brand —
  the breadcrumb must never show an empty `Home / / Name` segment.
- **Reviews:** submit a product review; confirm it enters moderation and is
  not publicly visible until approved.
- **Wishlist:** add/remove items; the heart state must be correct on reload
  (no flicker / wrong state).
- **Blog:** open `/blog` and a post — titles/excerpts must render clean text
  (no `&amp;` / `&#8217;` entities).

### A3. Admin fixes
- **Reviews:** the Delete button must ask for confirmation before deleting.
- **Analytics:** the page must not print any internal file paths or developer
  notes in its footer.
- **Top products / Segments:** the Analytics top-products table shows product
  names (not raw IDs); customer Segments shows real data, not empty.
- **Dashboard revenue chart:** on a wide desktop screen the chart labels must
  be readable — no overlapping/jumbled text.

---

## Part B — New features to test

### B1. Category navigation (storefront)
- Open the header **mega-menu**. It should show 4 sections — Makeup,
  Skincare, Wellness, Bundles — each with its sub-categories. Every link must
  resolve to a `/shop` view with products.
- On `/shop`, click each **top tab** (All / Makeup / Skincare / Wellness /
  Bundles). The **sub-category chip row** must show only categories that have
  products — **no empty chips**. Click each chip; results must be non-empty
  and correct.
- The homepage category tiles must all link somewhere real.

### B2. Coupons (admin)
- `/admin/coupons` — create a coupon, then **Edit** it (new): change the
  discount, min order, usage cap, expiry. Save and confirm the row updates.
- Try an invalid edit (e.g. a percentage over 100%) — it must be rejected
  with a clear message.
- Confirm `WELCOME10` and `SUBSCRIBE10` exist and look right.

### B3. Inventory (admin)
- `/admin/inventory` — "Needs attention" vs "All products" views; lowest
  stock first.
- Log a stock change: a **Restock** with a negative number must be rejected;
  **Damage** with a positive number must be rejected; **Adjustment** allows
  either. Confirm each accepted change lands in the movement history.

### B4. Orders — shipping (admin)
- Open an order. Tracking is managed **only** in the Shipment section — the
  status form must not have its own tracking field. Book/enter a shipment,
  then change the order status — the tracking must survive (not be wiped).

### B5. Blog taxonomy
- `/blog` filter chips must show only the 6 clean categories (Wellness,
  Women's Health, Men's Health, Fertility, Bone & Joint, Beauty & Skincare).
  There must be **no "Uncategorized"**.
- In admin, create/edit a post — Category is now a fixed dropdown.

### B6. Subscribe & Save / reorder reminders
- On a Wellness product, opt into Subscribe & Save. Confirm a subscription
  appears under `/account/subscriptions` and can be paused / resumed /
  cancelled / have its cadence changed.

### B7. Activity log (admin)
- `/admin/activity` (or the Activity sidebar item) — confirm it logs orders,
  signups, reviews, subscriptions, and staff actions. Test the filter chips
  and search box.

### B8. WhatsApp
- The storefront WhatsApp buttons (header, PDP, cart, contact) must open a
  chat to the real business number **+92 300 4374577**.

---

## Part C — Admin usefulness audit (judge, don't just load)

For **Dashboard, Analytics, Inventory, Products**, answer in the report:
1. What decision is this screen meant to support?
2. Does the data on it actually help make that decision — right data, fresh,
   correct?
3. Is it sorted/ordered sensibly by default?
4. What is missing that a real store owner would expect?
5. What is noise that should be removed?

The owner has specifically asked for **better UX across the dashboard and
analytics pages** — be opinionated here. Call out anything cramped, confusing,
poorly labelled, badly sorted, or hard to scan.

## Part D — Cleanup candidates

Keep a running **CLEANUP** list: empty/broken/duplicate pages or sidebar
items, dead buttons/links/filters, placeholder or demo content visible to
customers, anything that makes the site feel unfinished and should be cut
rather than fixed.

## Part E — Whole-system checks

- **Console & network:** report every JS error and failed request, with the
  page it happened on.
- **Mobile:** repeat the core purchase journey at phone width — sticky
  add-to-cart bar, mobile nav, mega-menu.
- **Performance:** flag any page that feels slow.
- **Consistency:** mismatched styles, fonts, spacing, button shapes, tone.
- **Empty states:** every list should look intentional when empty.
- **SEO/meta:** flag pages with a missing/wrong title or broken share preview.

---

## Deliverable

One report, grouped Storefront / Admin, sorted by severity, every issue in the
section-3 format with screenshots. Include:
- The **Part A** PASS/FAIL checklist.
- The **CLEANUP** list.
- A short **verdict**: is the site ready to take real customers? What are the
  top 3 things still standing in the way?
