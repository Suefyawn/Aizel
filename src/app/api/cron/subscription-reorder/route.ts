// ============================================================================
// Vercel Cron: send reorder-reminder emails for due Subscribe & Save records.
//
// Scans reorder_subscriptions for active rows whose next_reminder_at has
// fallen due, emails the customer a nudge (with the SUBSCRIBE10 code), then
// rolls next_reminder_at forward by interval_days so the reminder recurs.
//
// Invoked by the consolidated daily cron (src/app/api/cron/daily).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendReorderReminderEmail } from '@/lib/email';
import { brandPlusName } from '@/lib/product-display';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://aizel.co.uk';
const DAY_MS = 86_400_000;

interface DueRow {
  id: string;
  email: string;
  interval_days: number;
  reminder_count: number;
  products: { brand: string | null; name: string; slug: string; image_url: string | null } | null;
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

  const nowIso = new Date().toISOString();
  const { data, error } = await sb
    .from('reorder_subscriptions')
    .select('id, email, interval_days, reminder_count, products(brand, name, slug, image_url)')
    .eq('status', 'active')
    .lte('next_reminder_at', nowIso)
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as unknown as DueRow[];
  if (rows.length === 0) return NextResponse.json({ ok: true, scanned: 0, sent: 0 });

  let sent = 0;
  for (const row of rows) {
    // Product deleted out from under the subscription — skip; row is harmless.
    if (!row.products) continue;

    await sendReorderReminderEmail({
      email: row.email,
      product_name: brandPlusName(row.products.brand, row.products.name),
      product_url: `${SITE_URL}/product/${row.products.slug}`,
      image_url: row.products.image_url ?? undefined,
      interval_days: row.interval_days,
    });

    await sb.from('reorder_subscriptions')
      .update({
        next_reminder_at: new Date(Date.now() + row.interval_days * DAY_MS).toISOString(),
        last_reminded_at: nowIso,
        reminder_count: row.reminder_count + 1,
      })
      .eq('id', row.id);
    sent++;
  }

  return NextResponse.json({ ok: true, scanned: rows.length, sent });
}
