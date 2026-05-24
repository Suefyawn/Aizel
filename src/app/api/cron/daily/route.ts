// ============================================================================
// Consolidated daily cron. Runs eight jobs sequentially:
//   1. abandoned-cart       — drip emails to carts left for 24 h / 72 h
//   2. back-in-stock        — notify watchers whose product came back
//   3. courier-sync         — poll courier APIs for in-transit shipments
//   4. subscription-reorder — reorder reminders for due Subscribe & Save subs
//   5. review-requests      — ask for reviews on orders delivered 3–30 days ago
//   6. win-back             — nudge customers who haven't reordered in 60–90 days
//   7. low-stock            — email the owner a low-stock restock digest
//   8. analytics-refresh    — refresh PostHog + Sentry dashboard widgets
//
// Vercel Hobby allows only 2 cron entries per project and only at
// daily-or-less-frequent schedules. The previous setup (three crons,
// one hourly) tripped both limits, so the deploy was rejected before a
// build event ever fired. This route consolidates everything into one
// vercel.json cron entry and delegates to the three existing route
// handlers via in-process fetch — keeps the per-job logic untouched.
//
// Upgrade path: when the project moves to Vercel Pro, split this back
// into three crons (`abandoned-cart` + `back-in-stock` daily, plus
// `courier-sync` every 30 min) for fresher tracking updates.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Bump the function timeout — courier-sync alone can touch up to 200
// shipments × 1 API round-trip each; combined with the two email jobs
// the default 10 s budget is too tight.
export const maxDuration = 60;

function authorize(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return req.headers.get('authorization') === `Bearer ${expected}`;
}

interface SubJobResult {
  job: string;
  ok: boolean;
  status: number;
  ms: number;
  body?: unknown;
  error?: string;
}

async function runJob(req: NextRequest, path: string): Promise<SubJobResult> {
  const t0 = Date.now();
  try {
    const url = new URL(path, req.url);
    const res = await fetch(url, {
      method: 'GET',
      headers: { authorization: req.headers.get('authorization') ?? '' },
      // No caching — these are mutating jobs.
      cache: 'no-store',
    });
    let body: unknown = null;
    try { body = await res.json(); } catch { /* non-JSON response */ }
    return { job: path, ok: res.ok, status: res.status, ms: Date.now() - t0, body };
  } catch (err) {
    return {
      job: path, ok: false, status: 0, ms: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Run sequentially so we don't blow the 60 s budget with parallel
  // long-runs, and so a failure in one job doesn't abort the others.
  const results: SubJobResult[] = [];
  results.push(await runJob(req, '/api/cron/abandoned-cart'));
  results.push(await runJob(req, '/api/cron/back-in-stock'));
  results.push(await runJob(req, '/api/cron/courier-sync'));
  results.push(await runJob(req, '/api/cron/subscription-reorder'));
  results.push(await runJob(req, '/api/cron/review-requests'));
  results.push(await runJob(req, '/api/cron/win-back'));
  results.push(await runJob(req, '/api/cron/low-stock'));
  results.push(await runJob(req, '/api/cron/analytics-refresh'));

  const allOk = results.every(r => r.ok);
  return NextResponse.json(
    { ok: allOk, ran: results.length, results },
    { status: allOk ? 200 : 207 },
  );
}
