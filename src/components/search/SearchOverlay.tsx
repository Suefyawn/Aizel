'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Overline } from '@/components/ui/Overline';
import { ProductImage } from '@/components/ui/ProductImage';
import { useSearch } from '@/context/SearchContext';
// IMPORTANT: import the BROWSER client (memoised singleton) not
// `supabase` from '@/lib/supabase'. That module's `createClient` call
// constructs a second GoTrueClient in the browser bundle, which collides
// with the @supabase/ssr cookie client and makes signed-in customers look
// logged-out. `isDemo` comes from its own `createClient`-free module so
// importing it can't drag that client in.
import { isDemo } from '@/lib/is-demo';
import { getBrowserClient } from '@/lib/supabase-browser';
import { DEMO_PRODUCTS } from '@/lib/demo-data';
import { useBodyScrollLock, useFocusTrap } from '@/lib/hooks/useBodyScrollLock';
import { brandPlusName } from '@/lib/product-display';
import type { Product } from '@/types';

// Fallbacks when the server didn't pass anything (demo mode, network blip,
// or this component mounted in isolation). The wrapper at
// SearchOverlayWrapper.tsx normally resolves these from real catalog data.
// Brands list is Aizel's top in-stock hair-care brands; categories pick the
// five fattest Hair + Body Care leaves after the taxonomy expansion so the
// trending row stays useful even when the server probe returns nothing.
const TRENDING_FALLBACK = ['Cantu', 'ORS', 'Kuza', 'ApHogee', 'KeraCare'];
const CATEGORIES_FALLBACK = ['Hair Oils & Serums', 'Hair Colour', 'Hair Treatments & Masks', 'Curl & Styling Creams', 'Cocoa & Shea Butter'];

interface SearchOverlayProps {
  /** Server-fetched top brands (top 5 by in-stock product count). */
  trending?: string[];
  /** Server-fetched top categories (top 5 by in-stock product count). */
  categories?: string[];
}

export function SearchOverlay({ trending, categories }: SearchOverlayProps = {}) {
  // Treat empty arrays as "use fallback" so a transient empty list doesn't
  // leave a blank trending block.
  const TRENDING = trending && trending.length > 0 ? trending : TRENDING_FALLBACK;
  const POPULAR_CATS = categories && categories.length > 0 ? categories : CATEGORIES_FALLBACK;
  const { searchOpen, setSearchOpen } = useSearch();
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  useBodyScrollLock(searchOpen);
  useFocusTrap(searchOpen, panelRef);

  // Sync UI state to the overlay's open/closed external signal — focus the
  // search input when opening, clear the typeahead query when closing.
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery('');
    }
  }, [searchOpen]);

  // Server-side typeahead via search_products RPC (pg_trgm). Debounced 200 ms.
  // Demo-mode short-circuit: filter the stub catalog client-side instead so
  // the overlay actually returns something on a fresh clone. setState-in-effect
  // is intentional: results come from the network (external system).
  useEffect(() => {
    if (!searchOpen || query.trim().length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProducts([]);
      return;
    }
    if (isDemo) {
      const q = query.trim().toLowerCase();
      setProducts(
        DEMO_PRODUCTS.filter(p =>
          p.name.toLowerCase().includes(q) ||
          (p.brand ?? '').toLowerCase().includes(q) ||
          (p.category ?? '').toLowerCase().includes(q) ||
          (p.subcategory ?? '').toLowerCase().includes(q)
        ).slice(0, 8)
      );
      return;
    }
    const handle = setTimeout(() => {
      getBrowserClient().rpc('search_products' as never, { p_query: query, p_limit: 8 } as never).then(({ data }) => {
        setProducts((data ?? []) as Product[]);
      });
    }, 200);
    return () => clearTimeout(handle);
  }, [query, searchOpen]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && searchOpen) setSearchOpen(false);
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [searchOpen, setSearchOpen]);

  // Server already filtered + ranked via pg_trgm. Just rename for the JSX.
  const filtered = products;

  const goToProduct = (slug: string) => {
    setSearchOpen(false);
    router.push(`/product/${slug}`);
  };

  // Submit the current query as a full /search?q=… results page and close
  // the overlay. Called from Enter-key submit, the "View all results"
  // link, and trending pill clicks. /search is the dedicated query-
  // driven results route — different from /shop?q= which is the
  // catalogue with a search filter applied. /search ranks by pg_trgm
  // similarity; /shop filters in-place with the rail still applicable.
  const goToSearch = (term: string) => {
    const t = term.trim();
    if (!t) return;
    setSearchOpen(false);
    router.push(`/search?q=${encodeURIComponent(t)}`);
  };
  const goToCategory = (cat: string) => {
    setSearchOpen(false);
    router.push(`/shop?category=${encodeURIComponent(cat)}`);
  };

  return (
    <>
      <div onClick={() => setSearchOpen(false)} style={{
        position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.5)',
        opacity: searchOpen ? 1 : 0, pointerEvents: searchOpen ? 'auto' : 'none',
        transition: 'opacity 200ms ease-out', zIndex: 300,
      }} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal={searchOpen}
        aria-label="Search"
        // `inert` instead of `aria-hidden` — same fix as MiniCart. The
        // search panel stays in the DOM (so the slide-down animates) but
        // when closed it must be out of the a11y tree AND the tab order.
        // `aria-hidden={true}` alone failed WCAG 4.1.2 (aria-hidden-focus)
        // because the close button + the input remained focusable. `inert`
        // does both at once. React 19 wants `inert={true}` literally —
        // we spread so the attribute is OMITTED when open (not set to
        // `inert={false}`), keeping the DOM clean.
        {...((searchOpen ? {} : { inert: true }) as Record<string, unknown>)}
        style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        background: 'var(--paper)', zIndex: 301,
        transform: searchOpen ? 'translateY(0)' : 'translateY(-100%)',
        transition: 'transform 300ms ease-out',
        boxShadow: 'var(--shadow-1)',
        maxHeight: '80vh', overflowY: 'auto',
      }}>
        <div className="container" style={{ padding: '24px var(--side)' }}>
          <form
            onSubmit={e => { e.preventDefault(); goToSearch(query); }}
            role="search"
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              borderBottom: '2px solid var(--ink-900)', paddingBottom: 12, marginBottom: 24,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink-500)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <label htmlFor="search-overlay-input" className="sr-only">
              Search products, brands, or concerns
            </label>
            <input
              ref={inputRef}
              id="search-overlay-input"
              type="search"
              autoComplete="off"
              enterKeyHint="search"
              aria-label="Search products, brands, or concerns"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search products…"
              style={{
                // `minWidth: 0` lets the input shrink past its default
                // intrinsic content-size inside the flex row — without
                // this the 18 px placeholder pushed the form past the
                // mobile viewport (the Close button got cropped). The
                // placeholder is also shorter now ("Search products…")
                // so it doesn't get truncated at all on a 375 px screen.
                flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
                fontFamily: 'var(--font-ui)', fontSize: '1.125rem', fontWeight: 400,
                color: 'var(--ink-900)',
              }}
            />
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              aria-label="Close search"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--ink-500)', fontSize: '0.8125rem', fontWeight: 500, fontFamily: 'var(--font-ui)',
                padding: '12px 16px', borderRadius: 6, minHeight: 44, minWidth: 44,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >Close</button>
          </form>

          {query.length > 0 ? (
            <div>
              {filtered.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center' }}>
                  <div aria-hidden="true" style={{ fontSize: '2rem', marginBottom: 8, opacity: 0.35 }}>○</div>
                  <p className="body-text" style={{ color: 'var(--ink-700)', margin: '0 0 6px', fontWeight: 600 }}>
                    No results for &ldquo;{query}&rdquo;
                  </p>
                  <p className="small-text" style={{ color: 'var(--ink-500)', margin: '0 0 16px' }}>
                    Try a different search term, or jump to a category below.
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                    {POPULAR_CATS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setQuery(c)}
                        style={{
                          padding: '6px 12px', background: 'var(--paper2)',
                          border: '1px solid var(--line)', borderRadius: 'var(--radius-pill)',
                          fontSize: '0.75rem', fontWeight: 500, color: 'var(--ink-900)',
                          cursor: 'pointer',
                        }}
                      >{c}</button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <Overline style={{ display: 'block', marginBottom: 12, color: 'var(--ink-500)' }}>
                    {filtered.length} Result{filtered.length !== 1 ? 's' : ''}
                  </Overline>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {filtered.slice(0, 6).map((p) => (
                      <div key={p.id}
                        onClick={() => goToProduct(p.slug)}
                        role="link"
                        tabIndex={0}
                        onKeyDown={e => { if (e.key === 'Enter') goToProduct(p.slug); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '12px 0', borderBottom: '1px solid var(--line)', cursor: 'pointer',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-card)', flexShrink: 0, overflow: 'hidden', background: 'var(--paper2)' }}>
                          <ProductImage src={p.image_url} alt={brandPlusName(p.brand, p.name)} width={48} height={48} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Overline style={{ color: 'var(--ink-500)', fontSize: '0.5625rem', display: 'block' }}>{p.brand}</Overline>
                          <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{p.name}</div>
                        </div>
                        <span className="tabular-nums" style={{ fontWeight: 600, fontSize: '0.875rem', flexShrink: 0 }}>
                          £{p.price.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                  {/* "See all results" — full search page is the real source
                      of truth (with sort + filters); the inline list is a
                      typeahead preview only. */}
                  <button
                    onClick={() => goToSearch(query)}
                    style={{
                      marginTop: 14, padding: '10px 16px',
                      background: 'var(--ink-900)', color: 'var(--paper)',
                      border: 'none', borderRadius: 'var(--radius-card)',
                      fontFamily: 'var(--font-ui)', fontSize: '0.75rem', fontWeight: 600,
                      letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    See all results for &ldquo;{query}&rdquo; →
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }} className="search-suggestions">
              <div>
                <Overline style={{ display: 'block', marginBottom: 12, color: 'var(--ink-500)' }}>Trending</Overline>
                {TRENDING.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => goToSearch(t)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '10px 0', fontSize: '0.9375rem',
                      color: 'var(--ink-700)', borderBottom: '1px solid var(--line)',
                      fontFamily: 'var(--font-ui)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink-900)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-700)')}
                  >{t}</button>
                ))}
              </div>
              <div>
                <Overline style={{ display: 'block', marginBottom: 12, color: 'var(--ink-500)' }}>Categories</Overline>
                {POPULAR_CATS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => goToCategory(c)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '10px 0', fontSize: '0.9375rem',
                      color: 'var(--ink-700)', borderBottom: '1px solid var(--line)',
                      fontFamily: 'var(--font-ui)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink-900)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-700)')}
                  >{c}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
