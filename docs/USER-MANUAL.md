# Yellow Pink — System Manual

A complete guide to the Yellow Pink online store, written for anyone new to the
system. It explains both sides of the platform: the **storefront** your
customers shop on, and the **admin panel** you and your staff use to run the
store and process sales.

> **Keeping this current:** this manual is updated whenever user-facing
> behaviour changes. If something here doesn't match what you see on screen,
> the screen is right — please flag it so the manual can be corrected.
>
> *Last updated: 23 May 2026.*

---

## Contents

1. [What this system is](#1-what-this-system-is)
2. [The customer experience (storefront)](#2-the-customer-experience-storefront)
3. [The admin panel — a tour](#3-the-admin-panel--a-tour)
4. [Processing a sale — the order workflow](#4-processing-a-sale--the-order-workflow)
5. [Team, roles & permissions](#5-team-roles--permissions)
6. [Store settings](#6-store-settings)
7. [Reference](#7-reference)

---

## 1. What this system is

Yellow Pink is an online beauty & wellness shop serving customers across
Pakistan. The platform has two halves:

- **The storefront** — the public website where customers browse products, place
  orders, and track them. Anyone can visit it.
- **The admin panel** — found at `/admin`, this is where you manage the catalogue,
  process orders, configure the store, and view performance. Only staff with a
  login can reach it.

A typical day: customers place orders on the storefront; you open the admin
panel, confirm and fulfil those orders, and keep the catalogue and settings up
to date.

---

## 2. The customer experience (storefront)

This is the journey every customer takes. Understanding it helps you support
customers and spot where an order is.

### 2.1 Browsing the store

- **Home page** — the landing page. It shows a hero banner, curated product
  rails (featured items, bestsellers, wellness picks), shop-by-category tiles,
  the latest blog posts, and trust/press sections.
- **Shop page** (`/shop`) — the full catalogue. Customers can filter by
  category, brand, and product attributes (shade, size, etc.), search by name,
  show only on-sale items, and sort by newest, price, or name. Results are
  paginated.
- **Product page** — each product has its images, price (and the crossed-out
  original price if it's on sale), description, ingredients, how-to-use, key
  benefits, FAQs, and its customer star rating. If the product comes in
  variants (e.g. shades), the customer picks one before adding to the cart.

### 2.2 Cart and checkout

- **Cart** — lists everything the customer has added, with quantities and a
  running total. They can change quantities, remove items, and enter a **coupon
  code** for a discount.
- **Checkout** — the customer enters their delivery details (name, phone, email,
  full address), sees the shipping cost, and chooses how to pay.

### 2.3 Ways to pay

Which options appear depends on what you've enabled in **Settings → Payments**:

- **Cash on Delivery (COD)** — the customer pays the courier when the parcel
  arrives. No online payment.
- **Bank transfer** — the customer transfers the amount to one of your store
  bank/wallet accounts (shown to them at checkout and on the thank-you page).
  You confirm the order once the money arrives.
- **JazzCash / Easypaisa** — Pakistani mobile wallets; the customer is taken to
  the wallet's payment page and back.
- **Card** — Visa/Mastercard payment.

Every order gets a unique **order number** (for example `YP-A1B2C3`).

### 2.4 After placing an order

- The customer lands on a **thank-you page** showing the order number and a
  simple progress timeline. For bank-transfer orders, the transfer instructions
  are shown here.
- They receive an **order confirmation email**.
- They can check progress anytime at the **Track page** (`/track`) by entering
  their order number and phone — no login needed. Once the order ships, the
  tracking number and courier link appear there.

### 2.5 Customer accounts

Customers can shop as guests or create an account. A signed-in customer has:

- **My Orders** — their full order history, with status and tracking. Orders
  they placed as a guest with the same email are linked automatically.
- **Addresses** — saved delivery addresses for faster checkout.
- **Rewards** — loyalty points earned from purchases, redeemable as a discount.
- **Subscriptions** — reorder reminders for products they buy regularly.
- **Profile** — their personal details and password.

### 2.6 Returns

On a **delivered** order, the customer can choose **Request a Return**, select
which items and give a reason. The request lands in your admin **Returns** queue
for you to approve or reject.

### 2.7 Reviews and the newsletter

- **Reviews** — a signed-in customer can leave a star rating and review on a
  product. It only appears publicly once you approve it in the admin.
- **Newsletter** — customers can subscribe via the footer sign-up form or the
  prompt shown after a purchase.

---

## 3. The admin panel — a tour

### 3.1 Signing in

Go to `/admin`. There are two kinds of login:

- **Owner** — signs in with the store password. The owner can see and do
  everything.
- **Staff** — sign in with their own email and password. Staff see only the
  sections their role allows (see [section 5](#5-team-roles--permissions)).

### 3.2 The sections

The left sidebar groups every area of the admin into five sections — **Insights**,
**Sell**, **People**, **Marketing**, and **Store** — so related tools sit
together. Here's what each link is for:

**Insights**
| Section | What it's for |
|---|---|
| **Dashboard** | At-a-glance health of the store — revenue, order counts by status, top products, low-stock alerts, recent orders. |
| **Analytics** | Deeper performance data — revenue trends, customer cohorts (RFM segments + retention), and (if connected) website-traffic widgets including top user journeys (which path sequences customers take through the site), funnel-by-traffic-source, a weekly-active-users curve, and inline links to PostHog session recordings to watch real visits. |

**Sell** — day-to-day commerce operations
| Section | What it's for |
|---|---|
| **Orders** | Every order placed. Filter by status, search, and open an order to process it. |
| **Products** | The catalogue. Create, edit, publish, archive, and delete products; manage variants, images, pricing, and descriptions. Bulk price tools and CSV import are here. |
| **Inventory** | Stock levels. See low-stock items and adjust stock counts. |
| **Vendors** | Your suppliers/fulfilment partners. Add vendors and track what you owe or are owed (settlements). |
| **Returns** | Customer return requests awaiting your approval, and refund processing. |

**People** — customers and incentives
| Section | What it's for |
|---|---|
| **Customers** | Everyone who has an account — search the list and open a customer to see their orders, lifetime spend, and activity. |
| **Segments** | Customer groupings (e.g. high-spenders) for targeting and analysis. |
| **Coupons** | Discount codes — create, edit, set limits and expiry, and turn them on/off. |

**Marketing** — content and campaigns
| Section | What it's for |
|---|---|
| **Promos** | The promotional banner shown on the storefront — content, colours, and on/off. |
| **Blog** | Editorial posts shown in the storefront "Journal" and at `/blog`. |
| **Reviews** | Moderate customer reviews (approve, unapprove, edit, delete) and seed reviews yourself (migration / phoned-in feedback). |
| **Newsletter** | Compose and send newsletter emails. Manage the subscriber list directly — add, edit, unsubscribe, or resubscribe people. |

**Store** — admin internals
| Section | What it's for |
|---|---|
| **Email log** | A record of every email the system has sent (order emails, newsletters, etc.). |
| **Activity log** | An audit trail of admin actions — who changed what, and when. Owner only. |
| **Team** | Staff accounts and their roles. Owner only. |
| **Settings** | Store-wide configuration — see [section 6](#6-store-settings). |

---

## 4. Processing a sale — the order workflow

This is the core day-to-day task. When an order comes in, open **Orders**, find
it (new ones show a red count badge on the Orders menu item), and click it to
open the **order detail page**. From there:

**Step 1 — Confirm with the customer.**
Tap the **WhatsApp** button at the top of the order. It opens WhatsApp with a
message to the customer pre-filled with their items, address, and total. Once
they confirm, click **Mark customer-confirmed** to record it.

**Step 2 — Send it to a vendor (if you fulfil through one).**
In the *Confirmation & vendor* section, pick a vendor. A ready-to-send WhatsApp
message appears with the items and delivery address — forward it to the vendor.

**Step 3 — Book the shipment.**
In the *Shipment* section, record the courier and tracking number. If a courier
has an API connection set up, a one-click "book pickup" button is available;
otherwise enter the courier and tracking number manually.

**Step 4 — Move the order through its statuses.**
Use the **Update Order** control to change the order's status as it progresses:

- **Order received** → the order is placed and awaiting preparation.
- **Preparing** → you're packing/preparing it.
- **Shipped** → it's handed to the courier.
- **Delivered** → the customer has received it.
- **Cancelled** → the order won't be fulfilled.

Each change is recorded in the order's **timeline**, and the customer is emailed
automatically at the key steps (for example, a shipping email with their
tracking number when you mark the order *Shipped*).

**Step 5 — Settle with the vendor (if used).**
If the order went to a vendor, a settlement summary shows the vendor cost, your
margin, and who owes whom. Mark it **settled** once that payment is done.

**The rest of the order page** also shows the customer's details (with a
"repeat customer" badge and lifetime spend if applicable), the shipping address,
the items, the full status timeline, a payment summary, and a **Print Invoice**
button.

> **Tip:** cancelling an order automatically returns its items to stock.

---

## 5. Team, roles & permissions

The **owner** has unrestricted access. Everyone else is a **staff member** with
a login, managed under **Team** (owner only).

- Each staff member is given a **role** — a named bundle of permissions (for
  example a support role, a marketing role, an inventory role) — or a custom
  set of permissions chosen individually.
- **Permissions** decide which admin sections that person can open. A staff
  member only sees the sections their permissions allow; anything else shows an
  "Access restricted" page.
- Deactivating a staff member blocks their login while keeping their history in
  the activity log.

To add someone: **Team → Add Staff Member**, enter their name and email, pick a
role, and save. They receive a temporary password to sign in with and change.

---

## 6. Store settings

**Settings** (`/admin/settings`) splits into eight focused sub-pages, each
reachable from the left rail. Open Settings and the rail shows where to go for
what — pick a page, edit, hit **Save changes** at the bottom.

| Sub-page | What it controls |
|---|---|
| **Store profile** (`/admin/settings/profile`) | Store name, currency, contact email and phone, and links to your social profiles (used in the footer and for search-engine data). |
| **Branding & theme** (`/admin/settings/branding`) | Brand colours (pink, yellow, ink) and the **Seasonal Theme** — a one-switch makeover (palette, motif, hero) for Eid, Christmas, etc. |
| **Homepage** (`/admin/settings/homepage`) | The big **Homepage Hero** (wording, buttons, image, brand logos), the store-wide **Sale** on/off switch, and the thin **Announcement Bar** at the top of every page. |
| **Shipping & tax** (`/admin/settings/shipping`) | Default shipping rate (the fallback), tax rate, and per-zone overrides — add named zones (e.g. Karachi, Lahore, Remote) with their own rate, free-shipping threshold, and estimated delivery days. |
| **Payments** (`/admin/settings/payments`) | Turn each payment method on or off, and manage the bank/wallet accounts shown to customers paying by transfer. |
| **Loyalty** (`/admin/settings/loyalty`) | How customers earn and redeem loyalty points. |
| **Notifications** (`/admin/settings/notifications`) | Add as many staff email addresses as you like and pick which alerts each one receives — **New orders** (every order, immediately) and **Low stock** (daily digest when items drop below 5 units). If nobody is configured for an event, the alert falls back to the `OWNER_EMAIL` env var so existing behaviour is unchanged. |
| **Integrations** (`/admin/settings/integrations`) | Live status for every third-party service the store uses — Resend (email), PostHog, Sentry, Upstash, JazzCash, Easypaisa, Search Console, WhatsApp. Each card shows whether its env vars are set and (for analytics services) when data last synced. Secret values are never displayed. |

Saved changes apply to the storefront within a few minutes (storefront pages
are cached for speed).

> **Note on promos.** Scheduled, audience-targeted promotional banners (the
> top bar and the hero strip) are no longer in Settings — they live on the
> dedicated **Promos** page (`/admin/promos`) where you can run multiple
> campaigns at once with start/end dates and audience filters.

---

## 7. Reference

### Order statuses

| Status | Meaning |
|---|---|
| Awaiting payment | Card or bank-transfer order placed; we're waiting for payment to clear before preparation begins. |
| Payment failed | Card or bank-transfer payment attempt failed; the order will not be prepared until payment succeeds or the customer is contacted. |
| Order received | Order placed and paid (or COD); ready to start preparation. |
| Preparing | Being packed / prepared. |
| Shipped | Handed to the courier; customer emailed with tracking. |
| Delivered | Received by the customer. |
| Cancelled | Will not be fulfilled; stock is returned. |
| Returned | Customer returned the order after delivery. |
| Refunded | Money has been returned to the customer (typically follows Returned or Cancelled). |

These are the labels shown throughout the admin (the order list, filters, the order page, the quick-action buttons on a mobile order card, and the customer's order history) — all driven from one shared set so they never disagree.

### Glossary

- **Order number** — the customer-facing code for an order, e.g. `YP-A1B2C3`.
- **Variant** — a specific version of a product, such as a shade or size.
- **Vendor** — a supplier or fulfilment partner an order can be dispatched to.
- **Settlement** — the money owed between you and a vendor for an order.
- **Coupon** — a discount code a customer enters at checkout.
- **Segment** — a saved group of customers used for targeting.
- **Permission** — a capability that controls which admin sections a staff
  member can use.

### Search Console, Analytics & Merchant Center

Three Google products work together to give you traffic, conversion, and
shopping data. They're one-time setups — once each is wired you don't touch
them again.

**Search Console (organic search visibility)**

1. Open Search Console → *Add property* → **Domain** → enter `yellowpink.pk`,
   follow the DNS TXT verification it gives you.
2. Once verified, go to **Sitemaps**, paste `https://www.yellowpink.pk/sitemap.xml`,
   click **Submit**. The status should change to *Success* within minutes.
3. To speed up indexing of new products, use **URL Inspection** at the top:
   paste any product URL → *Request indexing*. Google crawls it within a few
   days instead of the usual few weeks.
4. The dashboard's *Products* and *Merchant listings* tiles show counts of
   pages Google has validated, not your full catalogue. Numbers grow as
   Google crawls; the sitemap submission above is what drives that.

**Google Analytics 4 (visitor behaviour)**

1. In GA4, *Admin* → *Property* → *Data Streams* → *Add stream* → *Web*. Use
   `https://www.yellowpink.pk` as the stream URL.
2. Copy the *Measurement ID* (looks like `G-XXXXXXXXXX`).
3. In Vercel → Project → Settings → Environment Variables, add
   `NEXT_PUBLIC_GA_MEASUREMENT_ID` = `G-XXXXXXXXXX` for Production. Redeploy.
4. Visit the storefront, accept analytics cookies on the banner, browse a few
   pages. Within ~60s, GA4 → *Reports* → *Realtime* should show one user.
5. (Recommended) link GA4 to Search Console: GA4 *Admin* → *Product links* →
   *Search Console links* → *Link*. Lets GA4 show landing-page queries.

The site already fires GA4's e-commerce events automatically — `view_item`,
`add_to_cart`, `begin_checkout`, `purchase`, `search`, `sign_up` — so you'll
see funnel and revenue data without any extra setup.

**Google Merchant Center (free Shopping listings)**

1. Sign up at merchants.google.com. Target country: Pakistan, currency: PKR.
2. *Products* → *Feeds* → *Add primary feed* → choose **Scheduled fetch** →
   feed URL `https://www.yellowpink.pk/feeds/google-merchant.xml` → daily.
3. After the first fetch, Merchant Center will flag any items it can't accept
   (usually missing images or descriptions). Fix those products' fields in
   the admin Products page; the next daily fetch picks the corrections up.

The feed is generated automatically from your published catalogue — any
product you publish, change the price of, or take out of stock will reflect
in Merchant Center within 24 hours of the next fetch.

### Who to contact

For storefront or admin issues that this manual doesn't cover, contact the
store owner.
