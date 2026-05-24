export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { RevenueChart } from '@/components/admin/RevenueChart';
import { SentryWidget } from '@/components/admin/SentryWidget';
import { RefreshAnalyticsButton } from '@/components/admin/RefreshAnalyticsButton';
import { brandPlusName } from '@/lib/product-display';
import { can, canAny } from '@/lib/permissions';
import { ORDER_STATUS_LABELS } from '@/types';
import type { Order, OrderStatus, Product } from '@/types';

interface DashboardKpis {
  total_revenue: number;
  order_count: number;
  status_counts: Record<string, number>;
  top_products: { id: string; name: string; brand: string; qty: number }[];
}

const fmt = (n: number) => `£${n.toLocaleString()}`;
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const payLabel: Record<string, string> = { cod: 'COD', card: 'Card', bank: 'Bank' };

const statusColors: Record<string, string> = {
  pending: '#f59e0b', processing: '#3b82f6', shipped: '#8b5cf6', delivered: '#10b981', cancelled: '#ef4444',
};

const statusLabels = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'] as const;

export default async function DashboardPage() {
  const session = await getStaffSession();
  // Dashboard is the landing surface — anyone with overview OR either of the
  // finer analytics perms can land here; they'll just see fewer widgets.
  if (session && !canAny(session, ['analytics', 'analytics_traffic', 'analytics_errors'])) {
    return <NoAccess section="Dashboard" />;
  }
  const canOverview = !session || can(session, 'analytics');
  const canErrors   = !session || can(session, 'analytics_errors');
  const canRefresh  = !session || can(session, 'analytics_refresh');
  // Server components render once per request — pulling the "now" once
  // here is fine. The `react-hooks/purity` rule flags Date.now() as impure;
  // that warning is for client components that may be re-rendered by the
  // React Compiler. Async server components don't memoise.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const thirtyDaysAgo = new Date(nowMs - 30 * 24 * 60 * 60 * 1000).toISOString();

  // orders RLS (migration 070) drops anon SELECT — use the service role
  // for every orders read on this page. products / blog_posts still
  // allow anon SELECT and can stay on the public client.
  const admin = supabaseAdmin();
  const [
    { data: recentOrders },
    { data: kpisData },
    { data: lowStockProducts },
    { count: lowStockCount },
    { count: newCustomerCount },
    { data: recentOrdersForChart },
  ] = await Promise.all([
    admin.from('orders').select('*').order('created_at', { ascending: false }).limit(5),
    // P1 audit fix: aggregated KPIs (revenue, order count, status histogram,
    // top products) in one SQL pass via dashboard_kpis() RPC. Previously
    // pulled every orders row + its JSONB items into Node and aggregated in
    // JS — would degrade linearly with order count.
    admin.rpc('dashboard_kpis' as never) as unknown as Promise<{ data: DashboardKpis | null }>,
    // Cap the low-stock list to 50 so a long-tail catalog with many
    // out-of-stock rows doesn't blow up the dashboard; the card next to it
    // shows the exact count.
    supabase.from('products').select('*').eq('track_inventory', true).lte('stock', 5).order('stock', { ascending: true }).limit(50),
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('track_inventory', true).lte('stock', 5),
    admin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
    // Revenue series reads `v_orders_revenue` — the same view the Analytics
    // page uses — so the two pages report an identical "Revenue · last 30
    // days". The view excludes cancelled / payment_pending / payment_failed
    // orders and zeroes refunds.
    admin.from('v_orders_revenue').select('revenue, created_at').gte('created_at', thirtyDaysAgo),
  ]);

  // Build 30-day revenue series — reuse the `nowMs` we pinned above so the
  // bucket boundaries match the `thirtyDaysAgo` window we queried with.
  const dayMap: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(nowMs - i * 24 * 60 * 60 * 1000);
    dayMap[d.toISOString().slice(0, 10)] = 0;
  }
  for (const o of (recentOrdersForChart ?? []) as Array<{ revenue: number; created_at: string }>) {
    const day = o.created_at.slice(0, 10);
    if (day in dayMap) dayMap[day] += Number(o.revenue) || 0;
  }
  const chartDays = Object.entries(dayMap).map(([date, revenue]) => ({ date, revenue }));

  // Unpack the aggregated KPIs. RPC returns one jsonb object; default to
  // empty shape if it ever returns null (RLS denied, table missing, etc.).
  const kpis: DashboardKpis = kpisData ?? {
    total_revenue: 0, order_count: 0, status_counts: {}, top_products: [],
  };
  const orderCount = kpis.order_count;
  const statusCounts = statusLabels.reduce<Record<string, number>>((acc, s) => {
    acc[s] = kpis.status_counts[s] ?? 0;
    return acc;
  }, {});
  const topProducts = kpis.top_products.map(p => ({ name: p.name, brand: p.brand, qty: p.qty }));

  // Dashboard cards favour actionable, time-bounded numbers over all-time
  // vanity totals — the things the owner checks each morning.
  const revenue30d = chartDays.reduce((s, d) => s + d.revenue, 0);
  const ordersToFulfill = (statusCounts.pending ?? 0) + (statusCounts.processing ?? 0);

  const stats = [
    { label: 'Revenue · last 30 days', value: fmt(revenue30d), icon: '£', color: '#10b981', href: '/admin/analytics' },
    { label: 'Orders to fulfill', value: ordersToFulfill, icon: '◎', color: '#4A1A6B', href: '/admin/orders' },
    { label: 'New customers · 30 days', value: newCustomerCount ?? 0, icon: '◉', color: '#6366f1', href: '/admin/users' },
    { label: 'Low stock items', value: lowStockCount ?? 0, icon: '⧉', color: '#f59e0b', href: '/admin/inventory' },
  ];

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div className="adm-page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', margin: 0 }}>
          Dashboard
        </h1>
        {canRefresh && <RefreshAnalyticsButton />}
      </div>
      <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 32px' }}>
        Welcome back. Here&apos;s what&apos;s happening with your store.
      </p>

      {/* ── Overview block (gated on `analytics` permission) ────────────── */}
      {canOverview && (
      <>
      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 32 }} className="adm-stat-grid">
        {stats.map(s => (
          <Link key={s.label} href={s.href} style={{
            background: 'white', borderRadius: 10, padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            display: 'flex', flexDirection: 'column', gap: 12,
            textDecoration: 'none', color: 'inherit',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280', fontSize: '0.8125rem', fontWeight: 500 }}>{s.label}</span>
              <span style={{
                width: 36, height: 36, borderRadius: 8,
                background: s.color + '18',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1rem', color: s.color,
              }}>{s.icon}</span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
              {s.value}
            </div>
          </Link>
        ))}
      </div>

      {/* Revenue chart */}
      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '24px', marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Revenue — Last 30 Days</h2>
          <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
            {fmt(chartDays.reduce((s, d) => s + d.revenue, 0))} total
          </span>
        </div>
        <RevenueChart days={chartDays} />
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts && lowStockProducts.length > 0 && (
        <div style={{
          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10,
          padding: '20px 24px', marginBottom: 32,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#92400e' }}>
              ⚠ Low Stock Alert ({lowStockProducts.length} item{lowStockProducts.length > 1 ? 's' : ''})
            </h2>
            <Link href="/admin/products" style={{ fontSize: '0.8125rem', color: '#d97706', textDecoration: 'none' }}>
              Manage products →
            </Link>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {(lowStockProducts as Product[]).map(p => (
              <Link key={p.id} href={`/admin/products/${p.id}`} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 12px', background: 'white', borderRadius: 8,
                border: '1px solid #fde68a', textDecoration: 'none',
              }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 22, height: 22, borderRadius: '50%', fontSize: '0.6875rem', fontWeight: 700,
                  background: p.stock === 0 ? '#fef2f2' : '#fffbeb',
                  color: p.stock === 0 ? '#dc2626' : '#d97706',
                }}>
                  {p.stock}
                </span>
                <span style={{ fontSize: '0.8125rem', color: '#374151', fontWeight: 500 }}>
                  {brandPlusName(p.brand, p.name)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Orders by status + Top products */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 32 }} className="adm-analytics-grid">
        {/* Status breakdown */}
        <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '24px' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Orders by Status</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {statusLabels.map(s => {
              const count = statusCounts[s] ?? 0;
              const pct = orderCount ? Math.round((count / orderCount) * 100) : 0;
              return (
                <div key={s}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.8125rem', color: '#374151', fontWeight: 500 }}>{ORDER_STATUS_LABELS[s] ?? s}</span>
                    <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: statusColors[s], borderRadius: 3, transition: 'width 0.3s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top products */}
        <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '24px' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Top Products</h2>
          {topProducts.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>No sales yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topProducts.map((p, i) => (
                <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{
                    width: 24, height: 24, borderRadius: '50%', background: '#fdf2f8',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.75rem', fontWeight: 700, color: '#4A1A6B', flexShrink: 0,
                  }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8125rem', color: '#111827', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{brandPlusName(p.brand, p.name)}</div>
                  </div>
                  <span style={{ fontSize: '0.8125rem', color: '#6b7280', fontWeight: 600, flexShrink: 0 }}>{p.qty} sold</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      </>
      )}
      {/* ── /Overview block ────────────────────────────────────────────── */}

      {/* Traffic widgets (funnel / PostHog / top pages / top events) now
          live on the Analytics page — the dashboard stays focused on
          today's actionable numbers. */}

      {/* ── Error monitoring (gated on `analytics_errors`) ─────────────── */}
      {canErrors && (
        <div style={{ marginBottom: 32 }}>
          <SentryWidget />
        </div>
      )}

      {/* Recent Orders (overview-gated) */}
      {canOverview && (
      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Recent Orders</h2>
          <Link href="/admin/orders" style={{ fontSize: '0.8125rem', color: '#4A1A6B', textDecoration: 'none' }}>View all →</Link>
        </div>
        {!recentOrders || recentOrders.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            No orders yet
          </div>
        ) : (
          <div className="adm-table-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Order', 'Customer', 'Total', 'Status', 'Payment', 'Date'].map(h => (
                  <th scope="col" key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(recentOrders as Order[]).map((o, i) => {
                const status = o.status ?? 'pending';
                return (
                  <tr key={o.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <Link href={`/admin/orders/${o.id}`} style={{ fontWeight: 600, fontSize: '0.875rem', color: '#4A1A6B', textDecoration: 'none' }}>
                        {o.order_number}
                      </Link>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#374151' }}>
                      {o.first_name} {o.last_name}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
                      {fmt(o.total)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 10px', borderRadius: 20,
                        fontSize: '0.75rem', fontWeight: 600,
                        background: (statusColors[status] ?? '#6b7280') + '20',
                        color: statusColors[status] ?? '#6b7280',
                      }}>
                        {ORDER_STATUS_LABELS[status as OrderStatus] ?? status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 10px',
                        background: '#f3f4f6', borderRadius: 20,
                        fontSize: '0.75rem', fontWeight: 500, color: '#374151',
                      }}>
                        {payLabel[o.pay_method] ?? o.pay_method}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.8125rem', color: '#6b7280' }}>
                      {o.created_at ? fmtDate(o.created_at) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
