// Brand index — /brand. Lists every brand stocked at Aizel as a tile grid,
// each linking to its dedicated /brand/[slug] landing. Useful for SEO
// (every brand carries some search demand) and for shoppers who navigate
// brand-first ("show me everything by Cantu").

export const revalidate = 300;

import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllBrands } from '@/lib/supabase';
import { pageMeta, jsonLd, breadcrumbLd, itemListLd, absoluteUrl, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Shop by brand',
  description: `Every brand stocked at ${SITE_NAME} — Cantu, ORS, Palmer's, Kuza, ApHogee, KeraCare and more. Authentic UK delivery.`,
  path: '/brand',
});

export default async function BrandIndexPage() {
  const brands = await getAllBrands();

  return (
    <main className="fade-in container" style={{ padding: '48px var(--side) var(--section-gap)' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(breadcrumbLd([
            { name: 'Home', path: '/' },
            { name: 'Brands', path: '/brand' },
          ])),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(itemListLd(
            `Brands at ${SITE_NAME}`,
            brands.map(b => ({ name: b.brand, path: `/brand/${b.slug}` })),
          )),
        }}
      />

      <nav aria-label="Breadcrumb" style={{ marginBottom: 24 }}>
        <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', gap: 8, fontSize: '0.8125rem', color: 'var(--ink-500)' }}>
          <li><Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>Home</Link></li>
          <li aria-hidden="true">·</li>
          <li aria-current="page" style={{ color: 'var(--ink-900)' }}>Brands</li>
        </ol>
      </nav>

      <header style={{ marginBottom: 32 }}>
        <h1 className="display-l" style={{ fontSize: '2.5rem', margin: '0 0 12px', letterSpacing: '-0.025em' }}>
          Shop by brand
        </h1>
        <p className="body-text" style={{ color: 'var(--ink-700)', maxWidth: 600, fontSize: '1.0625rem' }}>
          Every authentic brand stocked at {SITE_NAME} — straight from the brand or an
          authorised distributor, delivered across the UK.
        </p>
      </header>

      {brands.length === 0 ? (
        <p style={{ color: 'var(--ink-500)' }}>
          No brands yet. Browse the{' '}
          <Link href="/shop" className="underline">full catalogue</Link>.
        </p>
      ) : (
        <ul
          style={{
            listStyle: 'none', padding: 0, margin: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 'var(--gutter)',
          }}
        >
          {brands.map(b => (
            <li key={b.slug}>
              <Link
                href={`/brand/${b.slug}`}
                style={{
                  display: 'block', textDecoration: 'none',
                  border: '1px solid var(--line)', borderRadius: 'var(--radius-card)',
                  background: 'var(--paper)',
                  padding: 20,
                  color: 'var(--ink-900)',
                }}
                aria-label={`Browse ${b.brand} — ${b.productCount} ${b.productCount === 1 ? 'product' : 'products'}`}
              >
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.25rem',
                  fontWeight: 500,
                  marginBottom: 4,
                  letterSpacing: '-0.015em',
                }}>{b.brand}</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--ink-500)' }}>
                  {b.productCount} {b.productCount === 1 ? 'product' : 'products'}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <link rel="canonical" href={absoluteUrl('/brand')} />
    </main>
  );
}
