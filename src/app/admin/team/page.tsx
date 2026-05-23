import { redirect } from 'next/navigation';
import { getStaffSession } from '@/lib/staff-auth';
import { supabaseAdmin } from '@/lib/supabase';
import { TeamPage } from '@/components/admin/TeamPage';

export const metadata = { title: 'Team — Admin' };

export default async function Page() {
  const session = await getStaffSession();
  if (!session?.isOwner) redirect('/admin/dashboard');

  const [{ data: staff }, { data: roles }] = await Promise.all([
    supabaseAdmin()
      .from('staff_members')
      .select('id, email, name, permissions, is_active, created_at, role_id')
      .order('created_at', { ascending: true }),
    supabaseAdmin()
      .from('roles')
      .select('id, name, description, permissions, is_system')
      .order('name', { ascending: true }),
  ]);

  return <TeamPage staff={staff ?? []} roles={roles ?? []} />;
}
