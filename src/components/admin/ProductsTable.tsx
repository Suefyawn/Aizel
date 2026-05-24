'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { deleteProduct } from '@/app/admin/actions';
import {
  bulkArchiveProducts, bulkDeleteProducts, bulkPriceAdjustProducts,
  bulkPublishProducts, bulkTagProducts,
} from '@/app/admin/bulk-product-actions';
import { DeleteButton } from '@/components/admin/DeleteButton';
import { useToast } from '@/components/admin/Toast';
import type { Product } from '@/types';

const fmt = (n: number) => `£${n.toLocaleString()}`;
const TAGS = ['New', 'Sale', 'Bestseller', 'Featured', 'Limited'];

const STATUS_BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  published: { bg: '#f0fdf4', fg: '#16a34a', label: 'Published' },
  draft:     { bg: '#f3f4f6', fg: '#6b7280', label: 'Draft' },
  archived:  { bg: '#fef2f2', fg: '#dc2626', label: 'Archived' },
};

// Derived stock state shared by the desktop table and the mobile cards.
function stockState(p: Product) {
  const untracked = p.track_inventory === false;
  const lowStock = !untracked && p.stock > 0 && p.stock <= 10;
  const outOfStock = !untracked && p.stock === 0;
  return { untracked, lowStock, outOfStock };
}

function StatusBadge({ status }: { status?: string }) {
  const badge = STATUS_BADGE[status ?? 'published'] ?? STATUS_BADGE.published;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 20,
      fontSize: '0.75rem', fontWeight: 600,
      background: badge.bg, color: badge.fg,
    }}>
      {badge.label}
    </span>
  );
}

function StockBadge({ product }: { product: Product }) {
  const { untracked, lowStock, outOfStock } = stockState(product);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700,
      background: untracked ? '#f3f4f6' : outOfStock ? '#fef2f2' : lowStock ? '#fffbeb' : '#f0fdf4',
      color: untracked ? '#6b7280' : outOfStock ? '#dc2626' : lowStock ? '#d97706' : '#16a34a',
      border: `1px solid ${untracked ? '#e5e7eb' : outOfStock ? '#fecaca' : lowStock ? '#fde68a' : '#bbf7d0'}`,
    }}>
      {untracked ? 'Managed externally' : outOfStock ? '✕ Out of stock' : lowStock ? `⚠ ${product.stock} left` : `✓ ${product.stock}`}
    </span>
  );
}

function Price({ product }: { product: Product }) {
  return (
    <>
      {fmt(product.price)}
      {product.original_price ? (
        <span style={{ color: '#9ca3af', fontWeight: 400, textDecoration: 'line-through', fontSize: '0.75rem', marginLeft: 6 }}>
          {fmt(product.original_price)}
        </span>
      ) : null}
    </>
  );
}

export function ProductsTable({ products }: { products: Product[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const allSelected = products.length > 0 && selected.size === products.length;
  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(products.map(p => p.id)));

  const wrap = (fn: () => Promise<unknown>, label: string) => {
    if (selected.size === 0) return;
    startTransition(async () => {
      await fn();
      const count = selected.size;
      setSelected(new Set());
      toast(`${label} (${count})`, 'success');
    });
  };

  const handleBulkDelete = () => {
    if (selected.size === 0) return;
    const n = selected.size;
    if (!window.confirm(
      `Delete ${n} product${n !== 1 ? 's' : ''}? Any with order history will be archived instead so reports stay intact.`,
    )) return;
    const ids = Array.from(selected);
    startTransition(async () => {
      const { deleted, archived } = await bulkDeleteProducts(ids);
      setSelected(new Set());
      const parts: string[] = [];
      if (deleted) parts.push(`${deleted} deleted`);
      if (archived) parts.push(`${archived} archived (had orders)`);
      toast(parts.join(' · ') || 'No products changed', 'success');
    });
  };

  return (
    <>
      {products.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#9ca3af' }}>
            No products found. <Link href="/admin/products/new" style={{ color: '#4A1A6B' }}>Add one &rarr;</Link>
          </div>
        </div>
      ) : (
        <>
          {/* -- Desktop: table -- */}
          <div className="adm-products-table adm-table-scroll" style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <th scope="col" style={{ padding: '11px 12px', width: 30 }}>
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all products" />
                  </th>
                  {['Brand / Name', 'Price', 'Stock', 'Status', 'Category', 'Tag', 'Actions'].map(h => (
                    <th scope="col" key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p, i) => {
                  const { lowStock, outOfStock } = stockState(p);
                  const checked = selected.has(p.id);
                  return (
                    <tr key={p.id} style={{
                      borderTop: i > 0 ? '1px solid #f3f4f6' : 'none',
                      background: checked ? '#fdf2f8' : outOfStock ? '#fef2f2' : lowStock ? '#fffbeb' : 'transparent',
                    }}>
                      <td style={{ padding: '12px' }}>
                        <input type="checkbox" checked={checked} onChange={() => toggle(p.id)} aria-label={`Select ${p.name}`} />
                      </td>
                      <td style={{ padding: '12px 16px', maxWidth: 260 }}>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: 1 }}>{p.brand}</div>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                        {p.variant && <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 1 }}>{p.variant}</div>}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '0.875rem', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>
                        {fmt(p.price)}
                        {p.original_price && (
                          <div style={{ color: '#9ca3af', fontWeight: 400, textDecoration: 'line-through', fontSize: '0.75rem' }}>
                            {fmt(p.original_price)}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <StockBadge product={p} />
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <StatusBadge status={p.status} />
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '0.8125rem', color: '#374151' }}>
                        <div>{p.category}</div>
                        {p.subcategory && <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{p.subcategory}</div>}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {p.tag ? (
                          <span style={{ display: 'inline-block', padding: '2px 8px', background: '#fdf2f8', borderRadius: 20, fontSize: '0.75rem', fontWeight: 500, color: '#9d174d' }}>
                            {p.tag}
                          </span>
                        ) : <span style={{ color: '#d1d5db' }}>&mdash;</span>}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <Link href={`/admin/products/${p.id}`} style={{ padding: '7px 14px', background: '#f3f4f6', color: '#374151', borderRadius: 6, textDecoration: 'none', fontSize: '0.8125rem', fontWeight: 500, minHeight: 32, display: 'inline-flex', alignItems: 'center' }}>
                            Edit
                          </Link>
                          <DeleteButton id={p.id} action={deleteProduct} confirmMsg={`Delete "${p.name}"?`} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* -- Mobile: headline-led cards. The product name leads in a larger,
               bolder weight; price / stock / status / category follow as
               smaller secondary text. -- */}
          <div className="adm-products-cards">
            {products.map(p => {
              const { lowStock, outOfStock } = stockState(p);
              const checked = selected.has(p.id);
              return (
                <div
                  key={p.id}
                  className="adm-product-card"
                  style={{ background: checked ? '#fdf2f8' : outOfStock ? '#fef2f2' : lowStock ? '#fffbeb' : 'white' }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(p.id)}
                      aria-label={`Select ${p.name}`}
                      style={{ cursor: 'pointer', accentColor: '#4A1A6B', width: 18, height: 18, flexShrink: 0, marginTop: 3 }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      {p.brand && (
                        <div style={{ fontSize: '0.6875rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {p.brand}
                        </div>
                      )}
                      {/* Headline: the product name, the key fact of the row. */}
                      <Link
                        href={`/admin/products/${p.id}`}
                        style={{ display: 'block', fontWeight: 700, fontSize: '1rem', lineHeight: 1.3, color: '#111827', textDecoration: 'none' }}
                      >
                        {p.name}
                      </Link>
                      {p.variant && (
                        <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 1 }}>{p.variant}</div>
                      )}
                    </div>
                    <span style={{ flexShrink: 0 }}><StatusBadge status={p.status} /></span>
                  </div>

                  {/* Secondary facts: price + stock, smaller and lighter. */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827' }}>
                      <Price product={p} />
                    </span>
                    <StockBadge product={p} />
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af', marginLeft: 'auto', textAlign: 'right' }}>
                      {p.category}{p.subcategory ? ` · ${p.subcategory}` : ''}
                      {p.tag ? ` · ${p.tag}` : ''}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <Link
                      href={`/admin/products/${p.id}`}
                      style={{ padding: '8px 16px', background: '#f3f4f6', color: '#374151', borderRadius: 6, textDecoration: 'none', fontSize: '0.8125rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}
                    >
                      Edit
                    </Link>
                    <DeleteButton id={p.id} action={deleteProduct} confirmMsg={`Delete "${p.name}"?`} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="adm-bulk-bar" style={{
          position: 'sticky', bottom: 16, zIndex: 20,
          background: '#111827', borderRadius: 10,
          padding: '12px 20px', margin: '12px 0 0',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        }}>
          <span style={{ color: '#f9fafb', fontSize: '0.875rem', fontWeight: 600 }}>{selected.size} selected</span>

          <button onClick={() => wrap(() => bulkPublishProducts(Array.from(selected)), 'Published')} disabled={pending} style={btn('#10b981')}>Publish</button>
          <button onClick={() => wrap(() => bulkArchiveProducts(Array.from(selected)), 'Archived')} disabled={pending} style={btn('#6b7280')}>Archive</button>

          <select onChange={e => {
            const v = e.target.value;
            if (!v) return;
            wrap(() => bulkTagProducts(Array.from(selected), v === '__clear__' ? null : v), `Tagged "${v}"`);
            e.target.value = '';
          }} defaultValue="" style={{
            padding: '5px 10px', borderRadius: 6, border: '1px solid #374151',
            background: '#1f2937', color: '#f9fafb', fontSize: '0.8125rem', cursor: 'pointer',
          }}>
            <option value="" disabled>Set tag&hellip;</option>
            {TAGS.map(t => <option key={t} value={t}>{t}</option>)}
            <option value="__clear__">&mdash; Clear tag &mdash;</option>
          </select>

          <button onClick={() => {
            const v = window.prompt('Adjust price by %? (e.g. -10 = 10% off, +5 = 5% mark-up)');
            if (v === null || v === '') return;
            const n = Number(v);
            if (!isFinite(n)) return;
            wrap(async () => { await bulkPriceAdjustProducts(Array.from(selected), n); }, `Price ${n >= 0 ? '+' : ''}${n}%`);
          }} disabled={pending} style={btn('#3b82f6')}>Adjust price&hellip;</button>

          <button onClick={handleBulkDelete} disabled={pending} style={btn('#ef4444')}>Delete</button>

          <button onClick={() => setSelected(new Set())} style={{
            marginLeft: 'auto', padding: '5px 12px', borderRadius: 6,
            border: '1px solid #374151', background: 'transparent', color: '#9ca3af',
            fontSize: '0.8125rem', cursor: 'pointer',
          }}>
            Clear
          </button>
        </div>
      )}
    </>
  );
}

function btn(color: string): React.CSSProperties {
  return {
    padding: '5px 14px', borderRadius: 20, border: 'none',
    background: color + '30', color,
    fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
  };
}
