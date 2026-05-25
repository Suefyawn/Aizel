'use server';

import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { tierFor } from '@/lib/loyalty-tiers';
import { z } from 'zod';

// Customer lookup for the POS till — attach a registered customer to
// an in-store sale so:
//   • the sale shows up on the customer's order history
//   • lifetime spend stays accurate across web + in-store
//   • the cashier can offer loyalty tier perks at the till
//   • the receipt is emailed automatically to their on-file address
//
// Search is fuzzy across first/last name + email + phone. We cap at
// 10 results — the till's picker is a small list, not a full search
// page. Cashier types ≥2 chars to fire.

const QuerySchema = z.object({ q: z.string().min(2).max(80) });

export interface PosCustomerResult {
  id:         string;
  first_name: string | null;
  last_name:  string | null;
  email:      string;
  phone:      string | null;
  /** Lifetime delivered spend (£). Drives the tier badge in the picker. */
  lifetime_spend: number;
  /** Number of delivered orders. Used to spot first-time-walk-in vs
   *  returning customer at a glance. */
  order_count: number;
  /** Aizel loyalty tier derived from lifetime_spend. */
  tier: ReturnType<typeof tierFor>;
  /** Staff-curated tags ("VIP", "Has allergy", etc.). Shown as chips on
   *  the lookup row + the attached-customer pill. Empty array when none. */
  tags: string[];
  /** Freeform staff note. Shown as a small banner on the attached-
   *  customer pill so the cashier sees context without leaving the till. */
  notes: string | null;
}

async function assertPos() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('pos.operate'))) {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function searchPosCustomers(input: unknown): Promise<PosCustomerResult[]> {
  await assertPos();
  const parsed = QuerySchema.safeParse(input);
  if (!parsed.success) return [];

  const q = parsed.data.q.trim();
  const like = `%${q.replace(/[%_]/g, '\\$&')}%`;

  const admin = supabaseAdmin();
  // OR across the three fields a cashier knows. ilike for case-insensitive
  // partial match — pg_trgm would be faster but overkill at this scale.
  const { data } = await admin
    .from('profiles')
    .select('id, first_name, last_name, email, phone')
    .or(`first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
    .order('created_at', { ascending: false })
    .limit(10);

  const profiles = (data ?? []) as Array<{
    id: string; first_name: string | null; last_name: string | null;
    email: string; phone: string | null;
  }>;
  if (profiles.length === 0) return [];

  // Lifetime spend + order count + staff extras — one query each,
  // all keyed by user_id so we can hydrate in a single pass.
  const ids = profiles.map(p => p.id);
  const [{ data: orderAgg }, { data: extrasRows }] = await Promise.all([
    admin.from('orders').select('user_id, total').in('user_id', ids).eq('status', 'delivered'),
    admin.from('customer_profile_extras').select('user_id, tags, notes').in('user_id', ids),
  ]);

  const aggMap = new Map<string, { spend: number; count: number }>();
  for (const row of (orderAgg ?? []) as Array<{ user_id: string | null; total: number }>) {
    if (!row.user_id) continue;
    const cur = aggMap.get(row.user_id) ?? { spend: 0, count: 0 };
    cur.spend += Number(row.total ?? 0);
    cur.count += 1;
    aggMap.set(row.user_id, cur);
  }

  const extrasMap = new Map<string, { tags: string[]; notes: string | null }>();
  for (const row of (extrasRows ?? []) as Array<{ user_id: string; tags: string[] | null; notes: string | null }>) {
    extrasMap.set(row.user_id, { tags: row.tags ?? [], notes: row.notes });
  }

  return profiles.map(p => {
    const agg = aggMap.get(p.id) ?? { spend: 0, count: 0 };
    const extras = extrasMap.get(p.id) ?? { tags: [], notes: null };
    return {
      id: p.id,
      first_name: p.first_name,
      last_name:  p.last_name,
      email:      p.email,
      phone:      p.phone,
      lifetime_spend: agg.spend,
      order_count:    agg.count,
      tier:           tierFor(agg.spend),
      tags:           extras.tags,
      notes:          extras.notes,
    };
  });
}
