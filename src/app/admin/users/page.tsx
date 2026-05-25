export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Suspense } from 'react';
import { supabaseAdmin } from '@/lib/supabase';
import { Pagination } from '@/components/admin/Pagination';
import { UsersFilter } from '@/components/admin/UsersFilter';
import { PageTabs } from '@/components/admin/PageTabs';
import { ExportCSVButton } from '@/components/admin/ExportCSVButton';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import type { AdminUser } from '@/types';

const PAGE_SIZE = 20;

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtMoney = (n: number) => `£${Math.round(n).toLocaleString()}`;

interface OrderStat {
  user_id: string;
  order_count: number | string;
  total_spent: number | string;
  last_order_at: string | null;
}

// A customer account enriched with their order aggregates.
interface CustomerRow extends AdminUser {
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
}

const SORT_KEYS = ['recent', 'last_order', 'spent', 'orders', 'name'] as const;
type SortKey = (typeof SORT_KEYS)[number];

function displayName(u: { first_name: string | null; last_name: string | null; email: string }): string {
  const n = `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim();
  return n || u.email;
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; sort?: string }>;
}) {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('customers.view')) {
    return <NoAccess section="Customers" />;
  }

  const { q, page: pageParam, sort: sortParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? '1', 10));
  const sort: SortKey = SORT_KEYS.includes(sortParam as SortKey) ? (sortParam as SortKey) : 'recent';

  // Two SECURITY DEFINER RPCs, both called via the service-role client: the
  // account list (get_admin_users — auth.users PII) and per-customer order
  // aggregates (get_customer_order_stats — revenue data). Both are revoked
  // from anon/authenticated by the security_revoke_anon_rpc migration.
  const admin = supabaseAdmin();
  const [{ data: users }, { data: stats }] = await Promise.all([
    admin.rpc('get_admin_users' as never),
    admin.rpc('get_customer_order_stats' as never),
  ]);

  const statById = new Map<string, OrderStat>();
  for (const st of (stats ?? []) as OrderStat[]) statById.set(st.user_id, st);

  let list: CustomerRow[] = ((users ?? []) as AdminUser[]).map(u => {
    const st = statById.get(u.id);
    return {
      ...u,
      orderCount: st ? Number(st.order_count) : 0,
      totalSpent: st ? Number(st.total_spent) : 0,
      lastOrderAt: st?.last_order_at ?? null,
    };
  });

  if (q) {
    const lower = q.toLowerCase();
    list = list.filter(u =>
      u.email?.toLowerCase().includes(lower) ||
      u.first_name?.toLowerCase().includes(lower) ||
      u.last_name?.toLowerCase().includes(lower),
    );
  }

  list.sort((a, b) => {
    switch (sort) {
      case 'spent':      return b.totalSpent - a.totalSpent;
      case 'orders':     return b.orderCount - a.orderCount;
      case 'last_order': return (b.lastOrderAt ?? '').localeCompare(a.lastOrderAt ?? '');
      case 'name':       return displayName(a).localeCompare(displayName(b));
      default:           return (b.created_at ?? '').localeCompare(a.created_at ?? '');
    }
  });

  const total = list.length;
  const paginated = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div className="adm-page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Customers</h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>{total} registered account{total !== 1 ? 's' : ''}</p>
        </div>
        <ExportCSVButton kind="customers" q={q} />
      </div>

      {/* Customers + Segments share this surface — Segments used to be its
          own sidebar item but it's really a slice of the customer list. */}
      <PageTabs
        current="/admin/users"
        tabs={[
          { label: 'All customers', href: '/admin/users' },
          { label: 'Segments',      href: '/admin/segments' },
        ]}
      />

      <Suspense fallback={null}>
        <UsersFilter total={total} />
      </Suspense>

      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {paginated.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            {q ? `No customers matching "${q}"` : 'No customers have signed up yet'}
          </div>
        ) : (
          <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Customer', 'Orders', 'Spent', 'Last order', 'Joined', ''].map(h => (
                  <th scope="col" key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((u, i) => {
                const hasName = !!(u.first_name || u.last_name);
                return (
                  <tr key={u.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                    <td data-label="Customer" style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
                        {hasName ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() : u.email}
                      </div>
                      {hasName && (
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af', wordBreak: 'break-word' }}>{u.email}</div>
                      )}
                    </td>
                    <td data-label="Orders" style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#374151' }}>
                      {u.orderCount}
                    </td>
                    <td data-label="Spent" style={{ padding: '12px 16px', fontSize: '0.875rem', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>
                      {u.orderCount > 0 ? fmtMoney(u.totalSpent) : <span style={{ color: '#d1d5db', fontWeight: 400 }}>—</span>}
                    </td>
                    <td data-label="Last order" style={{ padding: '12px 16px', fontSize: '0.8125rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {u.lastOrderAt ? fmtDate(u.lastOrderAt) : <span style={{ color: '#d1d5db' }}>—</span>}
                    </td>
                    <td data-label="Joined" style={{ padding: '12px 16px', fontSize: '0.8125rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {fmtDate(u.created_at)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Link href={`/admin/users/${u.id}`} style={{
                        padding: '7px 14px', background: '#f3f4f6', color: '#374151',
                        borderRadius: 6, textDecoration: 'none', fontSize: '0.8125rem', fontWeight: 500,
                        minHeight: 32, display: 'inline-flex', alignItems: 'center',
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

      <Suspense fallback={null}>
        <Pagination total={total} pageSize={PAGE_SIZE} currentPage={page} basePath="/admin/users" />
      </Suspense>
    </div>
  );
}
