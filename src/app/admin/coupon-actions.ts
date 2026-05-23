'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { assertPermission } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit';
import { log } from '@/lib/logger';

// Errors are surfaced to the user via ?error=... on the coupons page rather
// than swallowed silently — the previous version dropped insert errors on the
// floor, leaving the admin with a cleared form and no idea why nothing
// happened (QA Session 2 finding).
function bounceCoupons(error: string): never {
  redirect(`/admin/coupons?error=${encodeURIComponent(error)}`);
}

export async function createCoupon(formData: FormData) {
  const session = await assertPermission('coupons');
  const code = ((formData.get('code') as string) ?? '').trim().toUpperCase();
  const type = formData.get('type') as 'percent' | 'fixed';
  const valueRaw = formData.get('value');
  const value = Number(valueRaw);
  const min_order = Number(formData.get('min_order') ?? 0);
  const max_uses = formData.get('max_uses') ? Number(formData.get('max_uses')) : null;
  const expires_at = (formData.get('expires_at') as string) || null;

  if (!code) bounceCoupons('Code is required.');
  if (!type) bounceCoupons('Type is required.');
  if (!valueRaw || !Number.isFinite(value)) bounceCoupons('Value is required.');
  if (!/^[A-Z0-9_-]+$/.test(code)) {
    bounceCoupons('Code may only contain letters, numbers, - and _.');
  }
  if (value <= 0) bounceCoupons('Value must be greater than zero.');
  if (type === 'percent' && value > 100) {
    bounceCoupons('A percentage discount cannot exceed 100%.');
  }

  // coupons RLS bars anon write/read after migration 070; admin
  // mutations must go through the service role.
  const { data: created, error } = await supabaseAdmin()
    .from('coupons')
    .insert({ code, type, value, min_order, max_uses, expires_at })
    .select('id')
    .single();

  if (error || !created) {
    log.error('coupon.create_failed', { code, error: error?.message });
    // Postgres 23505 — UNIQUE violation on coupon code.
    if ((error as { code?: string } | null)?.code === '23505') {
      bounceCoupons(`A coupon with code "${code}" already exists.`);
    }
    bounceCoupons(error?.message ?? 'Could not create coupon. Please try again.');
  }

  void logAudit(session, {
    action: 'coupon.create', entity: 'coupons', entity_id: created.id,
    diff: { code, type, value, min_order, max_uses, expires_at },
  });
  revalidatePath('/admin/coupons');
  redirect(`/admin/coupons?created=${encodeURIComponent(code)}`);
}

export async function updateCoupon(
  _prev: { error?: string; ok?: boolean } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await assertPermission('coupons');
  const id = formData.get('id') as string;
  const code = (formData.get('code') as string).trim().toUpperCase();
  const type = formData.get('type') as 'percent' | 'fixed';
  const value = Number(formData.get('value'));
  const min_order = Number(formData.get('min_order') ?? 0);
  const max_uses = formData.get('max_uses') ? Number(formData.get('max_uses')) : null;
  const expires_at = (formData.get('expires_at') as string) || null;

  if (!id) return { error: 'Missing coupon id.' };
  if (!code || !type || !value) return { error: 'Code, type and value are required.' };
  if (!/^[A-Z0-9_-]+$/.test(code)) return { error: 'Code may only contain letters, numbers, - and _.' };
  if (value <= 0) return { error: 'Value must be greater than zero.' };
  if (type === 'percent' && value > 100) return { error: 'A percentage discount cannot exceed 100%.' };

  const { error } = await supabaseAdmin()
    .from('coupons')
    .update({ code, type, value, min_order, max_uses, expires_at })
    .eq('id', id);
  if (error) return { error: error.message };

  void logAudit(session, {
    action: 'coupon.update', entity: 'coupons', entity_id: id,
    diff: { code, type, value, min_order, max_uses, expires_at },
  });
  revalidatePath('/admin/coupons');
  return { ok: true };
}

export async function deleteCoupon(formData: FormData) {
  const session = await assertPermission('coupons');
  const id = formData.get('id') as string;
  if (!id) bounceCoupons('Missing coupon id.');

  const { data: target } = await supabaseAdmin().from('coupons').select('code').eq('id', id).single();
  const { error } = await supabaseAdmin().from('coupons').delete().eq('id', id);
  if (error) {
    log.error('coupon.delete_failed', { id, error: error.message });
    bounceCoupons(`Could not delete coupon: ${error.message}`);
  }

  void logAudit(session, {
    action: 'coupon.delete', entity: 'coupons', entity_id: id,
    diff: { code: target?.code },
  });
  revalidatePath('/admin/coupons');
}

export async function toggleCoupon(id: string, active: boolean) {
  const session = await assertPermission('coupons');
  const { error } = await supabaseAdmin().from('coupons').update({ active }).eq('id', id);
  if (error) {
    log.error('coupon.toggle_failed', { id, active, error: error.message });
    bounceCoupons(`Could not change coupon status: ${error.message}`);
  }
  void logAudit(session, {
    action: active ? 'coupon.activate' : 'coupon.deactivate',
    entity: 'coupons', entity_id: id,
  });
  revalidatePath('/admin/coupons');
}
