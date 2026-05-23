// ============================================================================
// Vercel Cron: ask customers to review orders delivered 3–30 days ago.
//
// The delivery timestamp lives in order_events (to_status = 'delivered'),
// not on orders. This job finds delivered events inside the 3–30 day
// window, emails each customer a review nudge linking every purchased
// product to its PDP review form, then stamps orders.review_request_sent_at
// so nobody is asked twice. Older deliveries are skipped — a "how was it?"
// for a months-old order reads as spam.
//
// Invoked by the consolidated daily cron (src/app/api/cron/daily).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendReviewRequestEmail } from '@/lib/email';
import { brandPlusName } from '@/lib/product-display';

const DAY_MS = 86_400_000;
const MAX_PRODUCTS = 6;

interface OrderItem {
  name?: string;
  brand?: string | null;
  slug?: string;
  image_url?: string | null;
}

interface OrderRow {
  id: string;
  order_number: string;
  email: string | null;
  first_name: string | null;
  items: OrderItem[] | null;
}

async function authorize(req: NextRequest): Promise<boolean> {
  // P1: fail closed if CRON_SECRET isn't set.
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return req.headers.get('authorization') === `Bearer ${expected}`;
}

export async function GET(req: NextRequest) {
  if (!(await authorize(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const now = Date.now();
  const windowOpen = new Date(now - 30 * DAY_MS).toISOString();
  const windowClose = new Date(now - 3 * DAY_MS).toISOString();

  // Orders whose delivery event landed in the 3–30 day window.
  const { data: events, error: evErr } = await sb
    .from('order_events')
    .select('order_id')
    .eq('to_status', 'delivered')
    .gte('created_at', windowOpen)
    .lte('created_at', windowClose)
    .limit(500);
  if (evErr) return NextResponse.json({ error: evErr.message }, { status: 500 });

  const orderIds = Array.from(new Set((events ?? []).map(e => e.order_id as string)));
  if (orderIds.length === 0) return NextResponse.json({ ok: true, scanned: 0, sent: 0 });

  // Still delivered, still has an email, not already asked.
  const { data: orders, error: orderErr } = await sb
    .from('orders')
    .select('id, order_number, email, first_name, items')
    .in('id', orderIds)
    .eq('status', 'delivered')
    .is('review_request_sent_at', null);
  if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 });

  const rows = (orders ?? []) as OrderRow[];
  if (rows.length === 0) return NextResponse.json({ ok: true, scanned: 0, sent: 0 });

  let sent = 0;
  for (const order of rows) {
    if (!order.email) continue;

    // Dedupe purchased products by slug; only sluggable items get a link.
    const seen = new Set<string>();
    const products: { name: string; slug: string; image_url?: string | null }[] = [];
    for (const item of order.items ?? []) {
      if (!item.slug || !item.name || seen.has(item.slug)) continue;
      seen.add(item.slug);
      products.push({
        name: brandPlusName(item.brand, item.name),
        slug: item.slug,
        image_url: item.image_url ?? null,
      });
      if (products.length >= MAX_PRODUCTS) break;
    }
    if (products.length === 0) continue;

    await sendReviewRequestEmail({
      email: order.email,
      first_name: order.first_name ?? undefined,
      order_number: order.order_number,
      products,
    });

    await sb.from('orders')
      .update({ review_request_sent_at: new Date().toISOString() })
      .eq('id', order.id);
    sent++;
  }

  return NextResponse.json({ ok: true, scanned: rows.length, sent });
}
