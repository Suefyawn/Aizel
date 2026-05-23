// Per-brand landing page — /brand/cantu, /brand/palmers, etc.
//
// Lists every published product from one brand, with breadcrumb +
// JSON-LD Brand schema for richer SERP rendering. The URL is the
// canonical "show me everything from this brand" destination.

export const revalidate = 300;

import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getAllProductsByBrand, getBrandBySlug, getAllBrands } from '@/lib/supabase';
import { ProductTile } from '@/components/ui/ProductTile';
import { pageMeta, jsonLd, breadcrumbLd, itemListLd, absoluteUrl, SITE_NAME } from '@/lib/seo';

interface Params { slug: string }

export async function generateStaticParams(): Promise<Params[]> {
  // Pre-render every brand at build time. Falls back to ISR on misses.
  // Wrapped in try/catch so a Supabase outage during build doesn't fail
  // the whole production build — Next falls back to on-demand rendering.
  try {
    const brands = await getAllBrands();
    return brands.map(b => ({ slug: b.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const brand = await getBrandBySlug(slug);
  if (!brand) return {};
  const title = `${brand.brand} — Shop`;
  const description = `Shop the ${brand.brand} range at ${SITE_NAME} — ${brand.productCount} ${brand.productCount === 1 ? 'product' : 'products'}, 100% authentic, free UK delivery over £15.`;
  return pageMeta({
    title,
    description,
    path: `/brand/${slug}`,
    image: brand.sampleImage ?? undefined,
    keywords: [brand.brand, 'Hair Care', 'Body Care', 'UK'].filter(Boolean) as string[],
  });
}

function brandLd(brand: { brand: string; slug: string; sampleImage: string | null }) {
  // Schema.org Brand. Google renders this as a knowledge panel for
  // brand-name searches once the page accrues enough authority.
  return {
    '@context': 'https://schema.org',
    '@type': 'Brand',
    '@id': absoluteUrl(`/brand/${brand.slug}#brand`),
    name: brand.brand,
    url: absoluteUrl(`/brand/${brand.slug}`),
    logo: brand.sampleImage ?? undefined,
  };
}

export default async function BrandPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const brand = await getBrandBySlug(slug);
  if (!brand) notFound();

  const products = await getAllProductsByBrand(brand.brand);

  return (
    <main className="fade-in container" style={{ padding: '48px var(--side) var(--section-gap)' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(breadcrumbLd([
            { name: 'Home', path: '/' },
            { name: 'Brands', path: '/brand' },
            { name: brand.brand, path: `/brand/${brand.slug}` },
          ])),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(brandLd(brand)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(itemListLd(
            `${brand.brand} products`,
            products.map(p => ({ name: p.name, path: `/product/${p.slug}` })),
          )),
        }}
      />

      <nav aria-label="Breadcrumb" style={{ marginBottom: 24 }}>
        <ol style={{
          listStyle: 'none', padding: 0, margin: 0,
          display: 'flex', gap: 8, fontSize: '0.8125rem',
          color: 'var(--ink-500)', flexWrap: 'wrap',
        }}>
          <li><Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>Home</Link></li>
          <li aria-hidden="true">·</li>
          <li><Link href="/brand" style={{ color: 'inherit', textDecoration: 'none' }}>Brands</Link></li>
          <li aria-hidden="true">·</li>
          <li aria-current="page" style={{ color: 'var(--ink-900)' }}>{brand.brand}</li>
        </ol>
      </nav>

      <header
        style={{
          display: 'flex', alignItems: 'center', gap: 24,
          padding: '24px 0 28px',
          borderBottom: '1px solid var(--line)',
          marginBottom: 32,
          flexWrap: 'wrap',
        }}
      >
        {brand.sampleImage && (
          <div style={{
            width: 120, height: 120, flexShrink: 0,
            borderRadius: 'var(--radius-card)', overflow: 'hidden',
            background: 'var(--paper2)',
            position: 'relative',
          }}>
            <Image
              src={brand.sampleImage}
              alt={`${brand.brand} — sample product`}
              fill
              sizes="120px"
              style={{ objectFit: 'cover' }}
            />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 200 }}>
          <p style={{
            fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'var(--brand-pink-text)',
            margin: '0 0 6px',
          }}>
            Brand
          </p>
          <h1 className="display-l" style={{
            fontSize: '2.5rem', margin: '0 0 6px',
            letterSpacing: '-0.025em',
          }}>{brand.brand}</h1>
          <p style={{ color: 'var(--ink-500)', fontSize: '0.9375rem' }}>
            {brand.productCount} {brand.productCount === 1 ? 'product' : 'products'} ·
            free UK delivery over £15
          </p>
        </div>
      </header>

      {products.length === 0 ? (
        <p style={{ color: 'var(--ink-500)' }}>
          No products from {brand.brand} in stock right now.{' '}
          <Link href="/shop" className="underline">Browse the full catalogue.</Link>
        </p>
      ) : (
        <ul style={{
          listStyle: 'none', padding: 0, margin: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 'var(--gutter)',
        }}>
          {products.map(p => (
            <li key={p.id}>
              <ProductTile product={p} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
