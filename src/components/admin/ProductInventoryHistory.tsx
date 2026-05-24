import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';

// ─── Per-product inventory history ─────────────────────────────────────────
// Server component. Pulls the latest 25 ledger rows for a single product
// (including any variant-scoped rows) and renders a compact timeline.
// Mounted on /admin/products/[id] under the variants section so the
// merchant can answer "why does this SKU show N units?" without leaving
// the product page.

interface LedgerRow {
  id: string;
  variant_id: string | null;
  qty_delta: number;
  balance_after: number | null;
  reason: 'import' | 'order' | 'return' | 'cancellation' | 'restock' | 'adjustment' | 'damage' | 'transfer';
  order_id: string | null;
  actor_kind: 'system' | 'owner' | 'staff' | 'customer';
  actor_email: string | null;
  note: string | null;
  created_at: string;
}

const reasonColors: Record<LedgerRow['reason'], { bg: string; fg: string }> = {
  import:       { bg: '#eef2ff', fg: '#3730a3' },
  order:        { bg: '#fce7f3', fg: '#4A1A6B' },
  return:       { bg: '#d1fae5', fg: '#065f46' },
  cancellation: { bg: '#ede9fe', fg: '#5b21b6' },
  restock:      { bg: '#d1fae5', fg: '#065f46' },
  adjustment:   { bg: '#fef3c7', fg: '#92400e' },
  damage:       { bg: '#fee2e2', fg: '#991b1b' },
  transfer:     { bg: '#e5e7eb', fg: '#374151' },
};

const fmtDate = (s: string) =>
  new Date(s).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export async function ProductInventoryHistory({ productId }: { productId: string }) {
  const admin = supabaseAdmin();
  const { data } = await admin
    .from('inventory_ledger')
    .select('id, variant_id, qty_delta, balance_after, reason, order_id, actor_kind, actor_email, note, created_at')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(25);
  const rows = (data ?? []) as LedgerRow[];

  return (
    <section style={{ marginTop: 32, background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
      <header style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#111827' }}>Inventory history</h2>
        <Link href={`/admin/inventory?product=${productId}`} style={{ fontSize: '0.75rem', color: '#4A1A6B', textDecoration: 'none', fontWeight: 600 }}>
          View all →
        </Link>
      </header>
      {rows.length === 0 ? (
        <div style={{ padding: 36, textAlign: 'center', color: '#9ca3af', fontSize: '0.8125rem' }}>
          No stock movements recorded yet.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {['When', 'Δ', 'Balance', 'Reason', 'Actor', 'Note'].map(h => (
                <th scope="col" key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const color = reasonColors[r.reason];
              return (
                <tr key={r.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '8px 14px', color: '#6b7280', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{fmtDate(r.created_at)}</td>
                  <td style={{ padding: '8px 14px', fontFamily: 'monospace', fontWeight: 700, color: r.qty_delta < 0 ? '#991b1b' : '#065f46' }}>
                    {r.qty_delta > 0 ? '+' : ''}{r.qty_delta}
                  </td>
                  <td style={{ padding: '8px 14px', fontFamily: 'monospace' }}>{r.balance_after ?? '—'}</td>
                  <td style={{ padding: '8px 14px' }}>
                    <span style={{ background: color.bg, color: color.fg, padding: '2px 8px', borderRadius: 6, fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {r.reason}
                    </span>
                    {r.order_id && (
                      <Link href={`/admin/orders/${r.order_id}`} style={{ marginLeft: 8, fontFamily: 'monospace', fontSize: '0.6875rem', color: '#6b7280', textDecoration: 'none' }}>
                        order
                      </Link>
                    )}
                  </td>
                  <td style={{ padding: '8px 14px', fontSize: '0.75rem', color: '#374151' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: r.actor_kind === 'owner' ? '#4A1A6B' : r.actor_kind === 'staff' ? '#3b82f6' : '#6b7280', textTransform: 'uppercase' }}>
                      {r.actor_kind}
                    </span>
                    {r.actor_email && <span style={{ marginLeft: 6, color: '#9ca3af' }}>{r.actor_email}</span>}
                  </td>
                  <td style={{ padding: '8px 14px', fontSize: '0.75rem', color: '#374151', maxWidth: 280 }}>{r.note ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
