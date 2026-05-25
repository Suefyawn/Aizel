'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { assertPermission } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit';

// Tight surface for the click-to-edit cells in /admin/products. We deliberately
// do NOT route this through productInputSchema — that validator demands the
// full product payload and would reject a single-field PATCH. Each handler
// validates its one input and writes only that column.
//
// All three handlers go through the products.edit permission, so a viewer-only
// staff member can't bypass the row-detail editor by clicking the cell.

type Result = { ok: true } | { ok: false; error: string };

export async function inlineUpdateProductPrice(id: string, price: number): Promise<Result> {
  if (typeof price !== 'number' || !isFinite(price) || price < 0) {
    return { ok: false, error: 'Price must be ≥ 0' };
  }
  // Round to 2dp — Postgres numeric stores it fine, but rounding here keeps
  // the audit diff readable.
  const rounded = Math.round(price * 100) / 100;
  const session = await assertPermission('products.edit');
  const admin = supabaseAdmin();
  const { data: before } = await admin.from('products').select('price').eq('id', id).maybeSingle();
  const { error } = await admin.from('products').update({ price: rounded }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  await logAudit(session, {
    action: 'product.update',
    entity: 'product',
    entity_id: id,
    diff: { before: { price: before?.price ?? null }, after: { price: rounded }, source: 'inline-edit' },
  });
  revalidatePath('/admin/products');
  return { ok: true };
}

export async function inlineUpdateProductStock(id: string, stock: number): Promise<Result> {
  if (typeof stock !== 'number' || !isFinite(stock) || !Number.isInteger(stock) || stock < 0) {
    return { ok: false, error: 'Stock must be a whole number ≥ 0' };
  }
  const session = await assertPermission('products.edit');
  const admin = supabaseAdmin();
  // Don't allow stock writes on untracked products — they're services /
  // made-to-order, and the badge in the table already shows that. Inline-
  // editing the cell silently would be confusing.
  const { data: before } = await admin
    .from('products')
    .select('stock, track_inventory')
    .eq('id', id)
    .maybeSingle();
  if (before?.track_inventory === false) {
    return { ok: false, error: 'Stock is not tracked for this product' };
  }
  const { error } = await admin.from('products').update({ stock }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  await logAudit(session, {
    action: 'product.update',
    entity: 'product',
    entity_id: id,
    diff: { before: { stock: before?.stock ?? null }, after: { stock }, source: 'inline-edit' },
  });
  revalidatePath('/admin/products');
  return { ok: true };
}
