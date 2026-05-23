import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getStaffSession } from '@/lib/staff-auth';
import { SettingsNav } from '@/components/admin/SettingsNav';

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('settings')) {
    redirect('/admin/dashboard');
  }

  return (
    <div className="adm-page adm-settings-layout" style={{ padding: '32px 36px', maxWidth: 1080 }}>
      <SettingsNav />
      <div style={{ flex: 1, minWidth: 0, maxWidth: 780 }}>
        {children}
      </div>
    </div>
  );
}
