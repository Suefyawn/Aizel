# Deployment checklist — 2026-05-19 batch

This checklist covers the **commits in this branch that aren't on `origin/main` yet** and the **manual steps** Vercel/Supabase need from you to make them live. Work through it top-to-bottom; nothing later requires anything earlier that you skipped.

The full audit findings + fix details are in `.audit/REPORT_20260519.md`.

---

## 1 · Push the code (3 min)

```bash
git push origin main
```

Vercel will redeploy automatically. The deployment is **safe to push without** running the migration in §2 first — every code change is backward-compatible with the current DB:

- The `metadata.icons` fix only removes a `<link>` that 404s.
- The `?cat=` → `?category=` proxy redirect is additive.
- The `noindex` meta additions don't touch behaviour.
- The shipment booking form falls back to manual entry when no courier API is configured.

Without the migration in §2 the **SEV-0 orders RLS leak is still wide open** — push the code first to lock in the code fixes, then immediately do §2 to close the leak.

**Commits being pushed:**
- `399f755` Audit-report fixes: RLS + signup defence + audit instrumentation
- `6ce9861` Multi-courier shipping: TCS COD API adapter + manual + third-party
- _(and the followup commit landing this doc + the GoTrueClient + dynamic-trending + courier-sync cron fixes)_

---

## 2 · Apply the Supabase migration (5 min, blocks launch)

**File:** `supabase/migrations/20260525_070_audit_report_fixes.sql` (~200 lines)

**What it does:**
- SEV-0 — drops every existing SELECT policy on `public.orders` and installs `auth.uid() = user_id` for the authenticated role only. Anon SELECT goes away. The guest-tracking flow still works through the existing `lookup_order(order_number, phone)` RPC (security definer, bypasses RLS).
- SEV-1 — same lockdown on `public.coupons` + a new `lookup_coupon(code)` security-definer RPC so the storefront's apply-coupon path keeps working.
- SEV-1 — wraps `handle_new_user()`, `award_welcome_points()`, and `generate_referral_code()` in `BEGIN/EXCEPTION` blocks so a failing side-effect doesn't block `auth.users INSERT`. Backfills any auth.users without a profile.
- SEV-2 — deletes the `$ACTION_ID_…` row from `site_settings` and adds a `CHECK` constraint refusing future `$…` keys.
- SEV-2 — dedupes `staff_members.permissions` arrays where any row had duplicates.

**Apply it** — pick one:

**Option A · Supabase CLI (recommended):**
```bash
supabase db push
```
This applies every migration newer than what's in the project's `supabase_migrations.schema_migrations` table — should be just this one.

**Option B · Supabase Studio:**
1. Open https://supabase.com/dashboard/project/cngsjtthiexcfpjpcpsg/sql/new
2. Paste the contents of `supabase/migrations/20260525_070_audit_report_fixes.sql`
3. Click Run.

**Verify (paste in SQL Editor):**
```sql
-- All four should return 0
set role anon;
select count(*) as orders_count from public.orders;        -- → 0
select count(*) as coupons_count from public.coupons;      -- → 0
reset role;
select count(*) as action_id_rows from public.site_settings where key like '$%'; -- → 0
-- And this should still work (lookup_coupon is the new RPC):
select * from public.lookup_coupon('WELCOME10');            -- → 1 row
```

---

## 3 · Verify signup is unblocked (2 min, blocks customer journey)

The migration's defensive triggers should fix the "Database error saving new user" bug for the common cases. Confirm:

1. Visit `https://yellow-pink.vercel.app/login` → click **Sign up**
2. Enter a fresh email (e.g. `suefyawn+postfix-1@gmail.com`) + any 8+ char password
3. Click **Create account**

**Expected:** "Account created — check your email to confirm your address."

**If it still fails** — the migration wraps each side-effect in `EXCEPTION WHEN OTHERS`, which logs a NOTICE/WARNING to PostgreSQL. Grab the line and send it over:

1. Supabase Dashboard → **Logs** → **Postgres logs**
2. Filter for the last few minutes; look for lines containing `handle_new_user` or `award_welcome_points` or `generate_referral_code`
3. Paste the matching line — I can patch from there.

---

## 4 · Set env vars in Vercel (10 min)

Vercel Dashboard → Project → **Settings** → **Environment Variables**. Set for **Production**, **Preview**, and **Development** unless noted.

### Already required (you may have these)
| Var | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://cngsjtthiexcfpjpcpsg.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page. **Production only** — never expose to the browser. |
| `ADMIN_PASSWORD` | What the owner uses at `/admin` |
| `RESEND_API_KEY` | For transactional + newsletter emails |
| `CRON_SECRET` | Auth for `/api/cron/*` routes. `openssl rand -hex 32`. |

### NEW — courier system (Phase 5.7)
The shipment-booking UI gracefully degrades when these aren't set — every courier shows as "manual only." Set them when you're ready to wire TCS.

| Var | What to set | Required for TCS |
|---|---|---|
| `TCS_BASE_URL` | `https://devconnect.tcscourier.com` (UAT) then `https://ociconnect.tcscourier.com` (prod) | yes |
| `TCS_CLIENT_ID` | Provided by TCS at onboarding | yes |
| `TCS_CLIENT_SECRET` | Provided by TCS at onboarding | yes |
| `TCS_TCS_ACCOUNT` | Your TCS account number | yes |
| `TCS_COST_CENTER_CODE` | Assigned by TCS | yes |
| `TCS_SHIPPER_NAME` | `Yellow Pink` (printed on every label) | yes |
| `TCS_SHIPPER_ADDRESS` | Your pickup address line 1 | yes |
| `TCS_SHIPPER_CITY_CODE` | `KHI` / `LHE` / `ISB` etc. — TCS city code | yes |
| `TCS_SHIPPER_CITY_NAME` | Human-readable: `Karachi` | yes |
| `TCS_SHIPPER_MOBILE` | Your contact: `03xxxxxxxxx` | yes |
| `TCS_SERVICE_CODE` | `O` (Overnight, default) or per TCS docs | optional |
| `COURIER_WEBHOOK_SECRET` | `openssl rand -hex 32`. Required for the `/api/couriers/webhook` ingest endpoint (couriers POST status updates here). | yes if any courier webhook |

### Optional but recommended
| Var | Why |
|---|---|
| `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` | Error monitoring — paid Sentry org `trellee/yellowpink` already wired |
| `POSTHOG_PERSONAL_API_KEY` | Powers the admin analytics widgets — without it the "Refresh Analytics" button surfaces an error toast |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | If using Plausible, set the domain |
| `UPSTASH_REDIS_REST_URL` + `_TOKEN` | Rate-limiting on `/login`, `/forgot-password`, newsletter, etc. |
| `OWNER_EMAIL` | Where "new order" + "low stock" alerts go (defaults to the value in `src/lib/email.ts`) |

---

## 4½ · WordPress migration (one shot, then never again)

The current Supabase has products + blog imported but **0 customers, 0 historic orders, no reviews, no coupons, no WP redirect map**. Bring the rest over with a single command, then leave WP read-only for 30 days as a safety net.

**Pre-flight — put these five values in `.env.local` at the repo root:**

```
WP_SITE_URL=https://yellowpink.pk
WC_CONSUMER_KEY=ck_…           # WP admin → WooCommerce → Settings → Advanced → REST API
WC_CONSUMER_SECRET=cs_…        # same place
WP_USERNAME=                   # your WP admin username
WP_APPLICATION_PASSWORD=       # WP admin → Users → your user → Application Passwords
```

(Plus `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — the importer writes via service role to bypass RLS.)

**Run it:**

```bash
WP_IMPORT_DRY_RUN=true npm run wp-import   # sanity-check first (no writes)
npm run wp-import                          # the real one
```

**Verify counts in Supabase Studio → SQL Editor:**

```sql
select
  (select count(*) from public.products)                            as products,
  (select count(*) from public.product_variants)                    as variants,
  (select count(*) from public.product_images)                      as images,
  (select count(*) from public.categories)                          as categories,
  (select count(*) from public.blog_posts)                          as blog_posts,
  (select count(*) from public.pages)                               as pages,
  (select count(*) from public.coupons)                             as coupons,
  (select count(*) from public.orders)                              as orders,
  (select count(*) from auth.users)                                 as auth_users,
  (select count(*) from public.profiles)                            as profiles,
  (select count(*) from public.product_reviews)                     as reviews,
  (select count(*) from public.redirects where source = 'wp_import') as wp_redirects;
```

Numbers should match your WooCommerce dashboard. If a customer used the same email on WP and signs up again on the new site, the importer skips the auth.users insert but still upserts their profile — no duplicates either way.

After this, you're done with WordPress for good. Long-form troubleshooting (rare 401s, slow media, etc.) is in `scripts/wp-import/README.md`.

---

## 5 · TCS UAT → production handover (per TCS, 3 working days)

Per the API doc: production access requires a passing UAT phase.

1. Get UAT (sandbox) credentials from TCS.
2. Set `TCS_BASE_URL=https://devconnect.tcscourier.com` (UAT URL) in Vercel.
3. Place a test order on the storefront.
4. As admin, open the order → pick **TCS** in the Shipment dropdown → **Book pickup via TCS**.
5. Verify:
   - You get a consignment number back (printed in the success banner).
   - A `shipments` row exists in Supabase.
   - The audit log records a `shipment.book` event.
6. Run the `Cancel shipment` button. Verify TCS responds OK and the row's status flips to `cancelled`.
7. Email TCS to confirm UAT passed; they'll hand over production creds.
8. Swap `TCS_BASE_URL` to `https://ociconnect.tcscourier.com` in Vercel → redeploy.

---

## 6 · Verify the rest of the audit fixes are live (10 min)

After §1 + §2 + §4 land, walk through this in a fresh browser tab:

| Check | Where | Expected |
|---|---|---|
| Apple-touch-icon | View source on `/` — find `<link rel="apple-touch-icon">` | Not present (Next auto-emits `/apple-icon` only when configured). Old `/icon.svg` is gone. |
| `?cat=` redirect | Visit `https://yellow-pink.vercel.app/shop?cat=Makeup` | URL bar shows `?category=Makeup` after the 301 |
| Noindex on private routes | `curl -I https://yellow-pink.vercel.app/checkout` and `view-source:/track`, `/thank-you`, `/forgot-password`, `/reset-password` | `<meta name="robots" content="noindex,nofollow">` present |
| Doubled title | Browser tab title at `/cart` and `/wishlist` | "Cart \| Yellow Pink" — single suffix |
| Trending search | Open search overlay on `/` | Trending list shows actual brands in your catalog, no longer hardcoded |
| GoTrueClient warning | Open DevTools Console on `/` | No "Multiple GoTrueClient instances" warnings |
| Audit log | Sign in as owner → edit anything (settings save, coupon delete, etc.) → `/admin/audit` | New row appears with actor + diff |
| Team perms display | `/admin/team` → existing staff member's permission pills | Each permission appears once, not duplicated |
| Orders RLS (SEV-0 retest) | DevTools Console: `fetch('https://cngsjtthiexcfpjpcpsg.supabase.co/rest/v1/orders?select=*', { headers: { apikey: '<anon>', Authorization: 'Bearer <anon>' }}).then(r=>r.json()).then(console.log)` | Returns `[]` (was leaking full PII before) |
| Coupons RLS retest | Same with `…/rest/v1/coupons?select=*` | Returns `[]` |
| Courier cron | Vercel Dashboard → **Cron Jobs** | Three jobs listed; `/api/cron/courier-sync` shows status "Active" |
| `/api/cron/courier-sync` smoke | `curl -H "Authorization: Bearer $CRON_SECRET" https://yellow-pink.vercel.app/api/cron/courier-sync` | `{ok: true, polled: 0, updated: 0, no_adapter_couriers: ['Other', ...]}` (until you set TCS env vars + have in-transit shipments) |

---

## 7 · What I CAN'T do (decisions / accounts you need to make)

These are still open from the audit + the courier work; flag which you want me to take next:

1. **More courier accounts** — Leopards / M&P / BlueEx all publish similar APIs. Tell me which one(s) you have a merchant account with and I'll add the adapter (~150 lines, follows the TCS template).

2. **TCS area-code admin job** — TCS exposes `/ecom/api/setup/areacode` and friends; right now I pass the consignee's city as a free-text `cityname` (TCS accepts this but the routing accuracy is slightly worse than a real city code). I can add a one-time admin button that fetches + caches the area-code list. Useful but not blocking.

3. **§4 limited-staff RBAC test** — needs you to create a temp staff member I can sign in as. Tell me the email + temp password and I'll run the full RBAC sweep (§4.1 / §4.2 / §4.3 from the test plan).

4. **§3.14 staff 2FA flow** — same constraint. Needs a non-owner staff account.

5. **§6 Lighthouse run** — needs a dedicated DevTools-driven browser session. I can do it but it has to be its own pass.

6. **`OWNER_EMAIL` value** — currently defaults to `sooviaan@gmail.com` (the merchant-side new-order notice recipient). Change to a team alias or your real ops inbox?

7. **The remaining audit-instrumentation gap** — `notifications-actions.ts` (mark-as-read) intentionally skipped because it'd flood the audit log with low-value rows. If you want it instrumented anyway, say the word.

---

## 8 · Order of operations the day you flip the switch

1. **Push code** (§1) — Vercel redeploys.
2. **Apply migration** (§2) — the SEV-0 stops leaking the second the policy lands.
3. **Run the four verification SQL queries** (§2 verify block).
4. **Test signup** (§3) — confirms the SEV-1 is unblocked.
5. **WP migration** (§4½) — `npm run wp-import`. Brings customers + orders + reviews + coupons + redirects across in one shot. Skip if you've already done this since the audit; the dry-run flag is your friend either way.
6. **Set env vars in Vercel** (§4) — anything missing from your secrets store.
7. **Walk the verification table** (§6) — about 10 minutes; tells you nothing else regressed.
8. **Set TCS env vars** when ready (§4 + §5) — courier UI lights up automatically.

Total wall-clock: ~40 min to fully clean. Without (5)–(8), you're still launch-ready — the courier system gracefully degrades to manual entry and the audit-fix migration alone closes the launch blockers.
