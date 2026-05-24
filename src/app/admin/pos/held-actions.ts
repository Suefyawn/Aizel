'use server';

import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { z } from 'zod';

// ============================================================================
// Held (parked) sales — the cashier mid-transaction can step away from
// the current cart to ring up a different customer. The active cart
// serialises to held_sales and re-hydrates on demand.
//
// Why server-persisted rather than localStorage:
//   • A held sale survives a browser reload / tablet hand-off mid-shift.
//   • Two cashiers on the same POS station can each park their own
//     transactions and the resume list filters by staff_id.
//   • Audit trail — the operator can see what was held + by whom in
//     /admin/pos/dashboard's reports.
// ============================================================================

const ItemSchema = z.object({
  product_id: z.string().uuid(),
  name: z.string().min(1),
  brand: z.string().nullable(),
  unit_price: z.number().nonnegative(),
  list_price: z.number().nonnegative(),
  qty: z.number().int().positive().max(999),
  variant: z.string().nullable().optional(),
  image_url: z.string().url().nullable().optional(),
  slug: z.string().nullable().optional(),
});

const ParkInputSchema = z.object({
  label:           z.string().trim().min(1, 'Add a short label').max(80),
  cart_discount:   z.number().nonnegative().default(0),
  customer_email:  z.string().email().or(z.literal('')).optional(),
  items:           z.array(ItemSchema).min(1, 'Cart is empty — nothing to park'),
});

export interface HeldSaleSummary {
  id: string;
  label: string;
  total: number;
  item_count: number;
  created_at: string;
}

export interface HeldSaleDetail extends HeldSaleSummary {
  cart: {
    items: z.infer<typeof ItemSchema>[];
    cart_discount: number;
    customer_email: string;
  };
}

async function assertPos() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('pos.operate'))) {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function parkSale(input: unknown): Promise<{ ok: boolean; error?: string; id?: string }> {
  const session = await assertPos();
  const parsed = ParkInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const subtotal = parsed.data.items.reduce((s, it) => s + it.unit_price * it.qty, 0);
  const total = Math.max(0, subtotal - parsed.data.cart_discount);

  const { data, error } = await supabaseAdmin()
    .from('held_sales')
    .insert({
      staff_id: session.id,
      label:    parsed.data.label,
      cart: {
        items:           parsed.data.items,
        cart_discount:   parsed.data.cart_discount,
        customer_email:  parsed.data.customer_email ?? '',
      },
      total,
    })
    .select('id')
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? 'Could not park sale' };
  return { ok: true, id: data.id };
}

export async function listHeldSales(): Promise<HeldSaleSummary[]> {
  const session = await assertPos();
  const { data } = await supabaseAdmin()
    .from('held_sales')
    .select('id, label, total, cart, created_at')
    .eq('staff_id', session.id)
    .order('created_at', { ascending: false });

  return ((data ?? []) as Array<{ id: string; label: string; total: number; cart: { items: unknown[] }; created_at: string }>).map(r => ({
    id: r.id,
    label: r.label,
    total: Number(r.total ?? 0),
    item_count: Array.isArray(r.cart?.items) ? r.cart.items.length : 0,
    created_at: r.created_at,
  }));
}

export async function resumeSale(id: string): Promise<{ ok: boolean; error?: string; sale?: HeldSaleDetail }> {
  const session = await assertPos();
  const { data, error } = await supabaseAdmin()
    .from('held_sales')
    .select('id, label, total, cart, created_at, staff_id')
    .eq('id', id)
    .maybeSingle<{ id: string; label: string; total: number; cart: HeldSaleDetail['cart']; created_at: string; staff_id: string }>();

  if (error || !data) return { ok: false, error: 'Held sale not found' };
  // Defensive — UI already filters by staff_id, but a typed URL could
  // attempt to resume someone else's hold. Refuse cross-staff resume.
  if (data.staff_id !== session.id && !session.isOwner) {
    return { ok: false, error: 'That hold belongs to another cashier' };
  }

  // Resume = delete the hold + return its contents to the client.
  // Atomicity isn't critical: even if the delete races, the next park
  // would create a fresh row, and the worst-case is one orphaned hold
  // visible in the operator's list.
  await supabaseAdmin().from('held_sales').delete().eq('id', id);

  return {
    ok: true,
    sale: {
      id: data.id,
      label: data.label,
      total: Number(data.total ?? 0),
      item_count: Array.isArray(data.cart?.items) ? data.cart.items.length : 0,
      created_at: data.created_at,
      cart: data.cart,
    },
  };
}

export async function discardHeldSale(id: string): Promise<{ ok: boolean; error?: string }> {
  const session = await assertPos();
  const admin = supabaseAdmin();
  const { data } = await admin.from('held_sales').select('staff_id').eq('id', id).maybeSingle<{ staff_id: string }>();
  if (!data) return { ok: false, error: 'Held sale not found' };
  if (data.staff_id !== session.id && !session.isOwner) {
    return { ok: false, error: 'That hold belongs to another cashier' };
  }
  await admin.from('held_sales').delete().eq('id', id);
  return { ok: true };
}
