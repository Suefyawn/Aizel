export const dynamic = 'force-dynamic';
// The send action runs from this route — give it headroom over the platform
// default so a campaign send is never killed mid-flight.
export const maxDuration = 60;

import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { NewsletterComposer } from '@/components/admin/NewsletterComposer';
import { SubscriberList, type Subscriber } from '@/components/admin/SubscriberList';
import { PageTabs } from '@/components/admin/PageTabs';

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

interface CampaignRow {
  id: string;
  subject: string;
  recipient_count: number;
  sent_count: number;
  sent_by: string | null;
  created_at: string;
}

export default async function NewsletterPage() {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('newsletter')) {
    return <NoAccess section="Newsletter" />;
  }

  // newsletter_subscribers + newsletter_campaigns are RLS-locked to the
  // service role — staff-cookie auth needs supabaseAdmin() to read them.
  const admin = supabaseAdmin();
  const [{ count: activeCount }, { data: campaignRows }, { data: subscriberRows }] = await Promise.all([
    admin
      .from('newsletter_subscribers')
      .select('id', { count: 'exact', head: true })
      .is('unsubscribed_at', null),
    admin
      .from('newsletter_campaigns')
      .select('id, subject, recipient_count, sent_count, sent_by, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
    admin
      .from('newsletter_subscribers')
      .select('id, email, source, unsubscribed_at, created_at')
      .order('created_at', { ascending: false })
      .limit(2000),
  ]);

  const activeSubscribers = activeCount ?? 0;
  const campaigns = (campaignRows ?? []) as CampaignRow[];
  const subscribers = (subscriberRows ?? []) as Subscriber[];

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Newsletter</h1>
      <p style={{ margin: '0 0 16px', color: '#6b7280', fontSize: '0.875rem' }}>
        Write a note and send it to everyone on the mailing list.{' '}
        <strong style={{ color: '#111827' }}>{activeSubscribers}</strong> active subscriber{activeSubscribers === 1 ? '' : 's'}.
      </p>

      {/* Newsletter (full list) and the targeted Blast composer share this
          surface — Blast lost its sidebar slot and is reachable via this tab. */}
      <PageTabs
        current="/admin/newsletter"
        tabs={[
          { label: 'Subscribers',   href: '/admin/newsletter' },
          { label: 'Compose blast', href: '/admin/marketing/blast' },
        ]}
      />

      <NewsletterComposer activeCount={activeSubscribers} />

      <SubscriberList subscribers={subscribers} />

      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Sent newsletters</h2>
        </div>
        {campaigns.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            No newsletters sent yet.
          </div>
        ) : (
          <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Subject', 'Delivered', 'Sent by', 'Date'].map(h => (
                  <th key={h} scope="col" style={{ padding: '11px 20px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c, i) => (
                <tr key={c.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                  <td data-label="Subject" style={{ padding: '12px 20px', fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
                    {c.subject}
                  </td>
                  <td data-label="Delivered" style={{ padding: '12px 20px', fontSize: '0.875rem', color: '#374151', whiteSpace: 'nowrap' }}>
                    {c.sent_count} / {c.recipient_count}
                  </td>
                  <td data-label="Sent by" style={{ padding: '12px 20px', fontSize: '0.8125rem', color: '#6b7280' }}>
                    {c.sent_by ?? '—'}
                  </td>
                  <td data-label="Date" style={{ padding: '12px 20px', fontSize: '0.8125rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                    {fmtDate(c.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
