# Cowork Test Plan — Yellow Pink

You are testing **Yellow Pink**, a custom-built Pakistani beauty + wellness
e-commerce site (Next.js 16 + Supabase + Vercel). The owner built it custom to
grow online presence, sales, and performance. It is **not finished** — your job
is to drive every flow like a real user, find what is broken, half-built,
confusing, or useless, and report it precisely so it can be fixed.

You can use a browser and have access to everything except GitHub. Use it.

---

## 1. Mission

Three goals, in priority order:

1. **Find what is broken or unfinished.** Crashes, errors, dead buttons, empty
   pages, forms that don't submit, wrong data, broken layouts.
2. **Judge whether each page is genuinely useful.** Especially the admin —
   dashboard, analytics, inventory, products. A page that loads but tells the
   owner nothing actionable is a failure. Ask of every admin screen: *"If I ran
   this business, would this screen help me make a decision?"*
3. **Flag clutter.** Features, pages, links, or widgets that are redundant,
   confusing, or pointless and should be removed.

## 2. Environment & access

- **Production storefront:** https://yellow-pink.vercel.app/
- **Admin:** https://yellow-pink.vercel.app/admin
- **Admin login:** ask the user for the owner credentials — do not guess. The
  admin is owner/staff gated.
- **Test customer account:** create your own via the storefront signup, or ask
  the user for one. Use a real inbox you control so you can verify emails.
- You may also inspect the Supabase database and Vercel logs directly if it
  helps confirm a bug (e.g. "did the order row actually get written?").

**Safety:** this is a live site. You may create test orders (use Cash on
Delivery), test accounts, and test reviews. Do **not** delete real products,
real customers, or real orders. Prefix test data so it's obvious ("TEST —…").

## 3. How to report findings

Produce one structured report. For every issue use this format:

```
[SEVERITY] Area — short title
  Where:     URL / page / element
  Steps:     what you did
  Expected:  what should happen
  Actual:    what happened (attach a screenshot)
  Notes:     console errors, network failures, anything relevant
```

Severity:
- **P0 Blocker** — checkout broken, admin crash, data loss, security hole.
- **P1 Major** — a core flow is broken or a key admin page is useless.
- **P2 Minor** — visual glitch, awkward UX, small inconsistency.
- **P3 Polish** — copy, spacing, nice-to-have.
- **CLEANUP** — something that should be removed.

Group the report by area (Storefront / Admin) and sort by severity within each.

---

## Part A — Storefront (the customer journey)

Walk the whole purchase journey end to end. At every step watch the browser
console for errors and the network tab for failed requests.

### A1. Home & navigation
- Load the homepage. Do all sections render with real products (not empty
  collections, not placeholders)?
- Click every header nav item and every footer link. Do they all resolve?
- Test the search (the search overlay / icon). Search a real product name, a
  partial term, and gibberish. Are results relevant? Does empty-state work?
- Open the announcement bar / promo banner if present.

### A2. Shop & product discovery
- Open `/shop`. Apply each category filter and each sort option. Does the grid
  update correctly? Is the sort actually correct?
- Test pagination.
- Hover a product tile — does "quick add to cart" work?
- Open several PDPs (`/product/...`). Check: images, price, variants/shades,
  quantity, "Add to Cart", the key-benefits bar, FAQ, reviews section.
- On a wellness product, check the **Subscribe & Save** box.
- On an out-of-stock product, check the "notify me / back in stock" form.

### A3. Cart & checkout
- Add several items. Open the mini-cart drawer — check the free-shipping
  progress bar updates as the total changes.
- Go to `/cart`, change quantities, remove an item.
- Apply a coupon: try `WELCOME10` and `SUBSCRIBE10`, an invalid code, and a
  code below its minimum order. Are messages correct?
- Complete a **Cash on Delivery** checkout end to end. Reach `/thank-you`.
- Confirm the order confirmation email arrives and looks right.

### A4. Accounts & post-purchase
- Sign up, log out, log in, run "forgot password".
- Visit every `/account/*` page: orders, order detail, addresses (add/edit/
  delete/default), profile, rewards/loyalty, **subscriptions** (pause / resume /
  change cadence / cancel).
- Track an order via `/track`.
- Add and remove items from the wishlist.
- Submit a product review; confirm it enters moderation.

### A5. Content & marketing
- Browse `/blog` and a blog post — filters, search, share, related content.
- Trigger the newsletter modal; sign up; confirm the `WELCOME10` welcome email.
- Test any WhatsApp links — do they open a chat to the right number?
- Open the static pages (privacy, contact, other `/page/...` entries).

### A6. Cross-cutting (do this throughout)
- **Mobile:** repeat the core journey at a phone width. Check the sticky
  mobile add-to-cart bar and the mobile nav.
- Note any layout breakage, overflow, console errors, slow loads, broken
  images, or text that looks like a placeholder.

---

## Part B — Admin (every page works)

Log into `/admin`. Visit **every** sidebar item and confirm it loads without
error, shows real data, and that its actions work:

- **Dashboard** — KPIs, charts, recent activity.
- **Analytics** — traffic, errors, whatever it surfaces.
- **Products** — list, search, filter, open a product, edit & save a field,
  check variants and images. Try the WP import screen.
- **Inventory** — stock levels, low-stock view, adjusting stock.
- **Orders** — list, filters, open an order, change its status, add tracking.
  Confirm the status change shows up in the Activity log.
- **Returns** — the returns queue and processing a return.
- **Customers** — list, **open a customer profile** (this recently crashed —
  confirm it now works), order history per customer.
- **Segments** — customer segmentation.
- **Coupons** — list, create a coupon, edit one, confirm `WELCOME10` /
  `SUBSCRIBE10` exist and look right.
- **Promos** — promo banners.
- **Blog** — list, create/edit a post.
- **Reviews** — moderation queue; approve and reject a review.
- **Activity log** — confirm it shows orders, signups, reviews, subscriptions
  and staff actions; test the filter chips and the search box.
- **Team** — staff list and roles.
- **Settings** — every settings tab saves correctly.

For each: does every button do something? Any dead links, any 404s, any action
that silently fails?

---

## Part C — Admin usefulness audit (the important one)

For the four screens the owner specifically cares about — **Dashboard,
Analytics, Inventory, Products** — do not just check that they load. Judge them.
For each, answer in the report:

1. **What decision is this screen meant to support?**
2. **Does the data on it actually help make that decision?** Is it the right
   data, fresh, and correct?
3. **Is it sorted/ordered sensibly by default?** (e.g. orders newest-first,
   inventory lowest-stock-first, products by a useful default.)
4. **What is missing** that a real store owner would expect here?
5. **What is noise** that should be removed?

Specifically check:
- **Dashboard:** Does it show today's sales, order count, revenue trend, low
  stock, pending orders, recent activity — the things you'd check each morning?
- **Analytics:** Is it real data or empty? Top products, traffic sources,
  conversion, revenue over time? Is it actionable or just numbers?
- **Inventory:** Can the owner instantly see what's about to run out? Is
  low/out-of-stock surfaced first? Is adjusting stock easy?
- **Products:** Is the list scannable? Can you find a product fast? Are
  price, stock, status, and image visible at a glance? Good default sort?

## Part D — Cleanup candidates

As you go, keep a running list for the **CLEANUP** section:
- Pages or sidebar items that are empty, broken beyond repair, or duplicate
  another page.
- Features that don't work and add no value.
- Buttons/links/filters that do nothing or are confusing.
- Placeholder/demo/test content visible to real customers.
- Anything that makes the product feel unfinished and should be cut rather
  than fixed.

## Part E — Whole-system checks

- **Console & network:** report every JavaScript error and failed request you
  see anywhere, with the page it happened on.
- **Responsive:** every page should be usable on mobile, tablet, and desktop.
- **Performance:** flag any page that feels slow to load.
- **Consistency:** flag mismatched styles, fonts, spacing, button shapes, and
  inconsistent copy/tone between pages.
- **SEO/meta:** flag pages with a missing or wrong title/description, or a
  broken social-share preview.
- **Empty states:** every list (orders, reviews, wishlist, etc.) should look
  intentional when empty, not blank or broken.

---

## Deliverable

One report, grouped Storefront / Admin, sorted by severity, every issue in the
format from section 3, with screenshots. End with:
- The **CLEANUP** list.
- A short **"most important 5 fixes"** summary so the owner knows where to
  start.
