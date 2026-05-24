'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Overline } from '@/components/ui/Overline';
import { ProductImage } from '@/components/ui/ProductImage';
import { useCart } from '@/context/CartContext';
import { getBrowserClient } from '@/lib/supabase-browser';
import { brandPlusName } from '@/lib/product-display';
import { whatsappUrl as waUrl, WA_TEMPLATES as WA_T } from '@/lib/whatsapp';
import { RecentlyViewedRail } from '@/components/product/RecentlyViewedRail';
import type { CartItem, Coupon } from '@/types';

const FREE_SHIPPING = 15;

export function CartPage({ restoreToken = null }: { restoreToken?: string | null }) {
  const { cartItems, removeFromCart, updateQty, appliedCoupon, setAppliedCoupon, addToCart } = useCart();
  const router = useRouter();

  // ─── Abandoned-cart restore ─────────────────────────────────────────────
  // Visiting /cart?restore=<token> rehydrates the cart from the snapshot we
  // saved at checkout. We only do this once per token (ref guards against
  // re-runs on hot reload), and only when the current cart is empty so we
  // don't clobber what the user is already building.
  const restored = useRef(false);
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!restoreToken || restored.current) return;
    if (cartItems.length > 0) {
      // Cart already has items — keep them, but inform the user.
      restored.current = true;
      router.replace('/cart');
      return;
    }
    restored.current = true;
    (async () => {
      const sb = getBrowserClient();
      const { data } = await sb.rpc('restore_abandoned_cart' as never, { p_token: restoreToken } as never);
      const rows = Array.isArray(data) ? data : data ? [data] : [];
      const items = (rows[0] as { cart_items?: CartItem[] } | undefined)?.cart_items;
      if (items && items.length) {
        for (const i of items) addToCart({ ...i, qty: i.qty });
        setRestoreNotice('Welcome back — your cart has been restored.');
      } else {
        setRestoreNotice('This cart link has expired or is no longer valid.');
      }
      router.replace('/cart');
    })();
  }, [restoreToken, cartItems.length, addToCart, router]);

  const [couponCode, setCouponCode] = useState(appliedCoupon?.code ?? '');
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);

  const subtotal = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  const discount = appliedCoupon
    ? appliedCoupon.type === 'percent'
      ? Math.round(subtotal * appliedCoupon.value / 100)
      : appliedCoupon.value
    : 0;
  const total = Math.max(0, subtotal - discount);
  const progress = Math.min(total / FREE_SHIPPING, 1);
  const shipping = total >= FREE_SHIPPING ? 0 : 4;

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponError('');
    setCouponLoading(true);
    const sb = getBrowserClient();
    // coupons has RLS with no anon SELECT (migration 070) — go through the
    // SECURITY DEFINER lookup_coupon RPC instead of reading the table.
    const { data, error } = await sb.rpc('lookup_coupon' as never, { p_code: couponCode.trim() } as never);
    setCouponLoading(false);
    if (error) { setCouponError('Could not validate coupon. Try again.'); return; }
    const rows = (data ?? []) as Coupon[];
    if (rows.length === 0) { setCouponError('Invalid or inactive coupon code'); return; }
    const c = rows[0];

    // Cart is anonymous (no email field) — server still enforces per-user
    // caps + email restrictions at checkout. This is best-effort UX.
    const { validateCoupon } = await import('@/lib/coupon-validation');
    const verdict = validateCoupon({ coupon: c, cartItems, subtotal });
    if (!verdict.ok) { setCouponError(verdict.error); return; }

    setAppliedCoupon(c);
    setCouponCode(c.code);
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  if (cartItems.length === 0) {
    return (
      <section style={{ padding: 'var(--section-gap) 0', textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: 560 }}>
          <div style={{ fontSize: '3.5rem', marginBottom: 16, opacity: 0.35 }} aria-hidden="true">◎</div>
          <h1 className="h1" style={{ marginTop: 0, marginBottom: 12 }}>Your cart is empty</h1>
          <p className="body-text" style={{ color: 'var(--ink-700)', marginBottom: 28 }}>
            Browse the catalog and pick up where you left off — your favourites are one tap away.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/shop" className="btn-primary">Start shopping</Link>
            <Link href="/blog" style={{
              padding: '12px 24px', background: 'transparent',
              border: '1px solid var(--line)', borderRadius: 'var(--radius-card)',
              fontFamily: 'var(--font-ui)', fontSize: '0.875rem', fontWeight: 600,
              color: 'var(--ink-900)', textDecoration: 'none',
            }}>
              Read the edit
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div>
      <section style={{ padding: '48px 0 0' }}>
        <div className="container">
          <Overline style={{ display: 'block', marginBottom: 8, color: 'var(--ink-500)' }}>Shopping Cart</Overline>
          <h1 className="display-l" style={{ fontSize: '2rem', marginBottom: 16 }}>
            Your Cart ({cartItems.reduce((s, i) => s + i.qty, 0)})
          </h1>
          {restoreNotice && (
            <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, color: '#166534', fontSize: '0.875rem', marginBottom: 24, maxWidth: 520 }}>
              {restoreNotice}
            </div>
          )}
        </div>
      </section>

      <section style={{ padding: '0 0 var(--section-gap)' }}>
        <div className="container">
          <div style={{ padding: '16px 0 32px', borderBottom: '1px solid var(--line)' }}>
            <div className="small-text" style={{ marginBottom: 8, color: 'var(--ink-700)' }}>
              {progress >= 1
                ? <span style={{ color: 'var(--success)', fontWeight: 600 }}>You qualify for free shipping!</span>
                : <>£{(FREE_SHIPPING - total).toLocaleString()} away from <span style={{ color: 'var(--brand-pink-text)', fontWeight: 600 }}>FREE</span> shipping</>
              }
            </div>
            <div style={{ height: 4, background: 'var(--paper2)', borderRadius: 'var(--radius-pill)', overflow: 'hidden', maxWidth: 400 }}>
              <div style={{
                height: '100%', width: `${progress * 100}%`,
                // Pure Aizel purple — was a gold→purple gradient, the most
                // YellowPink-feeling visual on the cart row.
                background: 'linear-gradient(90deg, var(--brand-pink), var(--brand-pink-cta))',
                borderRadius: 'var(--radius-pill)', transition: 'width 400ms ease-out',
              }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 48, marginTop: 32 }} className="cart-grid">
            <div>
              {/* Column labels — hidden on mobile via .cart-row-head, replaced
                  by inline labels on each row card. */}
              <div className="cart-row-head" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 32px', gap: 16, paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>
                <Overline style={{ color: 'var(--ink-500)' }}>Product</Overline>
                <Overline style={{ color: 'var(--ink-500)', textAlign: 'center' }}>Quantity</Overline>
                <Overline style={{ color: 'var(--ink-500)', textAlign: 'right' }}>Total</Overline>
                <span />
              </div>
              {cartItems.map((item, i) => (
                <div key={i} className="cart-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 32px', gap: 16, alignItems: 'center', padding: '20px 0', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div style={{ width: 72, height: 72, borderRadius: 'var(--radius-card)', flexShrink: 0, overflow: 'hidden', background: 'var(--paper2)' }}>
                      <ProductImage src={item.image_url} alt={brandPlusName(item.brand, item.name)} width={72} height={72} />
                    </div>
                    <div>
                      <Overline style={{ color: 'var(--ink-500)', fontSize: '0.5625rem', display: 'block' }}>{item.brand}</Overline>
                      <div style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{item.name}</div>
                      {(item.variant_label ?? item.variant) && (
                        <div className="small-text">{item.variant_label ?? item.variant}</div>
                      )}
                      <div className="tabular-nums small-text" style={{ marginTop: 2 }}>£{item.price.toLocaleString()}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)' }}>
                      <button type="button" aria-label={`Decrease quantity of ${item.name}`} onClick={() => updateQty(i, -1)} style={{ width: 44, height: 44, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                      <span aria-live="polite" style={{ width: 32, textAlign: 'center', fontSize: '0.9375rem', fontWeight: 500 }}>{item.qty}</span>
                      <button type="button" aria-label={`Increase quantity of ${item.name}`} onClick={() => updateQty(i, 1)} style={{ width: 44, height: 44, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                    </div>
                  </div>
                  <div className="tabular-nums" style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.9375rem' }}>£{(item.price * item.qty).toLocaleString()}</div>
                  <button type="button" aria-label={`Remove ${item.name} from cart`} onClick={() => removeFromCart(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-500)', fontSize: '1.25rem', width: 44, height: 44, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
                </div>
              ))}
              <div style={{ marginTop: 20 }}>
                <Link href="/shop" className="btn-secondary">Continue Shopping</Link>
              </div>
            </div>

            <div style={{ background: 'var(--paper2)', borderRadius: 'var(--radius-card)', padding: 28, border: '1px solid var(--line)', alignSelf: 'start', position: 'sticky', top: 100 }}>
              <Overline style={{ display: 'block', marginBottom: 20, color: 'var(--ink-500)' }}>Order Summary</Overline>

              {/* Coupon code */}
              <div style={{ marginBottom: 20 }}>
                {appliedCoupon ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 12px' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803d', fontFamily: 'monospace' }}>{appliedCoupon.code}</span>
                      <span style={{ fontSize: '0.75rem', color: '#15803d', marginLeft: 6 }}>
                        — {appliedCoupon.type === 'percent' ? `${appliedCoupon.value}% off` : `£${appliedCoupon.value.toLocaleString()} off`}
                      </span>
                    </div>
                    <button type="button" aria-label="Remove coupon" onClick={removeCoupon} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '1.125rem', lineHeight: 1, minWidth: 36, minHeight: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      aria-label="Coupon code"
                      value={couponCode}
                      onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponError(''); }}
                      onKeyDown={e => e.key === 'Enter' && applyCoupon()}
                      placeholder="Coupon code"
                      style={{
                        flex: 1, padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 8,
                        fontSize: '0.875rem', fontFamily: 'monospace', background: 'white', outline: 'none',
                        color: 'var(--ink-900)', textTransform: 'uppercase',
                      }}
                    />
                    <button
                      onClick={applyCoupon}
                      disabled={couponLoading || !couponCode.trim()}
                      style={{
                        padding: '9px 14px', background: 'var(--ink-900)', color: 'white',
                        border: 'none', borderRadius: 8, fontSize: '0.8125rem', fontWeight: 600,
                        cursor: couponLoading || !couponCode.trim() ? 'not-allowed' : 'pointer',
                        opacity: couponLoading || !couponCode.trim() ? 0.5 : 1,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {couponLoading ? '…' : 'Apply'}
                    </button>
                  </div>
                )}
                {couponError && (
                  <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#dc2626' }}>{couponError}</p>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span className="body-text">Subtotal</span>
                <span className="body-text tabular-nums" style={{ fontWeight: 500 }}>£{subtotal.toLocaleString()}</span>
              </div>
              {discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span className="body-text" style={{ color: '#15803d' }}>Discount</span>
                  <span className="body-text tabular-nums" style={{ fontWeight: 500, color: '#15803d' }}>− £{discount.toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span className="body-text">Shipping</span>
                <span className="body-text tabular-nums" style={{ fontWeight: 500, color: shipping === 0 ? 'var(--success)' : 'inherit' }}>
                  {shipping === 0 ? 'FREE' : `£${shipping}`}
                </span>
              </div>
              <hr className="hairline" style={{ margin: '16px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                <span className="h3">Total</span>
                <span className="h3 tabular-nums">£{(total + shipping).toLocaleString()}</span>
              </div>
              <button className="btn-primary" style={{ width: '100%' }} onClick={() => router.push('/checkout')}>Proceed to Checkout</button>
              <p className="small-text" style={{ textAlign: 'center', marginTop: 12, color: 'var(--ink-500)' }}>
                Card · PayPal · Apple Pay · Klarna · VAT included
              </p>
              {/* Help-on-WhatsApp link — last-mile catch for the visitor who's
                  on the cart but hesitating. Hides when no number set. */}
              {(() => {
                const href = waUrl(WA_T.cart());
                if (!href) return null;
                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      marginTop: 12, padding: '10px 14px',
                      background: 'transparent', color: '#128C7E',
                      border: '1px solid #25D366', borderRadius: 999,
                      textDecoration: 'none', fontSize: '0.8125rem', fontWeight: 600,
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Need help? Chat on WhatsApp
                  </a>
                );
              })()}
            </div>
          </div>
        </div>
      </section>

      {/* Recently-viewed rail — encourages a final add-on browse before
          the shopper commits to checkout. Hides itself when there isn't
          enough localStorage data to make the row useful. */}
      <RecentlyViewedRail heading="Pick up where you left off" />
    </div>
  );
}
