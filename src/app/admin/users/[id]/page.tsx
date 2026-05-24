export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { ORDER_STATUS_LABELS, type Order, type AdminUser, type OrderStatus } from '@/types';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { CustomerGDPRPanel } from '@/components/admin/CustomerGDPRPanel';
import { TierBadge } from '@/components/ui/TierBadge';
import { tierFor } from '@/lib/loyalty-tiers';
import { whatsappUrlForCustomer } from '@/lib/whatsapp';

const fmt = (n: number) => `£${n.toLocaleString()}`;
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const statusColors: Record<string, string> = {
  pending: '#f59e0b', processing: '#3b82f6', shipped: '#8b5cf6', delivered: '#10b981', cancelled: '#ef4444',
};

const payLabel: Record<string, string> = { cod: 'COD', card: 'Card', bank: 'Bank' };

interface ActivityRow {
  id: string;
  action: string;
  entity: string | null;
  entity_id: string | null;
  diff: Record<string, unknown> | null;
  created_at: string;
}

const ACTIVITY_LABELS: Record<string, string> = {
  'order.placed':         'Placed an order',
  'order.status_changed': 'Order status changed',
  'customer.signup':      'Created their account',
  'review.submitted':     'Submitted a review',
  'subscription.created': 'Subscribed to a product',
  'newsletter.signup':    'Joined the newsletter',
};

function activityLabel(action: string): string {
  return ACTIVITY_LABELS[action] ?? action.replace(/[._]/g, ' ');
}

function activityDetail(a: ActivityRow): string {
  const d = a.diff ?? {};
  if (a.action === 'order.placed') {
    return `${String(d.order_number ?? '')} · £${Number(d.total ?? 0).toLocaleString()}`;
  }
  if (a.action === 'order.status_changed') return `${String(d.from ?? '')} → ${String(d.to ?? '')}`;
  if (a.action === 'review.submitted') return `${String(d.rating ?? '?')}★ rating`;
  if (a.action === 'subscription.created') return `every ${String(d.interval_days ?? '?')} days`;
  return '';
}

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('customers.view')) {
    return <NoAccess section="Customers" />;
  }
  // customers.edit gates the GDPR actions (data export + anonymise). A
  // view-only staffer still sees the panel but in a disabled state.
  const canManageCustomer = !session || session.isOwner || session.permissions.includes('customers.edit');
  const { id } = await params;

  // orders is RLS-locked; the `get_admin_user` RPC already uses
  // SECURITY DEFINER but route via service-role for consistency.
  const admin = supabaseAdmin();
  const [{ data: userData }, { data: orders }, { data: activity }] = await Promise.all([
    admin.rpc('get_admin_user' as never, { p_id: id } as never),
    admin.from('orders').select('*').eq('user_id', id).order('created_at', { ascending: false }),
    // The customer's own journey — activity_log rows where they are the actor
    // (signup, orders, reviews, subscriptions). See migration 090.
    admin.from('audit_log')
      .select('id, action, entity, entity_id, diff, created_at')
      .eq('actor_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  // get_admin_user RETURNS TABLE — a set-returning RPC, so `.rpc()` yields an
  // array even for a single match. Take the first row.
  const user = ((userData ?? []) as AdminUser[])[0];
  if (!user) notFound();

  const orderList = (orders ?? []) as Order[];
  const activityRows = (activity ?? []) as ActivityRow[];
  const totalSpend = orderList.reduce((s, o) => s + o.total, 0);
  const deliveredCount = orderList.filter(o => o.status === 'delivered').length;

  const section: React.CSSProperties = {
    background: 'white', borderRadius: 10,
    padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  };

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div className="adm-page-header" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <Link href="/admin/users" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem' }}>← Customers</Link>
        <span style={{ color: '#d1d5db' }}>/</span>
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>
          {user.first_name || user.last_name
            ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()
            : user.email}
        </h1>
      </div>

      <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, marginBottom: 20 }}>
        {/* Profile card */}
        <div>
          <div style={{ ...section, marginBottom: 16 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: '#F5EFF8', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.5rem', marginBottom: 16,
            }}>
              {(user.first_name?.[0] ?? user.email[0]).toUpperCase()}
            </div>
            <h2 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
              {user.first_name || user.last_name
                ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()
                : '—'}
            </h2>
            <p style={{ margin: '0 0 12px', fontSize: '0.875rem', color: '#6b7280', wordBreak: 'break-all' }}>{user.email}</p>
            {/* Quick contact actions — opens the system's default mail
                client / WhatsApp chat with the customer pre-filled. */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <a
                href={`mailto:${user.email}`}
                style={{
                  flex: '1 1 auto', padding: '8px 12px', fontSize: '0.75rem', fontWeight: 600,
                  background: '#F5EFF8', color: '#4A1A6B', textDecoration: 'none',
                  border: '1px solid #E3D2EF', borderRadius: 6,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  minHeight: 36,
                }}
              >✉ Email</a>
              {(() => {
                const phone = user.phone?.trim();
                if (!phone) return null;
                const href = whatsappUrlForCustomer(phone, `Hi ${user.first_name ?? 'there'}, this is Aizel.`);
                if (!href) return null;
                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flex: '1 1 auto', padding: '8px 12px', fontSize: '0.75rem', fontWeight: 600,
                      background: '#dcfce7', color: '#15803d', textDecoration: 'none',
                      border: '1px solid #bbf7d0', borderRadius: 6,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      minHeight: 36,
                    }}
                  >💬 WhatsApp</a>
                );
              })()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Tier — derived from the customer's lifetime delivered
                  spend that we've already calculated for the stats card
                  below. Single source of truth in lib/loyalty-tiers.ts. */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                <span style={{ color: '#6b7280' }}>Tier</span>
                <TierBadge tier={tierFor(totalSpend)} size="sm" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                <span style={{ color: '#6b7280' }}>Phone</span>
                <span style={{ color: '#374151', fontWeight: 500 }}>{user.phone ?? '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                <span style={{ color: '#6b7280' }}>Joined</span>
                <span style={{ color: '#374151' }}>{fmtDate(user.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'Orders', value: orderList.length, wide: false },
              { label: 'Delivered', value: deliveredCount, wide: false },
              { label: 'Total Spend', value: fmt(totalSpend), wide: true },
            ].map(s => (
              <div key={s.label} style={{
                ...section,
                padding: '16px 20px',
                gridColumn: s.wide ? '1 / -1' : undefined,
              }}>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Order history */}
        <div style={section}>
          <h2 style={{ margin: '0 0 16px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
            Order History
          </h2>
          {orderList.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
              No orders yet
            </div>
          ) : (
            <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                  {['Order #', 'Date', 'Items', 'Total', 'Status', 'Payment', ''].map(h => (
                    <th scope="col" key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orderList.map((o, i) => {
                  const status = (o.status ?? 'pending') as OrderStatus;
                  const itemCount = (o.items ?? []).length;
                  return (
                    <tr key={o.id} style={{ borderTop: i > 0 ? '1px solid #f9fafb' : 'none' }}>
                      <td data-label="Order #" style={{ padding: '10px 12px' }}>
                        <Link href={`/admin/orders/${o.id}`} style={{ fontWeight: 700, fontSize: '0.875rem', color: '#4A1A6B', textDecoration: 'none', fontFamily: 'monospace' }}>
                          {o.order_number}
                        </Link>
                      </td>
                      <td data-label="Date" style={{ padding: '10px 12px', fontSize: '0.8125rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                        {o.created_at ? fmtDateTime(o.created_at) : '—'}
                      </td>
                      <td data-label="Items" style={{ padding: '10px 12px', fontSize: '0.8125rem', color: '#374151' }}>
                        {itemCount} item{itemCount !== 1 ? 's' : ''}
                      </td>
                      <td data-label="Total" style={{ padding: '10px 12px', fontSize: '0.875rem', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>
                        {fmt(o.total)}
                      </td>
                      <td data-label="Status" style={{ padding: '10px 12px' }}>
                        <span style={{
                          display: 'inline-block', padding: '2px 10px', borderRadius: 20,
                          fontSize: '0.75rem', fontWeight: 600,
                          background: (statusColors[status] ?? '#6b7280') + '20',
                          color: statusColors[status] ?? '#6b7280',
                        }}>
                          {ORDER_STATUS_LABELS[status] ?? status}
                        </span>
                      </td>
                      <td data-label="Payment" style={{ padding: '10px 12px' }}>
                        <span style={{
                          display: 'inline-block', padding: '2px 8px',
                          background: '#f3f4f6', borderRadius: 20,
                          fontSize: '0.75rem', color: '#374151',
                        }}>
                          {payLabel[o.pay_method] ?? o.pay_method}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <Link href={`/admin/orders/${o.id}`} style={{
                          padding: '4px 10px', background: '#f3f4f6', color: '#374151',
                          borderRadius: 6, textDecoration: 'none', fontSize: '0.8125rem', fontWeight: 500,
                        }}>
                          View →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* UK GDPR controls — sit ABOVE the activity timeline because the
          timeline can be very long; we want the rights-handling actions
          visible without scrolling. */}
      <CustomerGDPRPanel
        userId={id}
        displayName={user.first_name || user.last_name
          ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()
          : user.email}
        canManage={canManageCustomer}
      />

      {/* Activity timeline — the customer's journey */}
      <div style={{ ...section, marginTop: 20 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
          Activity timeline
        </h2>
        {activityRows.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            No recorded activity yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {activityRows.map((a, i) => {
              const detail = activityDetail(a);
              return (
                <div key={a.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4A1A6B', marginTop: 6, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.875rem', color: '#111827', fontWeight: 500 }}>{activityLabel(a.action)}</div>
                    {detail && <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 1 }}>{detail}</div>}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                    {fmtDateTime(a.created_at)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
