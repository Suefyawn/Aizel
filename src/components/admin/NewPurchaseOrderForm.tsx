'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createPurchaseOrder } from '@/app/admin/inventory/management-actions';

// New PO form — supplier header + a line picker. Each line is a product
// + qty + optional unit cost. The product picker uses the same search
// + barcode-exact pattern as the stocktake counter and the till.
//
// Cost field defaults to the product's existing vendor_cost (now used
// as "unit cost" since vendors are gone) so a repeat order doesn't
// require retyping cost. The owner overrides if it changed.

interface PoFormProduct {
  id: string;
  brand: string | null;
  name: string;
  stock: number;
  default_cost: number | null;
  sku: string | null;
  barcode: string | null;
}

interface LineDraft {
  product_id: string;
  brand: string | null;
  name: string;
  qty: number;
  unit_cost: string;     // string so empty stays empty; coerced server-side
}

export function NewPurchaseOrderForm({ products }: { products: PoFormProduct[] }) {
  const router = useRouter();
  const [supplier, setSupplier] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const searchRef = useRef<HTMLInputElement | null>(null);

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    const exact = products.find(p => p.barcode && p.barcode.toLowerCase() === t);
    if (exact) return [exact];
    return products
      .filter(p => `${p.brand ?? ''} ${p.name} ${p.sku ?? ''} ${p.barcode ?? ''}`.toLowerCase().includes(t))
      .slice(0, 8);
  }, [products, q]);

  const totalCost = lines.reduce((s, l) => {
    const c = Number(l.unit_cost);
    return Number.isFinite(c) ? s + c * l.qty : s;
  }, 0);

  function addLine(p: PoFormProduct) {
    setLines(prev => {
      const i = prev.findIndex(l => l.product_id === p.id);
      if (i >= 0) {
        // Already in the PO — bump qty.
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + 1 };
        return next;
      }
      return [...prev, {
        product_id: p.id,
        brand: p.brand,
        name: p.name,
        qty: 1,
        unit_cost: p.default_cost != null ? String(p.default_cost) : '',
      }];
    });
    setQ('');
    setTimeout(() => searchRef.current?.focus(), 0);
  }

  function updateLine(i: number, patch: Partial<LineDraft>) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }
  function removeLine(i: number) {
    setLines(prev => prev.filter((_, idx) => idx !== i));
  }

  async function submit() {
    setError(null);
    if (!supplier.trim()) { setError('Supplier name is required'); return; }
    if (lines.length === 0) { setError('Add at least one product'); return; }
    startTransition(async () => {
      const r = await createPurchaseOrder({
        supplier_name: supplier.trim(),
        reference:     reference.trim() || null,
        note:          note.trim() || null,
        lines: lines.map(l => ({
          product_id: l.product_id,
          qty: l.qty,
          unit_cost: l.unit_cost.trim() === '' ? null : Number(l.unit_cost),
        })),
      });
      if (!r.ok) { setError(r.error ?? 'Could not create PO'); return; }
      router.push(`/admin/inventory/purchase-orders/${r.id}`);
    });
  }

  return (
    <div style={{ background: 'white', borderRadius: 10, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      {/* Supplier header */}
      <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
        <div>
          <label style={lbl}>Supplier *</label>
          <input
            type="text"
            value={supplier}
            onChange={e => setSupplier(e.target.value)}
            placeholder="e.g. ORS UK Ltd"
            style={inp}
          />
        </div>
        <div>
          <label style={lbl}>Supplier reference (optional)</label>
          <input
            type="text"
            value={reference}
            onChange={e => setReference(e.target.value)}
            placeholder="Their PO / invoice number"
            style={inp}
          />
        </div>
      </div>
      <div style={{ marginBottom: 24 }}>
        <label style={lbl}>Note (optional)</label>
        <input
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Anything the receiving cashier should know"
          maxLength={500}
          style={inp}
        />
      </div>

      {/* Product picker */}
      <h2 style={{ margin: '0 0 12px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Lines</h2>
      <input
        ref={searchRef}
        type="search"
        value={q}
        onChange={e => setQ(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && matches.length === 1) { e.preventDefault(); addLine(matches[0]); } }}
        placeholder="Scan / type to add a product…"
        autoComplete="off"
        style={{ ...inp, marginBottom: q.trim() ? 0 : 16, fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}
      />
      {q.trim() && matches.length > 0 && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 16, overflow: 'hidden' }}>
          {matches.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => addLine(p)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                padding: '10px 14px', background: 'white', border: 'none', cursor: 'pointer',
                textAlign: 'left', borderTop: '1px solid #f3f4f6',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827' }}>
                  {p.brand ? `${p.brand} · ` : ''}{p.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2 }}>
                  Stock {p.stock}{p.default_cost != null ? ` · last cost £${p.default_cost}` : ''}
                </div>
              </div>
              <span style={{ color: '#4A1A6B', fontSize: '1rem', fontWeight: 700 }}>＋</span>
            </button>
          ))}
        </div>
      )}

      {/* Lines table */}
      {lines.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem', background: '#f9fafb', borderRadius: 8, marginBottom: 18 }}>
          No lines yet. Search above to add the first product.
        </div>
      ) : (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 18, overflow: 'hidden' }}>
          {lines.map((l, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '1fr 90px 110px 40px', gap: 10,
              padding: '10px 14px', borderTop: i > 0 ? '1px solid #f3f4f6' : 'none',
              alignItems: 'center',
            }}>
              <div style={{ minWidth: 0 }}>
                {l.brand && <div style={{ fontSize: '0.6875rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>{l.brand}</div>}
                <div style={{ fontWeight: 500, fontSize: '0.875rem', color: '#111827' }}>{l.name}</div>
              </div>
              <input
                type="number" min={1} step={1} value={l.qty}
                onChange={e => updateLine(i, { qty: Math.max(1, Number(e.target.value) || 1) })}
                aria-label={`Quantity for ${l.name}`}
                style={{ ...inp, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
              />
              <input
                type="number" step="0.01" min={0} value={l.unit_cost}
                onChange={e => updateLine(i, { unit_cost: e.target.value })}
                placeholder="£ unit cost"
                aria-label={`Unit cost for ${l.name}`}
                style={{ ...inp, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
              />
              <button
                type="button" onClick={() => removeLine(i)}
                aria-label={`Remove ${l.name}`}
                style={{
                  width: 36, height: 36, background: 'transparent', border: 'none',
                  color: '#dc2626', fontSize: '1.25rem', cursor: 'pointer', borderRadius: 6,
                }}
              >×</button>
            </div>
          ))}
          <div style={{
            padding: '12px 14px', borderTop: '2px solid #111827', background: '#f9fafb',
            display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.9375rem',
          }}>
            <span>Estimated total cost</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>£{totalCost.toFixed(2)}</span>
          </div>
        </div>
      )}

      {error && (
        <div role="alert" style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 12px', borderRadius: 7, marginBottom: 16, fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => router.push('/admin/inventory/purchase-orders')}
          style={{
            padding: '10px 18px', background: 'transparent', border: '1px solid #d1d5db',
            borderRadius: 7, color: '#374151', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', minHeight: 40,
          }}
        >Cancel</button>
        <button
          type="button"
          onClick={submit}
          disabled={busy || lines.length === 0 || !supplier.trim()}
          style={{
            padding: '10px 22px',
            background: busy || lines.length === 0 || !supplier.trim() ? '#9ca3af' : '#4A1A6B',
            color: 'white', border: 'none', borderRadius: 7,
            fontSize: '0.875rem', fontWeight: 600,
            cursor: busy || lines.length === 0 || !supplier.trim() ? 'not-allowed' : 'pointer',
            minHeight: 40,
          }}
        >
          {busy ? 'Saving…' : 'Save PO'}
        </button>
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
