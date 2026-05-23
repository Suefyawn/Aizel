import Link from 'next/link';
import { Overline } from '@/components/ui/Overline';
import { ProductImage } from '@/components/ui/ProductImage';
import type { BlogPost } from '@/types';

/** Homepage "From the Journal" rail — the three most recent posts, linking
 *  through to the full blog. Self-hides when there are no posts. */
export function JournalSection({ posts }: { posts: BlogPost[] }) {
  const items = posts.slice(0, 3);
  if (items.length === 0) return null;
  return (
    <section style={{ paddingBottom: 'var(--section-gap)' }}>
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <Overline>From the Journal</Overline>
          <Link href="/blog" className="text-link">Read the Journal</Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gutter)' }} className="blog-grid">
          {items.map((post) => (
            <Link key={post.id} href={`/blog/${post.slug}`} className="blog-tile" style={{ textDecoration: 'none', color: 'inherit' }}>
              <article style={{ cursor: 'pointer' }}>
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
      </div>
    </section>
  );
}
