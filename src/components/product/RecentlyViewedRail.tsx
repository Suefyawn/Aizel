'use client';

import { ProductTile } from '@/components/ui/ProductTile';
import { Overline } from '@/components/ui/Overline';
import { useRecentlyViewed, type RecentlyViewedItem } from '@/lib/hooks/useRecentlyViewed';
import type { Product } from '@/types';

interface Props {
  /** Hide the current PDP's product from its own "recently viewed" rail. */
  excludeId?: string;
  /** Default: 8. Cap so the row stays a single horizontal scan. */
  max?: number;
  /** Section label — defaults to "Recently viewed" but can be overridden
   *  (e.g. "Pick up where you left off" on the cart). */
  heading?: string;
}

// Cast the localStorage summary into a ProductTile-acceptable shape. The
// missing-but-optional Product fields default to safe values so the tile
// can't NaN or crash mid-render.
function toTileProduct(p: RecentlyViewedItem): Product {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    price: p.price,
    original_price: p.original_price,
    image_url: p.image_url,
    category: p.category,
    stock: p.stock ?? 1,                  // assume in-stock when unknown
    track_inventory: p.track_inventory ?? false,
    kind: p.kind ?? 'simple',
    rating: p.rating ?? 0,
    review_count: p.review_count ?? 0,
    created_at: p.created_at,
    is_bestseller: p.is_bestseller ?? false,
  } as Product;
}

export function RecentlyViewedRail({ excludeId, max = 8, heading = 'Recently viewed' }: Props) {
  const items = useRecentlyViewed(excludeId);

  // Only render when there's a meaningful set — 1 item = useless on PDP
  // (it'd be the user just-looked-at thing), 0 = obviously empty.
  if (items.length < 2) return null;

  const shown = items.slice(0, max);

  return (
    <section style={{ padding: '48px 0' }} aria-label={heading}>
      <div className="container">
        <Overline style={{ display: 'block', marginBottom: 24 }}>{heading}</Overline>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(shown.length, 4)}, 1fr)`,
            gap: 'var(--gutter)',
          }}
          className="product-grid"
        >
          {shown.map(p => (
            <ProductTile key={p.id} product={toTileProduct(p)} />
          ))}
        </div>
      </div>
    </section>
  );
}
