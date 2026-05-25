'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { createManualOrder } from '@/app/admin/orders/manual-actions';

export interface ProductOption {
  id: string;
  brand: string | null;
  name: string;
  price: number;
  slug: string;
  image_url: string | null;
  in_stock: boolean;
}

interface LineItem {
  product_id: string;
  name: string;
  brand: string | null;
  price: number;     // operator can override before submit
  qty: number;
  slug: string;
  image_url: string | null;
}

interface Props {
  products: ProductOption[];
}

const fmtGBP = (n: number) =>
  `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function ManualOrderForm({ products }: Props) {
  const [items, setItems] = useState<LineItem[]>([]);
  const [search, setSearch] = useState('');
  const [shipping, setShipping] = useState('0');
  const [silent, setSilent] = useState(false);
  const [state, formAction, pending] = useActionState(createManualOrder, null);
  // Dropdown open/closed state. Open when the input is focused AND has
  // a query; outside-click or Esc closes. Without this the dropdown
  // floated forever over the form below, blocking clicks on real fields.
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-focus the search field on mount — operators want to start
  // typing immediately, no extra click to focus.
  useEffect(() => { searchInputRef.current?.focus(); }, []);

  // Close on outside-click + Escape. Single listener pair, cleaned up
  // on unmount. We bind to mousedown not click so a click on a
  // dropdown row (which calls addProduct) doesn't race the close.
  useEffect(() => {
    if (!dropdownOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      const wrap = searchWrapRef.current;
      if (wrap && !wrap.contains(e.target as Node)) setDropdownOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDropdownOpen(false); };
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [dropdownOpen]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter(p => {
        if (items.some(i => i.product_id === p.id)) return false; // skip already-added
        return `${p.brand ?? ''} ${p.name}`.toLowerCase().includes(q);
      })
      .slice(0, 8);
  }, [products, search, items]);

  function addProduct(p: ProductOption) {
    setItems(prev => [...prev, {
      product_id: p.id,
      name: p.name,
      brand: p.brand,
      price: p.price,
      qty: 1,
      slug: p.slug,
      image_url: p.image_url,
    }]);
    setSearch('');
  }

  function updateItem(idx: number, patch: Partial<LineItem>) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
  const shippingNum = Number(shipping) || 0;
  const total = subtotal + shippingNum;
  const canSubmit = items.length > 0 && !pending;

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {state?.error && (
        <div role="alert" style={errorStyle}>{state.error}</div>
      )}

      {/* ── Customer ─────────────────────────────────────────────────── */}
      <section style={sectionStyle}>
        <h2 style={h2Style}>Customer</h2>
        <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="First name *"  name="first_name" required />
          <Field label="Last name *"   name="last_name"  required />
          <Field label="Email"         name="email"      type="email" placeholder="optional — leave blank for in-store gifts" />
          <Field label="Phone *"       name="phone"      type="tel" placeholder="07123 456789" required />
        </div>
      </section>

      {/* ── Address ──────────────────────────────────────────────────── */}
      <section style={sectionStyle}>
        <h2 style={h2Style}>Shipping address</h2>
        <Field label="Address line *"   name="address" required placeholder="House/flat name or number, street" />
        <div className="adm-form-3col" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginTop: 12 }}>
          <Field label="City / Town *"        name="city" required placeholder="London" />
          <Field label="Country / Region"     name="province" placeholder="England" />
          <Field label="Postcode *"           name="zip" required placeholder="SW1A 1AA" />
        </div>
      </section>

      {/* ── Items ────────────────────────────────────────────────────── */}
      <section style={sectionStyle}>
        <h2 style={h2Style}>Items</h2>
        <div ref={searchWrapRef} style={{ position: 'relative', marginBottom: 12 }}>
          <input
            ref={searchInputRef}
            type="search"
            value={search}
            onChange={e => { setSearch(e.target.value); setDropdownOpen(true); }}
            onFocus={() => { if (search.trim()) setDropdownOpen(true); }}
            placeholder="Search products by brand or name…"
            style={inputStyle}
            aria-label="Search products"
            aria-expanded={dropdownOpen && matches.length > 0}
          />
          {dropdownOpen && matches.length > 0 && (
            <ul role="listbox" style={dropdownStyle}>
              {matches.map(p => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => { addProduct(p); setDropdownOpen(false); }}
                    style={dropdownRowStyle}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, color: '#111827', fontSize: '0.875rem' }}>
                        {p.brand ? `${p.brand} — ` : ''}{p.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        {fmtGBP(p.price)}{!p.in_stock ? ' · out of stock' : ''}
                      </div>
                    </div>
                    <span style={{ color: '#4A1A6B', fontWeight: 700, fontSize: '0.75rem' }}>+ Add</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length === 0 ? (
          <div style={emptyStyle}>No items yet — search above to add products.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((it, i) => (
              <div key={`${it.product_id}-${i}`} style={itemRowStyle}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: '0.875rem', color: '#111827' }}>
                    {it.brand ? `${it.brand} — ` : ''}{it.name}
                  </div>
                </div>
                <label style={{ fontSize: '0.6875rem', color: '#6b7280' }}>
                  Qty
                  <input
                    type="number" min={1} max={999} value={it.qty}
                    onChange={e => updateItem(i, { qty: Math.max(1, Number(e.target.value) || 1) })}
                    style={{ ...miniInputStyle, width: 64 }}
                    aria-label={`Quantity for ${it.name}`}
                  />
                </label>
                <label style={{ fontSize: '0.6875rem', color: '#6b7280' }}>
                  Unit £
                  <input
                    type="number" step="0.01" min={0} value={it.price}
                    onChange={e => updateItem(i, { price: Math.max(0, Number(e.target.value) || 0) })}
                    style={{ ...miniInputStyle, width: 84 }}
                    aria-label={`Unit price for ${it.name}`}
                  />
                </label>
                <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: '0.875rem', minWidth: 70, textAlign: 'right' }}>
                  {fmtGBP(it.price * it.qty)}
                </span>
                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  aria-label={`Remove ${it.name}`}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#ef4444', fontSize: '1rem', padding: 4,
                  }}
                >×</button>
              </div>
            ))}
          </div>
        )}
        {/* Hidden field carries the serialised items list to the server
            action — React form actions only send named inputs. */}
        <input type="hidden" name="items_json" value={JSON.stringify(items.map(it => ({
          product_id: it.product_id,
          name: it.name, brand: it.brand,
          price: it.price, qty: it.qty,
          slug: it.slug, image_url: it.image_url,
        })))} />
      </section>

      {/* ── Payment + totals ─────────────────────────────────────────── */}
      <section style={sectionStyle}>
        <h2 style={h2Style}>Payment &amp; totals</h2>
        <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>
            Payment method
            <select name="pay_method" defaultValue="manual" style={{ ...inputStyle, marginTop: 4 }}>
              <option value="manual">Manual / already paid</option>
              <option value="card">Card (Stripe, mark as paid)</option>
              <option value="bank">Bank transfer</option>
              <option value="cod">Cash on collection</option>
            </select>
          </label>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>
            Shipping (£)
            <input
              type="number" step="0.01" min={0} name="shipping"
              value={shipping} onChange={e => setShipping(e.target.value)}
              style={{ ...inputStyle, marginTop: 4 }}
            />
          </label>
        </div>
        <div style={{ marginTop: 16, padding: '12px 16px', background: '#f9fafb', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Row label="Subtotal"  value={fmtGBP(subtotal)} />
          <Row label="Shipping"  value={fmtGBP(shippingNum)} />
          <Row label="Total"     value={fmtGBP(total)} bold />
        </div>
      </section>

      {/* ── Internal note + email opt-out ───────────────────────────── */}
      <section style={sectionStyle}>
        <Field
          label="Internal note (optional)"
          name="note"
          placeholder="Why this manual order — channel / context / next action"
          maxLength={500}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: '0.8125rem', color: '#374151', cursor: 'pointer' }}>
          <input
            type="checkbox" name="silent" value="1"
            checked={silent} onChange={e => setSilent(e.target.checked)}
          />
          Skip customer confirmation email
        </label>
      </section>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            padding: '11px 22px',
            background: canSubmit ? '#4A1A6B' : '#9ca3af',
            color: 'white', border: 'none', borderRadius: 8,
            fontSize: '0.9375rem', fontWeight: 600,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            minHeight: 44,
          }}
        >
          {pending ? 'Creating order…' : `Create order (${fmtGBP(total)})`}
        </button>
      </div>
    </form>
  );
}

// ─── Inline form primitives ────────────────────────────────────────────
function Field({ label, ...rest }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>
      {label}
      <input {...rest} style={{ ...inputStyle, marginTop: 4 }} />
    </label>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: bold ? '0.9375rem' : '0.8125rem', fontWeight: bold ? 700 : 500, color: bold ? '#111827' : '#374151' }}>
      <span>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

const sectionStyle: React.CSSProperties = {
  background: 'white', borderRadius: 10,
  padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};
const h2Style: React.CSSProperties = {
  margin: '0 0 14px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827',
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  border: '1px solid #d1d5db', borderRadius: 7,
  fontSize: '0.875rem', color: '#111827', background: 'white',
  outline: 'none', boxSizing: 'border-box',
};
const miniInputStyle: React.CSSProperties = {
  padding: '6px 8px', marginTop: 4,
  border: '1px solid #d1d5db', borderRadius: 6,
  fontSize: '0.8125rem', color: '#111827',
  outline: 'none', boxSizing: 'border-box', display: 'block',
};
const dropdownStyle: React.CSSProperties = {
  position: 'absolute', top: '100%', left: 0, right: 0,
  background: 'white', border: '1px solid #e5e7eb',
  borderRadius: 8, marginTop: 4, padding: 0, listStyle: 'none',
  boxShadow: '0 8px 24px rgba(0,0,0,0.08)', zIndex: 50,
  maxHeight: 320, overflowY: 'auto',
};
const dropdownRowStyle: React.CSSProperties = {
  width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12,
  padding: '10px 14px', background: 'transparent',
  border: 'none', cursor: 'pointer',
  borderBottom: '1px solid #f3f4f6',
};
const itemRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-end', gap: 12,
  padding: '10px 12px', background: '#f9fafb',
  border: '1px solid #f3f4f6', borderRadius: 8,
};
const emptyStyle: React.CSSProperties = {
  padding: '20px 16px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem',
  background: '#f9fafb', borderRadius: 8,
};
const errorStyle: React.CSSProperties = {
  padding: '10px 14px', background: '#fef2f2', color: '#991b1b',
  borderRadius: 8, fontSize: '0.875rem',
  border: '1px solid #fecaca',
};
