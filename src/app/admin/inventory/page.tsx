export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { brandPlusName } from '@/lib/product-display';
import { adjustStock } from '@/app/admin/inventory-actions';

interface LedgerRow {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  qty_delta: number;
  balance_after: number | null;
  reason: 'import' | 'order' | 'return' | 'restock' | 'adjustment' | 'damage' | 'transfer' | 'cancellation';
  order_id: string | null;
  actor_kind: 'system' | 'owner' | 'staff' | 'customer';
  actor_email: string | null;
  note: string | null;
  created_at: string;
}

interface ProductLite {
  id: string; name: string; brand: string | null; stock: number;
  track_inventory?: boolean;
  /** Per-product re-order threshold. NULL = inherit DEFAULT_REORDER_POINT. */
  reorder_point?: number | null;
  created_at?: string | null;
}
interface OrderLite { id: string; order_number: string }

/** Default re-order point when a product hasn't set its own. */
const DEFAULT_REORDER_POINT = 5;
// Legacy alias used by the KPI card label. Kept as a name only.
const LOW_STOCK_THRESHOLD = DEFAULT_REORDER_POINT;
// A product is "dead stock" when it's sitting in stock, has been on the
// shelves long enough that we can't blame "still launching", and hasn't
// shifted a unit in the same window. The 90-day cut-off matches Aizel's
// 6-8 week consumable cycle plus a margin — anything older than that is
// genuinely not pulling its weight.
const DEAD_STOCK_DAYS = 90;
const DEAD_STOCK_MS = DEAD_STOCK_DAYS * 86_400_000;

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
  new Date(s).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

function stockBadge(stock: number, reorderPoint: number = DEFAULT_REORDER_POINT): { label: string; bg: string; fg: string } {
  if (stock <= 0) return { label: 'Out of stock', bg: '#fee2e2', fg: '#991b1b' };
  if (stock <= reorderPoint) return { label: 'Low', bg: '#fef3c7', fg: '#92400e' };
  return { label: 'In stock', bg: '#d1fae5', fg: '#065f46' };
}

export default async function InventoryPage({
  searchParams,
}: { searchParams: Promise<{ product?: string; reason?: string; error?: string; ok?: string; view?: string }> }) {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('products.view')) {
    return <NoAccess section="Inventory" />;
  }

  const { product: productFilter, reason: reasonFilter, error: errMsg, ok: okMsg, view } = await searchParams;
  const admin = supabaseAdmin();

  let ledgerQuery = admin
    .from('inventory_ledger')
    .select('id, product_id, variant_id, qty_delta, balance_after, reason, order_id, actor_kind, actor_email, note, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (productFilter) ledgerQuery = ledgerQuery.eq('product_id', productFilter);
  if (reasonFilter && reasonFilter !== 'all') ledgerQuery = ledgerQuery.eq('reason', reasonFilter);

  // Dead-stock window — anything older than this is a candidate; anything
  // sold inside the window is exempt from the "dead stock" tag.
  // eslint-disable-next-line react-hooks/purity -- async server component; one "now" per request is the intended behaviour
  const renderNow = Date.now();
  const deadStockCutoff = new Date(renderNow - DEAD_STOCK_MS).toISOString();

  // Pull every product so the manual-adjustment form has a dropdown +
  // every 'order' ledger row inside the dead-stock window so we can
  // figure out who has shifted units recently. 109 SKUs today — well
  // under any sane limit; ledger query is bounded by date so it scales.
  const [{ data: ledgerData }, { data: productData }, { data: recentSales }] = await Promise.all([
    ledgerQuery,
    admin.from('products').select('id, name, brand, stock, track_inventory, reorder_point, created_at').order('name'),
    admin.from('inventory_ledger')
      .select('product_id')
      .eq('reason', 'order')
      .gte('created_at', deadStockCutoff),
  ]);
  const rows = (ledgerData ?? []) as LedgerRow[];
  const allProducts = (productData ?? []) as ProductLite[];
  const productMap = new Map<string, ProductLite>(allProducts.map(p => [p.id, p]));
  // Only tracked products belong on the inventory screen — untracked
  // products are always-sellable (services / made-to-order) so there's
  // nothing here to count or adjust.
  const products = allProducts.filter(p => p.track_inventory !== false);

  // Per-product re-order threshold — falls back to DEFAULT_REORDER_POINT
  // when the product hasn't set its own. Lets a fast-moving SKU sit at
  // "low" while a slow-mover at the same stock level stays "in stock".
  const reorderPointFor = (p: ProductLite) =>
    p.reorder_point != null ? p.reorder_point : DEFAULT_REORDER_POINT;

  // Stock overview — buckets + the lowest-first sorted list.
  const outOfStock = products.filter(p => p.stock <= 0);
  const lowStock = products.filter(p => p.stock > 0 && p.stock <= reorderPointFor(p));
  const healthyCount = products.length - outOfStock.length - lowStock.length;
  // Dead stock = in stock + older than the cut-off + no sale in the window.
  // We also filter out products with no created_at (very old rows from a
  // pre-migration era) to avoid a flood of false positives on first run.
  const recentlySoldIds = new Set(
    ((recentSales ?? []) as Array<{ product_id: string | null }>)
      .map(r => r.product_id).filter((v): v is string => !!v),
  );
  const deadStockList = products
    .filter(p => p.stock > 0)
    .filter(p => p.created_at && new Date(p.created_at).getTime() < renderNow - DEAD_STOCK_MS)
    .filter(p => !recentlySoldIds.has(p.id))
    .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));

  // "Needs attention" is the default view; the owner can switch to all
  // products or to the dead-stock view.
  const currentView: 'attention' | 'all' | 'dead' =
    view === 'all' ? 'all' : view === 'dead' ? 'dead' : 'attention';
  const stockList = [...products].sort((a, b) => a.stock - b.stock);
  const attentionList = stockList.filter(p => p.stock <= reorderPointFor(p));
  const visibleStock = currentView === 'all'
    ? stockList
    : currentView === 'dead'
      ? deadStockList
      : attentionList;

  // Resolve order ids to order numbers for the rows that link to an order.
  const orderIds = Array.from(new Set(rows.map(r => r.order_id).filter((v): v is string => Boolean(v))));
  const { data: orderData } = orderIds.length
    ? await admin.from('orders').select('id, order_number').in('id', orderIds)
    : { data: [] };
  const orderMap = new Map<string, OrderLite>(((orderData ?? []) as OrderLite[]).map(o => [o.id, o]));

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div className="adm-page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Inventory</h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>
            Stock levels, manual adjustments, stocktakes, purchase orders — and an audit trail of every movement.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/admin/inventory/stocktake" style={secondaryLinkStyle}>📋 Stocktake</Link>
          <Link href="/admin/inventory/purchase-orders" style={secondaryLinkStyle}>📦 Purchase orders</Link>
        </div>
      </div>
      <div style={{ marginBottom: 24 }} />


      {errMsg && (
        <div role="alert" style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.875rem' }}>{errMsg}</div>
      )}
      {okMsg && (
        <div role="status" style={{ background: '#d1fae5', color: '#065f46', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.875rem' }}>Stock updated.</div>
      )}

      {/* ─── Stock summary ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }} className="adm-stat-grid">
        {[
          { label: 'Out of stock', value: outOfStock.length, bg: '#fef2f2', fg: '#dc2626', bd: '#fecaca' },
          { label: `Low stock (≤ ${LOW_STOCK_THRESHOLD})`, value: lowStock.length, bg: '#fffbeb', fg: '#d97706', bd: '#fde68a' },
          // Dead stock highlights cash sitting on the shelf — surface
          // it in the headline grid so the operator notices it without
          // hunting through tabs. Purple tint to read "decision needed"
          // rather than the green/yellow/red urgency scale.
          { label: `Dead stock (${DEAD_STOCK_DAYS}d, 0 sales)`, value: deadStockList.length, bg: '#F5EFF8', fg: '#4A1A6B', bd: '#E2D2EB' },
          { label: 'Healthy', value: healthyCount, bg: '#f0fdf4', fg: '#16a34a', bd: '#bbf7d0' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.bd}`, borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: s.fg }}>{s.label}</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#111827', marginTop: 2 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ─── Stock levels table ─────────────────────────────────────────── */}
      <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
            {currentView === 'all' ? 'All products'
              : currentView === 'dead' ? `Dead stock — no sale in ${DEAD_STOCK_DAYS}+ days`
              : 'Needs attention'}
          </h2>
          <div style={{ display: 'flex', gap: 8, fontSize: '0.8125rem' }}>
            <Link href="/admin/inventory"            style={chipLink(currentView === 'attention')}>Needs attention</Link>
            <Link href="/admin/inventory?view=dead"  style={chipLink(currentView === 'dead')}>Dead stock</Link>
            <Link href="/admin/inventory?view=all"   style={chipLink(currentView === 'all')}>All products</Link>
          </div>
        </div>
        {visibleStock.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#16a34a', fontSize: '0.875rem', fontWeight: 600 }}>
            {currentView === 'dead'
              ? `Nothing sitting idle — every in-stock product has shifted a unit in the last ${DEAD_STOCK_DAYS} days.`
              : 'Every product is in stock. Nothing needs restocking.'}
          </div>
        ) : (
          <div style={{ maxHeight: 440, overflowY: 'auto' }}>
            <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['Product', 'Stock', 'Status', ''].map(h => (
                    <th scope="col" key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleStock.map(p => {
                  const badge = stockBadge(p.stock, reorderPointFor(p));
                  // In the dead-stock view, surface "X days on shelf" in
                  // place of the in-stock/low/out badge — the badge would
                  // always read "In stock" for every dead-stock row (by
                  // definition: dead stock means stock > 0) so it'd be
                  // dead weight. Days-on-shelf is the operator's lever.
                  const ageDays = p.created_at
                    ? Math.floor((renderNow - new Date(p.created_at).getTime()) / 86_400_000)
                    : null;
                  return (
                    <tr key={p.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td data-label="Product" style={td}>
                        <Link href={`/admin/products/${p.id}`} style={{ color: '#111827', fontWeight: 500, textDecoration: 'none' }}>
                          {brandPlusName(p.brand, p.name)}
                        </Link>
                      </td>
                      <td data-label="Stock" style={{ ...td, fontFamily: 'monospace', fontWeight: 700, color: p.stock <= 0 ? '#991b1b' : p.stock <= LOW_STOCK_THRESHOLD ? '#92400e' : '#111827' }}>
                        {p.stock}
                      </td>
                      <td data-label="Status" style={td}>
                        {currentView === 'dead' && ageDays !== null ? (
                          <span style={{ background: '#F5EFF8', color: '#4A1A6B', padding: '2px 8px', borderRadius: 6, fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {ageDays} days on shelf
                          </span>
                        ) : (
                          <span style={{ background: badge.bg, color: badge.fg, padding: '2px 8px', borderRadius: 6, fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {badge.label}
                          </span>
                        )}
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <Link href={`/admin/products/${p.id}`} style={{ color: '#4A1A6B', textDecoration: 'none', fontSize: '0.75rem', fontWeight: 600 }}>
                          Edit →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Manual adjustment form ─────────────────────────────────────── */}
      <h2 style={{ margin: '0 0 10px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Log a stock change</h2>
      <form
        action={adjustStock}
        className="adm-stock-form"
        style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', padding: 16, marginBottom: 24, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr auto', gap: 12, alignItems: 'end' }}
      >
        <div>
          <label htmlFor="product_id" style={lbl}>Product</label>
          <select id="product_id" name="product_id" required style={inp} defaultValue="">
            <option value="" disabled>Choose a product</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>
                {brandPlusName(p.brand, p.name)} — {p.stock} in stock
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="qty_delta" style={lbl}>Change (use + or −)</label>
          <input id="qty_delta" name="qty_delta" type="number" required step="1" placeholder="+50 to add, -3 to remove" style={inp} />
        </div>
        <div>
          <label htmlFor="reason" style={lbl}>Reason</label>
          <select id="reason" name="reason" required style={inp} defaultValue="restock">
            <option value="restock">Restock (+)</option>
            <option value="adjustment">Adjustment (±)</option>
            <option value="damage">Damage (–)</option>
          </select>
        </div>
        <div>
          <label htmlFor="note" style={lbl}>Note (optional)</label>
          <input id="note" name="note" type="text" maxLength={200} placeholder="e.g. Restock PO-2025-04" style={inp} />
        </div>
        <button type="submit" style={btn}>Log change</button>
      </form>

      {/* ─── Movement history ───────────────────────────────────────────── */}
      <h2 style={{ margin: '0 0 10px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Movement history</h2>

      {/* Filters */}
      <div className="adm-filter-pills" style={{ display: 'flex', gap: 8, marginBottom: 16, fontSize: '0.8125rem', flexWrap: 'wrap' }}>
        <Link href="/admin/inventory" style={chipLink(!reasonFilter && !productFilter)}>All</Link>
        {(['order','return','cancellation','restock','adjustment','damage','import'] as const).map(r => (
          <Link key={r} href={`/admin/inventory?reason=${r}`} style={chipLink(reasonFilter === r)}>
            {r.charAt(0).toUpperCase() + r.slice(1)}
          </Link>
        ))}
      </div>

      {/* Ledger table */}
      <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        {rows.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#9ca3af' }}>No stock movements yet.</div>
        ) : (
          <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['When','Product','Δ','Balance','Reason','Order','Actor','Note'].map(h => (
                  <th scope="col" key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const product = r.product_id ? productMap.get(r.product_id) : null;
                const order = r.order_id ? orderMap.get(r.order_id) : null;
                const color = reasonColors[r.reason];
                return (
                  <tr key={r.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td data-label="When" style={{ ...td, color: '#6b7280', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{fmtDate(r.created_at)}</td>
                    <td data-label="Product" style={td}>
                      {product
                        ? <Link href={`/admin/products/${product.id}`} style={{ color: '#4A1A6B', textDecoration: 'none' }}>{brandPlusName(product.brand, product.name)}</Link>
                        : <span style={{ color: '#9ca3af' }}>(variant {r.variant_id?.slice(0, 8)}…)</span>}
                    </td>
                    <td data-label="Δ" style={{ ...td, fontFamily: 'monospace', fontWeight: 700, color: r.qty_delta < 0 ? '#991b1b' : '#065f46' }}>
                      {r.qty_delta > 0 ? '+' : ''}{r.qty_delta}
                    </td>
                    <td data-label="Balance" style={{ ...td, fontFamily: 'monospace' }}>{r.balance_after ?? '—'}</td>
                    <td data-label="Reason" style={td}>
                      <span style={{ background: color.bg, color: color.fg, padding: '2px 8px', borderRadius: 6, fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {r.reason}
                      </span>
                    </td>
                    <td data-label="Order" style={{ ...td, fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {order
                        ? <Link href={`/admin/orders/${order.id}`} style={{ color: '#4A1A6B', textDecoration: 'none' }}>{order.order_number}</Link>
                        : '—'}
                    </td>
                    <td data-label="Actor" style={{ ...td, fontSize: '0.75rem', color: '#374151' }}>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: r.actor_kind === 'owner' ? '#4A1A6B' : r.actor_kind === 'staff' ? '#3b82f6' : '#6b7280', textTransform: 'uppercase' }}>
                        {r.actor_kind}
                      </span>
                      {r.actor_email && <div style={{ fontSize: '0.6875rem', color: '#6b7280' }}>{r.actor_email}</div>}
                    </td>
                    <td data-label="Note" style={{ ...td, fontSize: '0.75rem', color: '#374151', maxWidth: 280 }}>{r.note ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <p style={{ marginTop: 12, fontSize: '0.75rem', color: '#9ca3af' }}>Showing the most recent 200 movements{reasonFilter ? ` for "${reasonFilter}"` : ''}.</p>
    </div>
  );
}

const lbl: React.CSSProperties = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 };
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem', background: 'white' };
const btn: React.CSSProperties = { padding: '9px 18px', background: '#4A1A6B', color: 'white', border: 'none', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' };
const th:  React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' };
const td:  React.CSSProperties = { padding: '10px 16px', verticalAlign: 'top' };
const chipLink = (active: boolean): React.CSSProperties => ({
  padding: '6px 12px',
  borderRadius: 6,
  border: '1px solid ' + (active ? '#4A1A6B' : '#e5e7eb'),
  // Pale-purple wash + deep purple text — was magenta/fuchsia (Tailwind
  // YellowPink-era leftover) on an admin chip.
  background: active ? '#EDE9FE' : 'white',
  color: active ? '#4A1A6B' : '#374151',
  textDecoration: 'none',
  fontWeight: active ? 700 : 500,
});
const secondaryLinkStyle: React.CSSProperties = {
  padding: '8px 14px',
  background: 'white',
  border: '1px solid #d1d5db',
  borderRadius: 7,
  color: '#374151',
  fontSize: '0.8125rem',
  fontWeight: 600,
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  minHeight: 36,
};
