// Brand index — /brand. Lists every brand stocked at Aizel as a tile grid
// grouped under A-Z letter sections, with a sticky alphabet rail at the top
// for rapid jump-to-letter. Tiles stay (each links to /brand/[slug] for SEO
// + the visual win) but the grouping + alphabet jump means the page keeps
// scanning as the catalogue grows past ~40 brands.
//
// Pattern borrowed from Sabina Hair Cosmetics' brand index, adapted for
// Aizel's tile aesthetic instead of their text-only list.

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

const LETTERS = ['0-9', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'] as const;
type LetterKey = typeof LETTERS[number];

/** Bucket a brand into '0-9' (anything non-alphabetic) or its uppercase
 *  first letter. Mirrors Sabina's grouping convention. */
function letterFor(brand: string): LetterKey {
  const first = brand.trim().charAt(0).toUpperCase();
  if (first >= 'A' && first <= 'Z') return first as LetterKey;
  return '0-9';
}

export default async function BrandIndexPage() {
  const brands = await getAllBrands();
  // /brand defaults to alphabetical sort — getAllBrands sorts by product
  // count for "trending" use cases, which isn't what a directory needs.
  const alphabetical = [...brands].sort((a, b) =>
    a.brand.localeCompare(b.brand, 'en-GB', { sensitivity: 'base' }),
  );

  // Group brands under their alphabet bucket so each letter section can
  // render as a self-contained sub-grid with an anchor.
  const grouped = new Map<LetterKey, typeof alphabetical>();
  for (const b of alphabetical) {
    const key = letterFor(b.brand);
    const list = grouped.get(key) ?? [];
    list.push(b);
    grouped.set(key, list);
  }
  // Order the buckets in alphabet-rail order, dropping any empty buckets
  // from the rendered sections (the alphabet bar still shows every letter
  // but greys out the empties).
  const sections = LETTERS
    .filter(l => grouped.has(l))
    .map(l => ({ letter: l, items: grouped.get(l)! }));

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
            alphabetical.map(b => ({ name: b.brand, path: `/brand/${b.slug}` })),
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
          authorised distributor, delivered across the UK. {alphabetical.length} brands in stock.
        </p>
      </header>

      {alphabetical.length === 0 ? (
        <p style={{ color: 'var(--ink-500)' }}>
          No brands yet. Browse the{' '}
          <Link href="/shop" className="underline">full catalogue</Link>.
        </p>
      ) : (
        <>
          {/* Sticky alphabet rail — jump-to-letter for rapid navigation as the
              catalogue grows. Letters with 0 brands render greyed-out and
              non-clickable so the shape stays consistent and shoppers learn
              the layout regardless of how many brands a letter holds today. */}
          <nav
            aria-label="Jump to letter"
            style={{
              position: 'sticky',
              top: 'calc(var(--header-height, 64px))',
              zIndex: 5,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 4,
              padding: '12px 0',
              marginBottom: 24,
              background: 'var(--paper)',
              borderBottom: '1px solid var(--line)',
              fontFamily: 'var(--font-ui)',
            }}
          >
            {LETTERS.map(l => {
              const populated = grouped.has(l);
              return populated ? (
                <a
                  key={l}
                  href={`#brands-${l}`}
                  style={{
                    minWidth: 28,
                    padding: '4px 8px',
                    borderRadius: 6,
                    textAlign: 'center',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: 'var(--ink-900)',
                    textDecoration: 'none',
                    background: 'transparent',
                  }}
                >{l}</a>
              ) : (
                <span
                  key={l}
                  aria-disabled="true"
                  style={{
                    minWidth: 28,
                    padding: '4px 8px',
                    textAlign: 'center',
                    fontSize: '0.8125rem',
                    fontWeight: 400,
                    color: 'var(--ink-300, #cbd5e0)',
                    cursor: 'not-allowed',
                    userSelect: 'none',
                  }}
                >{l}</span>
              );
            })}
          </nav>

          {sections.map(section => (
            <section
              key={section.letter}
              id={`brands-${section.letter}`}
              style={{ marginBottom: 40, scrollMarginTop: 'calc(var(--header-height, 64px) + 64px)' }}
            >
              <h2 style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.5rem',
                fontWeight: 500,
                letterSpacing: '-0.015em',
                margin: '0 0 16px',
                paddingBottom: 8,
                borderBottom: '1px solid var(--line)',
              }}>{section.letter}</h2>
              <ul
                style={{
                  listStyle: 'none', padding: 0, margin: 0,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: 'var(--gutter)',
                }}
              >
                {section.items.map(b => (
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
            </section>
          ))}
        </>
      )}

      <link rel="canonical" href={absoluteUrl('/brand')} />
    </main>
  );
}
