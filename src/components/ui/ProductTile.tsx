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

// Modern product card — the workhorse used on homepage rails, the
// collection grid, the brand landing, and the PDP "Pairs with" row.
//
// Information hierarchy from top to bottom of the image:
//   • New-in / discount-% pill (top-left)  — merchandising signal
//   • Wishlist heart           (top-right) — save for later
//   • Hover quick-add button   (bottom)    — add or "Choose options"
//
// Below the image: brand → name → variant → rating → price → low-stock
// urgency. Each row is optional except brand + name + price; the card
// keeps consistent rhythm by collapsing empty rows rather than padding
// reserved space.
//
// Keyboard: Tab focuses the Link (Enter → PDP). Tab again focuses the
// wishlist button (Enter → toggle), Tab again the quick-add (when
// visible). No nested-focusable HTML.
//
// "New in" threshold: products created in the last 14 days. Comparable to
// what UK beauty retailers (Cult Beauty, Beauty Bay) surface on the tile.
const NEW_IN_DAYS = 14;
// "Only N left" threshold — tighter than the soft "low stock" used
// elsewhere because urgency only converts when the number feels scarce.
const LOW_STOCK_THRESHOLD = 5;

function isNewArrival(createdAt: string | undefined | null): boolean {
  if (!createdAt) return false;
  const t = Date.parse(createdAt);
  if (Number.isNaN(t)) return false;
  return (Date.now() - t) < NEW_IN_DAYS * 24 * 60 * 60 * 1000;
}

export function ProductTile({ product }: ProductTileProps) {
  const [hovered, setHovered] = useState(false);
  const [added, setAdded] = useState(false);
  const router = useRouter();
  const { addToCart } = useCart();
  const { toggle, isWishlisted } = useWishlist();
  const { id, slug, brand, name, variant, price, original_price, kind, stock, rating, review_count, created_at, track_inventory } = product;
  const wishlisted = isWishlisted(id);

  // Quick-add UX matrix:
  //  • Variable products  → "Choose options" routes to PDP (variant pick needed).
  //  • Out of stock       → "Sold out" disabled badge, no action.
  //  • Simple + in stock  → "Add to bag" calls addToCart(product, qty: 1).
  const isVariable = kind === 'variable';
  const soldOut = typeof stock === 'number' && stock <= 0;
  const tracksStock = track_inventory !== false;
  const isOnSale = (original_price ?? 0) > price;
  const discountPercent = isOnSale
    ? Math.round(((original_price! - price) / original_price!) * 100)
    : 0;
  const showNewPill = !isOnSale && isNewArrival(created_at);
  const showLowStock = tracksStock && !soldOut && stock > 0 && stock <= LOW_STOCK_THRESHOLD;

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
        : 'Add to bag';

  // Pill on the top-left of the image — at most one ever shows, ranked
  // by usefulness: sold-out > discount-% > new-in. Generic "Sale" was
  // replaced because the percentage is materially more informative.
  type Pill = { label: string; bg: string; color: string };
  const pill: Pill | null = soldOut
    ? { label: 'Sold out', bg: 'rgba(10,10,10,0.78)', color: '#fff' }
    : isOnSale && discountPercent > 0
      ? { label: `-${discountPercent}%`, bg: 'var(--brand-pink)', color: '#fff' }
      : showNewPill
        ? { label: 'New in', bg: '#FFFFFF', color: 'var(--ink-900)' }
        : null;

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
          marginBottom: 14, position: 'relative', overflow: 'hidden',
          background: 'var(--paper2)',
          // Softer, lower-key shadow than the previous big-bouncy lift —
          // modern retail cards favour a quiet elevation that doesn't
          // detract from the product photo.
          boxShadow: hovered
            ? '0 10px 24px rgba(26, 26, 26, 0.08)'
            : '0 1px 2px rgba(26, 26, 26, 0.03)',
          transition: 'box-shadow 240ms ease-out',
        }}>
          <div style={{
            width: '100%', height: '100%',
            transform: hovered ? 'scale(1.04)' : 'scale(1)',
            transition: 'transform 500ms ease-out',
          }}>
            <ProductImage src={product.image_url} alt={brandPlusName(brand, name)} label={brand} />
          </div>

          {/* Merchandising pill (top-left) — at most one. */}
          {pill && (
            <span style={{
              position: 'absolute', top: 10, left: 10,
              background: pill.bg, color: pill.color,
              padding: '4px 9px', borderRadius: 'var(--radius-pill)',
              fontSize: '0.6875rem', fontWeight: 700,
              letterSpacing: '0.04em', textTransform: 'uppercase',
              boxShadow: pill.bg === '#FFFFFF' ? '0 1px 4px rgba(10,10,10,0.08)' : 'none',
            }}>{pill.label}</span>
          )}

          {/* Quick-add overlay — opacity-0 on desktop until tile hover (or
              button focus), always visible on mobile via the `quick-add-btn`
              CSS class. Refined pill: smaller padding, lighter shadow,
              compositional with the image rather than a heavy slab. */}
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
                  : `Add ${name} to bag`
            }
            style={{
              position: 'absolute',
              left: 10, right: 10, bottom: 10,
              padding: '10px 14px',
              background: soldOut
                ? 'rgba(243, 244, 246, 0.95)'
                : added
                  ? 'var(--success, #16a34a)'
                  : 'var(--ink-900)',
              color: soldOut ? 'var(--ink-500, #6b7280)' : '#fff',
              border: 'none', borderRadius: 'var(--radius-pill)',
              fontSize: '0.8125rem', fontWeight: 600, letterSpacing: '0.01em',
              cursor: soldOut ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 14px rgba(10,10,10,0.18)',
              opacity: hovered || added ? 1 : 0,
              transform: hovered || added ? 'translateY(0)' : 'translateY(6px)',
              transition: 'opacity 180ms ease-out, transform 180ms ease-out, background 200ms',
            }}
          >
            {quickAddLabel}
          </button>
        </div>

        {/* ── Text block ─────────────────────────────────────────────── */}

        {/* Brand line — smaller, tighter than the surrounding text so it
            reads as the secondary identifier rather than competing with
            the product name. */}
        <Overline style={{
          color: 'var(--ink-500)', marginBottom: 4, display: 'block',
          fontSize: '0.6875rem', letterSpacing: '0.14em',
        }}>{brand}</Overline>

        {/* Product name — display face, modest weight. Hover underline in
            the brand purple matches the CTA system. */}
        <div className="h3" style={{
          marginBottom: 2, position: 'relative', display: 'inline-block',
          fontSize: '0.9375rem', lineHeight: 1.35, fontWeight: 500,
        }}>
          {name}
          <div style={{
            position: 'absolute', bottom: -1, left: 0, right: 0, height: 1,
            background: 'var(--brand-pink)',
            transform: hovered ? 'scaleX(1)' : 'scaleX(0)',
            transformOrigin: 'left', transition: 'transform 180ms ease-out',
          }} />
        </div>

        {variant && (
          <div className="small-text" style={{
            marginBottom: 4, display: 'block',
            color: 'var(--ink-500)', fontSize: '0.75rem',
          }}>{variant}</div>
        )}

        {review_count != null && review_count > 0 && (
          <div style={{ marginTop: 6 }}>
            <StarRating rating={rating} count={review_count} size={12} />
          </div>
        )}

        {/* Price row — current price emphasised; original strikes through
            in a muted ink tone so the discount reads without shouting.
            tabular-nums keeps numerals vertically aligned across the grid. */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
          <span className="tabular-nums" style={{
            fontWeight: 600, fontSize: '1rem', color: 'var(--ink-900)',
            letterSpacing: '-0.01em',
          }}>
            £{price.toLocaleString()}
          </span>
          {isOnSale && (
            <span className="tabular-nums" style={{
              textDecoration: 'line-through',
              color: 'var(--ink-500)',
              fontSize: '0.8125rem',
              fontWeight: 400,
            }}>£{(original_price ?? 0).toLocaleString()}</span>
          )}
        </div>

        {/* Low-stock urgency — small, only when 1-5 left and we're tracking
            inventory. Sits under the price so it never displaces the
            primary product info; modern conversion pattern from UK beauty
            retail. */}
        {showLowStock && (
          <div style={{
            marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: '0.6875rem', fontWeight: 600,
            color: 'var(--brand-pink-text, var(--brand-pink))',
            letterSpacing: '0.02em',
          }}>
            <span aria-hidden="true" style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--brand-pink-text, var(--brand-pink))',
            }} />
            Only {stock} left
          </div>
        )}
      </Link>

      {/* Wishlist button — sibling of the Link so it's a discrete focusable
       *  element, not nested inside an <a>. Smaller, lighter touch than
       *  the previous 32px disc; expands on press / when set. */}
      <button
        type="button"
        onClick={() => toggle(id)}
        aria-label={wishlisted ? `Remove ${name} from wishlist` : `Add ${name} to wishlist`}
        aria-pressed={wishlisted}
        style={{
          position: 'absolute', top: 10, right: 10,
          width: 30, height: 30, borderRadius: '50%',
          background: wishlisted ? 'var(--brand-pink)' : 'rgba(255,255,255,0.92)',
          border: wishlisted ? 'none' : '1px solid rgba(10,10,10,0.06)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 150ms, transform 150ms, box-shadow 150ms',
          transform: wishlisted ? 'scale(1.05)' : 'scale(1)',
          boxShadow: wishlisted
            ? '0 2px 8px rgba(107,44,145,0.30)'
            : '0 1px 3px rgba(10,10,10,0.08)',
          padding: 0,
        }}
      >
        <svg
          width="14" height="14" viewBox="0 0 24 24"
          fill={wishlisted ? '#fff' : 'none'}
          stroke={wishlisted ? '#fff' : 'var(--ink-700)'}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </button>
    </div>
  );
}
