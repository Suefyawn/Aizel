// ============================================================================
// Vercel Cron entry point — fires staged abandoned-cart reminders.
//
// Schedule (every 15 min) configured in vercel.json:
//   { "crons": [{ "path": "/api/cron/abandoned-cart", "schedule": "*/15 * * * *" }] }
//
// Vercel adds the header `Authorization: Bearer <CRON_SECRET>` when calling
// scheduled routes; we verify it matches the env var so the endpoint can't be
// triggered by random web traffic.
//
// Reminder tiers:
//   tier 1 — first email after 1 hour of inactivity
//   tier 2 — second email after 24 hours
//   tier 3 — last-chance email with discount code after 72 hours
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendAbandonedCartEmail } from '@/lib/email';
import type { CartItem } from '@/types';

interface AbandonedCart {
  id: string;
  email: string;
  cart_items: CartItem[];
  subtotal: number;
  restore_token: string;
  reminder_tier: number;
  last_emailed_at: string | null;
  last_activity_at: string;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://aizel.co.uk';
const TIER_3_DISCOUNT_CODE = process.env.ABANDONED_CART_DISCOUNT_CODE ?? 'COMEBACK10';
const TIER_3_DISCOUNT_PCT = Number(process.env.ABANDONED_CART_DISCOUNT_PCT ?? 10);

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS  = 24 * ONE_HOUR_MS;

function nextTier(now: number, c: AbandonedCart): 1 | 2 | 3 | null {
  const sinceActivity = now - new Date(c.last_activity_at).getTime();
  const sinceLastEmail = c.last_emailed_at ? now - new Date(c.last_emailed_at).getTime() : Infinity;
  if (c.reminder_tier === 0 && sinceActivity > ONE_HOUR_MS) return 1;
  if (c.reminder_tier === 1 && sinceLastEmail > ONE_DAY_MS - ONE_HOUR_MS) return 2;
  if (c.reminder_tier === 2 && sinceLastEmail > 2 * ONE_DAY_MS) return 3;
  return null;
}

async function authorize(req: NextRequest): Promise<boolean> {
  // Vercel Cron sends a Bearer token equal to CRON_SECRET.
  // P1: fail closed if the secret isn't set, regardless of environment.
  // The previous fall-open-in-dev branch also fired on Vercel preview
  // deployments and self-hosted setups that forgot the env var, letting
  // anyone trigger mass emails. Local dev: set CRON_SECRET in .env.local.
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return req.headers.get('authorization') === `Bearer ${expected}`;
}

export async function GET(req: NextRequest) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const cutoff = new Date(Date.now() - ONE_HOUR_MS).toISOString();
  const { data, error } = await sb
    .from('abandoned_carts')
    .select('id, email, cart_items, subtotal, restore_token, reminder_tier, last_emailed_at, last_activity_at')
    .eq('recovered', false)
    .lt('reminder_tier', 3)
    .lt('last_activity_at', cutoff)
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = Date.now();
  const candidates = ((data ?? []) as AbandonedCart[])
    .map(c => ({ c, tier: nextTier(now, c) }))
    .filter((x): x is { c: AbandonedCart; tier: 1 | 2 | 3 } => x.tier !== null);

  let sent = 0;
  const errors: string[] = [];

  // Tier-1 fires immediately; tier-2/3 cluster on the same cart row so process
  // one cart at a time to avoid racing the update.
  for (const { c, tier } of candidates) {
    const restoreUrl = `${SITE_URL}/cart?restore=${c.restore_token}`;
    try {
      await sendAbandonedCartEmail({
        email:        c.email,
        items:        c.cart_items.map(i => ({ name: i.name, brand: i.brand ?? undefined, variant: i.variant ?? undefined, qty: i.qty, price: i.price })),
        total:        c.subtotal,
        restore_url:  restoreUrl,
        tier,
        discount_code: tier === 3 ? TIER_3_DISCOUNT_CODE : undefined,
        discount_pct:  tier === 3 ? TIER_3_DISCOUNT_PCT : undefined,
      });
      const { error: upErr } = await sb
        .from('abandoned_carts')
        .update({ reminder_tier: tier, last_emailed_at: new Date().toISOString() })
        .eq('id', c.id);
      if (upErr) errors.push(`update cart ${c.id}: ${upErr.message}`);
      sent++;
    } catch (err) {
      errors.push(`cart ${c.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({ ok: true, scanned: data?.length ?? 0, sent, errors });
}
