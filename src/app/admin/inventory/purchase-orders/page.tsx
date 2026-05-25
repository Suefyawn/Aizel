export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';

const fmt = (s: string) =>
  new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

interface PoRow {
  id: string;
  supplier_name: string;
  reference: string | null;
  status: 'draft' | 'sent' | 'received' | 'cancelled' | string;
  created_at: string;
  created_by: string | null;
  received_at: string | null;
  note: string | null;
}

export default async function PurchaseOrdersPage() {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('products.edit')) {
    return <NoAccess section="Inventory" />;
  }

  const admin = supabaseAdmin();
  const { data: rows } = await admin
    .from('purchase_orders')
    .select('id, supplier_name, reference, status, created_at, created_by, received_at, note')
    .order('created_at', { ascending: false })
    .limit(50);
  const list = (rows ?? []) as PoRow[];

  // Per-PO line count, for the table summary.
  const { data: lineRows } = list.length
    ? await admin.from('purchase_order_lines').select('po_id, qty').in('po_id', list.map(p => p.id))
    : { data: [] };
  const lineCounts = ((lineRows ?? []) as Array<{ po_id: string; qty: number }>)
    .reduce((m, r) => {
      const cur = m.get(r.po_id) ?? { lines: 0, units: 0 };
      cur.lines += 1;
      cur.units += r.qty;
      m.set(r.po_id, cur);
      return m;
    }, new Map<string, { lines: number; units: number }>());

  return (
    <div className="adm-page" style={{ padding: '32px 36px', maxWidth: 1100 }}>
      <div className="adm-page-header" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
        <Link href="/admin/inventory" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem' }}>← Inventory</Link>
        <span style={{ color: '#d1d5db' }}>/</span>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Purchase orders</h1>
        <Link
          href="/admin/inventory/purchase-orders/new"
          style={{
            marginLeft: 'auto', padding: '8px 16px', background: '#4A1A6B', color: 'white',
            borderRadius: 7, textDecoration: 'none', fontSize: '0.8125rem', fontWeight: 600,
          }}
        >+ New PO</Link>
      </div>
      <p style={{ margin: '0 0 24px', fontSize: '0.8125rem', color: '#6b7280' }}>
        Track incoming stock from suppliers. Mark a PO as received and the lines flow straight to inventory with a clean ledger trail.
      </p>

      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {list.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
            No purchase orders yet. Tap <strong style={{ color: '#4A1A6B' }}>+ New PO</strong> to log your first one.
          </div>
        ) : (
          <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Supplier', 'Reference', 'Status', 'Lines', 'Units', 'Created', ''].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((p, i) => {
                const sc = statusStyle(p.status);
                const count = lineCounts.get(p.id) ?? { lines: 0, units: 0 };
                return (
                  <tr key={p.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                    <td data-label="Supplier" style={{ ...td, fontWeight: 600, color: '#111827' }}>{p.supplier_name}</td>
                    <td data-label="Reference" style={{ ...td, color: '#6b7280', fontFamily: 'monospace', fontSize: '0.8125rem' }}>{p.reference ?? '—'}</td>
                    <td data-label="Status" style={td}>
                      <span style={{
                        padding: '2px 10px', borderRadius: 20, fontSize: '0.6875rem',
                        background: sc.bg, color: sc.fg,
                        textTransform: 'capitalize', fontWeight: 700, letterSpacing: '0.04em',
                      }}>{p.status}</span>
                    </td>
                    <td data-label="Lines" style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{count.lines}</td>
                    <td data-label="Units" style={{ ...td, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{count.units}</td>
                    <td data-label="Created" style={{ ...td, color: '#6b7280', fontSize: '0.8125rem' }}>
                      {fmt(p.created_at)}{p.created_by ? ` · ${p.created_by}` : ''}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <Link href={`/admin/inventory/purchase-orders/${p.id}`} style={{ color: '#4A1A6B', textDecoration: 'none', fontSize: '0.75rem', fontWeight: 600 }}>
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
  );
}

function statusStyle(status: string): { bg: string; fg: string } {
  switch (status) {
    case 'draft':     return { bg: '#f3f4f6', fg: '#374151' };
    case 'sent':      return { bg: '#dbeafe', fg: '#1e40af' };
    case 'received':  return { bg: '#dcfce7', fg: '#166534' };
    case 'cancelled': return { bg: '#fee2e2', fg: '#991b1b' };
    default:          return { bg: '#f3f4f6', fg: '#6b7280' };
  }
}

const th: React.CSSProperties = {
  padding: '10px 16px', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700,
  color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em',
};
const td: React.CSSProperties = { padding: '12px 16px', fontSize: '0.875rem', color: '#374151' };
