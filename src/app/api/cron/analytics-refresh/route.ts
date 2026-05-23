// ============================================================================
// Vercel Cron entry point — refreshes the analytics_cache rows that back the
// admin dashboard widgets (PostHog + Sentry panels). The staff-facing
// `refreshAnalytics()` server action does the same work but gates on
// `assertPermission('analytics_refresh')`; this route uses CRON_SECRET auth
// instead so it can run unattended.
//
// Fanned out from `/api/cron/daily` so the cache doesn't go stale between
// human refreshes — the dashboard widgets were showing day-old data when
// staff hadn't visited the page since the last refresh.
//
// Required env:
//   CRON_SECRET                 — Bearer secret shared with vercel.json
//   POSTHOG_PERSONAL_API_KEY    — used by refreshPostHog (optional; skipped if missing)
//   SENTRY_AUTH_TOKEN           — used by refreshSentry  (optional; skipped if missing)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { refreshAnalyticsCore } from '@/app/admin/dashboard/actions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorize(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return req.headers.get('authorization') === `Bearer ${expected}`;
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const result = await refreshAnalyticsCore();
  return NextResponse.json(result, { status: result.ok ? 200 : 207 });
}
