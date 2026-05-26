'use client';

import { useCart } from '@/context/CartContext';

// Same threshold the CartPage / MiniCart anchor against. Kept inline (not
// imported) so a /shop visitor doesn't pull in the cart-section module
// just to render a sticky bar of copy.
const FREE_SHIPPING_THRESHOLD = 15;

interface Props {
  /** Static copy shown when the cart is empty or above the free-shipping
   *  threshold. Authored in admin → settings → announcement bar. */
  text: string;
  bgColor: string;
}

export function AnnouncementBar({ text, bgColor }: Props) {
  // When the cart has items and is BELOW the free-shipping threshold, the
  // bar swaps its static copy for a live "£X.XX away from free UK
  // delivery" prompt — building the £15 anchor on every page, not just
  // inside the cart. Empty cart and over-threshold carts keep the
  // admin-authored static line so the bar still earns its real estate.
  const { cartItems } = useCart();
  const cartTotal = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  const cartHasItems = cartItems.length > 0;
  const belowThreshold = cartHasItems && cartTotal < FREE_SHIPPING_THRESHOLD;
  const remaining = FREE_SHIPPING_THRESHOLD - cartTotal;
  // 2-dp formatting in en-GB so "£3.50 away" doesn't render as "£3.5 away".
  const remainingStr = remaining.toLocaleString('en-GB', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

  // Pre-tokenise the static text into £-amount runs and plain runs so we
  // can underline the £-runs without a regex pass per render.
  const parts = text.split(/(£[\d,]+)/);

  return (
    <div style={{
      background: bgColor,
      color: '#fff',
      padding: '10px 0',
      textAlign: 'center',
      fontFamily: 'var(--font-ui)',
      fontSize: '0.75rem',
      fontWeight: 500,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
    }}>
      {belowThreshold ? (
        <span aria-live="polite">
          You&apos;re{' '}
          <span style={{ borderBottom: '2px solid rgba(255,255,255,0.55)', paddingBottom: 1, fontWeight: 700 }}>
            £{remainingStr}
          </span>
          {' '}away from free UK delivery
        </span>
      ) : (
        parts.map((part, i) =>
          /^£/.test(part) ? (
            // Soft white underline on every £-amount keeps the £15 anchor
            // emphasised in the dark brand surface without injecting gold
            // (the previous-brand-era accent).
            <span key={i} style={{ borderBottom: '2px solid rgba(255,255,255,0.55)', paddingBottom: 1 }}>{part}</span>
          ) : (
            <span key={i}>{part}</span>
          )
        )
      )}
    </div>
  );
}
