'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Overline } from './Overline';
import { ProductImage } from './ProductImage';
import { StarRating } from './StarRating';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { brandPlusName } from '@/lib/product-display';
import type { Product } from '@/types';

interface ProductTileProps {
  product: Product;
}

// The tile renders its own Link to the PDP so callers don't need to wrap
// it (the previous pattern produced invalid HTML — a <button> nested
// inside an <a>). The wishlist button is a sibling of the Link, absolutely
// positioned over the image; click events on it don't trigger navigation.
//
// Keyboard: Tab focuses the Link (Enter → PDP). Tab again focuses the
// wishlist button (Enter → toggle). No nested-focusable HTML.
export function ProductTile({ product }: ProductTileProps) {
  const [hovered, setHovered] = useState(false);
  const [added, setAdded] = useState(false);
  const router = useRouter();
  const { addToCart } = useCart();
  const { toggle, isWishlisted } = useWishlist();
  const { id, slug, brand, name, variant, price, original_price, kind, stock, rating, review_count } = product;
  const wishlisted = isWishlisted(id);

  // Quick-add UX matrix:
  //  • Variable products  → "Choose options" routes to PDP (variant pick needed).
  //  • Out of stock       → "Sold out" disabled badge, no action.
  //  • Simple + in stock  → "+ Add to cart" calls addToCart(product, qty: 1).
  //
  // The button overlays the bottom of the image; opacity-0 on desktop until
  // hover (or button focus), always visible on mobile. addCounter on the
  // existing AddToCartToast surfaces the post-add confirmation.
  const isVariable = kind === 'variable';
  const soldOut = typeof stock === 'number' && stock <= 0;
  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (soldOut) return;
    if (isVariable) {
      router.push(`/product/${slug}`);
      return;
    }
    addToCart({ ...product, qty: 1 });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1400);
  };
  const quickAddLabel = soldOut
    ? 'Sold out'
    : added
      ? 'Added ✓'
      : isVariable
        ? 'Choose options'
        : '+ Add to cart';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative' }}
    >
      <Link
        href={`/product/${slug}`}
        style={{
          textDecoration: 'none',
          color: 'inherit',
          display: 'block',
          transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
          transition: 'transform 220ms ease-out',
        }}
      >
        <div style={{
          width: '100%', aspectRatio: '1', borderRadius: 'var(--radius-card)',
          marginBottom: 12, position: 'relative', overflow: 'hidden',
          background: 'var(--paper2)',
          boxShadow: hovered
            ? '0 12px 28px rgba(26, 26, 26, 0.10), 0 2px 6px rgba(26, 26, 26, 0.04)'
            : '0 1px 2px rgba(26, 26, 26, 0.03)',
          transition: 'box-shadow 240ms ease-out',
        }}>
          <div style={{
            width: '100%', height: '100%',
            transform: hovered ? 'scale(1.035)' : 'scale(1)',
            transition: 'transform 500ms ease-out',
          }}>
            <ProductImage src={product.image_url} alt={brandPlusName(brand, name)} label={brand} />
          </div>
          {(original_price ?? 0) > price && (
            <span style={{
              position: 'absolute', top: 8, left: 8,
              background: 'var(--brand-yellow)', color: 'var(--ink-900)',
              padding: '2px 8px', borderRadius: 'var(--radius-pill)',
              fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>Sale</span>
          )}
          {/* Quick-add overlay — opacity-0 on desktop until tile hover (or
              button focus), always visible on mobile via the `quick-add-btn`
              CSS class. Sits inside the image container so it absolutes
              against the image bounds, not the whole card. */}
          <button
            type="button"
            className="quick-add-btn"
            onClick={handleQuickAdd}
            disabled={soldOut}
            aria-label={
              soldOut
                ? `${name} is sold out`
                : isVariable
                  ? `Choose options for ${name}`
                  : `Add ${name} to cart`
            }
            style={{
              position: 'absolute',
              left: 8, right: 8, bottom: 8,
              padding: '9px 12px',
              background: soldOut
                ? 'rgba(243, 244, 246, 0.95)'
                : added
                  ? 'var(--success, #16a34a)'
                  : 'var(--ink-900)',
              color: soldOut ? 'var(--ink-500, #6b7280)' : '#fff',
              border: 'none', borderRadius: 'var(--radius-pill)',
              fontSize: '0.8125rem', fontWeight: 600, letterSpacing: '0.01em',
              cursor: soldOut ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
              opacity: hovered || added ? 1 : 0,
              transform: hovered || added ? 'translateY(0)' : 'translateY(6px)',
              transition: 'opacity 180ms ease-out, transform 180ms ease-out, background 200ms',
            }}
          >
            {quickAddLabel}
          </button>
        </div>
        {/* Brand line — slightly larger (12px) and tighter than the default
            overline (11px) so it actually identifies the brand at a glance
            on a desk-distance browser. Was the smallest readable text on
            the entire homepage. */}
        <Overline style={{
          color: 'var(--ink-500)', marginBottom: 4, display: 'block',
          fontSize: '0.75rem', letterSpacing: '0.12em',
        }}>{brand}</Overline>
        <div className="h3" style={{ marginBottom: 2, position: 'relative', display: 'inline-block' }}>
          {name}
          <div style={{
            position: 'absolute', bottom: -1, left: 0, right: 0, height: 2,
            background: 'var(--brand-yellow)',
            transform: hovered ? 'scaleX(1)' : 'scaleX(0)',
            transformOrigin: 'left', transition: 'transform 180ms ease-out',
          }} />
        </div>
        {variant && <div className="small-text" style={{ marginBottom: 4, display: 'block' }}>{variant}</div>}
        {review_count != null && review_count > 0 && (
          <div style={{ marginTop: 4 }}>
            <StarRating rating={rating} count={review_count} size={12} />
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <span className="tabular-nums" style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
            £{price.toLocaleString()}
          </span>
          {(original_price ?? 0) > price && (
            <span className="tabular-nums" style={{
              textDecoration: 'line-through', color: 'var(--brand-pink-text, var(--brand-pink))', fontSize: '0.8125rem',
            }}>£{(original_price ?? 0).toLocaleString()}</span>
          )}
        </div>
      </Link>

      {/* Wishlist button — sibling of the Link so it's a discrete focusable
       *  element, not nested inside an <a>. */}
      <button
        type="button"
        onClick={() => toggle(id)}
        aria-label={wishlisted ? `Remove ${name} from wishlist` : `Add ${name} to wishlist`}
        aria-pressed={wishlisted}
        style={{
          position: 'absolute', top: 8, right: 8,
          width: 32, height: 32, borderRadius: '50%',
          background: wishlisted ? 'var(--brand-pink)' : 'rgba(255,255,255,0.9)',
          border: wishlisted ? 'none' : '1px solid rgba(0,0,0,0.08)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.875rem',
          transition: 'background 150ms, transform 150ms',
          transform: wishlisted ? 'scale(1.1)' : 'scale(1)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
        }}
      >
        <span aria-hidden="true" style={{ color: wishlisted ? 'white' : 'var(--ink-500)', lineHeight: 1 }}>
          {wishlisted ? '♥' : '♡'}
        </span>
      </button>
    </div>
  );
}
