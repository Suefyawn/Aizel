'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { createServerSupabase as authedClient } from '@/lib/supabase-server';
import { reviewLimiter, ipFromHeaders } from '@/lib/ratelimit';

interface ReturnItem { product_id: string; qty: number; name: string; price: number }

// authedClient() is the @supabase/ssr server client — reads the customer's
// session from cookies so RLS on order returns applies.

export async function requestReturn(args: {
  order_id: string;
  reason: string;
  items: ReturnItem[];
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const h = await headers();
  const { success } = await reviewLimiter.limit(`return:${ipFromHeaders(h)}`);
  if (!success) return { ok: false, error: 'Too many requests. Wait a minute.' };

  if (!args.order_id) return { ok: false, error: 'order_id required' };
  if (!args.reason || args.reason.trim().length < 5) return { ok: false, error: 'Please tell us why you\'re returning' };
  if (!Array.isArray(args.items) || args.items.length === 0) return { ok: false, error: 'Select at least one item' };

  const sb = await authedClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in' };

  const { data, error } = await sb.from('return_requests').insert({
    order_id:    args.order_id,
    user_id:     user.id,
    email:       user.email ?? null,
    reason:      args.reason.trim(),
    items:       args.items,
    status:      'pending',
  }).select('id').single();

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/account/orders/${args.order_id}`);
  revalidatePath('/account/orders');
  return { ok: true, id: data?.id as string };
}

// Admin-side decision actions live under /admin and use the service-role
// client; declaring them here keeps the customer/admin paths colocated.

import { getStaffSession } from '@/lib/staff-auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';

async function assertOrders() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('orders.edit'))) {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function approveReturn(args: {
  id: string;
  refund_amount: number;
  refund_method: 'store_credit' | 'coupon' | 'original' | 'cod_deduct';
  admin_note?: string;
}): Promise<{ error?: string; success?: boolean }> {
  const session = await assertOrders();
  if (args.refund_amount < 0) return { error: 'refund_amount must be >= 0' };

  // return_requests + loyalty_ledger are RLS-locked — staff-cookie auth
  // doesn't go through Supabase Auth, so we need the service-role client.
  const admin = supabaseAdmin();
  const { data: row } = await admin
    .from('return_requests')
    .select('id, user_id, items, order_id, status')
    .eq('id', args.id)
    .single();
  if (!row) return { error: 'return request not found' };
  if (row.status !== 'pending') return { error: `cannot approve a ${row.status} request` };

  const { error } = await admin
    .from('return_requests')
    .update({
      status: 'approved',
      refund_amount: args.refund_amount,
      refund_method: args.refund_method,
      admin_note: args.admin_note ?? null,
    })
    .eq('id', args.id);
  if (error) return { error: error.message };

  // Store-credit path: top up loyalty (1 £= 1 point per defaults).
  if (args.refund_method === 'store_credit' && row.user_id) {
    await admin.rpc('grant_loyalty_points' as never, {
      p_user_id:  row.user_id,
      p_delta:    Math.round(args.refund_amount),
      p_reason:   'refund_reversal',
      p_order_id: row.order_id,
      p_note:     `return ${args.id.slice(0,8)} approved as store credit`,
    } as never);
  }

  await logAudit(session, {
    action: 'return.approve',
    entity: 'return_request',
    entity_id: args.id,
    diff: { refund_amount: args.refund_amount, refund_method: args.refund_method },
  });
  revalidatePath('/admin/returns');
  return { success: true };
}

export async function rejectReturn(id: string, admin_note: string): Promise<{ error?: string; success?: boolean }> {
  const session = await assertOrders();
  const { error } = await supabaseAdmin()
    .from('return_requests')
    .update({ status: 'rejected', admin_note: admin_note || null })
    .eq('id', id);
  if (error) return { error: error.message };
  await logAudit(session, { action: 'return.reject', entity: 'return_request', entity_id: id, diff: { admin_note } });
  revalidatePath('/admin/returns');
  return { success: true };
}

// Mark an approved return as received and restock the items via the
// inventory ledger. Closes the loop: the units leave stock when the
// order is placed (place_order → record_stock_change reason='order')
// and re-enter stock here with reason='return' tying the ledger row
// back to the original return_request.
export async function markReturnReceived(id: string): Promise<{ error?: string; success?: boolean }> {
  const session = await assertOrders();
  const admin = supabaseAdmin();

  const { data: row } = await admin
    .from('return_requests')
    .select('id, status, items, order_id, user_id')
    .eq('id', id)
    .single();
  if (!row) return { error: 'return request not found' };
  if (row.status !== 'approved') {
    return { error: `cannot mark a ${row.status} return as received — approve it first` };
  }

  const items = (row.items ?? []) as Array<{ product_id: string; qty: number; variant_id?: string | null }>;

  // Restock each line via the ledger RPC. We do this BEFORE the status
  // update so a downstream failure doesn't leave the return marked
  // received with no stock movement.
  for (const it of items) {
    if (!it.product_id || !it.qty || it.qty <= 0) continue;
    const { error: rpcErr } = await admin.rpc('record_stock_change' as never, {
      p_product_id:  it.product_id,
      p_variant_id:  it.variant_id ?? null,
      p_qty_delta:   it.qty,
      p_reason:      'return',
      p_order_id:    row.order_id,
      p_return_id:   id,
      p_actor_kind:  session.isOwner ? 'owner' : 'staff',
      p_actor_email: session.email,
      p_note:        `Restock from return ${id.slice(0, 8)}`,
    } as never) as unknown as { error: { message: string } | null };
    if (rpcErr) return { error: `restock failed for product ${it.product_id}: ${rpcErr.message}` };
  }

  const { error } = await admin
    .from('return_requests')
    .update({ status: 'received' })
    .eq('id', id);
  if (error) return { error: error.message };

  await logAudit(session, {
    action: 'return.received',
    entity: 'return_request',
    entity_id: id,
    diff: { items_restocked: items.length },
  });
  revalidatePath('/admin/returns');
  revalidatePath('/admin/inventory');
  return { success: true };
}
