export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { StocktakeCounter } from '@/components/admin/StocktakeCounter';
import { finalizeStocktake, cancelStocktake } from '@/app/admin/inventory/management-actions';
import { brandPlusName } from '@/lib/product-display';

const fmt = (s: string) =>
  new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

interface StocktakeRow {
  id: string;
  status: 'open' | 'finalised' | 'cancelled' | string;
  opened_by: string | null;
  opened_at: string;
  closed_at: string | null;
  note: string | null;
}

export default async function StocktakeDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('products.edit')) {
    return <NoAccess section="Inventory" />;
  }

  const { id } = await params;
  const { ok: okMsg, error: errMsg } = await searchParams;

  const admin = supabaseAdmin();
  const [{ data: stocktakeRow }, { data: lineRows }, { data: productRows }] = await Promise.all([
    admin.from('stocktakes')
      .select('id, status, opened_by, opened_at, closed_at, note')
      .eq('id', id)
      .maybeSingle<StocktakeRow>(),
    admin.from('stocktake_lines')
      .select('id, product_id, system_qty, counted_qty, delta, note, counted_at')
      .eq('stocktake_id', id)
      .order('counted_at', { ascending: false }),
    admin.from('products')
      .select('id, brand, name, stock, track_inventory, sku, barcode')
      .eq('track_inventory', true)
      .order('name'),
  ]);

  if (!stocktakeRow) notFound();
  const stocktake = stocktakeRow;
  const lines = (lineRows ?? []) as Array<{
    id: string; product_id: string;
    system_qty: number; counted_qty: number; delta: number;
    note: string | null; counted_at: string;
  }>;
  const products = (productRows ?? []) as Array<{
    id: string; brand: string | null; name: string; stock: number;
    track_inventory: boolean | null; sku: string | null; barcode: string | null;
  }>;

  const productMap = new Map(products.map(p => [p.id, p]));
  const countedIds = new Set(lines.map(l => l.product_id));
  const adjustments = lines.filter(l => l.delta !== 0).length;
  const balanced = lines.length - adjustments;
  const isOpen = stocktake.status === 'open';

  return (
    <div className="adm-page" style={{ padding: '32px 36px', maxWidth: 1100 }}>
      {/* Breadcrumb + meta */}
      <div className="adm-page-header" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
        <Link href="/admin/inventory/stocktake" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem' }}>← Stocktakes</Link>
        <span style={{ color: '#d1d5db' }}>/</span>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>
          Stocktake
          <span style={{ marginLeft: 12, padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem',
            background: isOpen ? '#fef3c7' : stocktake.status === 'finalised' ? '#dcfce7' : '#f3f4f6',
            color: isOpen ? '#92400e' : stocktake.status === 'finalised' ? '#166534' : '#6b7280',
            textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, verticalAlign: 'middle',
          }}>{stocktake.status}</span>
        </h1>
      </div>
      <p style={{ margin: '0 0 24px', fontSize: '0.8125rem', color: '#6b7280' }}>
        Opened {fmt(stocktake.opened_at)}{stocktake.opened_by ? ` by ${stocktake.opened_by}` : ''}
        {stocktake.closed_at && ` · closed ${fmt(stocktake.closed_at)}`}
        {stocktake.note && ` · ${stocktake.note}`}
      </p>

      {okMsg && <div role="status" style={banner('#dcfce7', '#166534')}>{okMsg}</div>}
      {errMsg && <div role="alert" style={banner('#fee2e2', '#991b1b')}>{errMsg}</div>}

      {/* KPI strip */}
      <div className="adm-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <Kpi label="Products counted" value={String(lines.length)} />
        <Kpi label="Balanced (no change)" value={String(balanced)} tone="muted" />
        <Kpi label="Needs adjustment" value={String(adjustments)} tone={adjustments > 0 ? 'warn' : 'good'} />
      </div>

      {isOpen && (
        <>
          {/* Counter widget — client component for the search-and-enter flow. */}
          <div style={{ background: 'white', borderRadius: 10, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 20 }}>
            <h2 style={{ margin: '0 0 12px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Count a product</h2>
            <StocktakeCounter
              stocktakeId={stocktake.id}
              products={products.map(p => ({
                id: p.id,
                brand: p.brand,
                name: p.name,
                stock: p.stock ?? 0,
                sku: p.sku ?? null,
                barcode: p.barcode ?? null,
              }))}
              alreadyCounted={Array.from(countedIds)}
            />
          </div>
        </>
      )}

      {/* Counted lines table */}
      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb' }}>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
            Counts so far ({lines.length})
          </h2>
        </div>
        {lines.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
            No counts recorded yet. Use the counter above to start.
          </div>
        ) : (
          <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Product', 'System', 'Counted', 'Δ', 'When'].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((ln, i) => {
                const prod = productMap.get(ln.product_id);
                const deltaColor = ln.delta === 0 ? '#16a34a' : ln.delta < 0 ? '#991b1b' : '#92400e';
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
                    <td data-label="System" style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{ln.system_qty}</td>
                    <td data-label="Counted" style={{ ...td, fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{ln.counted_qty}</td>
                    <td data-label="Δ" style={{ ...td, fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: deltaColor }}>
                      {ln.delta > 0 ? `+${ln.delta}` : ln.delta}
                    </td>
                    <td data-label="When" style={{ ...td, fontSize: '0.75rem', color: '#9ca3af' }}>
                      {new Date(ln.counted_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {isOpen && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <form action={finalizeStocktake}>
            <input type="hidden" name="stocktake_id" value={stocktake.id} />
            <button type="submit" style={{
              padding: '12px 22px', background: '#10B981', color: 'white', border: 'none',
              borderRadius: 7, fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer', minHeight: 44,
            }}>
              Finalise &amp; write {adjustments} adjustment{adjustments === 1 ? '' : 's'}
            </button>
          </form>
          <form action={cancelStocktake}>
            <input type="hidden" name="stocktake_id" value={stocktake.id} />
            <button type="submit" style={{
              padding: '12px 22px', background: 'transparent', color: '#6b7280',
              border: '1px solid #d1d5db', borderRadius: 7, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', minHeight: 44,
            }}>
              Cancel stocktake
            </button>
          </form>
          <p style={{ margin: '12px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
            Finalising writes one ledger row per non-zero delta and updates product stock to the counted value. Cancelling discards the count session without touching stock.
          </p>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' | 'muted' }) {
  const fg = tone === 'good' ? '#16a34a' : tone === 'warn' ? '#92400e' : '#111827';
  return (
    <div style={{ background: 'white', borderRadius: 10, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: '1.5rem', fontWeight: 700, color: fg, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

function banner(bg: string, fg: string): React.CSSProperties {
  return {
    background: bg, color: fg, padding: '10px 14px', borderRadius: 8,
    marginBottom: 16, fontSize: '0.875rem', fontWeight: 500,
  };
}

const th: React.CSSProperties = {
  padding: '10px 16px', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700,
  color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em',
};
const td: React.CSSProperties = { padding: '12px 16px', fontSize: '0.875rem', color: '#374151' };
