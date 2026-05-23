'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { assertPermission } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit';

// ─── Vendor CRUD ────────────────────────────────────────────────────────────

/** Parse the commission % field — blank → null, otherwise clamped 0–100. */
function parseCommission(raw: FormDataEntryValue | null): number | null {
  const s = (raw as string | null)?.trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, n));
}

function parseDirection(raw: FormDataEntryValue | null): 'vendor_collects' | 'we_collect' {
  return raw === 'vendor_collects' ? 'vendor_collects' : 'we_collect';
}

export async function createVendor(formData: FormData) {
  const session = await assertPermission('orders.edit');
  const name  = (formData.get('name') as string)?.trim();
  const phone = (formData.get('phone') as string)?.trim();
  const notes = (formData.get('notes') as string)?.trim() || null;
  if (!name || !phone) return;

  const { data: created } = await supabaseAdmin()
    .from('vendors')
    .insert({
      name, phone, notes,
      commission_pct: parseCommission(formData.get('commission_pct')),
      settlement_direction: parseDirection(formData.get('settlement_direction')),
    })
    .select('id')
    .single();
  void logAudit(session, {
    action: 'vendor.create', entity: 'vendors', entity_id: created?.id ?? null,
    diff: { name, phone },
  });
  revalidatePath('/admin/vendors');
}

/** Update a vendor's commission % and settlement direction. */
export async function updateVendor(formData: FormData) {
  const session = await assertPermission('orders.edit');
  const id = formData.get('id') as string;
  if (!id) return;
  const commission_pct = parseCommission(formData.get('commission_pct'));
  const settlement_direction = parseDirection(formData.get('settlement_direction'));
  await supabaseAdmin()
    .from('vendors')
    .update({ commission_pct, settlement_direction })
    .eq('id', id);
  void logAudit(session, {
    action: 'vendor.update', entity: 'vendors', entity_id: id,
    diff: { commission_pct, settlement_direction },
  });
  revalidatePath('/admin/vendors');
}

export async function deleteVendor(formData: FormData) {
  const session = await assertPermission('orders.delete');
  const id = formData.get('id') as string;
  const { data: target } = await supabaseAdmin().from('vendors').select('name').eq('id', id).single();
  await supabaseAdmin().from('vendors').delete().eq('id', id);
  void logAudit(session, {
    action: 'vendor.delete', entity: 'vendors', entity_id: id,
    diff: { name: target?.name },
  });
  revalidatePath('/admin/vendors');
}

// ─── Order confirmation + vendor dispatch ───────────────────────────────────

/** Toggle whether the customer has confirmed the order (typically over
 *  WhatsApp). Bound with the order id + target state by the order page. */
export async function setOrderConfirmed(orderId: string, confirmed: boolean) {
  const session = await assertPermission('orders.edit');
  await supabaseAdmin()
    .from('orders')
    .update({ confirmed_at: confirmed ? new Date().toISOString() : null })
    .eq('id', orderId);
  void logAudit(session, {
    action: confirmed ? 'order.customer_confirmed' : 'order.confirmation_cleared',
    entity: 'orders', entity_id: orderId,
  });
  revalidatePath(`/admin/orders/${orderId}`);
}

interface OrderItemLite { id?: string; qty?: number; price?: number }

/** Compute and persist the financial split for an order dispatched to a
 *  vendor. Covers only the order's line items whose product is sourced from
 *  that vendor. Per-unit cost = the product's explicit `vendor_cost`, else
 *  derived from the vendor's commission %, else the full price (margin 0). */
async function recomputeSettlement(orderId: string, vendorId: string) {
  const admin = supabaseAdmin();
  const [{ data: order }, { data: vendor }] = await Promise.all([
    admin.from('orders').select('items').eq('id', orderId).single(),
    admin.from('vendors').select('commission_pct, settlement_direction').eq('id', vendorId).single(),
  ]);
  if (!order || !vendor) return;

  const items = (order.items ?? []) as OrderItemLite[];
  const ids = Array.from(new Set(items.map(i => i.id).filter((v): v is string => Boolean(v))));
  const { data: prodRows } = ids.length
    ? await admin.from('products').select('id, vendor_id, vendor_cost').in('id', ids)
    : { data: [] };
  const prodMap = new Map(
    ((prodRows ?? []) as { id: string; vendor_id: string | null; vendor_cost: number | null }[])
      .map(p => [p.id, p]),
  );

  const commission = vendor.commission_pct as number | null;
  let gross = 0, cost = 0;
  for (const item of items) {
    const prod = item.id ? prodMap.get(item.id) : null;
    if (!prod || prod.vendor_id !== vendorId) continue;
    const qty = Math.max(0, Number(item.qty) || 0);
    const price = Math.max(0, Number(item.price) || 0);
    const unitCost = prod.vendor_cost != null
      ? prod.vendor_cost
      : commission != null
        ? price * (1 - commission / 100)
        : price;
    gross += price * qty;
    cost  += unitCost * qty;
  }
  gross = Math.round(gross * 100) / 100;
  cost  = Math.round(cost * 100) / 100;
  const margin = Math.round((gross - cost) * 100) / 100;

  const direction = vendor.settlement_direction === 'vendor_collects' ? 'vendor_collects' : 'we_collect';
  const dueTo: 'us' | 'vendor' = direction === 'vendor_collects' ? 'us' : 'vendor';
  const amountDue = direction === 'vendor_collects' ? margin : cost;

  // Re-dispatch to a different vendor: drop the stale pending settlement.
  await admin.from('vendor_settlements')
    .delete()
    .eq('order_id', orderId)
    .eq('status', 'pending')
    .neq('vendor_id', vendorId);

  await admin.from('vendor_settlements').upsert({
    order_id: orderId,
    vendor_id: vendorId,
    gross_amount: gross,
    vendor_cost: cost,
    our_margin: margin,
    direction,
    amount_due: amountDue,
    due_to: dueTo,
    status: 'pending',
    settled_at: null,
  }, { onConflict: 'order_id,vendor_id' });
}

/** Record that the order was forwarded to a vendor. The WhatsApp message
 *  itself is opened client-side; this persists the assignment + a "sent"
 *  timestamp, and writes the vendor settlement (margin / payout) row. */
export async function dispatchOrderToVendor(orderId: string, vendorId: string) {
  const session = await assertPermission('orders.edit');
  if (!vendorId) return;
  await supabaseAdmin()
    .from('orders')
    .update({ vendor_id: vendorId, vendor_sent_at: new Date().toISOString() })
    .eq('id', orderId);
  await recomputeSettlement(orderId, vendorId);
  void logAudit(session, {
    action: 'order.dispatched_to_vendor', entity: 'orders', entity_id: orderId,
    diff: { vendor_id: vendorId },
  });
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath('/admin/vendors');
}

/** Mark a vendor settlement as paid/received. */
export async function markSettlementSettled(formData: FormData) {
  const session = await assertPermission('orders.edit');
  const id = formData.get('id') as string;
  if (!id) return;
  const settle = formData.get('settle') !== 'false';
  await supabaseAdmin()
    .from('vendor_settlements')
    .update({ status: settle ? 'settled' : 'pending', settled_at: settle ? new Date().toISOString() : null })
    .eq('id', id);
  void logAudit(session, {
    action: settle ? 'vendor.settlement_settled' : 'vendor.settlement_reopened',
    entity: 'vendor_settlements', entity_id: id,
  });
  revalidatePath('/admin/vendors');
}
