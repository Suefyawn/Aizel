'use client';

import Link from 'next/link';
import { SectionDivider } from '@/components/ui/SectionDivider';
import { Overline } from '@/components/ui/Overline';
import { ProductTile } from '@/components/ui/ProductTile';
import type { Product } from '@/types';

// `category` maps each pillar to a real wellness category value (see
// category-taxonomy.ts) so the box links to its /shop?category= listing.
const PILLARS = [
  { label: "Women's Health", desc: 'Fertility, prenatal, hormonal balance', category: "Women's Health" },
  { label: "Men's Vitality", desc: 'Performance, stamina, reproductive health', category: "Men's Health" },
  { label: 'Immune Support', desc: 'Defense, zinc, daily wellness', category: 'Immunity' },
  { label: 'Bone & Joint', desc: 'Calcium D3, mobility, strength', category: 'Bone & Joint' },
];

export function WellnessSection({ products }: { products: Product[] }) {
  const wellnessProducts = products.slice(0, 4);
  if (wellnessProducts.length === 0) return null;
  return (
    <section style={{ padding: 'var(--section-gap) 0' }}>
      <div className="container">
        <SectionDivider />
        <div style={{ marginTop: 'var(--section-gap)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'start', marginBottom: 48 }} className="duo-grid">
            <div>
              <Overline style={{ display: 'block', marginBottom: 12, color: 'var(--ink-500)' }}>Beyond Beauty</Overline>
              <h2 className="display-l" style={{ fontSize: '2.5rem', marginBottom: 16 }}>
                Beauty starts<br /><em style={{ fontStyle: 'italic' }}>from within.</em>
              </h2>
              <p className="body-text" style={{ color: 'var(--ink-700)', maxWidth: 400 }}>
                Clinical-grade nutraceuticals for fertility, immunity, bone health, and daily vitality.
                Because real beauty is health — inside out.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="duo-grid">
              {PILLARS.map((p) => (
                <Link key={p.label} href={`/shop?category=${encodeURIComponent(p.category)}`} style={{
                  display: 'block', textDecoration: 'none', color: 'inherit',
                  padding: 16, background: 'var(--paper2)', borderRadius: 'var(--radius-card)',
                  border: '1px solid var(--line)',
                  transition: 'border-color 180ms ease-out',
                }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brand-yellow)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--line)')}
                >
                  <div style={{ width: 24, height: 4, background: 'var(--brand-yellow)', borderRadius: 2, marginBottom: 10 }} />
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 2 }}>{p.label}</div>
                  <div className="small-text" style={{ lineHeight: 1.4 }}>{p.desc}</div>
                </Link>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gutter)' }} className="wellness-grid">
            {wellnessProducts.map((p) => (
              <ProductTile key={p.id} product={p} />
            ))}
          </div>

          <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center' }}>
            <Link href="/shop?taxon=wellness" className="btn-secondary">Explore Wellness</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
