// ============================================================================
// Vercel Cron: fire back-in-stock emails for any subscription whose product
// (or variant) now has stock > 0 and hasn't been notified yet.
//
// Scheduled every 15 min in vercel.json.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendBackInStockEmail } from '@/lib/email';
import { brandPlusName } from '@/lib/product-display';

interface SubRow {
  id: string;
  email: string;
  product_id: string;
  variant_id: string | null;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://aizel.co.uk';

async function authorize(req: NextRequest): Promise<boolean> {
  // P1: fail closed if CRON_SECRET isn't set (previously fell open in dev).
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

  const { data: subs, error } = await sb
    .from('stock_subscriptions')
    .select('id, email, product_id, variant_id')
    .is('notified_at', null)
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const subscriptions = (subs ?? []) as SubRow[];
  if (subscriptions.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  // Pull stock per (product, variant) in batches.
  const productIds = Array.from(new Set(subscriptions.map(s => s.product_id)));
  const variantIds = Array.from(new Set(subscriptions.map(s => s.variant_id).filter((v): v is string => Boolean(v))));

  const [{ data: products }, { data: variants }] = await Promise.all([
    sb.from('products').select('id, brand, name, slug, stock, image_url').in('id', productIds.length ? productIds : ['00000000-0000-0000-0000-000000000000']),
    variantIds.length
      ? sb.from('product_variants').select('id, stock, image_url').in('id', variantIds)
      : Promise.resolve({ data: [] as Array<{ id: string; stock: number; image_url: string | null }> }),
  ]);

  type Prod = { id: string; brand: string; name: string; slug: string; stock: number; image_url: string | null };
  const prodMap = new Map<string, Prod>(((products ?? []) as Prod[]).map(p => [p.id, p]));
  const varMap  = new Map<string, { id: string; stock: number; image_url: string | null }>(
    ((variants ?? []) as Array<{ id: string; stock: number; image_url: string | null }>).map(v => [v.id, v])
  );

  let sent = 0;
  const notified: string[] = [];

  for (const s of subscriptions) {
    const product = prodMap.get(s.product_id);
    if (!product) continue;
    const variantStock = s.variant_id ? (varMap.get(s.variant_id)?.stock ?? 0) : null;
    const available = s.variant_id ? variantStock! > 0 : product.stock > 0;
    if (!available) continue;
    await sendBackInStockEmail({
      email: s.email,
      product_name: brandPlusName(product.brand, product.name),
      product_url: `${SITE_URL}/product/${product.slug}`,
      image_url: (s.variant_id ? varMap.get(s.variant_id)?.image_url : null) ?? product.image_url ?? undefined,
    });
    sent++;
    notified.push(s.id);
  }

  if (notified.length) {
    await sb.from('stock_subscriptions')
      .update({ notified_at: new Date().toISOString() })
      .in('id', notified);
  }

  return NextResponse.json({ ok: true, scanned: subscriptions.length, sent });
}
