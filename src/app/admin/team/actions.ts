'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession, hashPassword, generateTempPassword, verifyPassword, upgradeStaffHash } from '@/lib/staff-auth';
import { sendStaffTempPasswordEmail } from '@/lib/email';
import { logAudit } from '@/lib/audit';
import type { Permission } from '@/lib/permissions';

async function assertOwner() {
  const session = await getStaffSession();
  if (!session?.isOwner) throw new Error('Unauthorized');
  return session;
}

export async function createStaffMember(
  _prev: { error?: string; tempPassword?: string } | null,
  formData: FormData
): Promise<{ error: string } | { tempPassword: string }> {
  const session = await assertOwner();

  const email = (formData.get('email') as string).trim().toLowerCase();
  const name = (formData.get('name') as string).trim();
  const roleId = ((formData.get('role_id') as string) ?? '').trim();
  // A staff member is either role-assigned (permissions inherited from the
  // role) or "Custom" (its own permissions column) — never both.
  const permissions = roleId ? [] : (formData.getAll('permissions') as Permission[]);

  if (!email || !name) return { error: 'Name and email are required' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Invalid email address' };

  const tempPassword = generateTempPassword();
  const hash = hashPassword(tempPassword); // scrypt now self-salts

  const { data: created, error } = await supabaseAdmin()
    .from('staff_members')
    .insert({
      email, name,
      permissions,
      role_id: roleId || null,
      password_hash: hash,
      password_salt: '',                 // empty for scrypt rows
      is_active: true,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') return { error: 'A staff member with this email already exists' };
    return { error: error.message };
  }

  // Best-effort: email the temp password too (the UI still shows it in case Resend isn't configured).
  // `after()` so the lambda doesn't get killed mid-send the moment we return.
  after(() => sendStaffTempPasswordEmail({ email, name, tempPassword }));

  void logAudit(session, {
    action: 'staff.create',
    entity: 'staff_members',
    entity_id: created?.id ?? null,
    diff: { email, name, permissions, role_id: roleId || null },
  });

  revalidatePath('/admin/team');
  return { tempPassword };
}

export async function updateStaffPermissions(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const session = await assertOwner();

  const id = formData.get('id') as string;
  const name = (formData.get('name') as string).trim();
  const roleId = ((formData.get('role_id') as string) ?? '').trim();
  const permissions = roleId ? [] : (formData.getAll('permissions') as Permission[]);

  const { error } = await supabaseAdmin()
    .from('staff_members')
    .update({ name, permissions, role_id: roleId || null })
    .eq('id', id);

  if (error) return { error: error.message };
  void logAudit(session, {
    action: 'staff.update',
    entity: 'staff_members',
    entity_id: id,
    diff: { name, permissions, role_id: roleId || null },
  });
  revalidatePath('/admin/team');
  return null;
}

export async function toggleStaffActive(formData: FormData): Promise<void> {
  const session = await assertOwner();

  const id = formData.get('id') as string;
  const isActive = formData.get('is_active') === 'true';

  const { error } = await supabaseAdmin()
    .from('staff_members')
    .update({ is_active: !isActive })
    .eq('id', id);
  if (error) {
    redirect(`/admin/team?error=${encodeURIComponent('Could not change status: ' + error.message)}`);
  }

  void logAudit(session, {
    action: isActive ? 'staff.deactivate' : 'staff.activate',
    entity: 'staff_members',
    entity_id: id,
  });
  revalidatePath('/admin/team');
}

export async function resetStaffPassword(
  _prev: { error?: string; tempPassword?: string } | null,
  formData: FormData
): Promise<{ error: string } | { tempPassword: string }> {
  const session = await assertOwner();

  const id = formData.get('id') as string;
  const tempPassword = generateTempPassword();
  const hash = hashPassword(tempPassword);

  const { data: staff, error } = await supabaseAdmin()
    .from('staff_members')
    .update({ password_hash: hash, password_salt: '' })
    .eq('id', id)
    .select('email, name')
    .single();

  if (error) return { error: error.message };
  if (staff?.email && staff?.name) {
    after(() => sendStaffTempPasswordEmail({ email: staff.email, name: staff.name, tempPassword }));
  }
  void logAudit(session, {
    action: 'staff.reset_password',
    entity: 'staff_members',
    entity_id: id,
    diff: { target_email: staff?.email },
  });
  revalidatePath('/admin/team');
  return { tempPassword };
}

export async function deleteStaffMember(formData: FormData): Promise<void> {
  const session = await assertOwner();

  const id = formData.get('id') as string;
  // Capture identifying info BEFORE the delete so the audit row has it.
  const { data: target } = await supabaseAdmin()
    .from('staff_members').select('email, name').eq('id', id).single();

  const { error } = await supabaseAdmin().from('staff_members').delete().eq('id', id);
  if (error) {
    redirect(`/admin/team?error=${encodeURIComponent('Could not delete member: ' + error.message)}`);
  }
  void logAudit(session, {
    action: 'staff.delete',
    entity: 'staff_members',
    entity_id: id,
    diff: { email: target?.email, name: target?.name },
  });
  revalidatePath('/admin/team');
}

// Used by staff profile page
export async function changeMyPassword(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error: string } | { success: true }> {
  const session = await getStaffSession();
  if (!session || session.isOwner) return { error: 'Unauthorized' };

  const current = formData.get('current_password') as string;
  const next = formData.get('new_password') as string;
  const confirm = formData.get('confirm_password') as string;

  if (!current || !next) return { error: 'All fields are required' };
  if (next.length < 8) return { error: 'New password must be at least 8 characters' };
  if (next !== confirm) return { error: 'Passwords do not match' };

  const { data } = await supabaseAdmin()
    .from('staff_members')
    .select('password_hash, password_salt')
    .eq('id', session.id)
    .single();

  if (!data) return { error: 'Account not found' };

  const verify = verifyPassword(current, data.password_hash, data.password_salt);
  if (!verify.ok) return { error: 'Current password is incorrect' };

  // Always store the new password as scrypt, regardless of legacy state.
  const newHash = hashPassword(next);
  await upgradeStaffHash(session.id, newHash);

  return { success: true };
}
