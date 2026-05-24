'use client';

import { useMemo, useRef, useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { completePosSale } from '@/app/admin/pos/actions';

export interface PosProduct {
  id: string;
  brand: string | null;
  name: string;
  price: number;
  slug: string;
  image_url: string | null;
  in_stock: boolean;
  stock: number | null;             // null = untracked
  sku: string | null;
  barcode: string | null;
  variant: string | null;
}

export interface PosSession {
  id: string;
  opening_float: number;
  opened_at: string;
}

interface CartLine {
  product_id: string;
  name: string;
  brand: string | null;
  unit_price: number;        // post-line-discount unit price
  list_price: number;        // catalogue price the line started at — used for the discount-pct display
  qty: number;
  variant: string | null;
  image_url: string | null;
  slug: string | null;
  discount_note?: string;
}

const fmtGBP = (n: number) =>
  `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  products: PosProduct[];
  cashier: { id: string; name: string };
  session: PosSession | null;
}

export function PosTerminal({ products, cashier, session }: Props) {
  const router = useRouter();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartDiscount, setCartDiscount] = useState<number>(0);
  const [search, setSearch] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [tenderOpen, setTenderOpen] = useState(false);
  const [lastSale, setLastSale] = useState<{ order_number: string; change: number } | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Keep focus on the search field at all times so a keyboard-wedge
  // barcode scanner just works — the scanner types fast then hits Enter,
  // and a focused search field is the easiest target.
  useEffect(() => {
    searchRef.current?.focus();
  }, [cart.length, tenderOpen, lastSale]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products.slice(0, 12);   // recent/popular shelf when empty
    // Barcode match is exact (scanners type the whole code) — try that
    // first so a scan resolves to a single product rather than a list.
    const barcodeHit = products.find(p => p.barcode && p.barcode.toLowerCase() === q);
    if (barcodeHit) return [barcodeHit];
    return products
      .filter(p =>
        `${p.brand ?? ''} ${p.name} ${p.sku ?? ''} ${p.barcode ?? ''}`.toLowerCase().includes(q),
      )
      .slice(0, 24);
  }, [products, search]);

  function addToCart(p: PosProduct) {
    setCart(prev => {
      const i = prev.findIndex(line => line.product_id === p.id);
      if (i >= 0) {
        // Already in cart — bump qty rather than adding a second line.
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + 1 };
        return next;
      }
      return [...prev, {
        product_id: p.id,
        name: p.name, brand: p.brand,
        unit_price: p.price, list_price: p.price,
        qty: 1,
        variant: p.variant, image_url: p.image_url, slug: p.slug,
      }];
    });
    // If this was a barcode scan (exact match → single result), clear
    // the field so the next scan lands clean.
    if (matches.length === 1) setSearch('');
  }

  function updateLine(idx: number, patch: Partial<CartLine>) {
    setCart(prev => prev.map((l, i) => i === idx ? { ...l, ...patch } : l));
  }
  function removeLine(idx: number) {
    setCart(prev => prev.filter((_, i) => i !== idx));
  }
  function clearSale() {
    setCart([]);
    setCartDiscount(0);
    setCustomerEmail('');
    setSearch('');
  }

  // Submit on Enter when there's exactly one match (scanner workflow).
  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (matches.length === 1) addToCart(matches[0]);
    }
  }

  const subtotal = cart.reduce((s, l) => s + l.unit_price * l.qty, 0);
  const clampedDiscount = Math.min(cartDiscount, subtotal);
  const total = Math.max(0, subtotal - clampedDiscount);

  // ── Render — sold sale screen takes priority over the ringup view ──────
  if (lastSale) {
    return <CompletedView order={lastSale} onNewSale={() => { setLastSale(null); clearSale(); }} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopBar cashier={cashier} session={session} onExit={() => router.push('/admin/dashboard')} />

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}>
        {/* ── Left half — cart ─────────────────────────────────────────── */}
        <section style={{
          display: 'flex', flexDirection: 'column',
          borderRight: '1px solid #2A2A2D',
          background: '#161618',
        }}>
          <header style={{
            padding: '14px 18px', borderBottom: '1px solid #2A2A2D',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <h2 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF' }}>
              Sale {cart.length > 0 && `· ${cart.reduce((s, l) => s + l.qty, 0)} item${cart.reduce((s, l) => s + l.qty, 0) === 1 ? '' : 's'}`}
            </h2>
            {cart.length > 0 && (
              <button onClick={clearSale} style={ghostButtonStyle('#fca5a5')}>Clear</button>
            )}
          </header>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {cart.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#6B7280', fontSize: '0.9375rem' }}>
                Scan a barcode or tap a product to add it.
              </div>
            ) : cart.map((line, i) => (
              <div key={`${line.product_id}-${i}`} style={cartRowStyle}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {line.brand && (
                    <div style={{ fontSize: '0.6875rem', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {line.brand}
                    </div>
                  )}
                  <div style={{ fontSize: '0.9375rem', fontWeight: 500, color: '#F5F5F7', lineHeight: 1.3 }}>
                    {line.name}
                  </div>
                  {line.variant && <div style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>{line.variant}</div>}
                </div>

                {/* Qty stepper — big tap targets for touchscreen. */}
                <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid #2A2A2D', borderRadius: 6, flexShrink: 0 }}>
                  <button onClick={() => updateLine(i, { qty: Math.max(1, line.qty - 1) })} style={stepperBtn}>−</button>
                  <input
                    type="number" min={1} max={999} value={line.qty}
                    onChange={e => updateLine(i, { qty: Math.max(1, Number(e.target.value) || 1) })}
                    style={qtyInput}
                  />
                  <button onClick={() => updateLine(i, { qty: line.qty + 1 })} style={stepperBtn}>+</button>
                </div>

                {/* Unit price — cashier can override down for line discount. */}
                <input
                  type="number" step="0.01" min={0} value={line.unit_price}
                  onChange={e => updateLine(i, { unit_price: Math.max(0, Number(e.target.value) || 0) })}
                  style={priceInput}
                  aria-label={`Unit price for ${line.name}`}
                />

                <div style={{ width: 88, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: '0.9375rem', color: '#F5F5F7', flexShrink: 0 }}>
                  {fmtGBP(line.unit_price * line.qty)}
                </div>

                <button onClick={() => removeLine(i)} aria-label={`Remove ${line.name}`} style={removeBtnStyle}>×</button>
              </div>
            ))}
          </div>

          {/* ── Totals + tender CTA ─────────────────────────────────────── */}
          <footer style={{ borderTop: '1px solid #2A2A2D', padding: '14px 18px', background: '#0F0F10' }}>
            <Row label="Subtotal" value={fmtGBP(subtotal)} muted />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.8125rem', color: '#9CA3AF' }}>
              <span>Cart discount (£)</span>
              <input
                type="number" step="0.01" min={0} max={subtotal} value={cartDiscount}
                onChange={e => setCartDiscount(Math.max(0, Number(e.target.value) || 0))}
                style={{ ...priceInput, width: 90, textAlign: 'right' }}
              />
            </div>
            <Row label="Total" value={fmtGBP(total)} big />

            <input
              type="email"
              placeholder="Customer email for receipt (optional)"
              value={customerEmail}
              onChange={e => setCustomerEmail(e.target.value)}
              style={{
                width: '100%', marginTop: 12, padding: '10px 12px',
                background: '#1F1F22', border: '1px solid #2A2A2D', borderRadius: 8,
                color: '#F5F5F7', fontSize: '0.875rem', outline: 'none',
              }}
            />

            <button
              type="button"
              disabled={cart.length === 0}
              onClick={() => setTenderOpen(true)}
              style={{
                width: '100%', marginTop: 12,
                padding: '18px',
                background: cart.length === 0 ? '#2A2A2D' : '#6B2C91',
                color: cart.length === 0 ? '#6B7280' : '#fff',
                border: 'none', borderRadius: 10,
                fontSize: '1.125rem', fontWeight: 700,
                cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                letterSpacing: '0.02em',
              }}
            >
              {cart.length === 0 ? 'Add items to start' : `Tender ${fmtGBP(total)}`}
            </button>
          </footer>
        </section>

        {/* ── Right half — product picker ──────────────────────────────── */}
        <section style={{ display: 'flex', flexDirection: 'column', background: '#0F0F10' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #2A2A2D' }}>
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Scan a barcode, type a name / SKU…"
              autoComplete="off"
              style={{
                width: '100%', padding: '14px 16px',
                background: '#1F1F22', border: '1px solid #2A2A2D', borderRadius: 10,
                color: '#F5F5F7', fontSize: '1rem', outline: 'none',
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              }}
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
              {matches.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#6B7280', padding: 32 }}>
                  No products match &ldquo;{search}&rdquo;
                </div>
              ) : matches.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addToCart(p)}
                  disabled={!p.in_stock}
                  style={{
                    display: 'flex', flexDirection: 'column',
                    padding: 12, borderRadius: 10,
                    background: p.in_stock ? '#1F1F22' : '#181819',
                    border: '1px solid #2A2A2D',
                    color: '#F5F5F7', textAlign: 'left',
                    cursor: p.in_stock ? 'pointer' : 'not-allowed',
                    opacity: p.in_stock ? 1 : 0.5,
                    minHeight: 140,
                  }}
                >
                  <div style={{
                    width: '100%', aspectRatio: '1', background: '#0F0F10',
                    borderRadius: 6, overflow: 'hidden', marginBottom: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '1.5rem', color: '#6B7280', fontWeight: 700 }}>
                        {(p.brand?.[0] ?? p.name[0] ?? '?').toUpperCase()}
                      </span>
                    )}
                  </div>
                  {p.brand && (
                    <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {p.brand}
                    </div>
                  )}
                  <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#F5F5F7', lineHeight: 1.2, marginTop: 2, flex: 1 }}>
                    {p.name.length > 60 ? p.name.slice(0, 57) + '…' : p.name}
                  </div>
                  <div style={{ marginTop: 6, fontVariantNumeric: 'tabular-nums', fontSize: '0.875rem', fontWeight: 700 }}>
                    {fmtGBP(p.price)}
                  </div>
                  {!p.in_stock && (
                    <div style={{ fontSize: '0.625rem', color: '#fca5a5', marginTop: 2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Out of stock
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>

      {tenderOpen && (
        <TenderModal
          total={total}
          onClose={() => setTenderOpen(false)}
          onComplete={async (tenders) => {
            const result = await completePosSale({
              items: cart.map(l => ({
                product_id: l.product_id,
                name: l.name,
                brand: l.brand,
                unit_price: l.unit_price,
                qty: l.qty,
                variant: l.variant,
                image_url: l.image_url ?? undefined,
                slug: l.slug ?? undefined,
                discount_note: l.unit_price < l.list_price ? `Marked down from ${fmtGBP(l.list_price)}` : undefined,
              })),
              cart_discount: clampedDiscount,
              customer_email: customerEmail || undefined,
              session_id: session?.id ?? null,
              tenders,
            });
            if (!result.ok) {
              return { ok: false, error: result.error ?? 'Sale failed' };
            }
            setTenderOpen(false);
            setLastSale({ order_number: result.order_number!, change: result.change ?? 0 });
            return { ok: true };
          }}
        />
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

function TopBar({ cashier, session, onExit }: {
  cashier: { id: string; name: string };
  session: PosSession | null;
  onExit: () => void;
}) {
  return (
    <header style={{
      height: 56, display: 'flex', alignItems: 'center',
      padding: '0 18px', gap: 16,
      borderBottom: '1px solid #2A2A2D',
      background: '#0A0A0A',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#6B2C91', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.875rem', color: '#fff' }}>A</span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 500, color: '#F5F5F7' }}>Aizel · POS</span>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, alignItems: 'center', fontSize: '0.8125rem', color: '#9CA3AF' }}>
        <span>{cashier.name}</span>
        {session ? (
          <span style={{ padding: '2px 10px', background: '#1F1F22', borderRadius: 20, fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#34D399' }}>
            Till open · float {fmtGBP(session.opening_float)}
          </span>
        ) : (
          <span style={{ padding: '2px 10px', background: '#1F1F22', borderRadius: 20, fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#FBBF24' }}>
            No till open
          </span>
        )}
        <button onClick={onExit} style={ghostButtonStyle('#9CA3AF')}>Exit</button>
      </div>
    </header>
  );
}

function Row({ label, value, muted, big }: { label: string; value: string; muted?: boolean; big?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0' }}>
      <span style={{
        fontSize: big ? '0.875rem' : '0.8125rem',
        color: muted ? '#9CA3AF' : '#F5F5F7',
        fontWeight: big ? 700 : 500,
      }}>{label}</span>
      <span style={{
        fontVariantNumeric: 'tabular-nums',
        fontSize: big ? '1.5rem' : '0.9375rem',
        fontWeight: big ? 700 : 500,
        color: '#F5F5F7',
      }}>{value}</span>
    </div>
  );
}

function TenderModal({ total, onClose, onComplete }: {
  total: number;
  onClose: () => void;
  onComplete: (tenders: { method: 'cash' | 'card' | 'stripe_terminal'; amount: number; txn_ref?: string | null }[]) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [method, setMethod] = useState<'cash' | 'card'>('cash');
  const [cashIn, setCashIn] = useState<number>(total);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const change = method === 'cash' ? Math.max(0, cashIn - total) : 0;

  function tap(amount: number) {
    setCashIn(amount);
  }

  function submit() {
    setError(null);
    const tenders = method === 'cash'
      ? [{ method: 'cash' as const, amount: cashIn }]
      : [{ method: 'card' as const, amount: total, txn_ref: null }];
    startTransition(async () => {
      const r = await onComplete(tenders);
      if (!r.ok) setError(r.error ?? 'Sale failed');
    });
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100, padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label="Take payment"
        style={{
          background: '#161618', borderRadius: 14, padding: 28,
          maxWidth: 480, width: '100%',
          border: '1px solid #2A2A2D',
        }}
      >
        <div style={{ marginBottom: 20, textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Total due
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', fontWeight: 500, letterSpacing: '-0.02em', color: '#F5F5F7' }}>
            {fmtGBP(total)}
          </div>
        </div>

        {/* Tender method toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {(['cash', 'card'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              style={{
                flex: 1, padding: '14px',
                background: method === m ? '#6B2C91' : '#1F1F22',
                border: '1px solid ' + (method === m ? '#6B2C91' : '#2A2A2D'),
                borderRadius: 10, color: '#F5F5F7',
                fontWeight: 700, fontSize: '0.9375rem',
                cursor: 'pointer', textTransform: 'capitalize',
              }}
            >{m}</button>
          ))}
        </div>

        {method === 'cash' ? (
          <>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#9CA3AF', marginBottom: 6 }}>
              Cash tendered
            </label>
            <input
              type="number" step="0.01" min={0}
              value={cashIn}
              onChange={e => setCashIn(Math.max(0, Number(e.target.value) || 0))}
              style={{
                width: '100%', padding: '18px',
                background: '#1F1F22', border: '1px solid #2A2A2D',
                borderRadius: 10, color: '#F5F5F7',
                fontSize: '1.5rem', fontVariantNumeric: 'tabular-nums',
                outline: 'none', textAlign: 'right',
              }}
            />
            {/* Quick-tap denominations — covers most UK cash transactions
                without the cashier having to think. Round-up to next £5 also
                handy when the customer says "keep it". */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 8 }}>
              {[total, Math.ceil(total / 5) * 5, Math.ceil(total / 10) * 10, Math.ceil(total / 20) * 20].map((amt, i) => (
                <button key={i} type="button" onClick={() => tap(amt)} style={denomBtnStyle}>
                  {fmtGBP(amt)}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', fontSize: '1.125rem' }}>
              <span style={{ color: '#9CA3AF' }}>Change</span>
              <strong style={{ color: change > 0 ? '#34D399' : '#9CA3AF', fontVariantNumeric: 'tabular-nums' }}>
                {fmtGBP(change)}
              </strong>
            </div>
          </>
        ) : (
          <div style={{ padding: 20, background: '#1F1F22', borderRadius: 10, textAlign: 'center', color: '#9CA3AF' }}>
            Charge {fmtGBP(total)} on the card terminal, then tap{' '}
            <strong style={{ color: '#F5F5F7' }}>Complete sale</strong> once the customer&apos;s receipt prints.
          </div>
        )}

        {error && (
          <div role="alert" style={{ marginTop: 12, padding: '10px 12px', background: '#7F1D1D', color: '#FECACA', borderRadius: 6, fontSize: '0.8125rem' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: 14, background: 'transparent', border: '1px solid #2A2A2D', borderRadius: 8, color: '#9CA3AF', fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending || (method === 'cash' && cashIn + 0.005 < total)}
            style={{
              flex: 2, padding: 14,
              background: pending ? '#4A5568' : '#10B981',
              border: 'none', borderRadius: 8, color: '#fff',
              fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer',
            }}
          >
            {pending ? 'Processing…' : 'Complete sale'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CompletedView({ order, onNewSale }: { order: { order_number: string; change: number }; onNewSale: () => void }) {
  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        background: '#161618', borderRadius: 16, padding: 48,
        textAlign: 'center', maxWidth: 460, width: '100%',
        border: '1px solid #2A2A2D',
      }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#10B981', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', margin: '0 0 8px', color: '#F5F5F7' }}>
          Sale complete
        </h1>
        <div style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: '#9CA3AF', marginBottom: 16 }}>
          {order.order_number}
        </div>
        {order.change > 0 && (
          <div style={{ background: '#1F1F22', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
            <div style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Change to give
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.25rem', color: '#10B981', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
              {fmtGBP(order.change)}
            </div>
          </div>
        )}
        <button onClick={onNewSale} style={{
          width: '100%', padding: 18, background: '#6B2C91', color: '#fff',
          border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '1.125rem',
          cursor: 'pointer',
        }}>
          New sale
        </button>
      </div>
    </div>
  );
}

// ─── inline styles (kept here so the POS surface is one file) ─────────────
const cartRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '12px 18px', borderBottom: '1px solid #2A2A2D',
};
const stepperBtn: React.CSSProperties = {
  width: 36, height: 36, background: 'transparent', border: 'none',
  color: '#F5F5F7', fontSize: '1.125rem', fontWeight: 700, cursor: 'pointer',
};
const qtyInput: React.CSSProperties = {
  width: 44, padding: '6px 4px', background: 'transparent', border: 'none',
  color: '#F5F5F7', fontSize: '0.875rem', textAlign: 'center', outline: 'none',
  fontVariantNumeric: 'tabular-nums',
};
const priceInput: React.CSSProperties = {
  width: 70, padding: '6px 8px',
  background: '#1F1F22', border: '1px solid #2A2A2D', borderRadius: 6,
  color: '#F5F5F7', fontSize: '0.8125rem', textAlign: 'right',
  outline: 'none', fontVariantNumeric: 'tabular-nums',
};
const removeBtnStyle: React.CSSProperties = {
  width: 32, height: 32, background: 'transparent', border: 'none',
  color: '#fca5a5', fontSize: '1.25rem', cursor: 'pointer', flexShrink: 0,
};
const denomBtnStyle: React.CSSProperties = {
  padding: '10px 6px', background: '#1F1F22', border: '1px solid #2A2A2D',
  borderRadius: 8, color: '#F5F5F7', fontSize: '0.8125rem', fontWeight: 600,
  cursor: 'pointer', fontVariantNumeric: 'tabular-nums',
};
function ghostButtonStyle(color: string): React.CSSProperties {
  return {
    background: 'transparent', border: 'none', cursor: 'pointer',
    color, fontSize: '0.75rem', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.08em',
    padding: '6px 10px', borderRadius: 6,
  };
}
