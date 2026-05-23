'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Overline } from '@/components/ui/Overline';
import { ProductTile } from '@/components/ui/ProductTile';
import { ProductGridSkeleton } from '@/components/ui/Skeleton';
import { useWishlist } from '@/context/WishlistContext';
import { useCart } from '@/context/CartContext';
import { getBrowserClient } from '@/lib/supabase-browser';
import type { Product } from '@/types';

const fmt = (n: number) => `£${n.toLocaleString()}`;

export function WishlistPage() {
  const { wishlist, clear } = useWishlist();
  const { addToCart, setCartOpen } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(wishlist.length > 0);
  const [copied, setCopied] = useState(false);

  // Fetch wishlist product details whenever the wishlist ids change.
  // setState-in-effect is intentional: wishlist is persisted to localStorage
  // (external store) and the product rows come from a network round-trip.
  useEffect(() => {
    if (wishlist.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProducts([]);
      setLoading(false);
      return;
    }
    const sb = getBrowserClient();
    sb.from('products').select('*').in('id', wishlist)
      .then(({ data }) => {
        if (data) setProducts(data as Product[]);
      })
      // Always clear the spinner — flaky mobile data shouldn't strand
      // the user staring at a skeleton forever.
      .then(undefined, () => undefined)
      .then(() => setLoading(false));
  }, [wishlist]);

  // Totals shown above the grid — both number-of-items and rolling sum so the
  // visitor sees the wishlist as a real basket-in-waiting.
  const summary = useMemo(() => {
    const inStock = products.filter(p => p.track_inventory === false || p.stock > 0);
    const total = inStock.reduce((s, p) => s + p.price, 0);
    return { count: products.length, inStock: inStock.length, total };
  }, [products]);

  const addAllToCart = () => {
    let moved = 0;
    for (const p of products) {
      if (p.track_inventory !== false && p.stock <= 0) continue;
      // CartContext.addToCart accepts a Product directly; qty defaults to 1.
      addToCart(p);
      moved++;
    }
    if (moved > 0) setCartOpen(true);
  };

  const shareWishlist = async () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    // navigator.share for mobile, clipboard for desktop.
    if (navigator.share) {
      try {
        await navigator.share({ url, title: 'My Aizel wishlist' });
        return;
      } catch { /* user cancelled — fall through */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* clipboard blocked */ }
  };

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <section style={{ padding: '48px 0 var(--section-gap)' }}>
        <div className="container">
          <Overline style={{ display: 'block', marginBottom: 8, color: 'var(--ink-500)' }}>Saved items</Overline>
          <h1 className="display-l" style={{ fontSize: '2rem', marginBottom: 32 }}>Wishlist</h1>
          <ProductGridSkeleton count={8} columns={4} />
        </div>
      </section>
    );
  }

  // ─── Empty state ────────────────────────────────────────────────────────────
  if (wishlist.length === 0 || products.length === 0) {
    return (
      <section style={{ padding: 'var(--section-gap) 0', textAlign: 'center' }}>
        <div
          className="container"
          style={{ maxWidth: 560, padding: '64px var(--side)' }}
        >
          <div
            aria-hidden="true"
            style={{
              width: 80, height: 80, margin: '0 auto 24px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #FDE7F0 0%, #FFF8E1 100%)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2.25rem', color: 'var(--brand-pink-text)',
            }}
          >♡</div>
          <h1 className="display-l" style={{ fontSize: '2rem', margin: '0 0 12px' }}>
            No favourites yet
          </h1>
          <p className="body-text" style={{ color: 'var(--ink-700)', margin: '0 0 28px', maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
            Tap the heart on any product to save it here. We&apos;ll let you know when something on your list goes on sale or runs low on stock.
          </p>
          <div style={{ display: 'inline-flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link href="/shop" className="btn-primary">Browse products</Link>
            <Link href="/blog" className="btn-secondary">Read the edit</Link>
          </div>
        </div>
      </section>
    );
  }

  // ─── Populated ──────────────────────────────────────────────────────────────
  return (
    <div>
      <section style={{ padding: '40px 0 32px', borderBottom: '1px solid var(--line)' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Overline style={{ display: 'block', marginBottom: 8, color: 'var(--ink-500)' }}>
              Saved items
            </Overline>
            <h1 className="display-l" style={{ fontSize: '2.25rem', margin: '0 0 8px' }}>
              Your wishlist
            </h1>
            <p className="small-text" style={{ margin: 0, color: 'var(--ink-700)' }}>
              {summary.count} item{summary.count !== 1 ? 's' : ''}
              {summary.inStock > 0 && summary.inStock < summary.count && (
                <>
                  {' '}· <span style={{ color: 'var(--ink-500)' }}>{summary.count - summary.inStock} out of stock</span>
                </>
              )}
              {summary.total > 0 && (
                <>
                  {' '}· Estimated total <span style={{ fontWeight: 600, color: 'var(--ink-900)' }}>{fmt(summary.total)}</span>
                </>
              )}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={addAllToCart}
              disabled={summary.inStock === 0}
              className="btn-primary"
              style={{
                opacity: summary.inStock === 0 ? 0.5 : 1,
                cursor: summary.inStock === 0 ? 'not-allowed' : 'pointer',
                fontSize: '0.75rem',
              }}
              title={summary.inStock === 0 ? 'Nothing currently in stock to move' : `Add ${summary.inStock} in-stock item${summary.inStock !== 1 ? 's' : ''} to cart`}
            >
              Add {summary.inStock > 0 ? `${summary.inStock} ` : ''}to cart
            </button>
            <button
              type="button"
              onClick={shareWishlist}
              className="btn-secondary"
              aria-label="Share wishlist"
              style={{ fontSize: '0.75rem' }}
            >
              {copied ? 'Link copied ✓' : 'Share'}
            </button>
            <button
              type="button"
              onClick={() => { if (confirm('Remove every item from your wishlist?')) clear(); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: 'var(--ink-500)',
                padding: '10px 8px',
              }}
            >
              Clear all
            </button>
          </div>
        </div>
      </section>

      <section style={{ padding: '32px 0 var(--section-gap)' }}>
        <div className="container">
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gutter)' }}
            className="product-grid"
          >
            {products.map(p => (
              <ProductTile key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
