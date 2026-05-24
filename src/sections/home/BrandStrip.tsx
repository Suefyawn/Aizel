// "Shop by brand" — horizontal tile strip on the homepage. Each tile links
// to /brand/<slug> and the section CTA links to /brand for the full index.
// Server component — data comes from getAllBrands() upstream.

import Link from 'next/link';
import { Overline } from '@/components/ui/Overline';
import type { BrandSummary } from '@/lib/supabase';

interface BrandStripProps {
  brands: BrandSummary[];
  /** How many tiles to show before the "View all" CTA. */
  limit?: number;
}

export function BrandStrip({ brands, limit = 12 }: BrandStripProps) {
  if (!brands.length) return null;
  const display = brands.slice(0, limit);

  return (
    <section style={{ padding: 'var(--section-gap) 0', borderTop: '1px solid var(--line)' }}>
      <div className="container">
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 16, marginBottom: 28,
        }}>
          <div>
            <Overline style={{ display: 'block', marginBottom: 8, color: 'var(--ink-500)' }}>
              Brands we stock
            </Overline>
            <h2 className="display-l" style={{ fontSize: '2rem', margin: 0, letterSpacing: '-0.02em' }}>
              Shop by brand
            </h2>
          </div>
          <Link
            href="/brand"
            style={{
              fontSize: '0.8125rem', fontWeight: 600,
              color: 'var(--brand-pink-text)', textDecoration: 'none',
              letterSpacing: '0.04em', textTransform: 'uppercase',
            }}
          >
            All {brands.length} brands →
          </Link>
        </div>

        <ul
          style={{
            listStyle: 'none', padding: 0, margin: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 'var(--gutter)',
          }}
        >
          {display.map(b => (
            <li key={b.slug}>
              <Link
                href={`/brand/${b.slug}`}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center',
                  textDecoration: 'none', color: 'var(--ink-900)',
                  border: '1px solid var(--line)', borderRadius: 'var(--radius-card)',
                  background: 'var(--paper)',
                  padding: '22px 16px',
                  minHeight: 96,
                  textAlign: 'center',
                  transition: 'border-color 150ms, transform 150ms',
                }}
              >
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.125rem', fontWeight: 500,
                  letterSpacing: '-0.01em',
                  marginBottom: 4,
                }}>{b.brand}</span>
                <span style={{ fontSize: '0.6875rem', color: 'var(--ink-500)' }}>
                  {b.productCount} {b.productCount === 1 ? 'product' : 'products'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
