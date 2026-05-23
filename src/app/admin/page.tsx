import { getStaffSession } from '@/lib/staff-auth';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/admin/LoginForm';

export default async function AdminLoginPage() {
  const session = await getStaffSession();
  if (session) redirect('/admin/dashboard');
  return <LoginForm />;
}
