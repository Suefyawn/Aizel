export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { AutoPrintOnLoad } from '@/components/admin/AutoPrintOnLoad';
import { PrintNowButton } from '@/components/admin/PrintNowButton';

// ============================================================================
// Z-report — end-of-shift printable summary.
//
// A till's Z-report is the document that proves the cashier's day at the
// counter balances. Standard cash-handling practice the bookkeeper, the
// tax-man, and the loss-prevention manager all expect to see. Anatomy:
//
//   • Shift header — cashier, open/close timestamps, duration
//   • Cash position — opening float, cash sales, cash refunds, cash in/out,
//     expected, counted, discrepancy
//   • Tender split — what was rung up by gateway (cash / card / stripe
//     terminal)
//   • Transactions — every POS sale + return rung in this shift
//   • Cash events — every cash-in / cash-out / refund recorded
//   • Signature line for the cashier
//
// Designed to print straight to a 80mm thermal receipt printer (the same
// print stylesheet hides chrome and shrinks margins). Use ?print=1 in the
// URL to auto-fire window.print() once the page hydrates.
// ============================================================================

interface ShiftRow {
  id: string;
  staff_id: string;
  opening_float: number;
  opened_at: string;
  closed_at: string | null;
  expected_cash: number | null;
  counted_cash: number | null;
  discrepancy: number | null;
  close_note: string | null;
  status: 'open' | 'closed' | string;
}

interface CashEvent {
  id: string;
  amount: number;
  kind: string;
  note: string | null;
  created_at: string;
}

interface PosOrder {
  id: string;
  order_number: string;
  total: number;
  pay_method: string;
  created_at: string;
  status: string;
}

const fmtGBP = (n: number) =>
  `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtTime = (s: string) =>
  new Date(s).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function durationLabel(openedAt: string, closedAt: string | null): string {
  const end = closedAt ? new Date(closedAt).getTime() : Date.now();
  const ms = end - new Date(openedAt).getTime();
  const mins = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default async function ZReportPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaffSession();
  if (staff && !staff.isOwner && !staff.permissions.includes('pos.operate')) {
    return <NoAccess section="POS" />;
  }
  const { id } = await params;
  const admin = supabaseAdmin();
  const { data: shiftRow } = await admin
    .from('pos_sessions')
    .select('id, staff_id, opening_float, opened_at, closed_at, expected_cash, counted_cash, discrepancy, close_note, status')
    .eq('id', id)
    .maybeSingle<ShiftRow>();
  if (!shiftRow) notFound();
  const shift = shiftRow;

  // Cashier name + events + the orders that hit the till during the shift.
  // Bound the orders query by opened_at → closed_at (or now if still open).
  const closedAt = shift.closed_at ?? new Date().toISOString();
  const [{ data: cashierRow }, { data: eventRows }, { data: orderRows }] = await Promise.all([
    admin.from('staff_members').select('name, email').eq('id', shift.staff_id).maybeSingle<{ name: string; email: string }>(),
    admin.from('pos_cash_events').select('id, amount, kind, note, created_at').eq('session_id', id).order('created_at'),
    admin.from('orders')
      .select('id, order_number, total, pay_method, created_at, status')
      .eq('channel', 'pos')
      .gte('created_at', shift.opened_at)
      .lte('created_at', closedAt)
      .order('created_at'),
  ]);

  const cashier = cashierRow ?? { name: 'Owner', email: '' };
  const events = (eventRows ?? []) as CashEvent[];
  const orders = (orderRows ?? []) as PosOrder[];

  // ── Aggregates ─────────────────────────────────────────────────────────
  const tenderSplit = orders.reduce((m, o) => {
    const k = o.pay_method ?? 'unknown';
    m[k] = (m[k] ?? 0) + Number(o.total ?? 0);
    return m;
  }, {} as Record<string, number>);

  let cashSales = 0, cashRefunds = 0, cashIn = 0, cashOut = 0;
  for (const e of events) {
    switch (e.kind) {
      case 'sale':     cashSales   += Number(e.amount); break;
      case 'refund':   cashRefunds += Number(e.amount); break;
      case 'cash_in':  cashIn      += Number(e.amount); break;
      case 'cash_out': cashOut     += Number(e.amount); break;
    }
  }
  const expected = Number(shift.expected_cash ?? shift.opening_float + cashSales + cashRefunds + cashIn + cashOut);
  const counted = Number(shift.counted_cash ?? 0);
  const discrepancy = Number(shift.discrepancy ?? (counted - expected));

  // Tone band for the discrepancy figure — matches the live drawer sheet.
  const discAbs = Math.abs(discrepancy);
  const discTone =
    discAbs < 0.01 ? { bg: '#f0fdf4', fg: '#166534', label: 'Balanced' } :
    discAbs < 5    ? { bg: '#fef9c3', fg: '#854d0e', label: 'Close enough' } :
                     { bg: '#fee2e2', fg: '#991b1b', label: 'Out by more than £5' };

  return (
    <div className="adm-page z-report" style={{ padding: '32px 36px', maxWidth: 760, margin: '0 auto' }}>
      {/* Auto-print when called with ?print=1 (the close-shift sheet links
          straight to that URL). Suspense because useSearchParams suspends. */}
      <Suspense fallback={null}>
        <AutoPrintOnLoad />
      </Suspense>

      {/* Print stylesheet — strip chrome, fit thermal receipt width. */}
      <style>{`
        @media print {
          .adm-sidebar, .adm-topbar, .adm-overlay, .no-print { display: none !important; }
          .adm-main { margin-left: 0 !important; background: white !important; }
          .z-report { padding: 8mm !important; max-width: 100% !important; }
          .z-report .z-card { box-shadow: none !important; border: 1px solid #d1d5db !important; break-inside: avoid; }
        }
      `}</style>

      {/* Back link — print-hidden */}
      <div className="no-print" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/admin/pos/dashboard" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem' }}>← POS dashboard</Link>
        </div>
        <PrintNowButton />
      </div>

      {/* Receipt header ──────────────────────────────────────────────── */}
      <div className="z-card" style={cardStyle}>
        <div style={{ textAlign: 'center', borderBottom: '1px dashed #d1d5db', paddingBottom: 16, marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, letterSpacing: '0.02em', color: '#111827' }}>
            AIZEL · Z-REPORT
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#6b7280', letterSpacing: '0.05em' }}>
            End-of-shift summary
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', fontSize: '0.875rem', marginBottom: 16 }}>
          <Field label="Cashier" value={cashier.name} />
          <Field label="Status" value={shift.status === 'closed' ? 'Closed' : 'Still open'} />
          <Field label="Opened" value={fmtDateTime(shift.opened_at)} />
          <Field label="Closed" value={shift.closed_at ? fmtDateTime(shift.closed_at) : '—'} />
          <Field label="Duration" value={durationLabel(shift.opened_at, shift.closed_at)} />
          <Field label="Transactions" value={String(orders.length)} />
        </div>

        {/* Cash position — the big numbers ──────────────────────────── */}
        <h2 style={sectionH}>Cash position</h2>
        <table style={tableStyle}>
          <tbody>
            <Tr label="Opening float"  value={fmtGBP(Number(shift.opening_float))} />
            <Tr label="Cash sales"     value={fmtGBP(cashSales)} />
            <Tr label="Refunds"        value={`− ${fmtGBP(Math.abs(cashRefunds))}`} />
            <Tr label="Cash in"        value={fmtGBP(cashIn)} />
            <Tr label="Cash out"       value={`− ${fmtGBP(Math.abs(cashOut))}`} />
            <Tr label="Expected in drawer" value={fmtGBP(expected)} bold border />
            <Tr label="Counted" value={shift.counted_cash != null ? fmtGBP(counted) : '—'} bold />
          </tbody>
        </table>

        {shift.counted_cash != null && (
          <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 8, background: discTone.bg, border: `1px solid ${discTone.fg}30` }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: discTone.fg }}>
              Discrepancy · {discTone.label}
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: discTone.fg, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
              {discrepancy >= 0 ? '+ ' : '− '}{fmtGBP(discAbs)}
            </div>
            {shift.close_note && (
              <div style={{ marginTop: 6, fontSize: '0.8125rem', color: discTone.fg }}>
                Note: {shift.close_note}
              </div>
            )}
          </div>
        )}

        {/* Tender split ─────────────────────────────────────────────── */}
        <h2 style={sectionH}>Tender split</h2>
        {Object.keys(tenderSplit).length === 0 ? (
          <p style={emptyMuted}>No sales this shift.</p>
        ) : (
          <table style={tableStyle}>
            <tbody>
              {Object.entries(tenderSplit).map(([k, v]) => (
                <Tr key={k} label={tenderLabel(k)} value={fmtGBP(v)} />
              ))}
              <Tr label="Total takings" value={fmtGBP(orders.reduce((s, o) => s + Number(o.total ?? 0), 0))} bold border />
            </tbody>
          </table>
        )}

        {/* Transactions — one row per POS sale ──────────────────────── */}
        <h2 style={sectionH}>Transactions ({orders.length})</h2>
        {orders.length === 0 ? (
          <p style={emptyMuted}>No transactions rung up.</p>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Time</th>
                <th style={thStyle}>Order</th>
                <th style={thStyle}>Tender</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id}>
                  <td style={tdStyle}>{fmtTime(o.created_at)}</td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{o.order_number}</td>
                  <td style={tdStyle}>{tenderLabel(o.pay_method)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                    {fmtGBP(Number(o.total))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Cash drawer events ──────────────────────────────────────── */}
        {events.length > 0 && (
          <>
            <h2 style={sectionH}>Cash drawer journal</h2>
            <table style={tableStyle}>
              <tbody>
                {events.map(e => (
                  <tr key={e.id}>
                    <td style={tdStyle}>{fmtTime(e.created_at)}</td>
                    <td style={tdStyle}>{eventLabel(e.kind)}</td>
                    <td style={{ ...tdStyle, color: '#6b7280', fontSize: '0.8125rem' }}>{e.note ?? '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: Number(e.amount) < 0 ? '#991b1b' : '#111827' }}>
                      {Number(e.amount) >= 0 ? fmtGBP(Number(e.amount)) : `− ${fmtGBP(Math.abs(Number(e.amount)))}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Signature line — paper-trail convention. */}
        <div style={{ marginTop: 28, borderTop: '1px dashed #d1d5db', paddingTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, fontSize: '0.75rem', color: '#6b7280' }}>
          <div>
            <div style={{ borderBottom: '1px solid #6b7280', height: 30 }} />
            <div style={{ marginTop: 4 }}>Cashier signature</div>
          </div>
          <div>
            <div style={{ borderBottom: '1px solid #6b7280', height: 30 }} />
            <div style={{ marginTop: 4 }}>Manager signature</div>
          </div>
        </div>

        <p style={{ marginTop: 18, fontSize: '0.6875rem', color: '#9ca3af', textAlign: 'center' }}>
          Printed {new Date().toLocaleString('en-GB')} · Shift {shift.id.slice(0, 8)}
        </p>
      </div>
    </div>
  );
}

// ─── Layout helpers ────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: 'white', borderRadius: 10, padding: 28, boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
};
const sectionH: React.CSSProperties = {
  margin: '24px 0 10px', fontSize: '0.6875rem', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b7280',
};
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' };
const tdStyle: React.CSSProperties = { padding: '6px 0', fontSize: '0.875rem', color: '#111827', verticalAlign: 'top' };
const thStyle: React.CSSProperties = {
  padding: '6px 0', fontSize: '0.6875rem', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.05em',
  color: '#9ca3af', textAlign: 'left', borderBottom: '1px solid #e5e7eb',
};
const emptyMuted: React.CSSProperties = { color: '#9ca3af', fontSize: '0.8125rem', margin: '6px 0' };

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
      <div style={{ fontWeight: 600, color: '#111827', marginTop: 2 }}>{value}</div>
    </div>
  );
}

function Tr({ label, value, bold, border }: { label: string; value: string; bold?: boolean; border?: boolean }) {
  return (
    <tr style={border ? { borderTop: '1px solid #e5e7eb' } : undefined}>
      <td style={{ ...tdStyle, fontWeight: bold ? 700 : 500, paddingTop: border ? 10 : 6 }}>{label}</td>
      <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: bold ? 700 : 500, paddingTop: border ? 10 : 6 }}>
        {value}
      </td>
    </tr>
  );
}

function tenderLabel(method: string): string {
  switch (method) {
    case 'cash': return 'Cash';
    case 'card': return 'Card';
    case 'stripe_terminal': return 'Tap card';
    case 'split': return 'Split tender';
    default: return method;
  }
}

function eventLabel(kind: string): string {
  switch (kind) {
    case 'sale':           return 'Cash sale';
    case 'refund':         return 'Refund';
    case 'cash_in':        return 'Cash in';
    case 'cash_out':       return 'Cash out';
    case 'opening_float':  return 'Opening float';
    case 'closing_count':  return 'Closing count';
    default: return kind;
  }
}

