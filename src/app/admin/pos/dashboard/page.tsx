export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';

// POS dashboard — today's view. Sits at /admin/pos/dashboard (separate
// from /admin/pos which is the till itself) so the operator can glance
// at trade-of-day from a back-office screen while a cashier rings up
// front-of-house.
//
// What it surfaces:
//   • Today's POS revenue + transaction count
//   • Active shifts (who's on the till, opening float, live position)
//   • Hourly heatmap of POS sales
//   • Top SKUs by units sold today
//   • Most recent POS transactions

interface PosOrderRow {
  id: string;
  order_number: string;
  total: number;
  pay_method: string;
  created_at: string;
  items: Array<{ id?: string; name: string; brand?: string | null; qty: number; price: number }> | null;
}

interface PosSessionRow {
  id: string;
  staff_id: string;
  opening_float: number;
  opened_at: string;
  status: string;
}

const fmtGBP = (n: number) =>
  `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function PosDashboardPage() {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('pos.operate')) {
    return <NoAccess section="POS" />;
  }

  const admin = supabaseAdmin();

  // Today = local time in Europe/London. We approximate by computing UTC
  // bounds from the operator's clock — Supabase rows store created_at in
  // UTC so we filter against that. Anything fancier (true London-time
  // boundaries with DST) needs a server-side function; the variance is
  // ≤ 1 hour either side of midnight, fine for a dashboard.
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const [{ data: orderRows }, { data: openSessionRows }] = await Promise.all([
    admin.from('orders')
      .select('id, order_number, total, pay_method, created_at, items')
      .eq('channel', 'pos')
      .gte('created_at', startOfDay)
      .order('created_at', { ascending: false }),
    admin.from('pos_sessions')
      .select('id, staff_id, opening_float, opened_at, status')
      .eq('status', 'open')
      .order('opened_at', { ascending: false }),
  ]);

  const orders = (orderRows ?? []) as PosOrderRow[];
  const openShifts = (openSessionRows ?? []) as PosSessionRow[];

  const todayRevenue = orders.reduce((s, o) => s + Number(o.total ?? 0), 0);
  const txnCount = orders.length;
  const avgBasket = txnCount > 0 ? todayRevenue / txnCount : 0;

  // ─ Hourly buckets (00 → 23). Empty hours render as a 1-pixel sparkline. ─
  const hourly: number[] = Array(24).fill(0);
  for (const o of orders) {
    const h = new Date(o.created_at).getHours();
    hourly[h] += Number(o.total ?? 0);
  }
  const peakHour = hourly.reduce((max, v, i) => v > hourly[max] ? i : max, 0);
  const peakValue = hourly[peakHour];

  // ─ Top SKUs — units sold ─
  const skuTotals = new Map<string, { name: string; brand: string | null; units: number; revenue: number }>();
  for (const o of orders) {
    for (const it of o.items ?? []) {
      const key = (it.id ?? it.name);
      const cur = skuTotals.get(key) ?? { name: it.name, brand: it.brand ?? null, units: 0, revenue: 0 };
      cur.units += it.qty;
      cur.revenue += it.qty * it.price;
      skuTotals.set(key, cur);
    }
  }
  const topSkus = Array.from(skuTotals.values())
    .sort((a, b) => b.units - a.units)
    .slice(0, 8);

  // ─ Tender split — proportional bar on the totals card ─
  const tenderSplit = orders.reduce((m, o) => {
    const k = o.pay_method ?? 'unknown';
    m[k] = (m[k] ?? 0) + Number(o.total ?? 0);
    return m;
  }, {} as Record<string, number>);

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1200 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>POS dashboard</h1>
        <Link href="/admin/pos" style={{ marginLeft: 'auto', padding: '8px 16px', background: '#6B2C91', color: 'white', borderRadius: 7, textDecoration: 'none', fontSize: '0.8125rem', fontWeight: 600 }}>
          → Open till
        </Link>
      </div>
      <p style={{ margin: '0 0 28px', fontSize: '0.8125rem', color: '#6b7280' }}>
        Today&apos;s trade at the counter. Web orders sit in the main /admin/orders feed.
      </p>

      {/* ── KPI cards ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }} className="adm-stat-grid">
        <Stat label="Today's revenue"  value={fmtGBP(todayRevenue)} tone="primary" />
        <Stat label="Transactions"     value={String(txnCount)} />
        <Stat label="Avg basket"       value={fmtGBP(avgBasket)} />
        <Stat label="Active shifts"    value={String(openShifts.length)} tone={openShifts.length > 0 ? 'good' : 'muted'} />
      </div>

      {/* ── Open shifts ──────────────────────────────────────────────── */}
      {openShifts.length > 0 && (
        <div style={card}>
          <h2 style={cardTitle}>Open shifts</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Cashier', 'Opened', 'Float', ''].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {openShifts.map(s => (
                <tr key={s.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={td}><code style={{ fontSize: '0.75rem', color: '#6b7280' }}>{s.staff_id.slice(0, 8)}</code></td>
                  <td style={td}>{new Date(s.opened_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td style={{ ...td, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmtGBP(s.opening_float)}</td>
                  <td style={td}><span style={{ padding: '2px 8px', background: '#d1fae5', color: '#065f46', borderRadius: 20, fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase' }}>Open</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }} className="adm-analytics-grid">
        {/* ── Hourly heatmap ───────────────────────────────────────── */}
        <div style={card}>
          <h2 style={cardTitle}>Hourly sales</h2>
          {peakValue === 0 ? (
            <p style={emptyMuted}>No POS sales today yet.</p>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 140, padding: '12px 0' }}>
              {hourly.map((v, h) => {
                const heightPct = peakValue > 0 ? (v / peakValue) * 100 : 0;
                const isPeak = h === peakHour && v > 0;
                return (
                  <div key={h} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
                       title={`${String(h).padStart(2, '0')}:00 — ${fmtGBP(v)}`}>
                    <div style={{
                      width: '100%',
                      // Min 1px so empty hours still show a tick.
                      height: `${Math.max(heightPct, v > 0 ? 6 : 1)}%`,
                      background: isPeak ? '#6B2C91' : v > 0 ? '#A78BFA' : '#e5e7eb',
                      borderRadius: 2,
                      transition: 'height 200ms',
                    }} />
                    {/* Label every 4th hour to keep axis legible. */}
                    {h % 4 === 0 && (
                      <span style={{ fontSize: '0.625rem', color: '#9ca3af', fontVariantNumeric: 'tabular-nums' }}>
                        {String(h).padStart(2, '0')}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {peakValue > 0 && (
            <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '8px 0 0' }}>
              Peak hour: <strong>{String(peakHour).padStart(2, '0')}:00</strong> · {fmtGBP(peakValue)}
            </p>
          )}
        </div>

        {/* ── Tender split ─────────────────────────────────────────── */}
        <div style={card}>
          <h2 style={cardTitle}>Tender split</h2>
          {todayRevenue === 0 ? (
            <p style={emptyMuted}>No sales yet.</p>
          ) : (
            <>
              <div style={{ display: 'flex', height: 14, borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
                {Object.entries(tenderSplit).map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      width: `${(v / todayRevenue) * 100}%`,
                      background: tenderColour(k),
                    }}
                    title={`${k}: ${fmtGBP(v)}`}
                  />
                ))}
              </div>
              {Object.entries(tenderSplit).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', fontSize: '0.8125rem' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: tenderColour(k) }} />
                    <span style={{ textTransform: 'capitalize', color: '#374151' }}>{k}</span>
                  </span>
                  <span style={{ color: '#111827', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtGBP(v)}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── Top SKUs ─────────────────────────────────────────────────── */}
      <div style={{ ...card, marginTop: 16 }}>
        <h2 style={cardTitle}>Top SKUs today</h2>
        {topSkus.length === 0 ? (
          <p style={emptyMuted}>Nothing sold yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Product', 'Units', 'Revenue'].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topSkus.map((s, i) => (
                <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={td}>
                    {s.brand && <span style={{ color: '#6b7280', marginRight: 4 }}>{s.brand}</span>}
                    {s.name}
                  </td>
                  <td style={{ ...td, fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{s.units}</td>
                  <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{fmtGBP(s.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Recent transactions ──────────────────────────────────────── */}
      <div style={{ ...card, marginTop: 16 }}>
        <h2 style={cardTitle}>Recent transactions</h2>
        {orders.length === 0 ? (
          <p style={emptyMuted}>No transactions today.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Order', 'Items', 'Tender', 'Total', 'Time'].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 12).map(o => (
                <tr key={o.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={td}>
                    <Link href={`/admin/orders/${o.id}`} style={{ fontFamily: 'monospace', color: '#4A1A6B', fontWeight: 700, textDecoration: 'none' }}>
                      {o.order_number}
                    </Link>
                  </td>
                  <td style={td}>{(o.items ?? []).reduce((s, i) => s + i.qty, 0)} items</td>
                  <td style={td}><span style={{ padding: '2px 8px', background: '#f3f4f6', borderRadius: 20, fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase' }}>{o.pay_method}</span></td>
                  <td style={{ ...td, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmtGBP(Number(o.total))}</td>
                  <td style={{ ...td, color: '#6b7280' }}>{new Date(o.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'primary' | 'good' | 'muted' }) {
  const accent =
    tone === 'primary' ? { bg: '#F5EFF8', fg: '#4A1A6B' } :
    tone === 'good'    ? { bg: '#f0fdf4', fg: '#16a34a' } :
    tone === 'muted'   ? { bg: '#f9fafb', fg: '#6b7280' } :
                          { bg: 'white',   fg: '#111827' };
  return (
    <div style={{ background: accent.bg, borderRadius: 10, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>{label}</div>
      <div style={{ fontSize: '1.75rem', fontWeight: 700, color: accent.fg, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

function tenderColour(method: string): string {
  switch (method) {
    case 'cash':            return '#10B981';
    case 'card':            return '#4A1A6B';
    case 'stripe_terminal': return '#635BFF';
    case 'split':           return '#A78BFA';
    default:                return '#9CA3AF';
  }
}

const card: React.CSSProperties = { background: 'white', borderRadius: 10, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' };
const cardTitle: React.CSSProperties = { margin: '0 0 14px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' };
const th: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' };
const td: React.CSSProperties = { padding: '10px 16px', fontSize: '0.875rem', color: '#374151' };
const emptyMuted: React.CSSProperties = { margin: 0, fontSize: '0.875rem', color: '#9ca3af', padding: '24px 0' };
