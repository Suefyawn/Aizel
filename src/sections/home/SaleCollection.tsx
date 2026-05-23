import Link from 'next/link';
import { ProductTile } from '@/components/ui/ProductTile';
import type { Product } from '@/types';

/** Homepage featured sale collection — shown only while a sale is switched
 *  on in Admin → Settings → Sale. It surfaces every discounted product
 *  (those with an original price above the current price) under the sale's
 *  title, in a tinted band so it reads as a distinct campaign. */
export function SaleCollection({ products, title, subtitle, ctaText, ctaUrl }: {
  products: Product[];
  title: string;
  subtitle?: string;
  ctaText: string;
  ctaUrl: string;
}) {
  const items = products.slice(0, 8);
  if (items.length === 0) return null;
  return (
    <section style={{ background: 'var(--paper2, #faf6ee)', padding: 'var(--section-gap) 0', marginBottom: 'var(--section-gap)' }}>
      <div className="container">
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <span style={{
            display: 'inline-block', padding: '4px 14px', marginBottom: 12,
            background: 'var(--brand-pink, #C5286A)', color: '#fff',
            borderRadius: 'var(--radius-pill, 999px)',
            fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>
            Sale
          </span>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '-0.02em',
            fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', margin: 0,
          }}>
            {title}
          </h2>
          {subtitle && (
            <p className="body-text" style={{ color: 'var(--ink-700)', marginTop: 8, maxWidth: 520, marginInline: 'auto' }}>
              {subtitle}
            </p>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gutter)' }} className="product-grid">
          {items.map((p) => (
            <ProductTile key={p.id} product={p} />
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <Link href={ctaUrl} className="btn-primary">{ctaText}</Link>
        </div>
      </div>
    </section>
  );
}
