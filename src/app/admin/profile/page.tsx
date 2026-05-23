import { redirect } from 'next/navigation';
import { getStaffSession } from '@/lib/staff-auth';
import { supabaseAdmin } from '@/lib/supabase';
import { ProfilePage } from '@/components/admin/ProfilePage';

export const metadata = { title: 'My Profile — Admin' };

export default async function Page() {
  const session = await getStaffSession();
  if (!session) redirect('/admin');
  if (session.isOwner) redirect('/admin/dashboard'); // owner has no profile page

  const { data } = await supabaseAdmin()
    .from('staff_members')
    .select('totp_enabled')
    .eq('id', session.id)
    .maybeSingle();

  return (
    <ProfilePage
      name={session.name}
      email={session.email}
      twoFaEnabled={Boolean(data?.totp_enabled)}
    />
  );
}
