# Yellow Pink — Owner Setup Checklist

Configuration that only you can do — dashboards, DNS, env vars, financial
details. These are **not code**; the code is deployed and waiting on them.
Work top-down: the **Critical** items block real functionality today.

_Last updated: 21 May 2026._

---

## 🔴 Critical — things are broken until these are done

- [ ] **Verify the Resend sending domain.**
  All outbound email (order confirmations, password resets, the newsletter,
  stock alerts) goes through Resend. If the `EMAIL_FROM` domain isn't verified,
  **every email silently fails**.
  → Resend dashboard → **Domains** → add your domain → add the DNS records it
  gives you → wait for "Verified" → make sure the `EMAIL_FROM` env var is an
  address on that verified domain.

- [ ] **Fix the Supabase Auth "Site URL".**
  It currently points at `localhost`, so confirmation and password-reset links
  in auth emails are broken — which is also why **customer login / sign-up
  doesn't work** right now.
  → Supabase dashboard → **Authentication → URL Configuration** → set **Site
  URL** to the live site URL, and add that URL under **Redirect URLs**.

- [ ] **Set `NEXT_PUBLIC_SITE_URL`.**
  It's pointing at the old WordPress site (or is unset). It drives email
  logos, social-share images, canonical SEO URLs, and share links.
  → Vercel → Project → **Settings → Environment Variables** → set
  `NEXT_PUBLIC_SITE_URL` to the live deployment URL (or the custom domain once
  it's live) → redeploy.

---

## 💳 Payments

- [ ] **Add Bank Transfer account details.**
  Bank Transfer is switched **on**, but **no accounts are saved**, so it does
  not appear at checkout. (I don't enter financial details — this one is
  yours.)
  → Admin → **Settings → Bank Transfer** → add each account: title, number /
  IBAN, bank name, and a contact email. Easypaisa / JazzCash wallet numbers
  can go here too.

---

## ✉️ Email — enhancements

- [ ] **Connect the Resend webhook** (powers the new Email log's open/click
  tracking).
  Without it, the Email log still records what was **sent / failed** — it just
  can't show **delivered / opened / clicked**.
  → Resend dashboard → **Webhooks** → add endpoint
  `https://<your-domain>/api/webhooks/resend` → enable **open** and **click**
  tracking → copy the signing secret into a `RESEND_WEBHOOK_SECRET` env var on
  Vercel → redeploy.

- [ ] **Brand the Supabase account emails.**
  The sign-up confirmation and password-reset emails are still Supabase's
  plain default template.
  → Supabase dashboard → **Authentication → Email Templates** → restyle
  "Confirm signup" and "Reset password" with Yellow Pink branding.

---

## 📦 Catalog

- [ ] **Assign vendors to products.**
  None of the 113 products has a vendor set, so the cost / margin / payout
  tracking and the vendor-dispatch workflow have nothing to act on. Link the
  products you source or dropship (e.g. the nbsons.com wellness products) to
  their vendor.
  → Admin → **Products** → open a product → set **Vendor** (and cost, if it's
  a per-product cost vendor).

---

## ⚙️ When you move to a custom domain

- [ ] If you point `yellowpink.pk` (or another domain) at the Vercel
  deployment, update all three to the new domain: `NEXT_PUBLIC_SITE_URL`, the
  Supabase Auth **Site URL**, and the Resend verified domain.

---

## Deferred — by your decision (not a to-do)

- **Easypaisa / JazzCash merchant integration** — intentionally not set up;
  Bank Transfer covers wallet payments for now. The integration code/env vars
  exist if you get merchant accounts later.
