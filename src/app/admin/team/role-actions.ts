'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { assertOwner } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit';
import type { Permission } from '@/lib/permissions';

// Role CRUD. Roles are owner-managed permission bundles in the `roles` table;
// assigning one to a staff member is handled in ./actions.ts. Built-in roles
// (is_system) can be edited but not deleted.

export async function createRole(
  _prev: { error?: string; ok?: true } | null,
  formData: FormData
): Promise<{ error: string } | { ok: true }> {
  const session = await assertOwner();

  const name = ((formData.get('name') as string) ?? '').trim();
  const description = ((formData.get('description') as string) ?? '').trim();
  const permissions = formData.getAll('permissions') as Permission[];
  if (!name) return { error: 'Role name is required' };

  const { data, error } = await supabaseAdmin()
    .from('roles')
    .insert({ name, description, permissions })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') return { error: 'A role with this name already exists' };
    return { error: error.message };
  }

  void logAudit(session, {
    action: 'role.create',
    entity: 'roles',
    entity_id: (data?.id as string | undefined) ?? null,
    diff: { name, description, permissions },
  });
  revalidatePath('/admin/team');
  return { ok: true };
}

export async function updateRole(
  _prev: { error?: string; ok?: true } | null,
  formData: FormData
): Promise<{ error: string } | { ok: true }> {
  const session = await assertOwner();

  const id = formData.get('id') as string;
  const name = ((formData.get('name') as string) ?? '').trim();
  const description = ((formData.get('description') as string) ?? '').trim();
  const permissions = formData.getAll('permissions') as Permission[];
  if (!name) return { error: 'Role name is required' };

  const { error } = await supabaseAdmin()
    .from('roles')
    .update({ name, description, permissions, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    if (error.code === '23505') return { error: 'A role with this name already exists' };
    return { error: error.message };
  }

  void logAudit(session, {
    action: 'role.update',
    entity: 'roles',
    entity_id: id,
    diff: { name, description, permissions },
  });
  revalidatePath('/admin/team');
  return { ok: true };
}

export async function deleteRole(formData: FormData): Promise<void> {
  const session = await assertOwner();

  const id = formData.get('id') as string;
  const { data: role } = await supabaseAdmin()
    .from('roles')
    .select('name, is_system')
    .eq('id', id)
    .single();

  if (role?.is_system) {
    redirect(`/admin/team?error=${encodeURIComponent("Built-in roles can't be deleted.")}`);
  }

  // Staff assigned to this role are detached by the ON DELETE SET NULL FK and
  // fall back to their own permissions column ("Custom").
  const { error } = await supabaseAdmin().from('roles').delete().eq('id', id);
  if (error) {
    redirect(`/admin/team?error=${encodeURIComponent('Could not delete role: ' + error.message)}`);
  }

  void logAudit(session, {
    action: 'role.delete',
    entity: 'roles',
    entity_id: id,
    diff: { name: role?.name },
  });
  revalidatePath('/admin/team');
}
