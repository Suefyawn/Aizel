// 1-min ISR per (path + query). Searches converge on a small set of
// popular terms; longer windows risk serving stale price/stock on a
// page that's specifically about discoverability.
export const revalidate = 60;

import type { Metadata } from 'next';
import Link from 'next/link';
import { Overline } from '@/components/ui/Overline';
import { ProductTile } from '@/components/ui/ProductTile';
import { pageMeta } from '@/lib/seo';
import { supabase, isDemo } from '@/lib/supabase';
import { DEMO_PRODUCTS } from '@/lib/demo-data';
import type { Product } from '@/types';

// Free-text search is infinite-state — every query is a separate URL we
// don't want Google indexing. The metadata flips robots noindex for any
// non-empty query, but the route itself stays public so the customer can
// share a search URL with a friend / paste it from history.
export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string }> }): Promise<Metadata> {
  const { q } = await searchParams;
  const trimmed = (q ?? '').trim();
  return pageMeta({
    title: trimmed ? `Search: ${trimmed}` : 'Search',
    description: trimmed
      ? `Search results for "${trimmed}" on Aizel — UK Afro/Black hair and body care brands.`
      : 'Search the Aizel catalogue — UK Afro/Black hair and body care brands.',
    path: trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search',
    noIndex: Boolean(trimmed),
  });
}

interface SearchRow {
  id: string;
  brand: string | null;
  name: string;
  slug: string;
  price: number;
  image_url: string | null;
  category: string | null;
  similarity?: number;
}

async function runSearch(query: string): Promise<Product[]> {
  if (!query) return [];
  if (isDemo) {
    const q = query.toLowerCase();
    return DEMO_PRODUCTS
      .filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.brand ?? '').toLowerCase().includes(q) ||
        (p.category ?? '').toLowerCase().includes(q) ||
        (p.subcategory ?? '').toLowerCase().includes(q)
      )
      .slice(0, 36);
  }
  // search_products is the same pg_trgm-backed RPC the overlay uses;
  // bigger limit because a full-page result deserves more depth than a
  // typeahead's 8 rows.
  const { data } = await supabase
    .rpc('search_products' as never, { p_query: query, p_limit: 36 } as never);
  return ((data ?? []) as SearchRow[]).map(r => ({
    id: r.id,
    brand: r.brand,
    name: r.name,
    slug: r.slug,
    price: Number(r.price ?? 0),
    image_url: r.image_url ?? undefined,
    category: r.category ?? '',
    stock: 1,                  // RPC doesn't return stock — assume in
    track_inventory: false,    //   stock so the tile renders without an
    kind: 'simple' as const,   //   "out of stock" badge it can't justify
    status: 'published' as const,
  })) as Product[];
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = (q ?? '').trim();
  const results = await runSearch(query);

  return (
    <main className="fade-in">
      <section style={{ padding: '48px 0 24px', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <Overline style={{ display: 'block', marginBottom: 8, color: 'var(--ink-500)' }}>Search</Overline>
          {query ? (
            <>
              <h1 className="display-l" style={{ fontSize: '2rem', margin: '0 0 8px' }}>
                Results for &ldquo;{query}&rdquo;
              </h1>
              <p className="small-text" style={{ color: 'var(--ink-500)', margin: 0 }}>
                {results.length === 0 ? 'No matches found.' : `${results.length} product${results.length === 1 ? '' : 's'}`}
              </p>
            </>
          ) : (
            <>
              <h1 className="display-l" style={{ fontSize: '2rem', margin: '0 0 8px' }}>
                Search Aizel
              </h1>
              <p className="small-text" style={{ color: 'var(--ink-500)', margin: 0 }}>
                Type a brand, product, or category — the search bar in the header is the fastest way in.
              </p>
            </>
          )}
        </div>
      </section>

      <section style={{ padding: 'var(--section-gap) 0' }}>
        <div className="container">
          {query && results.length === 0 ? (
            <div
              style={{
                textAlign: 'center', padding: '56px 24px',
                background: 'linear-gradient(135deg, var(--paper2) 0%, var(--paper) 100%)',
                border: '1px dashed var(--line)', borderRadius: 'var(--radius-card)',
              }}
            >
              <h2 className="display-l" style={{ fontSize: '1.25rem', margin: '0 0 8px' }}>
                Nothing matches &ldquo;{query}&rdquo;
              </h2>
              <p className="body-text" style={{ color: 'var(--ink-700)', maxWidth: 420, margin: '0 auto 20px' }}>
                Try a shorter spelling, search by brand, or browse the full catalogue.
              </p>
              <div style={{ display: 'inline-flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Link href="/shop" className="btn-primary" style={{ fontSize: '0.75rem' }}>
                  Browse all products
                </Link>
                <Link href="/brand" className="btn-secondary" style={{ fontSize: '0.75rem' }}>
                  Shop by brand
                </Link>
              </div>
            </div>
          ) : results.length > 0 ? (
            <div
              style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gutter)' }}
              className="product-grid"
            >
              {results.map(p => <ProductTile key={p.id} product={p} />)}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
