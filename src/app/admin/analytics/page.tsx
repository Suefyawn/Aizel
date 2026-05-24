export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { RevenueChart } from '@/components/admin/RevenueChart';
import { PostHogWidget } from '@/components/admin/PostHogWidget';
import { ConversionFunnelWidget } from '@/components/admin/ConversionFunnelWidget';
import { TopPagesWidget } from '@/components/admin/TopPagesWidget';
import { TopEventsWidget } from '@/components/admin/TopEventsWidget';
import { UserJourneysWidget } from '@/components/admin/UserJourneysWidget';
import { FunnelBySourceWidget } from '@/components/admin/FunnelBySourceWidget';
import { RetentionWidget } from '@/components/admin/RetentionWidget';
import { SessionRecordingsWidget } from '@/components/admin/SessionRecordingsWidget';
import { can } from '@/lib/permissions';
import { ORDER_STATUS_LABELS } from '@/types';
import type { OrderStatus } from '@/types';

const fmt = (n: number) => `£${Math.round(n).toLocaleString()}`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

interface DailyRow { day: string; orders: number; revenue: number; aov: number }
interface KpiRow { total_orders: number; total_revenue: number; aov: number; unique_customers: number; repeat_purchase_rate: number; lifetime_orders: number; lifetime_revenue: number }
interface StatusRow { status: string; count: number }
interface TopRow { product_id: string; units: number; revenue: number }
interface RfmRow { segment: string; customers: number; total_revenue: number }
interface CohortRow { cohort_month: string; month_offset: number; customers: number }

async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T[]> {
  // Service-role client: every analytics_* RPC is revoked from anon/authenticated
  // (the security_revoke_anon_rpc migration). They carry revenue/segment data.
  const { data, error } = await supabaseAdmin().rpc(name as never, args as never);
  if (error) {
    const { log } = await import('@/lib/logger');
    log.warn('analytics.rpc_failed', { rpc: name, message: error.message });
    return [];
  }
  return (data ?? []) as T[];
}

type Tab = 'finance' | 'customers';

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; tab?: string }>;
}) {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('analytics')) {
    return <NoAccess section="Analytics" />;
  }

  const canTraffic = !session || can(session, 'analytics_traffic');

  const sp = await searchParams;
  const window = Math.max(1, Math.min(365, Number(sp.days ?? '30')));
  const tab: Tab = sp.tab === 'customers' ? 'customers' : 'finance';

  const [daily, kpis, byStatus, top, rfm, cohort] = await Promise.all([
    rpc<DailyRow>('analytics_daily', { p_days: window }),
    rpc<KpiRow>('analytics_kpis', { p_days: window }).then(rows => rows[0]),
    rpc<StatusRow>('analytics_orders_by_status'),
    rpc<TopRow>('analytics_top_products', { p_days: window, p_limit: 10 }),
    rpc<RfmRow>('analytics_rfm_segments'),
    rpc<CohortRow>('analytics_cohort_retention', { p_months: 6 }),
  ]);

  // Map top product ids → product details.
  const topIds = top.map(t => t.product_id);
  const productMap = new Map<string, { brand: string; name: string; slug: string }>();
  if (topIds.length) {
    // Service-role read: top sellers can be archived/draft products, which
    // the anon client's RLS would hide — leaving a raw UUID in the table.
    const { data: prods } = await supabaseAdmin().from('products').select('id, brand, name, slug').in('id', topIds);
    for (const p of (prods ?? []) as Array<{ id: string; brand: string; name: string; slug: string }>) {
      productMap.set(p.id, { brand: p.brand, name: p.name, slug: p.slug });
    }
  }

  // Chart data adapter (RevenueChart already expects [{ date, revenue }]).
  const chartData = daily.map(d => ({ date: d.day, revenue: Number(d.revenue) }));

  // KPI cards split along the Finance / Customers line — money metrics on
  // one tab, audience metrics on the other.
  const financeKpis: { label: string; value: string; sub?: string }[] = kpis
    ? [
        { label: `Revenue · last ${window} days`, value: fmt(kpis.total_revenue), sub: `Lifetime: ${fmt(kpis.lifetime_revenue)}` },
        { label: 'Orders', value: String(kpis.total_orders), sub: `Lifetime: ${kpis.lifetime_orders}` },
        { label: 'AOV (avg order value)', value: fmt(kpis.aov) },
      ]
    : [];
  const customerKpis: { label: string; value: string; sub?: string }[] = kpis
    ? [
        { label: 'Unique customers', value: String(kpis.unique_customers), sub: `Last ${window} days` },
        { label: 'Repeat-purchase rate', value: pct(Number(kpis.repeat_purchase_rate)), sub: 'Lifetime customers with 2+ orders' },
      ]
    : [];

  // Cohort heat-map: rows = cohort_month, cols = month_offset.
  const cohortMatrix = (() => {
    const months = Array.from(new Set(cohort.map(c => c.cohort_month))).sort();
    const offsets = Array.from(new Set(cohort.map(c => c.month_offset))).sort((a, b) => a - b);
    const lookup = new Map<string, number>();
    for (const c of cohort) lookup.set(`${c.cohort_month}:${c.month_offset}`, c.customers);
    return { months, offsets, lookup };
  })();
  const maxCohortCount = Math.max(1, ...cohort.map(c => c.customers));

  const cardStyle = { background: 'white', borderRadius: 10, padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } as const;
  const headingStyle = { margin: '0 0 16px', fontSize: '0.875rem', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.04em' } as const;

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div className="adm-page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Analytics</h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>
            Showing the last {window} days
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[{ d: 7, l: '7 days' }, { d: 30, l: '30 days' }, { d: 90, l: '90 days' }, { d: 365, l: '1 year' }].map(opt => {
            const active = window === opt.d;
            return (
              <Link
                key={opt.d}
                href={`/admin/analytics?tab=${tab}&days=${opt.d}`}
                style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                  textDecoration: 'none',
                  background: active ? '#4A1A6B' : '#f3f4f6',
                  color: active ? 'white' : '#6b7280',
                }}
              >
                {opt.l}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Finance / Customers tab bar — the Shopify-style split between
          money metrics and audience metrics. */}
      <div role="tablist" style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb', marginBottom: 28 }}>
        {([['finance', 'Finance'], ['customers', 'Customers & Traffic']] as const).map(([key, label]) => {
          const active = tab === key;
          return (
            <Link
              key={key}
              role="tab"
              aria-selected={active}
              href={`/admin/analytics?tab=${key}&days=${window}`}
              style={{
                padding: '10px 18px', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none',
                color: active ? '#4A1A6B' : '#6b7280',
                borderBottom: active ? '2px solid #4A1A6B' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {tab === 'finance' && (
        <>
          {/* Finance KPIs */}
          <div className="adm-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
            {financeKpis.map(k => (
              <div key={k.label} style={{ background: 'white', borderRadius: 10, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{k.value}</div>
                {k.sub && <div style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: 4 }}>{k.sub}</div>}
              </div>
            ))}
          </div>

          {/* Revenue chart */}
          <div style={{ ...cardStyle, marginBottom: 28 }}>
            <h2 style={headingStyle}>Revenue · last {window} days</h2>
            <RevenueChart days={chartData} />
          </div>

          <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
            {/* Orders by status */}
            <div style={cardStyle}>
              <h2 style={headingStyle}>Orders by status</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {byStatus.map(s => {
                  const total = byStatus.reduce((sum, x) => sum + x.count, 0) || 1;
                  const p = (s.count / total) * 100;
                  return (
                    <div key={s.status} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.8125rem' }}>
                      <span style={{ width: 120, color: '#374151' }}>{ORDER_STATUS_LABELS[s.status as OrderStatus] ?? s.status}</span>
                      <div style={{ flex: 1, height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${p}%`, height: '100%', background: '#4A1A6B' }} />
                      </div>
                      <span style={{ width: 50, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#111827', fontWeight: 600 }}>{s.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top products */}
            <div style={cardStyle}>
              <h2 style={headingStyle}>Top products · last {window} days</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <th scope="col" style={{ textAlign: 'left',  padding: '6px 0', color: '#6b7280', fontWeight: 600 }}>Product</th>
                    <th scope="col" style={{ textAlign: 'right', padding: '6px 0', color: '#6b7280', fontWeight: 600 }}>Units</th>
                    <th scope="col" style={{ textAlign: 'right', padding: '6px 0', color: '#6b7280', fontWeight: 600 }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map(t => {
                    const p = productMap.get(t.product_id);
                    return (
                      <tr key={t.product_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '8px 0' }}>
                          {p ? (
                            <Link href={`/admin/products/${t.product_id}`} style={{ color: '#111827', fontWeight: 600, textDecoration: 'none' }}>
                              {p.brand} {p.name}
                            </Link>
                          ) : (
                            <span style={{ color: '#9ca3af', fontSize: '0.8125rem', fontStyle: 'italic' }}>Unknown product (deleted)</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{t.units}</td>
                        <td style={{ padding: '8px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(Number(t.revenue))}</td>
                      </tr>
                    );
                  })}
                  {top.length === 0 && (
                    <tr><td colSpan={3} style={{ padding: '12px 0', textAlign: 'center', color: '#9ca3af' }}>No order data in this window yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'customers' && (
        <>
          {/* Customer KPIs */}
          <div className="adm-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 28, maxWidth: 560 }}>
            {customerKpis.map(k => (
              <div key={k.label} style={{ background: 'white', borderRadius: 10, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{k.value}</div>
                {k.sub && <div style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: 4 }}>{k.sub}</div>}
              </div>
            ))}
          </div>

          {/* Traffic — gated on the analytics_traffic permission. */}
          {canTraffic && (
            <>
              <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 28 }}>
                <ConversionFunnelWidget />
                <PostHogWidget />
              </div>
              <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
                <TopPagesWidget />
                <TopEventsWidget />
              </div>

              {/* User-journey widgets — sessions, paths, funnel slices,
                  retention curve, and PostHog session recordings. */}
              <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 28 }}>
                <UserJourneysWidget />
                <RetentionWidget />
              </div>
              <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 28 }}>
                <FunnelBySourceWidget />
                <SessionRecordingsWidget />
              </div>
            </>
          )}

          <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
            {/* RFM segments */}
            <div style={cardStyle}>
              <h2 style={headingStyle}>Customer segments</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <th scope="col" style={{ textAlign: 'left',  padding: '6px 0', color: '#6b7280', fontWeight: 600 }}>Segment</th>
                    <th scope="col" style={{ textAlign: 'right', padding: '6px 0', color: '#6b7280', fontWeight: 600 }}>Customers</th>
                    <th scope="col" style={{ textAlign: 'right', padding: '6px 0', color: '#6b7280', fontWeight: 600 }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {rfm.map(r => (
                    <tr key={r.segment} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px 0', color: '#111827', fontWeight: 600 }}>{r.segment}</td>
                      <td style={{ padding: '8px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.customers}</td>
                      <td style={{ padding: '8px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(Number(r.total_revenue))}</td>
                    </tr>
                  ))}
                  {rfm.length === 0 && (
                    <tr><td colSpan={3} style={{ padding: '12px 0', textAlign: 'center', color: '#9ca3af' }}>No customer data yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Cohort retention heat-map */}
            <div style={cardStyle}>
              <h2 style={{ margin: '0 0 6px', fontSize: '0.875rem', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Cohort retention · last 6 months
              </h2>
              <p style={{ margin: '0 0 12px', fontSize: '0.6875rem', color: '#9ca3af' }}>
                Rows = month of customer&apos;s first order. Columns = months since.
              </p>
              {cohortMatrix.months.length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: '0.8125rem' }}>Not enough data yet.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                    <thead>
                      <tr>
                        <th scope="col" style={{ padding: '4px 8px', textAlign: 'left', color: '#6b7280' }}>Cohort</th>
                        {cohortMatrix.offsets.map(o => (
                          <th scope="col" key={o} style={{ padding: '4px 6px', color: '#6b7280', fontWeight: 600 }}>+{o}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cohortMatrix.months.map(m => (
                        <tr key={m}>
                          <td style={{ padding: '4px 8px', color: '#111827', fontWeight: 600 }}>
                            {new Date(m).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}
                          </td>
                          {cohortMatrix.offsets.map(o => {
                            const v = cohortMatrix.lookup.get(`${m}:${o}`) ?? 0;
                            const opacity = v === 0 ? 0 : 0.15 + (v / maxCohortCount) * 0.85;
                            return (
                              <td key={o} style={{
                                padding: '4px 6px', textAlign: 'center',
                                background: `rgba(107, 44, 145, ${opacity})`,
                                color: opacity > 0.5 ? 'white' : '#111827',
                                fontVariantNumeric: 'tabular-nums', minWidth: 30,
                              }}>
                                {v > 0 ? v : ''}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
