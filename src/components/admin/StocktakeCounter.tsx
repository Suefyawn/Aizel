'use client';

import { useMemo, useRef, useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { recordStocktakeCount } from '@/app/admin/inventory/management-actions';

// Stocktake counter widget — sits on the stocktake detail page during
// an open count session. Workflow:
//
//   1. Cashier scans / types into the search box. Barcode-exact match
//      narrows to a single product (the rest of the till's keyboard-
//      wedge support carries over).
//   2. Picks the result, types the counted quantity.
//   3. Submit posts an upsert to stocktake_lines and immediately clears
//      the form for the next product — keeps the cashier in the count
//      rhythm.
//
// Products already counted in this session show a green check and the
// count value, so the cashier can correct a typo without going back to
// the list.

interface CounterProduct {
  id: string;
  brand: string | null;
  name: string;
  stock: number;
  sku: string | null;
  barcode: string | null;
}

export function StocktakeCounter({ stocktakeId, products, alreadyCounted }: {
  stocktakeId: string;
  products: CounterProduct[];
  alreadyCounted: string[];
}) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<CounterProduct | null>(null);
  const [counted, setCounted] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const countRef = useRef<HTMLInputElement | null>(null);

  const alreadySet = useMemo(() => new Set(alreadyCounted), [alreadyCounted]);

  // Auto-focus the search field on mount so the cashier can scan immediately.
  useEffect(() => { searchRef.current?.focus(); }, []);

  const matches = useMemo(() => {
    const trimmed = q.trim().toLowerCase();
    if (!trimmed) return [];
    // Barcode exact match wins — scanners type the whole code + Enter.
    const exact = products.find(p => p.barcode && p.barcode.toLowerCase() === trimmed);
    if (exact) return [exact];
    return products
      .filter(p => `${p.brand ?? ''} ${p.name} ${p.sku ?? ''} ${p.barcode ?? ''}`.toLowerCase().includes(trimmed))
      .slice(0, 8);
  }, [products, q]);

  function pick(p: CounterProduct) {
    setPicked(p);
    setQ('');
    // Pre-fill counted with the system qty as a sensible starting value;
    // cashier overwrites if different. countRef gets focus next tick.
    setCounted(String(p.stock));
    setTimeout(() => { countRef.current?.focus(); countRef.current?.select(); }, 0);
  }

  function reset() {
    setPicked(null);
    setCounted('');
    setNote('');
    setError(null);
    setTimeout(() => searchRef.current?.focus(), 0);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!picked) return;
    setError(null);
    const n = Number(counted);
    if (!Number.isInteger(n) || n < 0) {
      setError('Counted quantity must be a whole number ≥ 0');
      return;
    }
    const fd = new FormData();
    fd.set('stocktake_id', stocktakeId);
    fd.set('product_id',   picked.id);
    fd.set('counted_qty',  String(n));
    if (note.trim()) fd.set('note', note.trim());

    startTransition(async () => {
      const r = await recordStocktakeCount(fd);
      if (!r.ok) { setError(r.error ?? 'Could not save count'); return; }
      reset();
      router.refresh();
    });
  }

  return (
    <div>
      {/* Search input */}
      {!picked && (
        <>
          <input
            ref={searchRef}
            type="search"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && matches.length === 1) { e.preventDefault(); pick(matches[0]); } }}
            placeholder="Scan a barcode, type a name / SKU…"
            autoComplete="off"
            style={{
              width: '100%', padding: '12px 14px',
              background: '#f9fafb', border: '1px solid #d1d5db', borderRadius: 8,
              fontSize: '0.9375rem', outline: 'none',
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            }}
          />
          {q.trim() && (
            <div style={{ marginTop: 10, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
              {matches.length === 0 ? (
                <div style={{ padding: 18, color: '#9ca3af', fontSize: '0.875rem', textAlign: 'center' }}>
                  No products match &ldquo;{q}&rdquo;
                </div>
              ) : matches.map(p => {
                const done = alreadySet.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => pick(p)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                      padding: '12px 14px', background: 'white', border: 'none', cursor: 'pointer',
                      textAlign: 'left', borderTop: '1px solid #f3f4f6',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827' }}>
                        {p.brand ? `${p.brand} · ` : ''}{p.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2 }}>
                        Stock {p.stock}{p.sku ? ` · SKU ${p.sku}` : ''}{p.barcode ? ` · ${p.barcode}` : ''}
                      </div>
                    </div>
                    {done && (
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, background: '#dcfce7', color: '#166534',
                        fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                      }}>Counted</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Counting form */}
      {picked && (
        <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
          <div style={{
            background: '#F5EFF8', border: '1px solid #E3D2EF', borderRadius: 8,
            padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#4A1A6B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Counting
              </div>
              <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#111827', marginTop: 2 }}>
                {picked.brand ? `${picked.brand} · ` : ''}{picked.name}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>
                System has {picked.stock} in stock
              </div>
            </div>
            <button type="button" onClick={reset} style={{
              padding: '6px 12px', background: 'transparent', border: '1px solid #d1d5db',
              borderRadius: 6, color: '#6b7280', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
            }}>Pick different</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }} className="adm-form-2col">
            <div>
              <label htmlFor="counted_qty" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                Counted quantity
              </label>
              <input
                ref={countRef}
                id="counted_qty"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={counted}
                onChange={e => setCounted(e.target.value)}
                style={{
                  width: '100%', padding: '12px 14px',
                  border: '1px solid #d1d5db', borderRadius: 7,
                  fontSize: '1.125rem', fontWeight: 700, textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                  background: 'white', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label htmlFor="ct-note" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                Note (optional)
              </label>
              <input
                id="ct-note"
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="e.g. damaged box, mis-shelved"
                maxLength={200}
                style={{
                  width: '100%', padding: '12px 14px',
                  border: '1px solid #d1d5db', borderRadius: 7,
                  fontSize: '0.875rem', background: 'white', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {error && (
            <div role="alert" style={{ background: '#fee2e2', color: '#991b1b', padding: '8px 12px', borderRadius: 6, fontSize: '0.8125rem' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            style={{
              padding: '12px 22px', background: busy ? '#9ca3af' : '#4A1A6B',
              color: 'white', border: 'none', borderRadius: 7,
              fontSize: '0.9375rem', fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer',
              minHeight: 44,
            }}
          >
            {busy ? 'Saving…' : 'Save count'}
          </button>
        </form>
      )}
    </div>
  );
}
