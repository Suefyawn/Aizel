export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { listSegments } from './actions';
import { BlastComposer } from '@/components/admin/BlastComposer';

export default async function BlastPage() {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('newsletter')) {
    return <NoAccess section="Marketing" />;
  }

  const segments = await listSegments();

  return (
    <div style={{ padding: '32px 36px', maxWidth: 920 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <Link href="/admin/newsletter" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem' }}>← Newsletter</Link>
        <span style={{ color: '#d1d5db' }}>/</span>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Send a blast</h1>
      </div>
      <p style={{ margin: '0 0 24px', fontSize: '0.8125rem', color: '#6b7280' }}>
        Compose a marketing email and send it to a customer segment.
        Every send is batch-capped + carries an unsubscribe footer; opted-out
        customers are excluded automatically. <strong>Start with a test send</strong> —
        the first preview always goes to your staff email only.
      </p>

      <BlastComposer segments={segments} />
    </div>
  );
}
