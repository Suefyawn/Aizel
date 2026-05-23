'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';
import { getAdapter } from '@/lib/couriers';
import type { BookingInput } from '@/lib/couriers/types';

async function assertOrders() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('orders.edit'))) {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function createShipment(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const session = await assertOrders();

  const order_id = formData.get('order_id');
  const courier  = formData.get('courier');
  const tracking_number = formData.get('tracking_number');
  if (typeof order_id !== 'string' || !order_id) return { error: 'order_id required' };
  if (typeof courier !== 'string' || !courier) return { error: 'courier required' };
  if (typeof tracking_number !== 'string' || !tracking_number) return { error: 'tracking_number required' };

  const weightRaw = formData.get('weight_grams');
  const weight_grams = typeof weightRaw === 'string' && weightRaw ? Number(weightRaw) : null;

  const { data, error } = await supabaseAdmin().from('shipments').insert({
    order_id,
    courier,
    tracking_number: tracking_number.trim(),
    weight_grams,
    status: 'picked_up',
  }).select('id').single();

  if (error) return { error: error.message };

  await logAudit(session, {
    action: 'shipment.create',
    entity: 'shipment',
    entity_id: data?.id as string | undefined,
    diff: { order_id, courier, tracking_number },
  });

  revalidatePath(`/admin/orders/${order_id}`);
  revalidatePath('/admin/orders');
  return { success: true };
}

// ─── Book via courier API (currently TCS, more couriers as adapters ship) ─
//
// Flow:
//   1. Validate session has the 'orders.edit' permission.
//   2. Look up the courier adapter; if not configured, return an error
//      telling the merchant which env vars to set.
//   3. Pull the order from Supabase so we have the consignee details.
//   4. Call adapter.book(...). On success, persist a shipment row with the
//      tracking number the courier assigned. On failure, return the
//      adapter's message verbatim — the UI shows it to the merchant.
//
// The merchant ALWAYS has the manual `createShipment` fallback above, so a
// courier outage / API hiccup never blocks fulfillment.
export async function bookShipment(
  _prev: { error?: string; success?: boolean; trackingNumber?: string } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean; trackingNumber?: string }> {
  const session = await assertOrders();

  const order_id = formData.get('order_id');
  const courier  = formData.get('courier');
  if (typeof order_id !== 'string' || !order_id) return { error: 'order_id required' };
  if (typeof courier !== 'string' || !courier) return { error: 'courier required' };

  const adapter = getAdapter(courier);
  if (!adapter) {
    return { error: `${courier} has no API adapter configured — use manual entry instead.` };
  }

  // Pull the order so we can give the courier the consignee + line items.
  const { data: order, error: orderErr } = await supabaseAdmin()
    .from('orders')
    .select('order_number, total, first_name, last_name, phone, email, address, city, province, zip, items')
    .eq('id', order_id)
    .single();
  if (orderErr || !order) return { error: orderErr?.message ?? 'Order not found' };

  // Weight: estimate from line items if any have weight_grams; otherwise
  // a conservative 0.5 kg minimum (TCS's lower bound).
  const items = Array.isArray(order.items) ? order.items as Array<{ name?: string; qty?: number; price?: number; weight_grams?: number }> : [];
  const totalGrams = items.reduce((g, it) => g + (it.weight_grams ?? 0) * (it.qty ?? 1), 0);
  const weightKg = totalGrams > 0 ? totalGrams / 1000 : 0.5;

  const weightOverride = formData.get('weight_kg');
  const pieceOverride = formData.get('pieces');

  const input: BookingInput = {
    orderNumber: order.order_number ?? order_id,
    consignee: {
      firstName: order.first_name ?? 'Customer',
      lastName: order.last_name ?? undefined,
      phone: order.phone ?? '',
      email: order.email,
      address1: order.address ?? '',
      city: order.city ?? '',
      province: order.province,
      zip: order.zip,
    },
    weightKg: typeof weightOverride === 'string' && weightOverride
      ? Math.max(0.5, Number(weightOverride))
      : weightKg,
    pieces: typeof pieceOverride === 'string' && pieceOverride
      ? Math.max(1, Number(pieceOverride))
      : 1,
    codAmount: Number(order.total) || 0,
    items: items.map(it => ({
      description: it.name ?? 'Item',
      quantity: it.qty ?? 1,
      weightKg: it.weight_grams ? it.weight_grams / 1000 : 0.5,
      unitPrice: it.price ?? 0,
    })),
    remarks: `Aizel order ${order.order_number}`,
  };

  const result = await adapter.book(input);
  if (!('ok' in result) || !result.ok) {
    void logAudit(session, {
      action: 'shipment.book_failed',
      entity: 'orders',
      entity_id: order_id,
      diff: { courier, message: result.message, code: result.code },
    });
    return { error: result.message };
  }

  // Persist the shipment row. The shipments_sync_order trigger (see
  // 20260521_040_shipments.sql) mirrors tracking_number + courier onto
  // orders for the /track + /account UI.
  const { data: shipment, error: insErr } = await supabaseAdmin()
    .from('shipments')
    .insert({
      order_id,
      courier,
      tracking_number: result.trackingNumber,
      weight_grams: Math.round(input.weightKg * 1000),
      raw_label_url: result.labelUrl ?? null,
      status: 'picked_up',
    })
    .select('id')
    .single();
  if (insErr) return { error: insErr.message };

  void logAudit(session, {
    action: 'shipment.book',
    entity: 'shipment',
    entity_id: shipment?.id ?? null,
    diff: { courier, order_id, tracking_number: result.trackingNumber },
  });

  revalidatePath(`/admin/orders/${order_id}`);
  revalidatePath('/admin/orders');
  return { success: true, trackingNumber: result.trackingNumber };
}

// ─── Cancel a shipment via courier API ────────────────────────────────────
// Manual shipments (those entered with createShipment) can also be marked
// cancelled; we just skip the API call and only update the DB.
export async function cancelShipment(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const session = await assertOrders();

  const shipment_id = formData.get('shipment_id');
  if (typeof shipment_id !== 'string' || !shipment_id) return { error: 'shipment_id required' };

  const { data: shipment, error: lookupErr } = await supabaseAdmin()
    .from('shipments')
    .select('id, order_id, courier, tracking_number, status')
    .eq('id', shipment_id)
    .single();
  if (lookupErr || !shipment) return { error: lookupErr?.message ?? 'Shipment not found' };

  // Try the API first; if there's no adapter, that's fine — we still mark
  // the DB row cancelled (the merchant has presumably called the courier
  // by phone or used the courier's web portal).
  const adapter = getAdapter(shipment.courier);
  let apiNote = 'manual cancel (no adapter)';
  if (adapter) {
    const r = await adapter.cancel(shipment.tracking_number);
    if (!('ok' in r) || !r.ok) {
      // Don't fail the action — the merchant explicitly asked to cancel.
      // Log it and continue with the local update.
      apiNote = `API cancel failed: ${r.message}`;
    } else {
      apiNote = 'API cancel OK';
    }
  }

  const { error: updErr } = await supabaseAdmin()
    .from('shipments')
    .update({ status: 'cancelled' })
    .eq('id', shipment_id);
  if (updErr) return { error: updErr.message };

  void logAudit(session, {
    action: 'shipment.cancel',
    entity: 'shipment',
    entity_id: shipment_id,
    diff: { courier: shipment.courier, tracking_number: shipment.tracking_number, note: apiNote },
  });

  revalidatePath(`/admin/orders/${shipment.order_id}`);
  revalidatePath('/admin/orders');
  return { success: true };
}
