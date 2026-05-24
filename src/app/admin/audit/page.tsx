export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';

interface AuditRow {
  id: string;
  actor_kind: 'owner' | 'staff' | 'system' | 'customer';
  actor_email: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  diff: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
}

const ROW_LIMIT = 300;

// Friendly labels for the events the activity triggers + audit helper emit.
const ACTION_LABELS: Record<string, string> = {
  'order.placed':          'Order placed',
  'order.status_changed':  'Order status changed',
  'customer.signup':       'New customer',
  'review.submitted':      'Review submitted',
  'subscription.created':  'Subscribed to product',
  'newsletter.signup':     'Newsletter signup',
};

function prettyAction(code: string): string {
  if (ACTION_LABELS[code]) return ACTION_LABELS[code];
  const spaced = code.replace(/[._]/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// Where an entity row links to in the admin, when it has a detail page.
function entityHref(entity: string | null, entityId: string | null): string | null {
  if (!entity || !entityId) return null;
  if (entity === 'order')    return `/admin/orders/${entityId}`;
  if (entity === 'customer') return `/admin/users/${entityId}`;
  if (entity === 'product')  return `/admin/products/${entityId}`;
  return null;
}

const ACTOR_COLORS: Record<string, string> = {
  owner: '#4A1A6B', staff: '#3b82f6', customer: '#16a34a', system: '#6b7280',
};

const FILTERS: { key: string; label: string }[] = [
  { key: 'all',      label: 'All activity' },
  { key: 'customer', label: 'Customers' },
  { key: 'staff',    label: 'Staff' },
  { key: 'owner',    label: 'Owner' },
  { key: 'system',   label: 'System' },
];

export default async function ActivityLogPage({
  searchParams,
}: {
  searchParams: Promise<{ actor?: string; q?: string }>;
}) {
  const session = await getStaffSession();
  if (!session?.isOwner) {
    return <NoAccess section="Activity log" />;
  }

  const { actor = 'all', q = '' } = await searchParams;
  const search = q.trim();

  // audit_log RLS has no anon SELECT policy. Service role bypasses RLS
  // and is the correct credential for an owner-only internal view.
  let query = supabaseAdmin()
    .from('audit_log')
    .select('id, actor_kind, actor_email, action, entity, entity_id, diff, ip, created_at')
    .order('created_at', { ascending: false })
    .limit(ROW_LIMIT);
  if (actor !== 'all') query = query.eq('actor_kind', actor);
  if (search) query = query.ilike('action', `%${search}%`);

  const { data } = await query;
  const rows = (data ?? []) as AuditRow[];

  const chipBase: React.CSSProperties = {
    padding: '6px 14px', borderRadius: 999, fontSize: '0.8125rem', fontWeight: 600,
    textDecoration: 'none', border: '1px solid #e5e7eb', whiteSpace: 'nowrap',
  };

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Activity log</h1>
      <p style={{ margin: '0 0 20px', fontSize: '0.8125rem', color: '#6b7280' }}>
        Everything happening across the store — orders, signups, reviews, subscriptions and staff actions.
        Showing the {ROW_LIMIT} most recent events. Owner-only.
      </p>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {FILTERS.map(f => {
          const active = actor === f.key;
          const params = new URLSearchParams();
          if (f.key !== 'all') params.set('actor', f.key);
          if (search) params.set('q', search);
          const href = params.toString() ? `/admin/audit?${params}` : '/admin/audit';
          return (
            <Link
              key={f.key}
              href={href}
              style={{
                ...chipBase,
                background: active ? '#111827' : 'white',
                color: active ? 'white' : '#374151',
                borderColor: active ? '#111827' : '#e5e7eb',
              }}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {/* Search */}
      <form method="get" style={{ display: 'flex', gap: 8, marginBottom: 20, maxWidth: 420 }}>
        {actor !== 'all' && <input type="hidden" name="actor" value={actor} />}
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Search action — e.g. order, review, product"
          style={{
            flex: 1, padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8,
            fontSize: '0.8125rem', color: '#111827',
          }}
        />
        <button type="submit" style={{
          padding: '8px 16px', background: '#4A1A6B', color: 'white', border: 'none',
          borderRadius: 8, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
        }}>Search</button>
        {search && (
          <Link href={actor !== 'all' ? `/admin/audit?actor=${actor}` : '/admin/audit'} style={{
            padding: '8px 12px', color: '#6b7280', fontSize: '0.8125rem', textDecoration: 'none',
            alignSelf: 'center',
          }}>Clear</Link>
        )}
      </form>

      <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        {rows.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#9ca3af' }}>
            {search || actor !== 'all' ? 'No activity matches this filter.' : 'No activity yet.'}
          </div>
        ) : (
          <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['When', 'Actor', 'Event', 'Entity', 'Details'].map(h => (
                  <th scope="col" key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td data-label="When" style={{ padding: '10px 16px', whiteSpace: 'nowrap', color: '#6b7280', fontSize: '0.75rem' }}>
                    {new Date(r.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td data-label="Actor" style={{ padding: '10px 16px', color: '#111827' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: ACTOR_COLORS[r.actor_kind] ?? '#6b7280', textTransform: 'uppercase' }}>
                      {r.actor_kind}
                    </span>
                    {r.actor_email && <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{r.actor_email}</div>}
                  </td>
                  <td data-label="Event" style={{ padding: '10px 16px', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>
                    {prettyAction(r.action)}
                  </td>
                  <td data-label="Entity" style={{ padding: '10px 16px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                    {(() => {
                      if (!r.entity) return <span style={{ color: '#6b7280' }}>—</span>;
                      const label = `${r.entity}${r.entity_id ? ` ${r.entity_id.slice(0, 8)}…` : ''}`;
                      const href = entityHref(r.entity, r.entity_id);
                      return href
                        ? <Link href={href} style={{ color: '#4A1A6B', textDecoration: 'none' }}>{label}</Link>
                        : <span style={{ color: '#6b7280' }}>{label}</span>;
                    })()}
                  </td>
                  <td data-label="Details" style={{ padding: '10px 16px', fontSize: '0.6875rem', color: '#374151' }}>
                    {r.diff
                      ? <details><summary style={{ cursor: 'pointer', color: '#6b7280' }}>view</summary><pre style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', maxWidth: '100%', overflowWrap: 'anywhere' }}>{JSON.stringify(r.diff, null, 2)}</pre></details>
                      : '—'}
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
