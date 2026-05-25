export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { startStocktake } from '@/app/admin/inventory/management-actions';

const fmt = (s: string) =>
  new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

interface StocktakeRow {
  id: string;
  status: 'open' | 'finalised' | 'cancelled' | string;
  opened_by: string | null;
  opened_at: string;
  closed_at: string | null;
  note: string | null;
  total_lines: number;
}

export default async function StocktakeListPage() {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('products.edit')) {
    return <NoAccess section="Inventory" />;
  }

  const admin = supabaseAdmin();
  const { data: rows } = await admin
    .from('stocktakes')
    .select('id, status, opened_by, opened_at, closed_at, note, total_lines')
    .order('opened_at', { ascending: false })
    .limit(50);
  const list = (rows ?? []) as StocktakeRow[];
  const open = list.find(s => s.status === 'open');

  return (
    <div className="adm-page" style={{ padding: '32px 36px', maxWidth: 980 }}>
      <div className="adm-page-header" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
        <Link href="/admin/inventory" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem' }}>← Inventory</Link>
        <span style={{ color: '#d1d5db' }}>/</span>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Stocktakes</h1>
      </div>
      <p style={{ margin: '0 0 28px', fontSize: '0.8125rem', color: '#6b7280' }}>
        Physical count sessions. Walk the shelves, type the counted quantity, finalise — the system writes the adjustments to the ledger and updates stock automatically.
      </p>

      {open ? (
        <div style={{
          background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10,
          padding: '18px 20px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: '#92400e' }}>A stocktake is in progress</div>
            <div style={{ fontSize: '0.8125rem', color: '#92400e', marginTop: 2 }}>
              {open.total_lines} product{open.total_lines === 1 ? '' : 's'} counted so far · started {fmt(open.opened_at)} by {open.opened_by ?? '—'}
            </div>
          </div>
          <Link
            href={`/admin/inventory/stocktake/${open.id}`}
            style={{
              padding: '10px 20px', background: '#92400e', color: 'white',
              borderRadius: 7, textDecoration: 'none', fontWeight: 600, fontSize: '0.875rem',
            }}
          >Continue counting →</Link>
        </div>
      ) : (
        <div style={{
          background: 'white', borderRadius: 10, padding: '20px 24px', marginBottom: 20,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}>
          <h2 style={{ margin: '0 0 10px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Start a new stocktake</h2>
          <form action={startStocktake} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 220px' }}>
              <label htmlFor="st-note" style={lbl}>Note (optional)</label>
              <input id="st-note" name="note" placeholder="e.g. Quarterly shop count" style={inp} />
            </div>
            <button type="submit" style={{
              padding: '10px 22px', background: '#4A1A6B', color: 'white',
              border: 'none', borderRadius: 7, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', minHeight: 40,
            }}>+ Start stocktake</button>
          </form>
          <p style={{ marginTop: 12, fontSize: '0.75rem', color: '#9ca3af' }}>
            Only one stocktake can be open at a time. Finalise the current one before starting another.
          </p>
        </div>
      )}

      <h2 style={{ margin: '24px 0 12px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Recent stocktakes</h2>
      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {list.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>No stocktakes yet.</div>
        ) : (
          <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Started', 'By', 'Status', 'Lines', 'Note', ''].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((s, i) => {
                const statusColor =
                  s.status === 'finalised' ? '#16a34a' :
                  s.status === 'open' ? '#92400e' :
                  '#6b7280';
                return (
                  <tr key={s.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                    <td data-label="Started" style={td}>{fmt(s.opened_at)}</td>
                    <td data-label="By" style={td}>{s.opened_by ?? '—'}</td>
                    <td data-label="Status" style={td}>
                      <span style={{
                        padding: '2px 10px', borderRadius: 20, fontSize: '0.6875rem',
                        background: statusColor + '20', color: statusColor,
                        textTransform: 'capitalize', fontWeight: 700, letterSpacing: '0.04em',
                      }}>{s.status}</span>
                    </td>
                    <td data-label="Lines" style={{ ...td, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{s.total_lines}</td>
                    <td data-label="Note" style={{ ...td, color: '#6b7280', fontSize: '0.8125rem' }}>{s.note ?? '—'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <Link href={`/admin/inventory/stocktake/${s.id}`} style={{ color: '#4A1A6B', textDecoration: 'none', fontSize: '0.75rem', fontWeight: 600 }}>
                        {s.status === 'open' ? 'Continue →' : 'View →'}
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
  );
}

const lbl: React.CSSProperties = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 };
const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  border: '1px solid #d1d5db', borderRadius: 7,
  fontSize: '0.875rem', color: '#111827', background: 'white', outline: 'none', boxSizing: 'border-box',
};
const th: React.CSSProperties = {
  padding: '10px 16px', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700,
  color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em',
};
const td: React.CSSProperties = { padding: '12px 16px', fontSize: '0.875rem', color: '#374151' };
