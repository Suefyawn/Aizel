'use server';

import { createHash, timingSafeEqual } from 'crypto';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import {
  hashPassword, verifyPassword, upgradeStaffHash,
  setStaffCookie, clearStaffCookie,
} from '@/lib/staff-auth';
import { authLimiter, ipFromHeaders } from '@/lib/ratelimit';
import { assertPermission } from '@/lib/admin-auth';
import { productInputSchema, blogPostInputSchema, parseForm, firstError } from '@/lib/validators';
import { logAudit } from '@/lib/audit';
import { verifyTotp } from '@/lib/totp';
import type { OrderStatus } from '@/types';

// ─── Auth ────────────────────────────────────────────────────────────────────

async function checkAuthRate(): Promise<{ error: string } | null> {
  const h = await headers();
  const ip = ipFromHeaders(h);
  const { success } = await authLimiter.limit(ip);
  if (!success) return { error: 'Too many attempts. Wait a minute, then try again.' };
  return null;
}

export async function loginAdmin(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const rateError = await checkAuthRate();
  if (rateError) return rateError;

  const password = formData.get('password') as string;
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return { error: 'Admin access is not configured. Set ADMIN_PASSWORD environment variable.' };
  // Constant-time compare on equal-length inputs only.
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { error: 'Incorrect password' };
  }
  // P1 audit fix: cookie value is now an HMAC-signed payload with a
  // timestamp instead of base64(password). Anyone who reads the cookie
  // can no longer recover the password, and an old leaked cookie expires
  // server-side after 7 days regardless of when the client gives it back.
  const { sign, OWNER_COOKIE_NAME, OWNER_COOKIE_TTL_SEC } = await import('@/lib/signed-cookie');
  const { STAFF_SESSION_SECRET } = await import('@/lib/session-secret');
  const token = await sign({ sub: 'owner' }, STAFF_SESSION_SECRET());
  const store = await cookies();
  store.set(OWNER_COOKIE_NAME, token, {
    httpOnly: true,
    // Always secure — even on Vercel previews this rides HTTPS.
    secure: true,
    maxAge: OWNER_COOKIE_TTL_SEC,
    path: '/',
    sameSite: 'lax',
  });
  redirect('/admin/dashboard');
}

export async function loginStaff(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const rateError = await checkAuthRate();
  if (rateError) return rateError;

  const email = (formData.get('email') as string).trim().toLowerCase();
  const password = formData.get('password') as string;
  const totpCode = (formData.get('totp') as string | null)?.trim() ?? '';
  if (!email || !password) return { error: 'Email and password are required' };

  const { data } = await supabaseAdmin()
    .from('staff_members')
    .select('id, password_hash, password_salt, is_active, totp_enabled, totp_secret, backup_codes')
    .eq('email', email)
    .single();

  if (!data || !data.is_active) return { error: 'Invalid email or password' };

  const verify = verifyPassword(password, data.password_hash, data.password_salt);
  if (!verify.ok) return { error: 'Invalid email or password' };

  if (verify.upgraded) {
    await upgradeStaffHash(data.id, verify.upgraded.newHash);
  }

  // 2FA gate, if enabled for this staff member.
  if (data.totp_enabled && data.totp_secret) {
    if (!totpCode) return { error: 'Enter your 2FA code from your authenticator app' };
    const codeIsTotp = verifyTotp(data.totp_secret as string, totpCode);
    let codeIsBackup = false;
    let backupCodes = (data.backup_codes as string[]) ?? [];
    if (!codeIsTotp) {
      // Backup codes are stored as SHA-256(lowercased, whitespace-stripped)
      // since the 2fa-actions enrollment switch. Compute the hash of the
      // submitted code and look it up in the stored hash list. Old plaintext
      // codes from before the switch will fail to match — staff will have to
      // re-enroll once. Hash strings are 64-char lowercase hex so they can't
      // collide with the old 8-char hex plaintext.
      const cleaned = totpCode.replace(/\s+/g, '').toLowerCase();
      const submittedHash = createHash('sha256').update(cleaned).digest('hex');
      const idx = backupCodes.findIndex(c => c === submittedHash);
      if (idx >= 0) {
        codeIsBackup = true;
        backupCodes = backupCodes.filter((_, i) => i !== idx);
        await supabaseAdmin().from('staff_members').update({ backup_codes: backupCodes }).eq('id', data.id);
      }
    }
    if (!codeIsTotp && !codeIsBackup) return { error: 'Invalid 2FA code' };
  }

  await setStaffCookie(data.id);
  redirect('/admin/dashboard');
}

export async function logoutAdmin() {
  const store = await cookies();
  store.delete('admin_session');
  await clearStaffCookie();
  redirect('/admin');
}

// ─── Products ────────────────────────────────────────────────────────────────

export async function createProduct(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const session = await assertPermission('products.edit');
  const parsed = parseForm(productInputSchema, formData);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { data, error } = await supabaseAdmin().from('products').insert(parsed.data).select('id').single();
  if (error) return { error: error.message };
  await logAudit(session, { action: 'product.create', entity: 'product', entity_id: data?.id as string | undefined, diff: parsed.data });
  revalidatePath('/admin/products');
  redirect('/admin/products');
}

export async function updateProduct(
  id: string,
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const session = await assertPermission('products.edit');
  const parsed = parseForm(productInputSchema, formData);
  if (!parsed.success) return { error: firstError(parsed.error) };
  // Snapshot the prior state for the audit diff.
  const { data: before } = await supabaseAdmin().from('products').select('*').eq('id', id).maybeSingle();
  const { error } = await supabaseAdmin().from('products').update(parsed.data).eq('id', id);
  if (error) return { error: error.message };
  await logAudit(session, { action: 'product.update', entity: 'product', entity_id: id, diff: { before, after: parsed.data } });
  revalidatePath('/admin/products');
  redirect('/admin/products');
}

export async function deleteProduct(formData: FormData) {
  const session = await assertPermission('products.delete');
  const id = formData.get('id') as string;
  const admin = supabaseAdmin();

  // A product that has ever appeared in a customer order is archived, not
  // hard-deleted. Orders snapshot their line items as denormalised jsonb keyed
  // by product id, and Analytics (Top Products) joins that id back to the
  // products table for the display name. Deleting the row would leave
  // "Unknown product (deleted)" entries and break the order detail view.
  // Archiving keeps the row but hides it from the storefront via status.
  const { productsWithOrderHistory } = await import('@/lib/product-archive');
  const referenced = await productsWithOrderHistory([id]);
  if (referenced.has(id)) {
    const { error } = await admin.from('products').update({ status: 'archived' }).eq('id', id);
    if (error) {
      redirect(`/admin/products?error=${encodeURIComponent(error.message)}`);
    }
    await logAudit(session, { action: 'product.archive', entity: 'product', entity_id: id, diff: { reason: 'has_order_history' } });
    revalidatePath('/admin/products');
    redirect('/admin/products?archived=1');
  }

  const { error } = await admin.from('products').delete().eq('id', id);
  if (error) {
    // Surface via query string. Index page reads ?error= and shows a toast.
    redirect(`/admin/products?error=${encodeURIComponent(error.message)}`);
  }
  await logAudit(session, { action: 'product.delete', entity: 'product', entity_id: id });
  revalidatePath('/admin/products');
  redirect('/admin/products?deleted=1');
}

// ─── Blog ─────────────────────────────────────────────────────────────────────

export async function createBlogPost(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const session = await assertPermission('blog');
  // checkbox quirk: when unchecked, `featured` is absent from FormData.
  const normalized = new FormData();
  for (const [k, v] of formData.entries()) normalized.append(k, v);
  if (!normalized.has('featured')) normalized.append('featured', 'false');
  else normalized.set('featured', normalized.get('featured') === 'on' ? 'true' : String(normalized.get('featured')));

  const parsed = parseForm(blogPostInputSchema, normalized);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { data, error } = await supabaseAdmin()
    .from('blog_posts').insert(parsed.data).select('id').single();
  if (error) return { error: error.message };
  await logAudit(session, {
    action: 'blog.create', entity: 'blog_post',
    entity_id: (data as { id?: string } | null)?.id,
    diff: parsed.data,
  });
  revalidatePath('/admin/blog');
  redirect('/admin/blog');
}

export async function updateBlogPost(
  id: string,
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const session = await assertPermission('blog');
  const normalized = new FormData();
  for (const [k, v] of formData.entries()) normalized.append(k, v);
  if (!normalized.has('featured')) normalized.append('featured', 'false');
  else normalized.set('featured', normalized.get('featured') === 'on' ? 'true' : String(normalized.get('featured')));

  const parsed = parseForm(blogPostInputSchema, normalized);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const admin = supabaseAdmin();
  const { data: before } = await admin
    .from('blog_posts').select('*').eq('id', id).maybeSingle();
  const { error } = await admin.from('blog_posts').update(parsed.data).eq('id', id);
  if (error) return { error: error.message };
  await logAudit(session, {
    action: 'blog.update', entity: 'blog_post', entity_id: id,
    diff: { before, after: parsed.data },
  });
  revalidatePath('/admin/blog');
  redirect('/admin/blog');
}

export async function deleteBlogPost(formData: FormData) {
  const session = await assertPermission('blog');
  const id = formData.get('id') as string;
  const admin = supabaseAdmin();
  // Capture the title before delete so the audit row carries useful context
  // (audit_log keeps the row indefinitely; the blog_posts row will be gone).
  const { data: before } = await admin
    .from('blog_posts').select('title, slug').eq('id', id).maybeSingle();
  const { error } = await admin.from('blog_posts').delete().eq('id', id);
  if (error) {
    redirect(`/admin/blog?error=${encodeURIComponent(error.message)}`);
  }
  await logAudit(session, {
    action: 'blog.delete', entity: 'blog_post', entity_id: id,
    diff: before ?? undefined,
  });
  revalidatePath('/admin/blog');
  redirect('/admin/blog?deleted=1');
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export async function bulkUpdateOrderStatus(ids: string[], status: OrderStatus): Promise<{ error?: string; count?: number }> {
  await assertPermission('orders.edit');
  // orders RLS bars anon writes; service role is required for admin
  // mutations.
  const { error, count } = await supabaseAdmin()
    .from('orders')
    .update({ status }, { count: 'exact' })
    .in('id', ids);
  if (error) return { error: error.message };
  revalidatePath('/admin/orders');
  return { count: count ?? ids.length };
}

export async function updateOrderStatus(
  id: string,
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const session = await assertPermission('orders.edit');
  const status = formData.get('status') as OrderStatus;

  // Read current state so we can detect transitions, email the customer,
  // and (for cancellation) restock the items. Both reads and writes need
  // the service role under the post-070 RLS.
  const admin = supabaseAdmin();
  const { data: before } = await admin
    .from('orders')
    .select('status, email, first_name, phone, order_number, items, tracking_number, courier')
    .eq('id', id)
    .single();

  // Tracking number + courier are owned exclusively by the Shipment
  // section (the `shipments` table syncs them onto `orders` via trigger).
  // This action only moves order status — writing tracking here would
  // null out a booked shipment whenever the merchant changes status.
  const { error } = await admin
    .from('orders')
    .update({ status })
    .eq('id', id);
  if (error) return { error: error.message };

  // Cancellation restock: when an order moves from a non-cancelled state
  // to cancelled, push the items back into stock via the inventory ledger.
  // place_order debited the stock at order-creation time (migration 079);
  // this is the symmetric credit. We use reason='cancellation' (migration
  // 080) so the trail in /admin/inventory distinguishes it from a real
  // customer return. Idempotency: only fires on the transition, not on a
  // no-op "cancelled → cancelled" submit.
  if (before && before.status !== 'cancelled' && status === 'cancelled') {
    const items = (before.items ?? []) as Array<{ id: string; qty: number; variant_id?: string | null }>;
    for (const it of items) {
      if (!it?.id || !it.qty || it.qty <= 0) continue;
      await admin.rpc('record_stock_change' as never, {
        p_product_id:  it.id,
        p_variant_id:  it.variant_id ?? null,
        p_qty_delta:   it.qty,
        p_reason:      'cancellation',
        p_order_id:    id,
        p_return_id:   null,
        p_actor_kind:  session?.isOwner ? 'owner' : session ? 'staff' : 'system',
        p_actor_email: session?.email ?? null,
        p_note:        `Restock from order cancellation ${before.order_number ?? id.slice(0, 8)}`,
      } as never);
    }
    revalidatePath('/admin/inventory');
  }

  // Fire-and-forget transition notifications. The status trigger logs the
  // change to order_events; here we only handle the customer-facing email
  // + SMS. Both are best-effort — neither blocks the status update.
  if (before && before.status !== status) {
    const phone = (before as { phone?: string | null }).phone ?? null;
    if (before.email) {
      const { sendShippedEmail, sendDeliveredEmail, sendCancelledEmail } = await import('@/lib/email');
      const args = {
        email: before.email,
        first_name: before.first_name ?? 'there',
        order_number: before.order_number,
      };
      if (status === 'shipped') {
        void sendShippedEmail({ ...args, tracking_number: before.tracking_number ?? undefined, courier: before.courier ?? undefined });
      } else if (status === 'delivered') {
        void sendDeliveredEmail(args);
      } else if (status === 'cancelled') {
        void sendCancelledEmail(args);
      }
    }
    // Customer SMS — fires only when Twilio is configured AND we have a
    // phone number on the order. The Twilio helper rejects non-UK numbers
    // gracefully so a malformed phone never bubbles an error here.
    if (phone) {
      const twilio = await import('@/lib/notifications/twilio');
      if (twilio.isConfigured()) {
        const smsArgs = {
          phone,
          firstName: before.first_name ?? undefined,
          orderNumber: before.order_number,
        };
        if (status === 'shipped') {
          void twilio.sendOrderShippedSms({
            ...smsArgs,
            courier: before.courier ?? undefined,
            trackingNumber: before.tracking_number ?? undefined,
          });
        } else if (status === 'delivered') {
          void twilio.sendOrderDeliveredSms(smsArgs);
        }
      }
    }
  }

  revalidatePath(`/admin/orders/${id}`);
  revalidatePath('/admin/orders');
  return { success: true };
}

// Hashed temp-password export so the staff/team UI keeps working.
export { hashPassword };
