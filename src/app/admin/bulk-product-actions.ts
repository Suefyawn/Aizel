'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';
import type { Permission } from '@/lib/permissions';

async function assertProducts(action: 'edit' | 'delete' = 'edit') {
  const session = await getStaffSession();
  const perm: Permission = action === 'delete' ? 'products.delete' : 'products.edit';
  if (!session || (!session.isOwner && !session.permissions.includes(perm))) {
    throw new Error('Unauthorized');
  }
  return session;
}

// ─── Bulk status / tag / price ─────────────────────────────────────────────
export async function bulkPublishProducts(ids: string[]): Promise<void> {
  const session = await assertProducts();
  if (ids.length === 0) return;
  await supabaseAdmin().from('products').update({ status: 'published' }).in('id', ids);
  await logAudit(session, { action: 'product.bulk_publish', entity: 'product', diff: { count: ids.length, ids } });
  revalidatePath('/admin/products');
}

export async function bulkArchiveProducts(ids: string[]): Promise<void> {
  const session = await assertProducts();
  if (ids.length === 0) return;
  await supabaseAdmin().from('products').update({ status: 'archived' }).in('id', ids);
  await logAudit(session, { action: 'product.bulk_archive', entity: 'product', diff: { count: ids.length, ids } });
  revalidatePath('/admin/products');
}

export async function bulkDeleteProducts(ids: string[]): Promise<{ deleted: number; archived: number }> {
  const session = await assertProducts('delete');
  if (ids.length === 0) return { deleted: 0, archived: 0 };

  // Products with order history are archived, not hard-deleted — see
  // src/lib/product-archive.ts for why. The rest are deleted as requested.
  const { productsWithOrderHistory } = await import('@/lib/product-archive');
  const referenced = await productsWithOrderHistory(ids);
  const toArchive = ids.filter(id => referenced.has(id));
  const toDelete = ids.filter(id => !referenced.has(id));

  const admin = supabaseAdmin();
  if (toArchive.length > 0) {
    await admin.from('products').update({ status: 'archived' }).in('id', toArchive);
  }
  if (toDelete.length > 0) {
    await admin.from('products').delete().in('id', toDelete);
  }
  await logAudit(session, {
    action: 'product.bulk_delete',
    entity: 'product',
    diff: { count: ids.length, deleted: toDelete, archived: toArchive },
  });
  revalidatePath('/admin/products');
  return { deleted: toDelete.length, archived: toArchive.length };
}

export async function bulkTagProducts(ids: string[], tag: string | null): Promise<void> {
  const session = await assertProducts();
  if (ids.length === 0) return;
  await supabaseAdmin().from('products').update({ tag }).in('id', ids);
  await logAudit(session, { action: 'product.bulk_tag', entity: 'product', diff: { count: ids.length, ids, tag } });
  revalidatePath('/admin/products');
}

// percent (e.g. -10 = 10% off, +5 = 5% mark-up). Applies to current price.
export async function bulkPriceAdjustProducts(ids: string[], percent: number): Promise<{ error?: string }> {
  const session = await assertProducts();
  if (ids.length === 0) return {};
  if (!isFinite(percent) || percent <= -100) return { error: 'Invalid percent' };

  const { data } = await supabaseAdmin().from('products').select('id, price, original_price').in('id', ids);
  for (const row of (data ?? []) as Array<{ id: string; price: number; original_price: number | null }>) {
    const newPrice = Math.round(row.price * (1 + percent / 100));
    if (newPrice < 0) continue;
    await supabaseAdmin().from('products').update({ price: newPrice }).eq('id', row.id);
  }
  await logAudit(session, { action: 'product.bulk_price_adjust', entity: 'product', diff: { count: ids.length, ids, percent } });
  revalidatePath('/admin/products');
  return {};
}
