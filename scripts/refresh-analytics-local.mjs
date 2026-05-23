// Local one-off: populate public.analytics_cache from PostHog + Sentry,
// without going through the deployed `/api/admin/refresh-analytics`
// server action. Used when Vercel env vars aren't set yet but local
// `.env.local` has the keys.
//
// Usage:
//   node --env-file=.env.local scripts/refresh-analytics-local.mjs

const PH_PROJECT_ID = 429225;
const PH_BASE = 'https://us.posthog.com';
const SENTRY_ORG = 'trellee';
const SENTRY_PROJECT = 'aizel';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PH_KEY = process.env.POSTHOG_PERSONAL_API_KEY;
const SENTRY_TOKEN = process.env.SENTRY_AUTH_TOKEN;

if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase env missing');

async function phQuery(sql) {
  const r = await fetch(`${PH_BASE}/api/projects/${PH_PROJECT_ID}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PH_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query: sql } }),
  });
  if (!r.ok) throw new Error(`PostHog ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.results;
}

async function sbUpsert(table, payload) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=key`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
}

async function refreshPostHog() {
  if (!PH_KEY) {
    console.log('Skip PostHog — POSTHOG_PERSONAL_API_KEY not set');
    return;
  }
  const W7 = 'timestamp >= now() - interval 7 day';
  const PV = "event = '$pageview'";
  const [pv, uu, sess, trend] = await Promise.all([
    phQuery(`SELECT count() FROM events WHERE ${PV} AND ${W7}`),
    phQuery(`SELECT count(distinct distinct_id) FROM events WHERE ${PV} AND ${W7}`),
    phQuery(`SELECT count(distinct properties.\`$session_id\`) FROM events WHERE ${PV} AND ${W7}`),
    phQuery(`SELECT toString(toDate(timestamp)) as d, count() FROM events WHERE ${PV} AND ${W7} GROUP BY d ORDER BY d`),
  ]);
  const data = {
    pageviews: Number(pv[0]?.[0] ?? 0),
    uniqueUsers: Number(uu[0]?.[0] ?? 0),
    sessions: Number(sess[0]?.[0] ?? 0),
    trend: trend.map(([date, count]) => ({ date: String(date), count: Number(count) })),
  };
  console.log('PostHog ✓', JSON.stringify(data));
  await sbUpsert('analytics_cache', { key: 'posthog', data, updated_at: new Date().toISOString() });
}

async function refreshSentry() {
  if (!SENTRY_TOKEN) {
    console.log('Skip Sentry — SENTRY_AUTH_TOKEN not set');
    return;
  }
  const r = await fetch(
    `https://sentry.io/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/issues/?query=is:unresolved&limit=25`,
    { headers: { Authorization: `Bearer ${SENTRY_TOKEN}` } },
  );
  if (!r.ok) throw new Error(`Sentry ${r.status}: ${await r.text()}`);
  const issues = await r.json();
  const data = {
    total: issues.length,
    errors: issues.filter(i => i.level === 'error' || i.level === 'fatal').length,
    warnings: issues.filter(i => i.level === 'warning').length,
    issues: issues.slice(0, 10).map(i => ({
      id: i.id, title: i.title, level: i.level,
      count: i.count, lastSeen: i.lastSeen, permalink: i.permalink,
    })),
  };
  console.log('Sentry ✓', JSON.stringify(data));
  await sbUpsert('analytics_cache', { key: 'sentry', data, updated_at: new Date().toISOString() });
}

await refreshPostHog();
await refreshSentry();
console.log('done');
