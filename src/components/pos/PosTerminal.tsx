'use client';

import { useMemo, useRef, useState, useTransition, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { completePosSale } from '@/app/admin/pos/actions';
import {
  parkSale, listHeldSales, resumeSale, discardHeldSale,
  type HeldSaleSummary,
} from '@/app/admin/pos/held-actions';
import {
  createTerminalPaymentIntent,
  processOnReader,
  retrievePaymentIntent,
  cancelTerminalPaymentIntent,
} from '@/app/admin/pos/terminal-actions';
import { CashDrawerSheet } from './CashDrawerSheet';

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
  /** True when STRIPE_SECRET_KEY + STRIPE_TERMINAL_LOCATION_ID +
   *  STRIPE_TERMINAL_READER_ID are all set. Controls whether the
   *  TenderModal exposes a "Tap card" tab backed by the chip-and-PIN
   *  reader. When false the cashier sees Cash + Manual card only. */
  terminalEnabled: boolean;
}

export function PosTerminal({ products, cashier, session, terminalEnabled }: Props) {
  const router = useRouter();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartDiscount, setCartDiscount] = useState<number>(0);
  const [search, setSearch] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [tenderOpen, setTenderOpen] = useState(false);
  const [lastSale, setLastSale] = useState<{ order_number: string; change: number } | null>(null);
  const [heldOpen, setHeldOpen] = useState(false);
  const [heldList, setHeldList] = useState<HeldSaleSummary[]>([]);
  const [heldCount, setHeldCount] = useState<number>(0);
  const [parkBusy, startParkTransition] = useTransition();
  const [parkError, setParkError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Refresh the held count on mount + after every park/resume so the
  // top-bar badge stays accurate without polling.
  const refreshHeldCount = useCallback(async () => {
    const list = await listHeldSales().catch(() => []);
    setHeldList(list);
    setHeldCount(list.length);
  }, []);
  useEffect(() => { void refreshHeldCount(); }, [refreshHeldCount]);

  function handlePark() {
    setParkError(null);
    if (cart.length === 0) return;
    const label = window.prompt('Label this sale (e.g. "Lady in red coat")');
    if (label === null) return;       // user hit cancel
    const trimmed = label.trim();
    if (!trimmed) { setParkError('A label is required so you can find this hold later.'); return; }

    startParkTransition(async () => {
      const result = await parkSale({
        label: trimmed,
        cart_discount: clampedDiscount,
        customer_email: customerEmail || undefined,
        items: cart.map(l => ({
          product_id: l.product_id,
          name: l.name, brand: l.brand,
          unit_price: l.unit_price, list_price: l.list_price,
          qty: l.qty,
          variant: l.variant, image_url: l.image_url ?? undefined, slug: l.slug ?? undefined,
        })),
      });
      if (!result.ok) { setParkError(result.error ?? 'Could not park sale'); return; }
      clearSale();
      await refreshHeldCount();
    });
  }

  function handleResume(id: string) {
    startParkTransition(async () => {
      const result = await resumeSale(id);
      if (!result.ok || !result.sale) { setParkError(result.error ?? 'Could not resume sale'); return; }
      const { items, cart_discount, customer_email } = result.sale.cart;
      setCart(items.map(it => ({
        product_id: it.product_id,
        name: it.name, brand: it.brand,
        unit_price: it.unit_price, list_price: it.list_price,
        qty: it.qty,
        variant: it.variant ?? null,
        image_url: it.image_url ?? null,
        slug: it.slug ?? null,
      })));
      setCartDiscount(cart_discount ?? 0);
      setCustomerEmail(customer_email ?? '');
      setHeldOpen(false);
      await refreshHeldCount();
    });
  }

  function handleDiscard(id: string) {
    if (!window.confirm('Discard this held sale? This cannot be undone.')) return;
    startParkTransition(async () => {
      await discardHeldSale(id);
      await refreshHeldCount();
    });
  }

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
      {/* Keyframes for the Terminal status dot. Inline so the POS surface
          remains a single file — pasting into globals.css would couple the
          till to the storefront stylesheet for no benefit. */}
      <style>{`
        @keyframes aizel-pos-pulse {
          0%   { box-shadow: 0 0 0 0   rgba(107, 44, 145, 0.6); }
          70%  { box-shadow: 0 0 0 18px rgba(107, 44, 145, 0);   }
          100% { box-shadow: 0 0 0 0   rgba(107, 44, 145, 0);   }
        }
      `}</style>
      <TopBar
        cashier={cashier}
        session={session}
        onExit={() => router.push('/admin/dashboard')}
        heldCount={heldCount}
        onHeldClick={() => setHeldOpen(true)}
        onTillClick={() => setDrawerOpen(true)}
      />

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

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                disabled={cart.length === 0 || parkBusy}
                onClick={handlePark}
                title="Park this sale so you can ring up another customer first"
                style={{
                  flex: 1, padding: '18px',
                  background: 'transparent',
                  color: cart.length === 0 ? '#4B5563' : '#9CA3AF',
                  border: '1px solid ' + (cart.length === 0 ? '#2A2A2D' : '#4B5563'),
                  borderRadius: 10,
                  fontSize: '0.9375rem', fontWeight: 600,
                  cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                {parkBusy ? '…' : 'Park sale'}
              </button>
              <button
                type="button"
                disabled={cart.length === 0}
                onClick={() => setTenderOpen(true)}
                style={{
                  flex: 2, padding: '18px',
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
            </div>
            {parkError && (
              <div role="alert" style={{ marginTop: 10, padding: '8px 10px', background: '#7F1D1D', color: '#FECACA', borderRadius: 6, fontSize: '0.8125rem' }}>
                {parkError}
              </div>
            )}
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

      {heldOpen && (
        <HeldSalesSheet
          list={heldList}
          busy={parkBusy}
          onResume={handleResume}
          onDiscard={handleDiscard}
          onClose={() => setHeldOpen(false)}
        />
      )}

      {drawerOpen && (
        <CashDrawerSheet
          session={session}
          onClose={() => setDrawerOpen(false)}
          // Bounce the page to re-fetch the session — cleanest way to
          // get a fresh session object onto the terminal after open/close.
          onShiftChanged={() => router.refresh()}
        />
      )}

      {tenderOpen && (
        <TenderModal
          total={total}
          terminalEnabled={terminalEnabled}
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

function TopBar({ cashier, session, onExit, heldCount, onHeldClick, onTillClick }: {
  cashier: { id: string; name: string };
  session: PosSession | null;
  onExit: () => void;
  heldCount: number;
  onHeldClick: () => void;
  onTillClick: () => void;
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
        {/* Held-sales button — clickable when there's anything on hold,
            disabled-look otherwise. Badge surfaces the count so the
            cashier doesn't forget about a parked transaction. */}
        <button
          type="button"
          onClick={onHeldClick}
          disabled={heldCount === 0}
          style={{
            background: heldCount > 0 ? '#1F1F22' : 'transparent',
            border: '1px solid ' + (heldCount > 0 ? '#4B5563' : '#2A2A2D'),
            borderRadius: 20, padding: '4px 12px',
            color: heldCount > 0 ? '#F5F5F7' : '#4B5563',
            fontSize: '0.75rem', fontWeight: 700,
            cursor: heldCount > 0 ? 'pointer' : 'not-allowed',
            textTransform: 'uppercase', letterSpacing: '0.06em',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}
        >
          Held
          {heldCount > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              minWidth: 18, height: 18, padding: '0 5px',
              background: '#6B2C91', color: '#fff', borderRadius: 9,
              fontSize: '0.625rem', fontWeight: 700,
            }}>
              {heldCount}
            </span>
          )}
        </button>
        {/* Till badge — clickable on both states (open the drawer sheet
            to count, log cash-in/out, or close; or to open a new shift). */}
        <button
          type="button"
          onClick={onTillClick}
          style={{
            background: '#1F1F22',
            border: '1px solid ' + (session ? '#065F46' : '#92400E'),
            borderRadius: 20, padding: '4px 12px',
            fontSize: '0.6875rem', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.06em',
            color: session ? '#34D399' : '#FBBF24',
            cursor: 'pointer',
          }}
        >
          {session ? `Till open · float ${fmtGBP(session.opening_float)}` : 'Open till'}
        </button>
        <button onClick={onExit} style={ghostButtonStyle('#9CA3AF')}>Exit</button>
      </div>
    </header>
  );
}

function HeldSalesSheet({ list, busy, onResume, onDiscard, onClose }: {
  list: HeldSaleSummary[];
  busy: boolean;
  onResume: (id: string) => void;
  onDiscard: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        display: 'flex', justifyContent: 'flex-end',
        zIndex: 100,
      }}
    >
      <aside
        onClick={e => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label="Held sales"
        style={{
          width: 'min(460px, 92vw)', height: '100vh',
          background: '#161618',
          borderLeft: '1px solid #2A2A2D',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <header style={{ padding: '18px 20px', borderBottom: '1px solid #2A2A2D', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#F5F5F7' }}>
            Held sales <span style={{ color: '#6B7280', fontWeight: 500 }}>({list.length})</span>
          </h2>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: '#9CA3AF', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
        </header>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {list.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#6B7280', fontSize: '0.875rem' }}>
              No held sales — park a cart from the till to see it here.
            </div>
          ) : list.map(h => (
            <div key={h.id} style={{
              padding: '16px 20px', borderBottom: '1px solid #2A2A2D',
              display: 'flex', alignItems: 'flex-start', gap: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#F5F5F7', marginBottom: 4 }}>
                  {h.label}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
                  {h.item_count} item{h.item_count === 1 ? '' : 's'} · {new Date(h.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{ marginTop: 6, fontSize: '0.9375rem', fontWeight: 700, color: '#F5F5F7', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtGBP(h.total)}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                <button
                  type="button" disabled={busy} onClick={() => onResume(h.id)}
                  style={{ padding: '8px 12px', background: '#10B981', border: 'none', borderRadius: 6, color: '#fff', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', minHeight: 32 }}
                >Resume</button>
                <button
                  type="button" disabled={busy} onClick={() => onDiscard(h.id)}
                  style={{ padding: '8px 12px', background: 'transparent', border: '1px solid #4B5563', borderRadius: 6, color: '#9CA3AF', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', minHeight: 32 }}
                >Discard</button>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
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

type TenderMethod = 'cash' | 'card' | 'stripe_terminal';

function TenderModal({ total, terminalEnabled, onClose, onComplete }: {
  total: number;
  terminalEnabled: boolean;
  onClose: () => void;
  onComplete: (tenders: { method: TenderMethod; amount: number; txn_ref?: string | null }[]) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [method, setMethod] = useState<TenderMethod>('cash');
  const [cashIn, setCashIn] = useState<number>(total);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // ── Stripe Terminal flow state ─────────────────────────────────────────
  // Lives alongside the cash/card state so switching tabs doesn't drop a
  // PI on the floor — we cancel cleanly via the unmount effect below.
  const [terminalStage, setTerminalStage] =
    useState<'idle' | 'minting' | 'pushing' | 'waiting' | 'succeeded' | 'failed'>('idle');
  const [terminalPiId, setTerminalPiId] = useState<string | null>(null);
  const [terminalMsg, setTerminalMsg] = useState<string>('');
  const pollRef = useRef<number | null>(null);

  // Stop any in-flight poll when the modal unmounts.
  useEffect(() => () => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const change = method === 'cash' ? Math.max(0, cashIn - total) : 0;

  // Methods on offer — Terminal slots in only when the till has an env
  // pointing at a paired reader. Otherwise we ship the original two-tab
  // layout (cash + manual card).
  const methods: TenderMethod[] = terminalEnabled ? ['cash', 'stripe_terminal', 'card'] : ['cash', 'card'];

  const methodLabel: Record<TenderMethod, string> = {
    cash: 'Cash',
    card: 'Manual card',
    stripe_terminal: 'Tap card',
  };

  function tap(amount: number) {
    setCashIn(amount);
  }

  // ── Stripe Terminal kick-off ───────────────────────────────────────────
  // 1. Mint a PI server-side (amount in pence, currency GBP, card_present)
  // 2. Push the PI to the paired reader
  // 3. Poll every 2s until status changes off `requires_payment_method` /
  //    `requires_confirmation` / `processing`. Succeeded → ring the sale.
  async function startTerminalFlow() {
    setError(null);
    setTerminalMsg('Creating payment…');
    setTerminalStage('minting');

    const pi = await createTerminalPaymentIntent({ amount: total });
    if (!pi.ok) {
      setTerminalStage('failed');
      setTerminalMsg(('error' in pi ? pi.error : null) ?? 'Could not create PaymentIntent');
      return;
    }
    setTerminalPiId(pi.payment_intent_id);
    setTerminalStage('pushing');
    setTerminalMsg('Sending to reader…');

    const push = await processOnReader({ pi_id: pi.payment_intent_id });
    if (!push.ok) {
      setTerminalStage('failed');
      setTerminalMsg(('error' in push ? push.error : null) ?? 'Reader refused the PaymentIntent');
      return;
    }
    setTerminalStage('waiting');
    setTerminalMsg('Waiting for customer to tap…');

    pollRef.current = window.setInterval(async () => {
      const probe = await retrievePaymentIntent({ pi_id: pi.payment_intent_id });
      if (!probe.ok) {
        // Soft fail — keep polling unless we hit something we cannot recover.
        return;
      }
      if (probe.status === 'succeeded') {
        if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
        setTerminalStage('succeeded');
        setTerminalMsg('Payment confirmed — closing sale.');
        // Ring up automatically so the cashier doesn't have to tap twice.
        startTransition(async () => {
          const r = await onComplete([{ method: 'stripe_terminal', amount: total, txn_ref: pi.payment_intent_id }]);
          if (!r.ok) {
            setTerminalStage('failed');
            setTerminalMsg(r.error ?? 'Payment captured but sale could not be saved — escalate.');
          }
        });
      } else if (probe.status === 'canceled') {
        if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
        setTerminalStage('failed');
        setTerminalMsg('Payment cancelled on the reader.');
      }
    }, 2000);
  }

  async function cancelTerminalFlow() {
    if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
    if (terminalPiId) {
      // Fire-and-forget — if the PI is already past cancellable state, Stripe
      // will say so and we don't really care: the cashier just wants the UI
      // to clear so they can pick another tender.
      void cancelTerminalPaymentIntent({ pi_id: terminalPiId });
    }
    setTerminalPiId(null);
    setTerminalStage('idle');
    setTerminalMsg('');
  }

  function submit() {
    setError(null);
    if (method === 'stripe_terminal') {
      // Terminal submit kicks off the PI flow — completion happens inside
      // the poller above, not here.
      void startTerminalFlow();
      return;
    }
    const tenders = method === 'cash'
      ? [{ method: 'cash' as const, amount: cashIn }]
      : [{ method: 'card' as const, amount: total, txn_ref: null }];
    startTransition(async () => {
      const r = await onComplete(tenders);
      if (!r.ok) setError(r.error ?? 'Sale failed');
    });
  }

  // Disable tab switching mid-Terminal-flow so we don't strand a PI.
  const tabsLocked = method === 'stripe_terminal' && terminalStage !== 'idle' && terminalStage !== 'failed';

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
          {methods.map(m => (
            <button
              key={m}
              type="button"
              disabled={tabsLocked && m !== method}
              onClick={() => setMethod(m)}
              style={{
                flex: 1, padding: '14px',
                background: method === m ? '#6B2C91' : '#1F1F22',
                border: '1px solid ' + (method === m ? '#6B2C91' : '#2A2A2D'),
                borderRadius: 10, color: '#F5F5F7',
                fontWeight: 700, fontSize: '0.875rem',
                cursor: (tabsLocked && m !== method) ? 'not-allowed' : 'pointer',
                opacity: (tabsLocked && m !== method) ? 0.4 : 1,
              }}
            >{methodLabel[m]}</button>
          ))}
        </div>

        {method === 'cash' && (
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
        )}

        {method === 'card' && (
          <div style={{ padding: 20, background: '#1F1F22', borderRadius: 10, textAlign: 'center', color: '#9CA3AF' }}>
            Charge {fmtGBP(total)} on the card terminal, then tap{' '}
            <strong style={{ color: '#F5F5F7' }}>Complete sale</strong> once the customer&apos;s receipt prints.
          </div>
        )}

        {method === 'stripe_terminal' && (
          <div style={{
            padding: 20, background: '#1F1F22', borderRadius: 10,
            textAlign: 'center', color: '#9CA3AF',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            {terminalStage === 'idle' && (
              <>
                <div style={{ fontSize: '0.875rem' }}>
                  Tap <strong style={{ color: '#F5F5F7' }}>Send to reader</strong> below — the customer&apos;s reader will prompt for tap, insert, or contactless.
                </div>
              </>
            )}
            {terminalStage !== 'idle' && (
              <>
                <TerminalStatusDot stage={terminalStage} />
                <div style={{
                  fontSize: '0.9375rem',
                  color: terminalStage === 'succeeded' ? '#34D399' : terminalStage === 'failed' ? '#FCA5A5' : '#F5F5F7',
                  fontWeight: 600,
                }}>
                  {terminalMsg}
                </div>
                {(terminalStage === 'waiting' || terminalStage === 'pushing') && (
                  <button
                    type="button" onClick={cancelTerminalFlow}
                    style={{ marginTop: 4, padding: '8px 14px', background: 'transparent', border: '1px solid #4B5563', borderRadius: 6, color: '#9CA3AF', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                  >Cancel payment on reader</button>
                )}
              </>
            )}
          </div>
        )}

        {error && (
          <div role="alert" style={{ marginTop: 12, padding: '10px 12px', background: '#7F1D1D', color: '#FECACA', borderRadius: 6, fontSize: '0.8125rem' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button
            type="button" onClick={onClose}
            disabled={tabsLocked}
            style={{ flex: 1, padding: 14, background: 'transparent', border: '1px solid #2A2A2D', borderRadius: 8, color: '#9CA3AF', fontWeight: 600, cursor: tabsLocked ? 'not-allowed' : 'pointer', opacity: tabsLocked ? 0.4 : 1 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={
              pending ||
              (method === 'cash' && cashIn + 0.005 < total) ||
              (method === 'stripe_terminal' && terminalStage !== 'idle' && terminalStage !== 'failed')
            }
            style={{
              flex: 2, padding: 14,
              background: pending ? '#4A5568' : '#10B981',
              border: 'none', borderRadius: 8, color: '#fff',
              fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer',
            }}
          >
            {pending
              ? 'Processing…'
              : method === 'stripe_terminal'
                ? (terminalStage === 'failed' ? 'Retry' : 'Send to reader')
                : 'Complete sale'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TerminalStatusDot({ stage }: { stage: 'minting' | 'pushing' | 'waiting' | 'succeeded' | 'failed' }) {
  const color =
    stage === 'succeeded' ? '#10B981' :
    stage === 'failed'    ? '#EF4444' :
    '#6B2C91';
  const pulsing = stage === 'waiting' || stage === 'pushing' || stage === 'minting';
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block', width: 14, height: 14,
        borderRadius: '50%', background: color,
        margin: '0 auto',
        boxShadow: pulsing ? `0 0 0 0 ${color}80` : 'none',
        animation: pulsing ? 'aizel-pos-pulse 1.4s ease-out infinite' : undefined,
      }}
    />
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
