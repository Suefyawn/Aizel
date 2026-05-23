import Link from 'next/link';
import { Overline } from '@/components/ui/Overline';
import { ProductTile } from '@/components/ui/ProductTile';
import type { Product } from '@/types';

export function FeaturedProducts({ products }: { products: Product[] }) {
  // Self-hide on empty so the page doesn't render an Overline + empty grid.
  if (products.length === 0) return null;
  return (
    <section style={{ padding: 'var(--section-gap) 0' }}>
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <Overline>This Week</Overline>
          <Link href="/shop" className="text-link">View All</Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gutter)' }} className="product-grid">
          {products.slice(0, 4).map((p) => (
            <ProductTile key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  );
}
