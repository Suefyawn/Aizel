'use client';

import { useEffect, useRef, useState } from 'react';
import { useCart } from '@/context/CartContext';
import { brandPlusName } from '@/lib/product-display';

/**
 * Visually-hidden aria-live region that announces cart additions /
 * removals to screen readers. Without this, a sighted user gets the
 * "Added ✓" button flash + the cart drawer opening, but a VoiceOver /
 * NVDA user gets nothing — there's no audible confirmation that an
 * add-to-cart click did anything.
 *
 * Mounted once in app/layout.tsx so it lives outside any modal.
 */
export function CartAnnouncer() {
  const { cartCount, cartItems } = useCart();
  const prevCountRef = useRef(cartCount);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const prev = prevCountRef.current;
    if (cartCount !== prev) {
      if (cartCount > prev) {
        // Newest item is the last one we added. Pull its label if available.
        const last = cartItems[cartItems.length - 1];
        const label = last ? brandPlusName(last.brand, last.name) : 'Item';
        setMessage(`${label} added to cart. ${cartCount} ${cartCount === 1 ? 'item' : 'items'} total.`);
      } else if (cartCount < prev) {
        setMessage(`Item removed from cart. ${cartCount} ${cartCount === 1 ? 'item' : 'items'} remaining.`);
      }
      prevCountRef.current = cartCount;
    }
  }, [cartCount, cartItems]);

  // Visually hidden but readable by assistive tech.
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: 'absolute',
        width: 1, height: 1,
        padding: 0, margin: -1,
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      {message}
    </div>
  );
}
