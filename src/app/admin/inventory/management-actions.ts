'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';

// ============================================================================
// Inventory management — stocktakes + purchase orders.
//
// Stocktake flow:
//   1. startStocktake() — opens an empty session, redirects to the count
//      page. Only one open stocktake at a time per shop (refused if one's
//      already open).
//   2. recordStocktakeCount() — UPSERTs a single product's counted qty.
//      Cashier walks the shelves and types in what they see; system_qty
//      is snapshotted at upsert time so the delta is fixed even if
//      sales happen mid-count.
//   3. finalizeStocktake() — for every line with a non-zero delta, writes
//      an `adjustment`-reason ledger row and updates the product's stock
//      column. Session marked finalised.
//
// PO flow:
//   1. createPurchaseOrder() — creates a draft with supplier + lines
//   2. markPoReceived() — for each line, bumps the product's stock and
//      writes an `import`-reason ledger row tied to the PO id. Marks PO
//      as received with a timestamp.
//
// All actions are gated on `products.edit` permission.
// ============================================================================

async function assertEdit() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('products.edit'))) {
    throw new Error('Unauthorized');
  }
  return session;
}

// ─── Re-order points ────────────────────────────────────────────────

const ReorderSchema = z.object({
  product_id: z.string().uuid(),
  reorder_point: z.preprocess(
    v => (v === '' || v == null ? null : v),
    z.coerce.number().int().nonnegative().nullable(),
  ),
});

export async function setReorderPoint(formData: FormData): Promise<void> {
  const session = await assertEdit();
  const parsed = ReorderSchema.safeParse({
    product_id: formData.get('product_id'),
    reorder_point: formData.get('reorder_point'),
  });
  if (!parsed.success) return;

  await supabaseAdmin()
    .from('products')
    .update({ reorder_point: parsed.data.reorder_point })
    .eq('id', parsed.data.product_id);

  void logAudit(session, {
    action: 'product.reorder_point_set',
    entity: 'products',
    entity_id: parsed.data.product_id,
    diff: { reorder_point: parsed.data.reorder_point },
  });
  revalidatePath('/admin/inventory');
  revalidatePath(`/admin/products/${parsed.data.product_id}`);
}

// ─── Stocktakes ──────────────────────────────────────────────────────

export async function startStocktake(formData: FormData): Promise<void> {
  const session = await assertEdit();
  const note = (formData.get('note') as string | null)?.trim() || null;

  const admin = supabaseAdmin();
  // Refuse if there's already an open stocktake — they're meant to be
  // atomic (count to end then finalise). Two parallel counts would
  // produce conflicting deltas on the same product.
  const { data: existing } = await admin
    .from('stocktakes')
    .select('id')
    .eq('status', 'open')
    .maybeSingle<{ id: string }>();
  if (existing) {
    redirect(`/admin/inventory/stocktake/${existing.id}?error=A%20stocktake%20is%20already%20in%20progress.`);
  }

  const { data: created } = await admin
    .from('stocktakes')
    .insert({
      opened_by: session.name,
      note,
      status: 'open',
    })
    .select('id')
    .single<{ id: string }>();

  if (!created) return;

  void logAudit(session, {
    action: 'stocktake.start',
    entity: 'stocktakes',
    entity_id: created.id,
    diff: { note },
  });
  redirect(`/admin/inventory/stocktake/${created.id}`);
}

const CountSchema = z.object({
  stocktake_id: z.string().uuid(),
  product_id:   z.string().uuid(),
  counted_qty:  z.coerce.number().int().nonnegative(),
  note:         z.string().max(200).optional().nullable(),
});

export async function recordStocktakeCount(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const session = await assertEdit();
  const parsed = CountSchema.safeParse({
    stocktake_id: formData.get('stocktake_id'),
    product_id:   formData.get('product_id'),
    counted_qty:  formData.get('counted_qty'),
    note:         formData.get('note'),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const admin = supabaseAdmin();
  // Snapshot the live system qty NOW so the finalize step writes the
  // exact adjustment the cashier saw at count time.
  const { data: prod } = await admin
    .from('products')
    .select('stock')
    .eq('id', parsed.data.product_id)
    .maybeSingle<{ stock: number }>();
  if (!prod) return { ok: false, error: 'Product not found' };

  await admin.from('stocktake_lines').upsert({
    stocktake_id: parsed.data.stocktake_id,
    product_id:   parsed.data.product_id,
    system_qty:   prod.stock ?? 0,
    counted_qty:  parsed.data.counted_qty,
    note:         parsed.data.note,
  }, { onConflict: 'stocktake_id,product_id' });

  // Keep total_lines synced for the dashboard "12 products counted" line.
  const { count } = await admin
    .from('stocktake_lines')
    .select('id', { count: 'exact', head: true })
    .eq('stocktake_id', parsed.data.stocktake_id);
  await admin.from('stocktakes').update({ total_lines: count ?? 0 }).eq('id', parsed.data.stocktake_id);

  void logAudit(session, {
    action: 'stocktake.count',
    entity: 'stocktakes',
    entity_id: parsed.data.stocktake_id,
    diff: { product_id: parsed.data.product_id, counted_qty: parsed.data.counted_qty },
  });
  revalidatePath(`/admin/inventory/stocktake/${parsed.data.stocktake_id}`);
  return { ok: true };
}

export async function finalizeStocktake(formData: FormData): Promise<void> {
  const session = await assertEdit();
  const stocktakeId = formData.get('stocktake_id') as string;
  if (!stocktakeId) return;

  const admin = supabaseAdmin();
  const { data: lines } = await admin
    .from('stocktake_lines')
    .select('id, product_id, system_qty, counted_qty, delta')
    .eq('stocktake_id', stocktakeId);

  let adjustedCount = 0;
  for (const ln of ((lines ?? []) as Array<{ product_id: string; system_qty: number; counted_qty: number; delta: number }>)) {
    if (ln.delta === 0) continue;
    // Set the product stock to the counted value — the cashier's eyes
    // are the source of truth, not the system.
    await admin.from('products').update({ stock: ln.counted_qty }).eq('id', ln.product_id);
    // And ledger the adjustment so the movement-history view stays
    // explanatory. Note tied back to the stocktake id.
    await admin.from('inventory_ledger').insert({
      product_id:    ln.product_id,
      qty_delta:     ln.delta,
      balance_after: ln.counted_qty,
      reason:        'adjustment',
      actor_kind:    session.isOwner ? 'owner' : 'staff',
      actor_email:   session.email,
      note:          `Stocktake ${stocktakeId.slice(0, 8)} — counted ${ln.counted_qty}, system had ${ln.system_qty}`,
    });
    adjustedCount += 1;
  }

  await admin.from('stocktakes').update({
    status: 'finalised',
    closed_at: new Date().toISOString(),
  }).eq('id', stocktakeId);

  void logAudit(session, {
    action: 'stocktake.finalise',
    entity: 'stocktakes',
    entity_id: stocktakeId,
    diff: { lines_with_adjustments: adjustedCount },
  });
  redirect(`/admin/inventory/stocktake/${stocktakeId}?ok=Stocktake%20finalised`);
}

export async function cancelStocktake(formData: FormData): Promise<void> {
  const session = await assertEdit();
  const stocktakeId = formData.get('stocktake_id') as string;
  if (!stocktakeId) return;
  await supabaseAdmin().from('stocktakes').update({
    status: 'cancelled',
    closed_at: new Date().toISOString(),
  }).eq('id', stocktakeId);
  void logAudit(session, {
    action: 'stocktake.cancel',
    entity: 'stocktakes',
    entity_id: stocktakeId,
  });
  redirect('/admin/inventory/stocktake');
}

// ─── Purchase orders ─────────────────────────────────────────────────

const PoLineSchema = z.object({
  product_id: z.string().uuid(),
  qty:        z.coerce.number().int().positive(),
  unit_cost:  z.preprocess(
    v => (v === '' || v == null ? null : v),
    z.coerce.number().nonnegative().nullable(),
  ),
});

const CreatePoSchema = z.object({
  supplier_name: z.string().min(1).max(160),
  reference:     z.string().max(80).optional().nullable(),
  note:          z.string().max(500).optional().nullable(),
  lines:         z.array(PoLineSchema).min(1, 'A PO needs at least one line'),
});

export async function createPurchaseOrder(input: unknown): Promise<{ ok: boolean; error?: string; id?: string }> {
  const session = await assertEdit();
  const parsed = CreatePoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const admin = supabaseAdmin();
  const { data: po, error } = await admin
    .from('purchase_orders')
    .insert({
      supplier_name: parsed.data.supplier_name,
      reference:     parsed.data.reference,
      note:          parsed.data.note,
      created_by:    session.name,
      status:        'draft',
    })
    .select('id')
    .single<{ id: string }>();
  if (error || !po) return { ok: false, error: error?.message ?? 'Could not create PO' };

  await admin.from('purchase_order_lines').insert(
    parsed.data.lines.map(ln => ({
      po_id: po.id,
      product_id: ln.product_id,
      qty: ln.qty,
      unit_cost: ln.unit_cost,
    })),
  );

  void logAudit(session, {
    action: 'po.create',
    entity: 'purchase_orders',
    entity_id: po.id,
    diff: { supplier: parsed.data.supplier_name, line_count: parsed.data.lines.length },
  });
  revalidatePath('/admin/inventory/purchase-orders');
  return { ok: true, id: po.id };
}

export async function markPoReceived(formData: FormData): Promise<void> {
  const session = await assertEdit();
  const poId = formData.get('po_id') as string;
  if (!poId) return;

  const admin = supabaseAdmin();

  // Idempotency claim: flip the PO status from 'draft' to 'received'
  // BEFORE touching stock. The `eq('status', 'draft')` clause means a
  // second concurrent call (or a double-click) will update 0 rows; we
  // bail without re-ledgering. This is the cheapest atomic guard for a
  // server-action that doesn't have a wrapping transaction. The `select`
  // gives us the row count so we know whether to proceed.
  const { data: claimed } = await admin
    .from('purchase_orders')
    .update({
      status: 'received',
      received_at: new Date().toISOString(),
      received_by: session.name,
    })
    .eq('id', poId)
    .eq('status', 'draft')
    .select('id');
  if (!claimed || claimed.length === 0) {
    // Either the PO doesn't exist, is already received, or is cancelled.
    // Redirect back so the operator sees the current state.
    redirect(`/admin/inventory/purchase-orders/${poId}?error=Already%20processed`);
  }

  const { data: lines } = await admin
    .from('purchase_order_lines')
    .select('product_id, qty, unit_cost')
    .eq('po_id', poId);

  for (const ln of ((lines ?? []) as Array<{ product_id: string; qty: number; unit_cost: number | null }>)) {
    const { data: prod } = await admin
      .from('products')
      .select('stock, track_inventory')
      .eq('id', ln.product_id)
      .maybeSingle<{ stock: number; track_inventory: boolean | null }>();
    if (!prod) continue;
    const newStock = (prod.stock ?? 0) + ln.qty;
    if (prod.track_inventory !== false) {
      await admin.from('products').update({ stock: newStock }).eq('id', ln.product_id);
    }
    await admin.from('inventory_ledger').insert({
      product_id:    ln.product_id,
      qty_delta:     ln.qty,
      balance_after: newStock,
      reason:        'import',
      actor_kind:    session.isOwner ? 'owner' : 'staff',
      actor_email:   session.email,
      note:          `Received via PO ${poId.slice(0, 8)}${ln.unit_cost ? ` @ £${ln.unit_cost}` : ''}`,
    });
  }

  void logAudit(session, {
    action: 'po.receive',
    entity: 'purchase_orders',
    entity_id: poId,
    diff: { line_count: (lines ?? []).length },
  });
  revalidatePath('/admin/inventory');
  revalidatePath('/admin/inventory/purchase-orders');
  redirect(`/admin/inventory/purchase-orders/${poId}?ok=Stock%20received`);
}

export async function cancelPo(formData: FormData): Promise<void> {
  const session = await assertEdit();
  const poId = formData.get('po_id') as string;
  if (!poId) return;
  // Refuse to cancel a PO that has already been received. If we let it
  // through, the ledger keeps the receive rows but the PO is marked
  // cancelled — inventory drifts permanently with no compensating
  // movement. The `eq('status', 'draft')` clause means 0 rows update on
  // a received/cancelled PO.
  const { data: cancelled } = await supabaseAdmin()
    .from('purchase_orders')
    .update({ status: 'cancelled' })
    .eq('id', poId)
    .eq('status', 'draft')
    .select('id');
  if (!cancelled || cancelled.length === 0) {
    redirect(`/admin/inventory/purchase-orders/${poId}?error=Only%20draft%20POs%20can%20be%20cancelled`);
  }
  void logAudit(session, {
    action: 'po.cancel',
    entity: 'purchase_orders',
    entity_id: poId,
  });
  redirect('/admin/inventory/purchase-orders');
}
