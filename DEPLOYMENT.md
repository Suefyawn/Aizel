# Deploying Aizel

Aizel deploys to Vercel from the `main` branch of
[github.com/Suefyawn/Aizel](https://github.com/Suefyawn/Aizel). Production
runs out of the **London (`lhr1`)** Vercel region for lowest latency to UK
customers.

## First-time deploy

### 1. Import the repo into Vercel

1. Sign in to <https://vercel.com> with the GitHub account that owns the
   `Suefyawn/Aizel` repo (or a team that has access).
2. Click **Add New… → Project**, search for `Aizel`, click **Import**.
3. Framework preset auto-detects to **Next.js**. Leave the build / output
   directories as-is.
4. Hit **Deploy** with no env vars — the site comes up in demo mode at the
   `aizel-*.vercel.app` URL Vercel generates. Use this to verify the deploy
   works end-to-end before adding the live integrations.

### 2. Connect the custom domain

1. **Project → Settings → Domains → Add Domain**, enter `aizel.co.uk` and
   `www.aizel.co.uk`.
2. At your registrar, follow Vercel's DNS instructions — either point the
   apex `A` record to Vercel's IP and the `www` CNAME to
   `cname.vercel-dns.com`, or move nameservers to Vercel entirely.
3. Wait for DNS to propagate (typically <5 min). Vercel issues TLS
   automatically.

### 3. Add production environment variables

Open **Project → Settings → Environment Variables** and add each of these
for the **Production** environment (and **Preview** if you want the same
behaviour on PR previews). All come from `.env.example`.

#### Required for the site to read its own data
- `NEXT_PUBLIC_SUPABASE_URL` — your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the anon key (RLS-protected)
- `SUPABASE_SERVICE_ROLE_KEY` — service-role key (server-only; never exposed)

#### Required for owner / staff sign-in
- `ADMIN_PASSWORD` — the owner login password
- `STAFF_SESSION_SECRET` — generate with
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

#### Site origin
- `NEXT_PUBLIC_SITE_URL` — set to `https://aizel.co.uk` once the domain is
  live. Used to build absolute URLs in emails, OG images, and JSON-LD.

#### Email (Resend)
- `RESEND_API_KEY`
- `OWNER_EMAIL` — fallback recipient when Notifications recipients are empty
- `EMAIL_FROM` — `Aizel Orders <orders@aizel.co.uk>` (after verifying the
  domain in Resend)

#### Card checkout (Stripe)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET` — copy from the Stripe webhook config (step below)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` *(optional; not used by hosted Checkout)*

#### SMS notifications (Twilio)
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER` **or** `TWILIO_MESSAGING_SERVICE_SID` — one or the other

#### Rate limiting (Upstash, recommended)
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

#### Observability (optional)
- `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`,
  `SENTRY_ORG`, `SENTRY_PROJECT=aizel`
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` — GA4 measurement ID

#### Cron + courier webhook secrets
- `CRON_SECRET` — random string; Vercel auto-injects it in scheduled runs
- `COURIER_WEBHOOK_SECRET` — only needed if you'll wire a courier callback

### 4. Wire the Stripe webhook

After Production is live with the env vars above:

1. **Stripe Dashboard → Developers → Webhooks → Add endpoint**.
2. Endpoint URL: `https://aizel.co.uk/api/payments/stripe/webhook`
3. Events to send (Stripe lets you tick from a list):
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `checkout.session.async_payment_failed`
   - `payment_intent.payment_failed`
4. Stripe shows the **signing secret** (`whsec_…`). Copy it into Vercel's
   `STRIPE_WEBHOOK_SECRET` env var and redeploy.

Test it: place a card order on the live site with Stripe's test card
`4242 4242 4242 4242` (only when using `sk_test_*` keys). The order should
land in `/admin/orders` and the customer should receive both an email and
(if Twilio is set up) an SMS.

### 5. Promote `lhr1` confirmation

`vercel.json` pins the function region to `lhr1` (London). Confirm in
**Project → Settings → Functions** that the runtime region matches — Vercel
sometimes ignores the file-level setting on first deploy and you have to
re-pick it from the UI.

## Subsequent deploys

Push to `main` — Vercel auto-deploys. PRs get preview URLs. CI must pass
(typecheck + lint + build + tests) before merge once branch protection is
enabled in the GitHub repo settings.

## Rollback

**Project → Deployments → previous green deploy → Promote to Production.**
Takes ~5 seconds; no rebuild required.
