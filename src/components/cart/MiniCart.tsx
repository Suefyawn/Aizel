'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Overline } from '@/components/ui/Overline';
import { ProductImage } from '@/components/ui/ProductImage';
import { useCart } from '@/context/CartContext';
import { useBodyScrollLock, useEscapeKey, useFocusTrap } from '@/lib/hooks/useBodyScrollLock';
import { brandPlusName } from '@/lib/product-display';

const FREE_SHIPPING = 15;

export function MiniCart() {
  const { cartItems, cartOpen, setCartOpen, removeFromCart, updateQty } = useCart();
  const router = useRouter();
  useBodyScrollLock(cartOpen);
  useEscapeKey(cartOpen, () => setCartOpen(false));
  const panelRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(cartOpen, panelRef);
  const total = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  const progress = Math.min(total / FREE_SHIPPING, 1);

  const handleViewCart = () => {
    setCartOpen(false);
    router.push('/cart');
  };

  const handleCheckout = () => {
    setCartOpen(false);
    router.push('/checkout');
  };

  return (
    <>
      <div onClick={() => setCartOpen(false)} style={{
        position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.4)',
        opacity: cartOpen ? 1 : 0, pointerEvents: cartOpen ? 'auto' : 'none',
        transition: 'opacity 250ms ease-out', zIndex: 200,
      }} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal={cartOpen}
        aria-label="Shopping cart"
        aria-hidden={!cartOpen}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 400, maxWidth: '90vw',
          background: 'var(--paper)', boxShadow: 'var(--shadow-1)',
          transform: cartOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 300ms ease-out', zIndex: 201,
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="h3">Your Cart</span>
          <button
            onClick={() => setCartOpen(false)}
            aria-label="Close cart"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--ink-900)', fontSize: '1.5rem', lineHeight: 1,
              width: 40, height: 40, borderRadius: 8,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              marginRight: -8,
            }}
          >×</button>
        </div>

        <div
          style={{ padding: '14px 24px', borderBottom: '1px solid var(--line)' }}
          aria-live="polite"
        >
          <div
            className="small-text"
            style={{
              marginBottom: 8, color: 'var(--ink-700)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            {progress >= 1 ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--success)', flexShrink: 0 }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                  Free shipping unlocked
                </span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--ink-500)', flexShrink: 0 }}>
                  <rect x="1" y="3" width="15" height="13" rx="1" />
                  <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                  <circle cx="5.5" cy="18.5" r="2.5" />
                  <circle cx="18.5" cy="18.5" r="2.5" />
                </svg>
                <span>
                  Spend <span className="tabular-nums" style={{ fontWeight: 600, color: 'var(--ink-900)' }}>£{(FREE_SHIPPING - total).toLocaleString()}</span> more for <span style={{ fontWeight: 600, color: 'var(--brand-pink-text)' }}>free shipping</span>
                </span>
              </>
            )}
          </div>
          <div
            role="progressbar"
            aria-valuenow={Math.round(progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Free shipping progress"
            style={{ height: 6, background: 'var(--paper2)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}
          >
            <div style={{
              height: '100%', width: `${progress * 100}%`,
              // Pure Aizel purple in transit; success-green once the
              // threshold's hit. Was a gold→purple gradient — the same
              // YellowPink hangover we're sweeping out of the rest of cart.
              background: progress >= 1
                ? 'var(--success)'
                : 'linear-gradient(90deg, var(--brand-pink), var(--brand-pink-cta))',
              borderRadius: 'var(--radius-pill)', transition: 'width 400ms ease-out, background 400ms ease-out',
            }} />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {cartItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ink-500)' }}>
              <p className="body-text">Your cart is empty</p>
            </div>
          ) : cartItems.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
              <Link
                href={`/product/${item.slug}`}
                onClick={() => setCartOpen(false)}
                style={{ width: 64, height: 64, borderRadius: 'var(--radius-card)', flexShrink: 0, overflow: 'hidden', background: 'var(--paper2)', display: 'block' }}
              >
                <ProductImage src={item.image_url} alt={brandPlusName(item.brand, item.name)} width={64} height={64} />
              </Link>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Overline style={{ color: 'var(--ink-500)', fontSize: '0.6875rem', display: 'block', letterSpacing: '0.12em' }}>{item.brand}</Overline>
                <Link
                  href={`/product/${item.slug}`}
                  onClick={() => setCartOpen(false)}
                  style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 2, display: 'block', color: 'var(--ink-900)', textDecoration: 'none' }}
                >
                  {item.name}
                </Link>
                {(item.variant_label ?? item.variant) && (
                  <div className="small-text" style={{ fontSize: '0.6875rem', color: 'var(--ink-500)' }}>
                    {item.variant_label ?? item.variant}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)' }}>
                    <button type="button" aria-label={`Decrease quantity of ${item.name}`} onClick={() => updateQty(i, -1)} style={{ width: 40, height: 40, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                    <span aria-live="polite" style={{ width: 28, textAlign: 'center', fontSize: '0.875rem', fontWeight: 500 }}>{item.qty}</span>
                    <button type="button" aria-label={`Increase quantity of ${item.name}`} onClick={() => updateQty(i, 1)} style={{ width: 40, height: 40, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                  </div>
                  <span className="tabular-nums" style={{ fontSize: '0.875rem', fontWeight: 600 }}>£{(item.price * item.qty).toLocaleString()}</span>
                </div>
              </div>
              <button type="button" aria-label={`Remove ${item.name} from cart`} onClick={() => removeFromCart(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-500)', fontSize: '1.25rem', alignSelf: 'flex-start', width: 40, height: 40, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
            </div>
          ))}
          {cartItems.length > 0 && (
            <div style={{ marginTop: 16, padding: 12, background: 'var(--paper2)', borderRadius: 'var(--radius-card)', border: '1px solid var(--line)' }}>
              <Overline style={{ color: 'var(--brand-pink-text)', display: 'block', marginBottom: 4, fontSize: '0.75rem' }}>Free sample with every order</Overline>
              <div className="small-text">We tuck a hair- or body-care sample into every parcel — first dibs on what we&apos;re testing next.</div>
            </div>
          )}
        </div>

        {cartItems.length > 0 && (
          <div style={{ padding: '20px 24px', borderTop: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <span className="h3">Total</span>
              <span className="h3 tabular-nums">£{total.toLocaleString()}</span>
            </div>
            <button className="btn-primary" style={{ width: '100%' }} onClick={handleCheckout}>Checkout</button>
            <button onClick={handleViewCart} style={{
              width: '100%', marginTop: 8, padding: '10px 0', background: 'none',
              border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', cursor: 'pointer',
              fontFamily: 'var(--font-ui)', fontSize: '0.8125rem', fontWeight: 600,
              color: 'var(--ink-900)', letterSpacing: '0.04em',
            }}>View Cart</button>
          </div>
        )}
      </div>
    </>
  );
}
