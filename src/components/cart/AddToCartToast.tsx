'use client';

// Small visible toast that confirms an add-to-cart for sighted users.
// Pairs with CartAnnouncer (which handles screen readers via aria-live).
// The mini-cart drawer also opens on add — the toast is the at-a-glance
// affordance for when the user is mid-page and not focusing on the drawer.
//
// Subscribes to `addCounter` / `lastAdded` on CartContext (not to
// `cartCount`) so it does NOT flash when the persisted cart hydrates
// from localStorage on a fresh page load.

import { useEffect, useState } from 'react';
import { useCart } from '@/context/CartContext';
import { brandPlusName } from '@/lib/product-display';

interface Toast { id: number; label: string }

export function AddToCartToast() {
  const { addCounter, lastAdded } = useCart();
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Subscribe to addCounter from CartContext (the external store) and queue
  // a toast row whenever it increments. The setState here is the canonical
  // "subscribe to external system" pattern the React Compiler rule documents
  // as the exception — addCounter is not derivable from props.
  useEffect(() => {
    // addCounter starts at 0 and only increments when addToCart is called.
    // Anything below 1 means we're still in the initial mount / hydration
    // window and have nothing real to announce.
    if (addCounter < 1 || !lastAdded) return;
    const id = Date.now();
    const label = brandPlusName(lastAdded.brand ?? '', lastAdded.name);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToasts(t => [...t, { id, label }]);
    const handle = setTimeout(
      () => setToasts(t => t.filter(x => x.id !== id)),
      3200,
    );
    return () => clearTimeout(handle);
  }, [addCounter, lastAdded]);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        zIndex: 250,
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map(t => (
        <div
          key={t.id}
          style={{
            background: 'var(--ink-900)',
            color: 'var(--paper)',
            padding: '12px 16px',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            fontSize: '0.8125rem',
            fontWeight: 500,
            maxWidth: 320,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            animation: 'toast-in 220ms ease-out',
          }}
        >
          <span
            style={{
              flexShrink: 0,
              width: 22, height: 22, borderRadius: '50%',
              background: 'var(--brand-pink-cta)', color: '#fff',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.875rem', fontWeight: 700,
            }}
            aria-hidden="true"
          >✓</span>
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Added to cart: <strong style={{ fontWeight: 700 }}>{t.label}</strong>
          </span>
        </div>
      ))}
    </div>
  );
}
