// ============================================================================
// Vercel Cron: email the owner a low-stock digest.
//
// Lists every product at or below the 5-unit threshold so the owner gets a
// daily restock nudge without having to open the dashboard. sendLowStock-
// AlertEmail is a no-op when nothing is low, so a fully-stocked day is silent.
//
// Invoked by the consolidated daily cron (src/app/api/cron/daily).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendLowStockAlertEmail } from '@/lib/email';

const LOW_STOCK_THRESHOLD = 5;

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

  const { data, error } = await sb
    .from('products')
    .select('name, brand, stock, slug')
    .eq('track_inventory', true)
    .lte('stock', LOW_STOCK_THRESHOLD)
    .order('stock', { ascending: true })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const products = ((data ?? []) as Array<{ name: string; brand: string | null; stock: number; slug: string }>)
    .map(p => ({ name: p.name, brand: p.brand ?? '', stock: p.stock, slug: p.slug }));

  // No-op when nothing is low — sendLowStockAlertEmail returns early.
  await sendLowStockAlertEmail({ products });

  return NextResponse.json({ ok: true, lowStock: products.length });
}
