export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { brandPlusName } from '@/lib/product-display';
import { markPoReceived, cancelPo } from '@/app/admin/inventory/management-actions';
import { ConfirmButton } from '@/components/admin/ConfirmButton';

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
  received_by: string | null;
  note: string | null;
}

export default async function PurchaseOrderDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string }>;
}) {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('products.edit')) {
    return <NoAccess section="Inventory" />;
  }
  const { id } = await params;
  const { ok: okMsg } = await searchParams;

  const admin = supabaseAdmin();
  const [{ data: poRow }, { data: lineRows }] = await Promise.all([
    admin.from('purchase_orders')
      .select('id, supplier_name, reference, status, created_at, created_by, received_at, received_by, note')
      .eq('id', id)
      .maybeSingle<PoRow>(),
    admin.from('purchase_order_lines')
      .select('id, product_id, qty, unit_cost, note')
      .eq('po_id', id),
  ]);

  if (!poRow) notFound();
  const po = poRow;
  const lines = (lineRows ?? []) as Array<{ id: string; product_id: string; qty: number; unit_cost: number | null; note: string | null }>;

  // Resolve product names.
  const productIds = lines.map(l => l.product_id);
  const { data: productRows } = productIds.length
    ? await admin.from('products').select('id, brand, name, stock').in('id', productIds)
    : { data: [] };
  const productMap = new Map(
    ((productRows ?? []) as Array<{ id: string; brand: string | null; name: string; stock: number }>)
      .map(p => [p.id, p]),
  );

  const totalUnits = lines.reduce((s, l) => s + l.qty, 0);
  const totalCost = lines.reduce((s, l) => s + (Number(l.unit_cost ?? 0) * l.qty), 0);
  const canReceive = po.status === 'draft' || po.status === 'sent';
  const sc = statusStyle(po.status);

  return (
    <div className="adm-page" style={{ padding: '32px 36px', maxWidth: 960 }}>
      <div className="adm-page-header" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
        <Link href="/admin/inventory/purchase-orders" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem' }}>← Purchase orders</Link>
        <span style={{ color: '#d1d5db' }}>/</span>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>
          {po.supplier_name}
          <span style={{
            marginLeft: 12, padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem',
            background: sc.bg, color: sc.fg, textTransform: 'capitalize', fontWeight: 700,
            letterSpacing: '0.04em', verticalAlign: 'middle',
          }}>{po.status}</span>
        </h1>
      </div>
      <p style={{ margin: '0 0 24px', fontSize: '0.8125rem', color: '#6b7280' }}>
        Created {fmt(po.created_at)}{po.created_by ? ` by ${po.created_by}` : ''}
        {po.received_at && ` · received ${fmt(po.received_at)}${po.received_by ? ` by ${po.received_by}` : ''}`}
        {po.reference && ` · Supplier ref ${po.reference}`}
      </p>

      {okMsg && (
        <div role="status" style={{ background: '#dcfce7', color: '#166534', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.875rem', fontWeight: 500 }}>
          {okMsg}
        </div>
      )}

      {po.note && (
        <div style={{ background: '#fef3c7', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: '0.8125rem', color: '#92400e' }}>
          <strong>Note:</strong> {po.note}
        </div>
      )}

      {/* Lines */}
      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: 20 }}>
        <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['Product', 'Qty', 'Unit cost', 'Line total', 'Current stock'].map(h => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((ln, i) => {
              const prod = productMap.get(ln.product_id);
              return (
                <tr key={ln.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                  <td data-label="Product" style={td}>
                    {prod ? (
                      <Link href={`/admin/products/${prod.id}`} style={{ color: '#111827', fontWeight: 500, textDecoration: 'none' }}>
                        {brandPlusName(prod.brand, prod.name)}
                      </Link>
                    ) : (
                      <span style={{ color: '#9ca3af' }}>Unknown product</span>
                    )}
                  </td>
                  <td data-label="Qty" style={{ ...td, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{ln.qty}</td>
                  <td data-label="Unit cost" style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>
                    {ln.unit_cost != null ? `£${Number(ln.unit_cost).toFixed(2)}` : '—'}
                  </td>
                  <td data-label="Line total" style={{ ...td, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                    {ln.unit_cost != null ? `£${(Number(ln.unit_cost) * ln.qty).toFixed(2)}` : '—'}
                  </td>
                  <td data-label="Current stock" style={{ ...td, color: '#6b7280' }}>
                    {prod ? prod.stock : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid #111827', background: '#f9fafb' }}>
              <td style={{ ...td, fontWeight: 700 }}>Totals</td>
              <td style={{ ...td, fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{totalUnits}</td>
              <td />
              <td style={{ ...td, fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>£{totalCost.toFixed(2)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Actions */}
      {canReceive && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <form action={markPoReceived}>
            <input type="hidden" name="po_id" value={po.id} />
            <ConfirmButton
              message={`Mark this PO as received? Stock will go up by ${totalUnits} units across ${lines.length} product${lines.length === 1 ? '' : 's'}.`}
              style={{
                padding: '12px 22px', background: '#10B981', color: 'white', border: 'none',
                borderRadius: 7, fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer', minHeight: 44,
              }}
            >
              📦 Mark received &amp; add to stock
            </ConfirmButton>
          </form>
          <form action={cancelPo}>
            <input type="hidden" name="po_id" value={po.id} />
            <ConfirmButton
              message="Cancel this purchase order? You can't undo a cancel — it stays in the history as a record."
              style={{
                padding: '12px 22px', background: 'transparent', color: '#6b7280',
                border: '1px solid #d1d5db', borderRadius: 7, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', minHeight: 44,
              }}
            >
              Cancel PO
            </ConfirmButton>
          </form>
        </div>
      )}
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
