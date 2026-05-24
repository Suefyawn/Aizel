'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Overline } from '@/components/ui/Overline';
import { ProductImage } from '@/components/ui/ProductImage';
import type { BlogPost } from '@/types';

const POSTS_PER_PAGE = 12;

export function BlogPage({ posts }: { posts: BlogPost[] }) {
  // Filters are derived from the actual post categories, sorted by
  // frequency. The old hardcoded ['Skincare','Makeup','Wellness'] list
  // didn't match any real category (real values: "Bone Health",
  // "Fertility Support", "Men Health", etc.) so every non-"All" tab
  // showed zero posts.
  const filters = useMemo<string[]>(() => {
    const counts = new Map<string, number>();
    for (const p of posts) {
      if (!p.category) continue;
      counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    }
    // Keep only categories with 2+ posts so the filter rail doesn't
    // explode into a long single-post-per-category list.
    return ['All', ...[...counts.entries()]
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([cat]) => cat)];
  }, [posts]);

  const [activeFilter, setActiveFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const featured = posts.find(p => p.featured);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter(p => {
      if (activeFilter !== 'All' && p.category !== activeFilter) return false;
      if (!q) return true;
      const hay = `${p.title} ${p.excerpt ?? ''} ${p.category ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [posts, activeFilter, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / POSTS_PER_PAGE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const paginated = filtered.slice((safePage - 1) * POSTS_PER_PAGE, safePage * POSTS_PER_PAGE);

  return (
    <div>
      <section style={{ padding: '48px 0', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <Overline style={{ display: 'block', marginBottom: 8, color: 'var(--ink-500)' }}>Journal</Overline>
          <h1 className="display-l" style={{ fontSize: '2.5rem', marginBottom: 12 }}>The Edit</h1>
          <p className="body-text" style={{ color: 'var(--ink-700)', maxWidth: 480 }}>
            Expert guides, honest reviews, and the science behind beauty and health — no fluff.
          </p>
        </div>
      </section>

      {featured && (
        <section style={{ padding: 'var(--section-gap) 0', borderBottom: '1px solid var(--line)' }}>
          <div className="container">
            <Link href={`/blog/${featured.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 48, alignItems: 'center', cursor: 'pointer' }} className="duo-grid">
                <div style={{ aspectRatio: '16/10', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
                  <ProductImage src={featured.image_url} alt={featured.title} priority sizes="(max-width: 900px) 100vw, 60vw" />
                </div>
                <div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ padding: '3px 10px', background: 'var(--brand-pink)', color: '#fff', borderRadius: 'var(--radius-pill)', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Featured</span>
                    <Overline style={{ color: 'var(--ink-500)' }}>{featured.category}</Overline>
                  </div>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 12 }}>{featured.title}</h2>
                  <p className="body-text" style={{ color: 'var(--ink-700)', marginBottom: 16 }}>{featured.excerpt}</p>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <span className="small-text">{featured.date}</span>
                    <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--ink-500)' }} />
                    <span className="small-text">{featured.read_time}</span>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </section>
      )}

      <section style={{ padding: 'var(--section-gap) 0' }}>
        <div className="container">
          {/* Search + filter rail */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="search"
              value={query}
              onChange={e => { setQuery(e.target.value); setPage(1); }}
              placeholder="Search the journal — try “PCOS”, “retinol”…"
              aria-label="Search blog posts"
              style={{
                flex: '1 1 280px', maxWidth: 420, minWidth: 220,
                padding: '10px 14px', border: '1px solid var(--line)', borderRadius: 'var(--radius-pill)',
                fontSize: '0.875rem', fontFamily: 'var(--font-ui)', background: 'var(--paper2, #f5f5f5)',
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {filters.map(f => (
                <button key={f} onClick={() => { setActiveFilter(f); setPage(1); }} className="blog-filter-chip" style={{
                  padding: '8px 14px', borderRadius: 'var(--radius-pill)',
                  border: '1px solid ' + (activeFilter === f ? 'var(--ink-900)' : 'var(--line)'),
                  background: activeFilter === f ? 'var(--ink-900)' : 'transparent',
                  color: activeFilter === f ? 'var(--paper)' : 'var(--ink-700)',
                  fontFamily: 'var(--font-ui)', fontSize: '0.8125rem', fontWeight: 500,
                  cursor: 'pointer', transition: 'all 150ms ease-out',
                }}>{f}</button>
              ))}
            </div>
          </div>

          {paginated.length === 0 ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--ink-500)' }}>
              <p className="body-text" style={{ marginBottom: 6 }}>No posts match that filter.</p>
              <button
                onClick={() => { setActiveFilter('All'); setQuery(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--brand-pink-text)', cursor: 'pointer', fontWeight: 600 }}
              >
                Clear search
              </button>
            </div>
          ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gutter)' }} className="blog-grid">
            {paginated.map((post) => (
              <Link key={post.id} href={`/blog/${post.slug}`} className="blog-tile" style={{ textDecoration: 'none', color: 'inherit' }}>
                <article style={{ cursor: 'pointer' }}>
                  {/* Hover lift handled in CSS (.blog-tile:hover .blog-tile-img) instead
                      of JS onMouseEnter — the old version was a React Compiler
                      anti-pattern (mutating DOM in event handlers). */}
                  <div className="blog-tile-img" style={{ aspectRatio: '16/10', borderRadius: 'var(--radius-card)', overflow: 'hidden', marginBottom: 16, transition: 'transform 200ms ease-out' }}>
                    <ProductImage src={post.image_url} alt={post.title} sizes="(max-width: 700px) 100vw, 33vw" />
                  </div>
                  <Overline style={{ color: 'var(--ink-500)', display: 'block', marginBottom: 6 }}>{post.category}</Overline>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.3, marginBottom: 8 }}>{post.title}</h3>
                  <p className="small-text" style={{ marginBottom: 8, lineHeight: 1.5 }}>{post.excerpt}</p>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span className="small-text" style={{ fontSize: '0.75rem' }}>{post.date}</span>
                    <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--ink-500)' }} />
                    <span className="small-text" style={{ fontSize: '0.75rem' }}>{post.read_time}</span>
                  </div>
                </article>
              </Link>
            ))}
          </div>
          )}

          {totalPages > 1 && (
            <nav
              aria-label="Blog pagination"
              style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 32 }}
            >
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                aria-label="Previous page"
                style={pageBtnStyle(false)}
              >
                ←
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  aria-current={p === safePage ? 'page' : undefined}
                  aria-label={`Page ${p}`}
                  style={pageBtnStyle(p === safePage)}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                aria-label="Next page"
                style={pageBtnStyle(false)}
              >
                →
              </button>
            </nav>
          )}
        </div>
      </section>
    </div>
  );
}

function pageBtnStyle(active: boolean): React.CSSProperties {
  return {
    minWidth: 36, height: 36, padding: '0 10px',
    border: '1px solid ' + (active ? 'var(--ink-900)' : 'var(--line)'),
    background: active ? 'var(--ink-900)' : 'transparent',
    color: active ? 'var(--paper)' : 'var(--ink-700)',
    borderRadius: 8, fontFamily: 'var(--font-ui)', fontSize: '0.8125rem', fontWeight: 600,
    cursor: 'pointer',
  };
}
