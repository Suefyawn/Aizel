export const dynamic = 'force-dynamic';

import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { listSegments } from './actions';
import { BlastComposer } from '@/components/admin/BlastComposer';
import { PageTabs } from '@/components/admin/PageTabs';

export default async function BlastPage() {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('newsletter')) {
    return <NoAccess section="Marketing" />;
  }

  const segments = await listSegments();

  return (
    <div style={{ padding: '32px 36px', maxWidth: 920 }}>
      <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Send a blast</h1>
      <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: '#6b7280' }}>
        Compose a marketing email and send it to a customer segment.
        Every send is batch-capped + carries an unsubscribe footer; opted-out
        customers are excluded automatically. <strong>Start with a test send</strong> —
        the first preview always goes to your staff email only.
      </p>

      {/* Tabs let staff jump between the whole-list send and the segment-
          targeted blast in one click — the blast page no longer has its
          own sidebar entry. */}
      <PageTabs
        current="/admin/marketing/blast"
        tabs={[
          { label: 'Subscribers',   href: '/admin/newsletter' },
          { label: 'Compose blast', href: '/admin/marketing/blast' },
        ]}
      />

      <BlastComposer segments={segments} />
    </div>
  );
}
