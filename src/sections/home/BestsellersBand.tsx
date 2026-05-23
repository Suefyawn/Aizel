import Link from 'next/link';
import { Overline } from '@/components/ui/Overline';
import { ProductTile } from '@/components/ui/ProductTile';
import type { Product } from '@/types';

export function BestsellersBand({ products }: { products: Product[] }) {
  const items = products.slice(0, 3);
  if (items.length === 0) return null;
  return (
    <section style={{ background: 'var(--paper2)', padding: 'var(--section-gap) 0', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
      <div className="container">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 48, alignItems: 'center' }} className="duo-grid">
          <div>
            <Overline style={{ display: 'block', marginBottom: 12, color: 'var(--ink-500)' }}>Bestsellers</Overline>
            <h2 className="display-l" style={{ fontSize: '2.25rem', marginBottom: 16 }}>
              What everyone&apos;s buying.
            </h2>
            <p className="body-text" style={{ color: 'var(--ink-700)', marginBottom: 20, maxWidth: 320 }}>
              The products our customers keep coming back to — tried, tested, loved.
            </p>
            <Link href="/shop" className="btn-secondary">Shop Bestsellers</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gutter)' }} className="product-grid-3">
            {items.map((p) => (
              <ProductTile key={p.id} product={p} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
