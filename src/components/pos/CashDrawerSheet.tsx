'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  openShift, adjustCash, closeShift, getShiftSummary,
  type ShiftSummary,
} from '@/app/admin/pos/session-actions';
import type { PosSession } from './PosTerminal';

interface Props {
  session: PosSession | null;
  onClose: () => void;
  onShiftChanged: () => void;        // fires after open/close so the terminal refreshes its top-bar
}

const fmtGBP = (n: number) =>
  `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ============================================================================
// Cash drawer + shift sheet. Three views depending on state:
//   • no open shift → "Open shift" form with float input
//   • open shift   → live position + cash-in / cash-out + "Close shift"
//   • close result → discrepancy summary the cashier dismisses
// ============================================================================
export function CashDrawerSheet({ session, onClose, onShiftChanged }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  // Local view state — null = normal view; non-null = the close-shift report
  const [closeReport, setCloseReport] = useState<(ShiftSummary & { counted_cash: number; discrepancy: number }) | null>(null);

  // ── Refresh live position when a shift is open ─────────────────────────
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      const s = await getShiftSummary(session.id);
      if (!cancelled) setSummary(s);
    })();
    return () => { cancelled = true; };
  }, [session, pending]);

  function refresh() {
    onShiftChanged();
  }

  if (closeReport) {
    return (
      <Sheet onClose={onClose} title="Shift closed">
        <div style={{ marginBottom: 16 }}>
          <Row label="Opening float"  value={fmtGBP(closeReport.opening_float)} />
          <Row label="Cash sales"     value={fmtGBP(closeReport.cash_sales)} />
          <Row label="Refunds"        value={`− ${fmtGBP(closeReport.cash_refunds)}`} />
          <Row label="Cash in"        value={fmtGBP(closeReport.cash_in)} />
          <Row label="Cash out"       value={`− ${fmtGBP(closeReport.cash_out)}`} />
          <hr style={hr} />
          <Row label="Expected"       value={fmtGBP(closeReport.expected_cash)} bold />
          <Row label="Counted"        value={fmtGBP(closeReport.counted_cash)} bold />
          <Row
            label="Discrepancy"
            value={(closeReport.discrepancy >= 0 ? '+ ' : '− ') + fmtGBP(Math.abs(closeReport.discrepancy))}
            tone={
              Math.abs(closeReport.discrepancy) < 0.01 ? 'good'
              : Math.abs(closeReport.discrepancy) < 5 ? 'warn'
              : 'bad'
            }
            big
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <a
            href={`/admin/pos/shifts/${closeReport.session_id}?print=1`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '12px 16px', borderRadius: 8, textAlign: 'center',
              background: 'transparent', border: '1px solid #4B5563',
              color: '#9CA3AF', textDecoration: 'none', fontWeight: 600, fontSize: '0.9375rem',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >🖨 Print Z-report</a>
          <button onClick={() => { setCloseReport(null); onClose(); }} style={primaryBtnStyle}>Done</button>
        </div>
      </Sheet>
    );
  }

  if (!session) {
    return (
      <Sheet onClose={onClose} title="Open a new shift">
        <p style={infoCopyStyle}>
          Count the cash already in the drawer and enter the total here. We&apos;ll
          use it as the baseline for the end-of-shift reconciliation.
        </p>
        <form
          onSubmit={e => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              setError(null);
              const result = await openShift({ opening_float: Number(fd.get('opening_float') ?? 0) });
              if (!result.ok) { setError(result.error ?? 'Could not open shift'); return; }
              refresh();
              onClose();
            });
          }}
        >
          <label style={lblStyle}>Opening float (cash already in drawer)</label>
          <input
            name="opening_float"
            type="number" step="0.01" min={0} max={10000}
            defaultValue="50.00"
            autoFocus
            style={bigInputStyle}
          />
          {error && <p style={errorStyle}>{error}</p>}
          <button type="submit" disabled={pending} style={primaryBtnStyle}>
            {pending ? 'Opening…' : 'Open shift'}
          </button>
        </form>
      </Sheet>
    );
  }

  // ── Open-shift view ─────────────────────────────────────────────────────
  return (
    <Sheet onClose={onClose} title="Cash drawer">
      <div style={{ marginBottom: 18 }}>
        <Row label="Opening float" value={fmtGBP(summary?.opening_float ?? session.opening_float)} />
        <Row label="Cash sales"    value={fmtGBP(summary?.cash_sales ?? 0)} />
        <Row label="Refunds"       value={`− ${fmtGBP(summary?.cash_refunds ?? 0)}`} muted />
        <Row label="Cash in"       value={fmtGBP(summary?.cash_in ?? 0)} muted />
        <Row label="Cash out"      value={`− ${fmtGBP(summary?.cash_out ?? 0)}`} muted />
        <hr style={hr} />
        <Row label="Expected in drawer" value={fmtGBP(summary?.expected_cash ?? 0)} bold big />
      </div>

      {/* ── Cash adjustment ──────────────────────────────────────────── */}
      <details style={{ marginBottom: 14, borderTop: '1px solid #2A2A2D', paddingTop: 14 }}>
        <summary style={{ cursor: 'pointer', fontSize: '0.875rem', color: '#9CA3AF', fontWeight: 600 }}>
          Cash in / out — manager-only
        </summary>
        <form
          onSubmit={e => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const kind = String(fd.get('kind')) as 'cash_in' | 'cash_out';
            const amount = Number(fd.get('amount') ?? 0);
            const note = String(fd.get('note') ?? '').trim();
            startTransition(async () => {
              setError(null);
              const result = await adjustCash({ session_id: session.id, kind, amount, note });
              if (!result.ok) { setError(result.error ?? 'Could not log adjustment'); return; }
              (e.target as HTMLFormElement).reset();
              refresh();
            });
          }}
          style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          <select name="kind" defaultValue="cash_in" style={selectStyle}>
            <option value="cash_in">Cash IN — deposit / float top-up</option>
            <option value="cash_out">Cash OUT — banking / pay-out</option>
          </select>
          <input name="amount" type="number" step="0.01" min={0.01} placeholder="Amount £" required style={inputStyle} />
          <input name="note" type="text" placeholder="Reason (e.g. Bank deposit)" required minLength={2} maxLength={200} style={inputStyle} />
          <button type="submit" disabled={pending} style={secondaryBtnStyle}>
            {pending ? 'Logging…' : 'Log adjustment'}
          </button>
        </form>
      </details>

      {/* ── Close shift ──────────────────────────────────────────────── */}
      <form
        onSubmit={e => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const counted = Number(fd.get('counted_cash') ?? 0);
          const note = String(fd.get('note') ?? '').trim();
          startTransition(async () => {
            setError(null);
            const result = await closeShift({
              session_id: session.id,
              counted_cash: counted,
              note: note || undefined,
            });
            if (!result.ok || !result.summary) { setError(result.error ?? 'Could not close shift'); return; }
            setCloseReport(result.summary);
            refresh();
          });
        }}
        style={{ borderTop: '1px solid #2A2A2D', paddingTop: 14 }}
      >
        <label style={lblStyle}>End-of-shift counted cash</label>
        <input
          name="counted_cash"
          type="number" step="0.01" min={0} max={50000}
          defaultValue={(summary?.expected_cash ?? 0).toFixed(2)}
          required
          style={bigInputStyle}
        />
        <input
          name="note"
          type="text"
          placeholder="Note (optional — explain any discrepancy)"
          maxLength={500}
          style={{ ...inputStyle, marginTop: 8 }}
        />
        {error && <p style={errorStyle}>{error}</p>}
        <button type="submit" disabled={pending} style={{ ...primaryBtnStyle, marginTop: 12 }}>
          {pending ? 'Closing…' : 'Count + close shift'}
        </button>
      </form>
    </Sheet>
  );
}

// ─── primitives ────────────────────────────────────────────────────────
function Sheet({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'flex-end', zIndex: 100 }}>
      <aside onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}
        style={{ width: 'min(460px, 92vw)', height: '100vh', background: '#161618', borderLeft: '1px solid #2A2A2D', display: 'flex', flexDirection: 'column' }}>
        <header style={{ padding: '18px 20px', borderBottom: '1px solid #2A2A2D', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#F5F5F7' }}>{title}</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: '#9CA3AF', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
        </header>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>{children}</div>
      </aside>
    </div>
  );
}

function Row({ label, value, muted, bold, big, tone }: {
  label: string; value: string;
  muted?: boolean; bold?: boolean; big?: boolean;
  tone?: 'good' | 'warn' | 'bad';
}) {
  const color =
    tone === 'good' ? '#34D399' :
    tone === 'warn' ? '#FBBF24' :
    tone === 'bad'  ? '#F87171' :
    bold ? '#F5F5F7' : muted ? '#6B7280' : '#9CA3AF';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
      <span style={{ fontSize: big ? '0.9375rem' : '0.8125rem', color, fontWeight: bold ? 700 : 500 }}>{label}</span>
      <span style={{ fontSize: big ? '1.25rem' : '0.875rem', color, fontWeight: bold ? 700 : 500, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

const hr: React.CSSProperties = { border: 'none', borderTop: '1px solid #2A2A2D', margin: '10px 0' };
const lblStyle: React.CSSProperties = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#9CA3AF', marginBottom: 4 };
const infoCopyStyle: React.CSSProperties = { fontSize: '0.8125rem', color: '#9CA3AF', lineHeight: 1.5, marginBottom: 16 };
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px',
  background: '#1F1F22', border: '1px solid #2A2A2D', borderRadius: 8,
  color: '#F5F5F7', fontSize: '0.875rem', outline: 'none',
  boxSizing: 'border-box',
};
const bigInputStyle: React.CSSProperties = {
  ...inputStyle,
  padding: '16px',
  fontSize: '1.5rem',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
};
const selectStyle: React.CSSProperties = { ...inputStyle };
const primaryBtnStyle: React.CSSProperties = {
  width: '100%', padding: 14, marginTop: 12,
  background: '#6B2C91', color: '#fff', border: 'none', borderRadius: 8,
  fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer',
};
const secondaryBtnStyle: React.CSSProperties = {
  padding: '10px 14px', marginTop: 4,
  background: 'transparent', color: '#F5F5F7', border: '1px solid #4B5563', borderRadius: 8,
  fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer',
};
const errorStyle: React.CSSProperties = { margin: '8px 0 0', color: '#FCA5A5', fontSize: '0.8125rem' };
