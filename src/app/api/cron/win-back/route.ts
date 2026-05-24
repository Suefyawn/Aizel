// ============================================================================
// Vercel Cron: win-back email for lapsed customers.
//
// Aizel sells consumables on a natural 6-8 week reorder cycle, so customers
// whose last delivered order sits in the 60–90 day window are the sweet spot
// for a "we miss you" nudge. The job:
//
//   1. Pulls delivered orders created 60–90 days ago that haven't already
//      had a win-back email sent (win_back_sent_at IS NULL).
//   2. For each, checks the customer hasn't placed a follow-up order since
//      (joins by user_id || email so customers who deleted their account
//      still get filtered out).
//   3. For each that survives, picks one representative product from their
//      last order, fires the email, and stamps win_back_sent_at so the
//      next cron run skips them.
//
// Daily cap: 100 orders to keep the burst sane and the Resend rate-limit
// happy. With 100 deliveries/day the steady state is ~100 win-backs/day
// fired ~60 days out — well within any reasonable plan.
//
// Invoked by the consolidated daily cron (src/app/api/cron/daily).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendWinBackEmail } from '@/lib/email';
import { brandPlusName } from '@/lib/product-display';

const DAY_MS = 86_400_000;
const WINDOW_MIN_DAYS = 60;
const WINDOW_MAX_DAYS = 90;
const DAILY_CAP = 100;

interface OrderItem {
  name?: string;
  brand?: string | null;
  slug?: string;
  image_url?: string | null;
}

interface OrderRow {
  id: string;
  email: string | null;
  first_name: string | null;
  user_id: string | null;
  created_at: string;
  items: OrderItem[] | null;
}

async function authorize(req: NextRequest): Promise<boolean> {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return req.headers.get('authorization') === `Bearer ${expected}`;
}

export async function GET(req: NextRequest) {
  if (!(await authorize(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Skip cleanly when Supabase env vars aren't set (demo mode) — the cron
  // still returns 200 so the daily aggregator doesn't 207 because of an
  // intentionally-disabled sub-job.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ ok: true, skipped: 'supabase-not-configured' });

  const sb = createClient(url, key, { auth: { persistSession: false } });

  const now = Date.now();
  const windowOldest = new Date(now - WINDOW_MAX_DAYS * DAY_MS).toISOString();
  const windowYoungest = new Date(now - WINDOW_MIN_DAYS * DAY_MS).toISOString();

  const { data: orders, error: orderErr } = await sb
    .from('orders')
    .select('id, email, first_name, user_id, created_at, items')
    .eq('status', 'delivered')
    .is('win_back_sent_at', null)
    .gte('created_at', windowOldest)
    .lte('created_at', windowYoungest)
    .order('created_at', { ascending: true })
    .limit(DAILY_CAP * 3); // pull a buffer; we'll filter down before sending

  if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 });
  const rows = (orders ?? []) as OrderRow[];
  if (rows.length === 0) return NextResponse.json({ ok: true, scanned: 0, sent: 0 });

  // Dedupe to one candidate-order per customer (keep most recent). A
  // customer who placed 3 orders in the 60-90 day window otherwise gets
  // 3 emails today — we only want one.
  const byCustomer = new Map<string, OrderRow>();
  for (const o of rows) {
    const key = o.user_id ?? o.email ?? o.id;
    const existing = byCustomer.get(key);
    if (!existing || existing.created_at < o.created_at) byCustomer.set(key, o);
  }
  const candidates = Array.from(byCustomer.values());

  // Skip anyone whose most-recent order is AFTER the candidate window —
  // they've already come back, no need for a win-back.
  const userIds = candidates.map(c => c.user_id).filter((v): v is string => !!v);
  const emails  = candidates.map(c => c.email).filter((v): v is string => !!v);
  const recentByUser: Record<string, string> = {};
  const recentByEmail: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: recent } = await sb
      .from('orders')
      .select('user_id, created_at')
      .in('user_id', userIds)
      .gte('created_at', windowYoungest)
      .order('created_at', { ascending: false });
    for (const r of (recent ?? []) as Array<{ user_id: string; created_at: string }>) {
      if (!recentByUser[r.user_id]) recentByUser[r.user_id] = r.created_at;
    }
  }
  if (emails.length > 0) {
    const { data: recent } = await sb
      .from('orders')
      .select('email, created_at')
      .in('email', emails)
      .gte('created_at', windowYoungest)
      .order('created_at', { ascending: false });
    for (const r of (recent ?? []) as Array<{ email: string; created_at: string }>) {
      if (!recentByEmail[r.email]) recentByEmail[r.email] = r.created_at;
    }
  }

  const eligible = candidates.filter(c => {
    if (c.user_id && recentByUser[c.user_id]) return false;
    if (c.email && recentByEmail[c.email])    return false;
    return Boolean(c.email);
  }).slice(0, DAILY_CAP);

  let sent = 0;
  for (const order of eligible) {
    if (!order.email) continue;
    const daysSince = Math.floor((now - new Date(order.created_at).getTime()) / DAY_MS);

    // First sluggable item from their last order — gives the email a
    // visual anchor without us having to fetch a brand new product.
    const firstProduct = (order.items ?? []).find(i => i.slug && i.name);
    const lastProduct = firstProduct
      ? {
          name: brandPlusName(firstProduct.brand, firstProduct.name!),
          slug: firstProduct.slug!,
          image_url: firstProduct.image_url ?? null,
        }
      : undefined;

    await sendWinBackEmail({
      email: order.email,
      first_name: order.first_name ?? undefined,
      days_since: daysSince,
      last_product: lastProduct,
    });

    await sb.from('orders')
      .update({ win_back_sent_at: new Date().toISOString() })
      .eq('id', order.id);
    sent++;
  }

  return NextResponse.json({ ok: true, scanned: candidates.length, sent });
}
