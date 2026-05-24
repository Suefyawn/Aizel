# Aizel — Pre-launch checklist

> Follow this top-to-bottom on the day you're flipping `aizel.co.uk` to live.
> Every step is something only you (the operator) can do — the code is shipped.
>
> _Last reviewed: 24 May 2026._

Each section ends with a **✅ verify** step you can actually click + see, not
just "tick the box". If a verify step fails, fix that before moving on.

---

## 1. Supabase project

### 1.1 Create the project

- New project at [supabase.com/dashboard](https://supabase.com/dashboard).
  Choose the London (`eu-west-2`) region — UK shoppers, UK data residency,
  best latency for both the storefront edge functions + the admin reads.
- Pick the **Pro** plan if you're past the free tier's row count or expect
  to host product images in Storage (Free is fine for soft-launch).

### 1.2 Run every migration

```bash
# From your local clone, with `supabase` CLI logged in + project linked:
supabase db push
```

This runs every file in `supabase/migrations/` in lexical order — 102 files,
including the rebrand migrations from this engagement (133 loyalty-GBP rename,
134 stripe gateway widening, 135 win-back tracking, 136 free-from claims).

**✅ verify:** in the Supabase SQL editor, run
`select count(*) from supabase_migrations.schema_migrations;` — should return
102 (or higher if you've added more since).

### 1.3 Copy the keys into Vercel env

From Supabase Project Settings → API:

| .env name | What to paste |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | "Project URL" |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | "anon public" key |
| `SUPABASE_SERVICE_ROLE_KEY` | "service_role" key (SECRET — never commit) |

### 1.4 Seed the owner staff row

The storefront ships in demo mode until the staff table has a row. Either
import your first staff via Supabase Auth + flip them to `is_owner = true`
in `public.staff`, OR set `ADMIN_PASSWORD` env and visit `/admin` once —
the first login creates the bootstrap owner.

**✅ verify:** sign into `/admin` and see the dashboard (not the staff-empty
splash).

---

## 2. Domain + DNS

### 2.1 Point the apex to Vercel

In your registrar (123-reg / Cloudflare / GoDaddy / wherever):

- **A** record `aizel.co.uk` → Vercel's IP (Vercel will show this in the
  project Domains tab once you add `aizel.co.uk`).
- **CNAME** record `www.aizel.co.uk` → `cname.vercel-dns.com`.
- Add `aizel.co.uk` AND `www.aizel.co.uk` in Vercel Domains; pick `aizel.co.uk`
  as the primary so the www variant 301s to it.

**✅ verify:** `curl -I https://aizel.co.uk` returns `HTTP/2 200` with a Vercel
`server` header. `curl -I https://www.aizel.co.uk` returns 308 to apex.

### 2.2 Email DNS — SPF + DKIM + DMARC

For Resend (transactional + marketing) to land in inboxes — without these,
Gmail spam-folders everything.

Add at the apex:

```
TXT   aizel.co.uk          "v=spf1 include:_spf.resend.com ~all"
TXT   resend._domainkey    "<DKIM record Resend gives you>"
TXT   _dmarc               "v=DMARC1; p=quarantine; rua=mailto:dmarc@aizel.co.uk; pct=100"
```

Resend's dashboard shows the exact records under Domains → Add domain →
aizel.co.uk. Wait 30 min for propagation.

**✅ verify:** Resend dashboard shows aizel.co.uk as "Verified" (green).
Send yourself a test email from the admin; check Gmail "Show original" →
SPF: PASS, DKIM: PASS, DMARC: PASS.

---

## 3. Payments

### 3.1 Stripe — live mode

1. Apply at [stripe.com/gb](https://stripe.com/gb) (UK Ltd / sole-trader),
   complete identity verification.
2. In the Stripe Dashboard, flip the toggle from Test mode → Live mode.
3. From **API keys**, copy the **live** keys into Vercel:
   - `STRIPE_SECRET_KEY` = `sk_live_…`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = `pk_live_…`
4. Set up the webhook:
   - **URL:** `https://aizel.co.uk/api/payments/stripe/webhook`
   - **Events to send:**
     `checkout.session.completed`,
     `checkout.session.expired`,
     `checkout.session.async_payment_failed`,
     `payment_intent.payment_failed`,
     `charge.refunded`
   - Copy the **Signing secret** into Vercel as `STRIPE_WEBHOOK_SECRET`.

**✅ verify:** in Stripe Dashboard → Webhooks → your endpoint → click "Send
test webhook" → `checkout.session.completed`. Refresh — last delivery should
be `200 OK`.

### 3.2 Klarna (optional, BNPL)

Apply at [klarna.com/uk/business/](https://klarna.com/uk/business/). Once
approved, copy your client ID into Vercel as `NEXT_PUBLIC_KLARNA_CLIENT_ID`
to enable the "3 instalments of £X" line under PDP prices.

### 3.3 Stripe Terminal (optional — for in-store POS)

If you're running the `/admin/pos` till alongside the web shop, Stripe
Terminal turns your chip-and-PIN reader into a connected card terminal:

1. In Stripe Dashboard → **More → Terminal → Locations**, create a
   Location (one per physical shop). Copy the ID (`tml_…`) into Vercel
   as `STRIPE_TERMINAL_LOCATION_ID`.
2. Order a BBPOS WisePOS E or Verifone P400 from Stripe (UK only ships
   to your business address; allow 3–5 days).
3. Pair the reader against the Location from the Stripe Dashboard's
   reader-registration flow, then copy its ID (`tmr_…`) into Vercel as
   `STRIPE_TERMINAL_READER_ID`. The till pushes every PaymentIntent to
   this reader over the REST API — no browser SDK needed; the reader
   handles tap/insert/contactless on its own screen.
4. The POS will surface a third "Tap card" tender alongside Cash and
   Manual card. Without both env vars set, the Tap card tab is hidden
   and the cashier sees only Cash + Manual card (operator keys it on
   their existing terminal then marks the order paid).

**✅ verify:** in `/admin/pos`, start a sale → press Tender — you
should see three tabs (Cash · Tap card · Manual card). Pick **Tap
card**, hit **Send to reader**, tap a test card on the reader: the dot
pulses purple while waiting, turns green on success, and the sale
auto-completes with the PI id stored in `payments.txn_ref` for later
reconciliation.

### 3.4 PayPal (optional)

If you want PayPal alongside Stripe: get
`PAYPAL_CLIENT_ID` + `PAYPAL_CLIENT_SECRET` from
[developer.paypal.com](https://developer.paypal.com); flip
`PAYPAL_ENVIRONMENT=production`.

---

## 4. Notifications

### 4.1 Twilio SMS (optional but recommended)

- [twilio.com/console](https://twilio.com/console) → buy a UK long-code
  (`+44 7…`) or short code.
- Copy into Vercel:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_FROM_NUMBER` (the number you bought)
  - `TWILIO_MESSAGING_SERVICE_SID` (recommended — handles delivery
    fallback automatically)

**✅ verify:** from `/admin` → Settings → Notifications → "Send test SMS".
Should arrive within 30 s with the `Aizel: ` prefix.

### 4.2 WhatsApp Business (optional — chat support)

Set `NEXT_PUBLIC_WHATSAPP_NUMBER=+447xxxxxxxxx`. The chat icon then appears
in the header + cart + thank-you. Install the WhatsApp Business app on the
operator's phone using that same number — no API account needed.

### 4.3 Owner email + sender identity

- `OWNER_EMAIL` = the staff inbox that should receive "new order" alerts
  out-of-the-box. Per-event routing is configurable from
  `/admin/settings/notifications` once at least one event has fired.
- `EMAIL_FROM` = `Aizel Orders <orders@aizel.co.uk>` — must use a sender
  on the domain you DKIM-verified above.

---

## 5. Analytics

### 5.1 Plausible (recommended primary — privacy-friendly)

- Sign up at [plausible.io](https://plausible.io), add `aizel.co.uk` as
  a site, copy the domain string into `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`.
- The script only loads when the shopper grants analytics consent —
  zero data leaves the browser until then.

### 5.2 Google Analytics 4 (optional second source)

- Create a GA4 property at [analytics.google.com](https://analytics.google.com).
- Copy the Measurement ID (`G-…`) into `NEXT_PUBLIC_GA_MEASUREMENT_ID`.
- Also paste the **Verification code** from Google Search Console
  (Property → Settings → Verification details) into `GOOGLE_SITE_VERIFICATION`.

### 5.3 Meta Pixel (optional — only if you'll run paid ads)

- Create a pixel in [business.facebook.com/events_manager](https://business.facebook.com/events_manager).
- Copy the 15-digit ID into `NEXT_PUBLIC_META_PIXEL_ID`.
- Only loads when the shopper grants **marketing** consent (not analytics)
  — Meta Pixel is classified as ad retargeting per UK ICO guidance.

### 5.4 Sentry (recommended — error monitoring)

- Project at [sentry.io](https://sentry.io); copy DSN into both `SENTRY_DSN`
  and `NEXT_PUBLIC_SENTRY_DSN`.
- For source-map upload on deploys: `SENTRY_ORG`, `SENTRY_PROJECT=aizel`,
  `SENTRY_AUTH_TOKEN`.

**✅ verify:** trigger a deliberate error in production (e.g. hit
`/admin/orders/xxxxx-not-a-uuid`) — Sentry should show the issue within
30 s with a readable stack trace (proves source-maps uploaded).

---

## 6. Storage (product images)

- In Supabase → Storage, create a public bucket called `images` (or whatever
  you set `EBAY_IMPORT_BUCKET` to).
- Storage policies: anon SELECT on the bucket; authenticated INSERT/UPDATE
  only for the staff role.

**✅ verify:** in `/admin/products/new`, upload a test image — it should
appear in the bucket AND the PDP preview should render it.

---

## 7. Cron / scheduled jobs

`vercel.json` registers `/api/cron/daily` to fire once per day. It runs
abandoned-cart, back-in-stock, courier-sync, subscription-reorder,
review-requests, **win-back**, low-stock, analytics-refresh in sequence.

- Generate a long random `CRON_SECRET` (e.g. `openssl rand -hex 32`) and
  paste it into both Vercel env + the cron Authorization header (Vercel
  Cron auto-includes it; you only need to set the env var).

**✅ verify:** Vercel Project → Cron Jobs → daily should show the next
scheduled run + the last execution status when it fires.

---

## 8. Search Console + sitemap

1. Add `https://aizel.co.uk` to [Google Search Console](https://search.google.com/search-console)
   as a Domain property.
2. Use DNS verification (TXT record at the apex; Google shows the exact
   value) — survives certificate / hosting changes.
3. Submit `https://aizel.co.uk/sitemap.xml` from Search Console → Sitemaps.

**✅ verify:** within 24 hours the sitemap status reads "Success" with
the discovered URL count. Should match `(static pages) + brands + products
+ blog posts + CMS pages`.

---

## 9. Tax / VAT

- If you're VAT-registered: set the rate in `/admin/settings/shipping` →
  "VAT rate (%)" (UK standard is 20%, but most personal-care products are
  zero-rated — check with your accountant).
- The order CSV export (Orders → Export CSV) already carries a VAT column
  for HMRC reconciliation.

---

## 10. Final pre-launch sanity sweep

Run this list as the last thing you do before flipping DNS to live:

- [ ] `/admin/dashboard` loads + KPIs are non-zero (or accurately zero for
      a fresh launch).
- [ ] Place a real £1 test order through Stripe (live mode, refund yourself
      after) — full flow including the email confirmation.
- [ ] Refund that order from `/admin/orders/[id]` — Stripe shows the
      refund + the order flips to status=refunded.
- [ ] `/account` → sign in, view orders, run the GDPR data export. JSON
      should download with your test data.
- [ ] `/quiz` — complete all 5 questions, see a real product rail on the
      result page.
- [ ] `/account/data-export` — JSON downloads with your test profile +
      order.
- [ ] `/search?q=cantu` returns matching products.
- [ ] `/admin/marketing/blast` — "Send test to me" arrives in the staff
      inbox with the Aizel brand chrome + unsubscribe link.
- [ ] Lighthouse on `/`, `/shop`, `/product/<a-real-slug>`: Performance ≥
      85, Accessibility ≥ 95, SEO = 100.
- [ ] `npx playwright test` — 20 e2e + 10 a11y all green locally.

---

## 11. After launch

Things that don't block launch but you'll want to action in the first week:

- **Add at least 3 real reviews per top-50 product** — empty review counts
  on the PDP read as "untried". Operator can paste from previous-store
  CSV imports via `/admin/reviews/new`.
- **Author the first 3 blog posts** to seed `/blog` — the wash-day,
  Jamaican-black-castor-oil, and cocoa-vs-shea-butter posts are already
  stubbed in demo data; edit the live versions in `/admin/blog`.
- **Curate the homepage** — `/admin/settings/home` (hero, featured rail,
  category tiles). The current defaults from demo data work but the
  client will want to personalise.
- **Set a UTM-tagged welcome promo** for the first 30 days — `/admin/promos`.
- **Configure SCA / 3D Secure exemptions** in Stripe (Settings → Payment
  methods → 3D Secure) — UK PSD2 default behaviour is correct but worth
  reviewing as live transactions appear.
- **Subscribe yourself to your own newsletter** — proves the double-opt-in
  + the welcome email + the unsubscribe link all work for a real shopper.

Welcome to launch. 🚀
