# QA Hand-off — Session 2 (2026-05-23)

**Scope:** Final pre-pause sweep covering everything shipped in this session plus a broad regression on the rest of the app.
**Expected effort:** ~90 minutes for a thorough pass.
**Sign-off goal:** clean enough that the project can sit idle for a week.

This document is **temporary** — once you sign off on this batch, feel free to delete it.

---

## 0 · Pre-flight (5 min)

Before touching anything, confirm the environment is in the expected state.

### 0.1 — Latest deploy is live in Mumbai

```bash
curl -sL -I -X POST https://www.yellowpink.pk/api/upload/review --max-time 8 \
  | grep -i 'x-vercel-id'
```

Expect the header value to contain `bom1` (Mumbai), e.g. `x-vercel-id: sfo1::bom1::xxxxx`. The middle segment is the compute region. If it still says `iad1` or `sfo1`, the bom1 deploy hasn't rolled out yet — wait 2-3 min and re-check.

### 0.2 — Logged-in test identities

You need three test contexts to cover everything below:

| Context | How |
|---|---|
| **Owner** | Login with the rotated owner password at `/admin/login` |
| **Limited staff** | Login as a staff member whose role is NOT Admin (use `/admin/team` as owner to grant a Newsletter-only role to a throwaway staff if you don't already have one) |
| **Anonymous storefront** | Open an incognito window; never log in |

### 0.3 — Test customer email

Use `it@onetouchmd.com` for any flow that requires an existing registered customer (e.g. forgot-password). It's the only confirmed real Auth user we tested in dev. `sooviaan@gmail.com` is **not** an Auth user — testing forgot-password with it will silently no-op (correct anti-enumeration behaviour).

---

## 1 · Critical verifications — fixes shipped this session

Run these first. Each maps to a specific change merged today.

### 1.1 — SEV-1: Anon RPC lockdown (PRs #178, #179)

**What changed:** 32 SECURITY DEFINER RPCs revoked from anon/authenticated; 15 storefront RPCs preserved.

**Check:**

```bash
# Should be 401
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST https://cngsjtthiexcfpjpcpsg.supabase.co/rest/v1/rpc/get_admin_users \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" -d '{}'

# Should be 200
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST https://cngsjtthiexcfpjpcpsg.supabase.co/rest/v1/rpc/search_products \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" -d '{"q":"test","lim":5}'
```

Spot-check 5 more of: `bulk_update_order_status`, `staff_directory`, `admin_pii_search`, `process_return`, `get_low_stock_alerts` → all 401.

Then log in as owner and open: `/admin/dashboard`, `/admin/users`, `/admin/analytics`, `/admin/orders`, `/admin/inventory`, `/admin/returns`, `/admin/audit` — none should 500.

### 1.2 — SEV-2: Upstash rate-limiting (post bom1)

**What changed:** Vercel functions moved to Mumbai (`bom1`) so Upstash calls finish in ~5ms instead of ~250ms; previously the limiter was failing open on timeout.

**Check:**

```bash
for i in $(seq 1 12); do
  curl -sL -o /dev/null -w "req $i → %{http_code}\n" \
    -X POST https://www.yellowpink.pk/api/upload/review --max-time 10
done
```

Expect: first 2-5 requests return `500` (the route crashes on empty body, but that's AFTER the limiter passed — counter is decaying from the previous probe window), then the rest return `429`. The transition should be sharp.

Bonus: try with a real auth flow:

```bash
for i in $(seq 1 8); do
  curl -s -o /dev/null -w "%{http_code} " -X POST https://www.yellowpink.pk/account/login \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d 'email=does-not-exist@example.com&password=wrong'
done
echo
```

Expect a 429 to appear by request 6 (authLimiter = 5/min).

### 1.3 — SEV-3: Audit log identity (PR #180)

**What changed:** Owner sessions now stamp `actor_id` / `actor_email` with `OWNER_EMAIL` (`sooviaan@gmail.com`) instead of the literal string `"owner"`. Notification recipient create/delete now write `entity_id` and email diff.

**Check:**

1. Log in as owner
2. Settings → Notifications → add a throwaway recipient `qa-test@example.com` for `order.new`
3. Open `/admin/audit` (Activity log under Store group)
4. The new row should have:
   - `actor_email` = `sooviaan@gmail.com` (real email, not `"owner"`)
   - `entity_id` = a real UUID
   - `diff` contains `{ email, events }`
5. Delete that throwaway recipient
6. The delete audit row should have:
   - `actor_email` = `sooviaan@gmail.com`
   - `entity_id` = the same UUID
   - `diff` = `{ email: "qa-test@example.com" }`

### 1.4 — SEV-4: Sidebar grouping (PR #181)

- **Marketing** group should contain: Promos, Blog, Reviews, Newsletter, **Email log** (in that order)
- **Store** group should contain ONLY: Activity log, Team, Settings
- A staff member with `newsletter` perm but NOT `settings` should NOT see Email log

### 1.5 — SEV-4: PostHog `add_to_cart` (PR #181)

**What changed:** `PostHogProvider` now listens for `yp:track` window events and forwards to `posthog.capture`. The dashboard's `add_to_cart` funnel step was reading 0; should now populate.

**Check:**

1. Storefront in **incognito** → accept cookie consent banner
2. Add 3 different items to cart from different surfaces (a PDP, a product tile, the FBT widget)
3. PostHog → **Activity** → filter `event = add_to_cart` → expect 3 events within 60s
4. Each payload should include `product_id`, `product_name`, `price`, `qty`, `currency: "PKR"`
5. Wait for next analytics refresh (or `/admin/analytics` → "Refresh analytics" button); `/admin/dashboard` funnel "Add to cart" step should now be non-zero

### 1.6 — SEV-4: FK indexes (PR #181, migration 132)

No user-visible check. Confirm via:

```sql
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'inventory_ledger_return_id_idx',
    'orders_vendor_id_idx',
    'reorder_subscriptions_product_id_idx'
  );
```

Should return 3 rows. Supabase Advisor warnings for these FKs should be gone.

### 1.7 — Mumbai region migration (PR #182)

Already verified in 0.1. Side benefits to spot-check during the rest of QA:

- Admin pages should feel notably snappier on first-paint
- Storefront PDP/cart/checkout page TTFB should be sub-300ms from Pakistan

### 1.8 — `after()` fix for fire-and-forget emails (PR #183)

**What changed:** Newsletter welcome + staff temp-password sends now use `after()` from `next/server` instead of bare `void`. The lambda is no longer terminated mid-write to `email_log`.

**Check:**

1. Storefront footer → newsletter signup with a **new email** you can read (e.g. `qa-check+1@<your-domain>`). The newsletter table dedupes by email, so reusing prior addresses will skip the welcome send.
2. Wait ~10 seconds
3. Verify in DB:

```sql
SELECT recipient, kind, status, resend_id, created_at, delivered_at, opened_at
FROM email_log
WHERE recipient = '<your test email>'
ORDER BY created_at DESC LIMIT 1;
```

Expected sequence over ~60s:
- Row appears with `status='sent'`, `resend_id` populated, `delivered_at` null
- Within ~30s: `delivered_at` populates (this proves Resend webhook → handler → DB write all flow)
- If you open the email in your inbox: `opened_at` populates within ~60s
- If you click any link in the email: `clicked_at` populates

If you only see `sent` but no `delivered_at` after 60s, the Resend webhook isn't reaching us — check Resend dashboard → Webhooks → the endpoint should be `https://www.yellowpink.pk/api/webhooks/resend` and recent attempts should show 200 responses.

### 1.9 — Reset-password page (PR #184)

**What changed:** Page used to spin forever on "Verifying reset link…" because it only handled the legacy hash flow, not modern PKCE `?code=`. Now handles both, with explicit timeout + visible errors.

**Check:**

1. Log out (close incognito + reopen if needed)
2. `/forgot-password` → enter `it@onetouchmd.com`
3. Submit; expect "Check your inbox" success state
4. Open the email and click the reset button
5. Land on `/reset-password?code=...` → should show the **"Set new password"** form within ~500 ms (NOT the spinner)
6. Enter a new password twice; submit
7. Should redirect to `/account` within 2 sec

**Negative test:**

1. Wait until the link is older than ~1 hour (Supabase default token lifetime) OR click an already-used link
2. Should now show a clear error: "This reset link is invalid or has expired" with a "Request a new link" button — NOT the spinner

---

## 2 · Storefront golden paths (~25 min)

| # | Flow | Expected |
|---|---|---|
| 2.1 | Home → category → PDP → add to cart → cart page → checkout → place COD order | Order appears in `/admin/orders` with status `pending`; customer receives confirmation email; merchant receives new-order email |
| 2.2 | Search using brand, partial word, and a typo | Each returns relevant results; PostHog `search` event fires |
| 2.3 | PDP with variants (shade or size) — pick one, switch, add | Cart line shows variant label; stock cap respected on the variant |
| 2.4 | Wishlist add → remove → "add all to cart" | All transitions work |
| 2.5 | Apply a valid coupon, then an invalid one at cart | Valid applies discount; invalid shows error toast |
| 2.6 | Newsletter signup with fresh email (verifies 1.8) | Welcome email arrives, `email_log` row lands |
| 2.7 | Account flow: register → confirm → log in → place order → view in /account/orders | All steps work; order shows in history |
| 2.8 | Forgot password → reset → log in with new password | New flow works end-to-end (verifies 1.9) |
| 2.9 | Returns: open a past order under /account/orders, file a return request | Return appears in `/admin/returns` |
| 2.10 | 404 / empty states: `/product/does-not-exist`, `/blog/does-not-exist`, search `zzzzz` | Clean empty states, no stack traces, no console errors |

---

## 3 · Admin sweep (~25 min)

Log in as **owner** for the main pass, then re-sample 2-3 surfaces as **limited staff** to confirm permission gating.

| Surface | Smoke check |
|---|---|
| Dashboard | All widgets render (Top pages, Latest recordings, Funnel, Sales 7-day, Sentry); add-to-cart funnel step is non-zero |
| Orders | Filter by status; filter by vendor (uses new index); bulk-update 2 orders |
| Products | Create a draft, publish, edit price, archive, delete |
| Inventory | Adjust stock for 1 product; verify ledger row + audit_log row |
| Vendors | Open vendor list, check vendor detail page |
| Returns | Approve one, reject one |
| Customers | Filter by segment; open one detail page |
| Segments | Sample 1 segment, verify count looks right |
| Coupons | Create a 10%-off code with expiry; disable it |
| Promos | Add a promo banner to home; verify it shows on storefront |
| Blog | Draft a post, publish, edit, delete |
| Reviews | Approve one queued review, reject another |
| Newsletter | Compose a test campaign; verify campaign list shows it |
| Email log | Filter by event type, by recipient; the 4-stat header should show real open-rate % once 1.8 has fired a delivered event |
| Activity log | New rows show real OWNER_EMAIL (regression check on 1.3) |
| Team | Owner can add a staff member; setting permissions works; remove the test staff |
| Settings | Save a change in 2-3 different sections; verify audit row written for each |
| Settings → Integrations | Resend card should be "Configured" (✓ all three vars); other cards reflect actual env state |

### 3a · Permission boundary sanity

Log in as a **limited staff** (e.g. Newsletter-only role):
- Sidebar should hide everything they don't have perms for
- Direct-URL to `/admin/users` should redirect to `/admin/no-access` or show "no access" component
- `/admin/team` and `/admin/audit` should be owner-only

---

## 4 · Cross-cutting (~10 min)

| Check | How | Expected |
|---|---|---|
| Supabase advisors | `get_advisors(security)` + `(performance)` | No new ERROR-level findings since last sweep |
| Sentry | Last 24h error count | No spike; no new unique issue types from today's PRs |
| PostHog Replay | "Latest recordings" widget on `/admin/dashboard` | Shows real recordings (now that Replay is enabled) |
| Resend webhook flow | After firing 1.8's newsletter signup, check Resend Dashboard → Webhooks → recent attempts | 200 responses to `/api/webhooks/resend` |
| Sitemap + robots | `curl https://www.yellowpink.pk/sitemap.xml` and `/robots.txt` | Sitemap 200 with product URLs; robots.txt disallows `/admin/` and `/api/` |
| Service worker | DevTools → Application → Service Workers | Active, version `yp-v1`, scope `/` |
| Both domains | Hit `yellowpink.pk` AND `yellowpink.com.pk` | Both serve traffic (one redirects to the other or both serve identically) |
| Mobile viewport | Storefront + admin on a 375×667 viewport in DevTools | No horizontal scroll; sidebar collapses |

### 4a · SQL sanity probes

```sql
-- email_log open-rate over last 30d (after 1.8 fires a real delivered event)
SELECT
  count(*) FILTER (WHERE sent_at IS NOT NULL)      AS sent,
  count(*) FILTER (WHERE delivered_at IS NOT NULL) AS delivered,
  count(*) FILTER (WHERE opened_at IS NOT NULL)    AS opened,
  count(*) FILTER (WHERE clicked_at IS NOT NULL)   AS clicked
FROM email_log
WHERE created_at > now() - interval '30 days';

-- audit_log: confirm new rows have real OWNER_EMAIL
SELECT actor_kind, actor_id, actor_email, action, created_at
FROM audit_log
WHERE created_at > now() - interval '2 hours'
  AND actor_kind = 'owner'
ORDER BY created_at DESC
LIMIT 5;
-- Every row should show actor_email = 'sooviaan@gmail.com' (not literal "owner")

-- audit_log: notification recipient create should now have entity_id
SELECT action, entity_id, diff, created_at
FROM audit_log
WHERE action IN ('notification_recipient.create', 'notification_recipient.delete')
  AND created_at > now() - interval '2 hours'
ORDER BY created_at DESC;
-- create: entity_id not null, diff has {email, events}
-- delete: entity_id not null, diff has {email}

-- FK indexes present
SELECT indexname FROM pg_indexes
WHERE indexname IN (
  'inventory_ledger_return_id_idx',
  'orders_vendor_id_idx',
  'reorder_subscriptions_product_id_idx'
);
-- Expect 3 rows.
```

---

## 5 · Known gaps & deferred items

Pre-flagged, don't re-report.

| Item | Why it's open |
|---|---|
| **HIBP / leaked-password protection** | Requires Supabase Pro plan. Min password length raised to 8 as a partial mitigation. Revisit on upgrade. |
| **`pg_net` / `pg_trgm` / `citext` in `public` schema** | Deferred — high-risk to move. `citext` is used as column types; `pg_trgm` provides search operators. Move needs careful staging. |
| **~8 remaining unindexed FKs** on advisor | Lower-impact than the 3 we just fixed. Future batch. |
| **Several unused indexes** still on advisor | No harm in keeping them; deferred. |
| **`void logAudit(...)` calls** | Same fire-and-forget shape as the email bug, but `audit_log` writes are landing in practice (single fast DB insert vs the email's Resend-then-DB chain). Belt-and-braces fix optional. |
| **Supabase Preview branch "MIGRATIONS_FAILED"** | Pre-existing CI red on the Supabase Preview Branches integration. Production migrations apply cleanly via MCP. Needs preview-branch reset, not a code fix. Doesn't block any merge. |
| **`OWNER_EMAIL` fallback to literal `"owner"`** | Code-level fallback only if env var is unset. Production has it set. |

---

## 6 · 10-minute smoke shortlist

If you're time-pressed, do **just these six** and call it:

1. **Pre-flight 0.1** — confirm `bom1` is live
2. **1.2** — fire a burst at `/api/upload/review`; see 429s
3. **1.5** — incognito storefront add-to-cart × 3; check PostHog has the events
4. **1.8** — newsletter signup with a fresh email; check `email_log` populates including `delivered_at` within 60s
5. **1.9** — `it@onetouchmd.com` forgot-password → click link → reach the form (not the spinner)
6. **2.1** — full happy-path order: home → PDP → add → checkout → place COD order. Check `/admin/orders` for the new order + audit row + confirmation email

If all six pass, the rest is overwhelmingly likely to pass too. Sign off.

---

## 7 · Severity legend for findings

If anything fails, log it with:

- **🔴 SEV-1** — security exposure, data loss, full broken flow on a critical path
- **🟠 SEV-2** — broken flow on a non-critical path, or a security mitigation missing
- **🟡 SEV-3** — visible bug that doesn't block the user, data-integrity issue without exposure
- **🟢 SEV-4** — polish, UX paper-cuts, copy nits, performance under load

Don't waste time on SEV-4 polish for this pass — the goal is "safe to leave for a week", not "perfect."

---

## 8 · Sign-off

Once you've worked through this, leave a one-line note in chat:

> "QA pass 2 complete — X SEV-1, Y SEV-2, Z SEV-3 findings logged. Safe to pause."

Or if everything's clean: just "All green, pausing."

---

*Generated 2026-05-23 by Claude Code session covering PRs #178-184 + bom1 region migration + Upstash configuration + external Supabase/PostHog/Resend setup.*
