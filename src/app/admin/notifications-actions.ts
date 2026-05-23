'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';

async function assertAnyStaff() {
  const session = await getStaffSession();
  if (!session) throw new Error('Unauthorized');
  return session;
}

export async function markNotificationRead(id: string): Promise<void> {
  await assertAnyStaff();
  await supabaseAdmin().from('admin_notifications').update({ read: true }).eq('id', id);
  revalidatePath('/admin', 'layout');
}

export async function markAllNotificationsRead(): Promise<void> {
  await assertAnyStaff();
  await supabaseAdmin().from('admin_notifications').update({ read: true }).eq('read', false);
  revalidatePath('/admin', 'layout');
}
