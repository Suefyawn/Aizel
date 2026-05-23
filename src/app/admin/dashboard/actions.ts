'use server';

import { revalidatePath } from 'next/cache';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { assertPermission } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit';

// ─── Config ─────────────────────────────────────────────────────────────────
const PH_PROJECT_ID = 429225;
const PH_BASE       = 'https://us.posthog.com';
const SENTRY_ORG    = 'trellee';
const SENTRY_PROJECT = 'aizel';

// `createClient` without explicit generics returns a client whose `.from()`
// inference treats every table as `never`, so .upsert / .insert payloads
// fail type-check. We don't ship generated DB types, so widen to a
// permissive shape — the runtime contract is owned by the analytics_cache
// migration.
type PermissiveSupabase = SupabaseClient<unknown, never, never, never, never>;

// ─── PostHog helpers ────────────────────────────────────────────────────────
async function phQuery(apiKey: string, sql: string) {
  const res = await fetch(`${PH_BASE}/api/projects/${PH_PROJECT_ID}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query: sql } }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`PostHog ${res.status}: ${await res.text()}`);
  return (await res.json()).results as unknown[][];
}

// Cast helper so a single `.upsert` payload isn't fighting the `never[]` inference.
function upsertCache(supabase: PermissiveSupabase, key: string, data: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from('analytics_cache') as any).upsert({
    key, data, updated_at: new Date().toISOString(),
  });
}

// ─── refreshPostHog ─────────────────────────────────────────────────────────
async function refreshPostHog(supabase: PermissiveSupabase): Promise<void> {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  if (!apiKey) throw new Error('POSTHOG_PERSONAL_API_KEY not configured');

  const W7  = `timestamp >= now() - interval 7 day`;
  const PV  = `event = '$pageview'`;
  // Exclude /admin from every panel — staff dashboard activity isn't
  // storefront traffic. (before_send in PostHogProvider stops new admin
  // events; this also drops any already in the 7-day window.)
  const NOT_ADMIN = `NOT startsWith(coalesce(properties.\`$pathname\`, ''), '/admin')`;

  // Pull every panel in parallel so the refresh stays under ~2 s even when
  // PostHog is slow. The four "core" stats keep the existing 'posthog' cache
  // entry shape so the existing widget stays backward-compatible.
  const [
    pvRows, uuRows, sessRows, trendRows,
    topPagesRows, topEventsRows, topReferrersRows,
    funnelRows,
    journeyRows, funnelBySourceRows, retentionRows,
  ] = await Promise.all([
    // ── core stats
    phQuery(apiKey, `SELECT count() FROM events WHERE ${PV} AND ${W7} AND ${NOT_ADMIN}`),
    phQuery(apiKey, `SELECT count(distinct distinct_id) FROM events WHERE ${PV} AND ${W7} AND ${NOT_ADMIN}`),
    phQuery(apiKey, `SELECT count(distinct properties.\`$session_id\`) FROM events WHERE ${PV} AND ${W7} AND ${NOT_ADMIN}`),
    phQuery(apiKey, `SELECT toString(toDate(timestamp)) as d, count() FROM events WHERE ${PV} AND ${W7} AND ${NOT_ADMIN} GROUP BY d ORDER BY d`),

    // ── top 10 pages (path + count + uniques)
    phQuery(apiKey, `
      SELECT properties.\`$pathname\` as path,
             count() as views,
             count(distinct distinct_id) as uniques
      FROM events
      WHERE ${PV} AND ${W7} AND ${NOT_ADMIN} AND properties.\`$pathname\` is not null
      GROUP BY path
      ORDER BY views DESC
      LIMIT 10
    `),

    // ── top 10 events (any kind, count + uniques)
    phQuery(apiKey, `
      SELECT event, count() as n, count(distinct distinct_id) as uniques
      FROM events
      WHERE ${W7} AND ${NOT_ADMIN}
      GROUP BY event
      ORDER BY n DESC
      LIMIT 10
    `),

    // ── top 10 referrers (initial referring_domain)
    phQuery(apiKey, `
      SELECT coalesce(nullIf(properties.\`$initial_referring_domain\`, ''), 'direct') as src,
             count(distinct distinct_id) as visitors
      FROM events
      WHERE ${PV} AND ${W7} AND ${NOT_ADMIN}
      GROUP BY src
      ORDER BY visitors DESC
      LIMIT 10
    `),

    // ── 5-step funnel: home_view → product_view → add_to_cart → begin_checkout → purchase
    // Use the simple session-based count of each event; conversion is the
    // ratio of step n+1 to step n. Not as accurate as PostHog's Funnel
    // insight, but lightweight and good enough for an at-a-glance chart.
    phQuery(apiKey, `
      SELECT
        countIf(event = '$pageview' AND properties.\`$pathname\` = '/')                    as home_view,
        countIf(event = '$pageview' AND startsWith(properties.\`$pathname\`, '/product/')) as product_view,
        countIf(event = 'add_to_cart')                                                     as add_to_cart,
        countIf(event = 'begin_checkout' OR (event = '$pageview' AND properties.\`$pathname\` = '/checkout')) as begin_checkout,
        countIf(event = 'purchase'      OR (event = '$pageview' AND properties.\`$pathname\` = '/thank-you')) as purchase
      FROM events
      WHERE ${W7}
    `),

    // ── Top 15 user journeys (4-page sequences per session)
    // Per-session, sort pageviews by timestamp and concat the first 4 paths.
    // Group identical journeys together and rank by session count.
    phQuery(apiKey, `
      SELECT journey, count() as sessions
      FROM (
        SELECT
          arrayStringConcat(
            arraySlice(arraySort(groupArray((timestamp, properties.\`$pathname\`))), 1, 4).2,
            ' → '
          ) as journey
        FROM events
        WHERE ${PV} AND ${W7} AND ${NOT_ADMIN} AND properties.\`$session_id\` IS NOT NULL
        GROUP BY properties.\`$session_id\`
      )
      WHERE journey != ''
      GROUP BY journey
      ORDER BY sessions DESC
      LIMIT 15
    `),

    // ── Funnel sliced by traffic source — top 8 sources by home view
    phQuery(apiKey, `
      SELECT
        coalesce(nullIf(properties.\`$initial_referring_domain\`, ''), 'direct') as source,
        countIf(event = '$pageview' AND properties.\`$pathname\` = '/')                    as home,
        countIf(event = '$pageview' AND startsWith(properties.\`$pathname\`, '/product/')) as product,
        countIf(event = 'add_to_cart')                                                     as cart,
        countIf(event = 'begin_checkout' OR (event = '$pageview' AND properties.\`$pathname\` = '/checkout')) as checkout,
        countIf(event = 'purchase'      OR (event = '$pageview' AND properties.\`$pathname\` = '/thank-you')) as purchase
      FROM events
      WHERE ${W7} AND ${NOT_ADMIN}
      GROUP BY source
      ORDER BY home DESC
      LIMIT 8
    `),

    // ── 4-week active-user curve (weekly retention proxy)
    phQuery(apiKey, `
      SELECT
        toString(toMonday(timestamp)) as week,
        count(distinct distinct_id)   as users
      FROM events
      WHERE event = '$pageview' AND timestamp >= now() - interval 28 day AND ${NOT_ADMIN}
      GROUP BY week
      ORDER BY week
    `),
  ]);

  // Build the shapes the widgets expect.
  const core = {
    pageviews:   Number(pvRows[0]?.[0]   ?? 0),
    uniqueUsers: Number(uuRows[0]?.[0]   ?? 0),
    sessions:    Number(sessRows[0]?.[0] ?? 0),
    trend: trendRows.map(([date, count]) => ({ date: String(date), count: Number(count) })),
  };

  const topPages = topPagesRows.map(([path, views, uniques]) => ({
    path: String(path), views: Number(views), uniques: Number(uniques),
  }));
  const topEvents = topEventsRows.map(([event, n, uniques]) => ({
    event: String(event), count: Number(n), uniques: Number(uniques),
  }));
  const topReferrers = topReferrersRows.map(([src, visitors]) => ({
    source: String(src), visitors: Number(visitors),
  }));
  const f = funnelRows[0] ?? [];
  const funnel = {
    steps: [
      { label: 'Home',     event: 'home_view',      count: Number(f[0] ?? 0) },
      { label: 'Product',  event: 'product_view',   count: Number(f[1] ?? 0) },
      { label: 'Add to cart', event: 'add_to_cart', count: Number(f[2] ?? 0) },
      { label: 'Checkout', event: 'begin_checkout', count: Number(f[3] ?? 0) },
      { label: 'Purchase', event: 'purchase',       count: Number(f[4] ?? 0) },
    ],
  };

  // Detect a >50% week-over-week drop in pageviews → notify. (Compare last 3 vs
  // first 3 days of the trend window — same row of data, cheap, no extra query.)
  const t = core.trend;
  if (t.length >= 6) {
    const recent = t.slice(-3).reduce((s, d) => s + d.count, 0);
    const prior  = t.slice(0, 3).reduce((s, d) => s + d.count, 0);
    if (prior > 100 && recent < prior * 0.5) {
      await notifyAdmin(supabase, {
        kind: 'posthog_drop',
        title: 'Traffic dip detected',
        body:  `Pageviews are down ${(100 - Math.round(recent / prior * 100))}% vs the start of the week (${prior} → ${recent}).`,
        link:  '/admin/dashboard',
        dedupKey: `posthog_drop:${new Date().toISOString().slice(0, 10)}`,
      });
    }
  }

  // ── Journey / funnel-by-source / retention reshape ────────────────────────
  const journeys = journeyRows.map(([journey, sessions]) => ({
    journey: String(journey),
    sessions: Number(sessions),
  }));

  const funnelBySource = funnelBySourceRows.map(([source, home, product, cart, checkout, purchase]) => ({
    source: String(source),
    home: Number(home),
    product: Number(product),
    cart: Number(cart),
    checkout: Number(checkout),
    purchase: Number(purchase),
  }));

  const retention = retentionRows.map(([week, users]) => ({
    week: String(week),
    users: Number(users),
  }));

  // ── Latest session recordings (separate endpoint, not HogQL) ──────────────
  // Best-effort: a failure here mustn't block the rest of the refresh.
  let recordings: Array<{ id: string; startTime: string; durationSeconds: number; viewerUrl: string }> = [];
  try {
    const recRes = await fetch(
      `${PH_BASE}/api/projects/${PH_PROJECT_ID}/session_recordings/?limit=10`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: 'no-store',
      },
    );
    if (recRes.ok) {
      const j = await recRes.json() as { results?: Array<{ id: string; start_time: string; recording_duration?: number }> };
      recordings = (j.results ?? []).map(r => ({
        id: r.id,
        startTime: r.start_time,
        durationSeconds: Math.round(r.recording_duration ?? 0),
        viewerUrl: `${PH_BASE}/project/${PH_PROJECT_ID}/replay/${r.id}`,
      }));
    }
  } catch {
    /* keep recordings empty on failure */
  }

  await Promise.all([
    upsertCache(supabase, 'posthog',                 core),
    upsertCache(supabase, 'posthog_top_pages',       { items: topPages }),
    upsertCache(supabase, 'posthog_top_events',      { items: topEvents }),
    upsertCache(supabase, 'posthog_top_referrers',   { items: topReferrers }),
    upsertCache(supabase, 'posthog_funnel',          funnel),
    upsertCache(supabase, 'posthog_journeys',        { items: journeys }),
    upsertCache(supabase, 'posthog_funnel_by_source',{ items: funnelBySource }),
    upsertCache(supabase, 'posthog_retention',       { items: retention }),
    upsertCache(supabase, 'posthog_recordings',      { items: recordings }),
  ]);
}

// ─── refreshSentry ──────────────────────────────────────────────────────────
interface SentryIssue {
  id: string; title: string; level: string; count: string;
  lastSeen: string; firstSeen?: string; permalink: string;
  metadata?: { value?: string }; tags?: Array<{ key: string; value: string }>;
}

async function refreshSentry(supabase: PermissiveSupabase): Promise<void> {
  const token = process.env.SENTRY_AUTH_TOKEN;
  if (!token) throw new Error('SENTRY_AUTH_TOKEN not configured');

  // Issues list — same shape we had, plus firstSeen so the dedup logic can
  // tell "brand-new issue today" from "still open from last week".
  const issuesRes = await fetch(
    `https://sentry.io/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/issues/?query=is:unresolved&limit=25`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
  );
  if (!issuesRes.ok) throw new Error(`Sentry ${issuesRes.status}: ${await issuesRes.text()}`);
  const issues = (await issuesRes.json()) as SentryIssue[];

  // 14-day error trend via the events-stats endpoint.
  const trendRes = await fetch(
    `https://sentry.io/api/0/organizations/${SENTRY_ORG}/events-stats/`
      + `?project=${SENTRY_PROJECT}&field=count()&statsPeriod=14d&interval=1d`
      + `&query=${encodeURIComponent('event.type:error')}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
  );
  let trend: { date: string; count: number }[] = [];
  if (trendRes.ok) {
    const json = await trendRes.json() as { data?: Array<[number, Array<{ count: number }>]> };
    trend = (json.data ?? []).map(([ts, buckets]) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      count: buckets.reduce((s, b) => s + (b?.count ?? 0), 0),
    }));
  }

  // Top affected URLs (best-effort — collapse the issue list by `url` tag).
  const urlCounts = new Map<string, number>();
  for (const i of issues) {
    const url = i.tags?.find(t => t.key === 'url')?.value;
    if (!url) continue;
    urlCounts.set(url, (urlCounts.get(url) ?? 0) + Number(i.count));
  }
  const topRoutes = [...urlCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([url, count]) => ({ url, count }));

  const data = {
    total:    issues.length,
    errors:   issues.filter(i => i.level === 'error' || i.level === 'fatal').length,
    warnings: issues.filter(i => i.level === 'warning').length,
    issues:   issues.slice(0, 10).map(i => ({
      id: i.id, title: i.title, level: i.level,
      count: i.count, lastSeen: i.lastSeen, permalink: i.permalink,
    })),
    topRoutes,
    trend,
  };

  // ── Notification dedup: only notify for issue ids we haven't seen before.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meta = supabase.from('analytics_meta') as any;
  const { data: prev } = await meta.select('value').eq('key', 'sentry_seen_ids').single();
  const seen: string[] = Array.isArray(prev?.value?.ids) ? prev.value.ids : [];
  const seenSet = new Set(seen);
  const newIssues = issues.filter(i => !seenSet.has(i.id));

  for (const issue of newIssues.slice(0, 10)) {
    await notifyAdmin(supabase, {
      kind: 'sentry_issue',
      title: `New ${issue.level} in Sentry`,
      body:  issue.title.slice(0, 220),
      link:  issue.permalink,
      dedupKey: `sentry_issue:${issue.id}`,
    });
  }

  // Persist the full current id set (truncated to the most recent 200 so the
  // row stays small).
  const allIds = issues.map(i => i.id).concat(seen).slice(0, 200);
  await meta.upsert({ key: 'sentry_seen_ids', value: { ids: [...new Set(allIds)] }, updated_at: new Date().toISOString() });

  await upsertCache(supabase, 'sentry', data);
}

// ─── Admin-notification helper ──────────────────────────────────────────────
interface NotifyInput {
  kind: 'sentry_issue' | 'posthog_spike' | 'posthog_drop';
  title: string;
  body: string;
  link: string;
  /** Idempotency key — we skip the insert if a row already exists with this
   *  value stashed in `entity_id`. Lets the refresher run repeatedly without
   *  duplicating the same notification. */
  dedupKey: string;
}

async function notifyAdmin(supabase: PermissiveSupabase, input: NotifyInput): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const notifs = supabase.from('admin_notifications') as any;
  const { data: existing } = await notifs
    .select('id')
    .eq('entity_id', input.dedupKey)
    .limit(1);
  if (existing && existing.length > 0) return;
  await notifs.insert({
    kind:      input.kind,
    title:     input.title,
    body:      input.body,
    link:      input.link,
    entity_id: input.dedupKey,
  });
}

// ─── Core refresh (no auth) ─────────────────────────────────────────────────
// Pure data-refresh path. Both the staff-facing server action and the
// CRON_SECRET-gated cron route call this. Auth/audit/revalidate is the
// caller's responsibility.
export async function refreshAnalyticsCore(): Promise<{ ok: boolean; errors: string[] }> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  ) as PermissiveSupabase;

  const results = await Promise.allSettled([
    refreshPostHog(supabase),
    refreshSentry(supabase),
  ]);

  const errors = results
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map(r => String(r.reason instanceof Error ? r.reason.message : r.reason));

  return { ok: errors.length === 0, errors };
}

// ─── Public action ──────────────────────────────────────────────────────────
export async function refreshAnalytics(): Promise<{ ok: boolean; errors?: string[] }> {
  // Auth gate: this action makes outbound calls to PostHog + Sentry (burning
  // quota) and writes to analytics_cache + admin_notifications via service
  // role. Without a check, an unauthenticated caller could DOS our metrics
  // and our inbox. Only staff with `analytics_refresh` (or owners) may run it.
  const session = await assertPermission('analytics_refresh');

  const { ok, errors } = await refreshAnalyticsCore();

  void logAudit(session, {
    action: 'analytics.refresh',
    entity: 'analytics_cache',
    diff: { ok, errors },
  });

  revalidatePath('/admin/dashboard');

  return ok ? { ok: true } : { ok: false, errors };
}
