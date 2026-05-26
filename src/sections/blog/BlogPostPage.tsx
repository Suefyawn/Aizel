import Link from 'next/link';
import { Overline } from '@/components/ui/Overline';
import { ProductTile } from '@/components/ui/ProductTile';
import { ProductImage } from '@/components/ui/ProductImage';
import { sanitizeHtml } from '@/lib/sanitize';
import { markdownToHtml, isMarkdown } from '@/lib/markdown';
import { linkProductMentions } from '@/lib/link-product-mentions';
import { NewsletterSignup } from '@/components/marketing/NewsletterSignup';
import { BlogShareStrip } from './BlogShareStrip';
import { BlogToc, type TocHeading } from './BlogToc';
import { absoluteUrl } from '@/lib/seo';
import type { BlogPost, Product } from '@/types';

interface BlogPostPageProps {
  post: BlogPost;
  relatedPosts: BlogPost[];
  relatedProducts: Product[];
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&hellip;/g, '…');
}

function slugify(text: string): string {
  const base = text.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return base || 'section';
}

// Pulls the <h2> headings out of the article body, gives each a stable id
// (for anchor links) and returns the rewritten HTML plus the heading list
// that feeds the table-of-contents rail.
function extractHeadings(html: string): { html: string; headings: TocHeading[] } {
  const headings: TocHeading[] = [];
  const seen = new Set<string>();

  const out = html.replace(/<h2(\s[^>]*)?>([\s\S]*?)<\/h2>/gi, (match, attrs: string | undefined, inner: string) => {
    const text = decodeEntities(inner.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
    if (!text) return match;

    let id = slugify(text);
    if (seen.has(id)) {
      let n = 2;
      while (seen.has(`${id}-${n}`)) n++;
      id = `${id}-${n}`;
    }
    seen.add(id);
    headings.push({ id, text });

    // Respect an id the CMS already set.
    if (attrs && /\sid=/i.test(attrs)) return match;
    return `<h2${attrs ?? ''} id="${id}">${inner}</h2>`;
  });

  return { html: out, headings };
}

export function BlogPostPage({ post, relatedPosts, relatedProducts }: BlogPostPageProps) {
  // Operator-authored bodies arrive either as raw HTML (historic posts) or
  // Markdown (current editor). isMarkdown() detects the latter so the
  // post-detail page renders both shapes correctly — without forcing a
  // one-off SQL migration on existing rows.
  const rawHtml = post.body
    ? (isMarkdown(post.body) ? markdownToHtml(post.body) : post.body)
    : '';
  const { html: withIds, headings } = rawHtml
    ? extractHeadings(sanitizeHtml(rawHtml))
    : { html: '', headings: [] as TocHeading[] };
  const bodyHtml = post.body ? linkProductMentions(withIds, relatedProducts) : '';
  const showToc = headings.length >= 2;

  const newsletterCard = (
    <div
      style={{
        marginTop: 40,
        padding: '24px 28px',
        background: 'var(--paper2, #f5f5f5)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-card)',
        textAlign: 'left',
      }}
    >
      <Overline style={{ display: 'block', marginBottom: 6, color: 'var(--brand-pink-text)' }}>
        The fortnight edit
      </Overline>
      <h3 style={{ margin: '0 0 8px', fontFamily: 'var(--font-display)', fontSize: '1.375rem', fontWeight: 500, letterSpacing: '-0.01em' }}>
        Liked this one? Get the next in your inbox.
      </h3>
      <p className="small-text" style={{ marginBottom: 14, color: 'var(--ink-700)', lineHeight: 1.55 }}>
        One fortnightly note from the editors — new pieces, restocks, and the routines we&apos;re actually using. Unsubscribe any time.
      </p>
      <NewsletterSignup source="footer" variant="light" ctaLabel="Sign up" />
    </div>
  );

  const bodyInner = (
    <div className="blog-article-main">
      {post.body ? (
        <div
          className="blog-body"
          style={{ lineHeight: 1.8, color: 'var(--ink-700)' }}
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      ) : (
        <p className="body-text" style={{ color: 'var(--ink-500)', fontStyle: 'italic' }}>
          No content yet.
        </p>
      )}

      {/* Bottom-of-post share strip — catches the reader who finishes the
          article and is most likely to share. */}
      <BlogShareStrip title={post.title} url={absoluteUrl(`/blog/${post.slug}`)} excerpt={post.excerpt} />

      {/* Newsletter capture at the natural "I just read something good"
          moment. Goes through the existing /api/newsletter pipeline. */}
      {newsletterCard}
    </div>
  );

  return (
    <div>
      <div className="container" style={{ padding: '16px var(--side)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link href="/blog" style={{ fontFamily: 'var(--font-ui)', fontSize: '0.8125rem', color: 'var(--ink-500)', textDecoration: 'none' }}>Journal</Link>
          <span style={{ color: 'var(--ink-500)', fontSize: '0.75rem' }}>/</span>
          <span style={{ fontSize: '0.8125rem', color: 'var(--ink-900)' }}>{post.category}</span>
        </div>
      </div>

      <article style={{ borderTop: '1px solid var(--line)' }}>
        <div className="container" style={{ maxWidth: 1120, padding: '48px var(--side) 0' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
            <Overline style={{ color: 'var(--ink-500)' }}>{post.category}</Overline>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--ink-500)' }} />
            <span className="small-text">{post.read_time}</span>
          </div>
          {/* Fluid type so a long title doesn't blow out at 375 px — the
              clamp goes from the small-screen size (1.75rem) up to the
              desktop hero (2.75rem), scaling with the viewport. */}
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.75rem, 6vw, 2.75rem)', fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1.15, marginBottom: 16, maxWidth: 880, overflowWrap: 'break-word' }}>{post.title}</h1>
          <p className="body-text" style={{ color: 'var(--ink-700)', fontSize: '1.0625rem', lineHeight: 1.6, marginBottom: 24, maxWidth: 720 }}>{post.excerpt}</p>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', paddingBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--paper2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>AZ</span>
            </div>
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Aizel Editorial</div>
              <div className="small-text">{post.date}</div>
            </div>
          </div>
          <BlogShareStrip title={post.title} url={absoluteUrl(`/blog/${post.slug}`)} excerpt={post.excerpt} />
          <div style={{ borderBottom: '1px solid var(--line)', marginTop: 16 }} />
        </div>

        <div className="container" style={{ maxWidth: 1120, padding: '32px var(--side)' }}>
          <div style={{ aspectRatio: '16/9', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
            <ProductImage src={post.image_url} alt={post.title} priority sizes="(max-width: 1180px) 100vw, 1120px" />
          </div>
        </div>

        {showToc ? (
          <div className="container blog-article-grid" style={{ maxWidth: 1120, padding: '0 var(--side) 48px' }}>
            <BlogToc headings={headings} />
            {bodyInner}
          </div>
        ) : (
          <div className="container" style={{ maxWidth: 760, padding: '0 var(--side) 48px' }}>
            {bodyInner}
          </div>
        )}

        <hr className="hairline" />

        {relatedProducts.length > 0 && (
          <section style={{ padding: '48px 0' }}>
            <div className="container">
              <Overline style={{ display: 'block', marginBottom: 24 }}>Mentioned in This Article</Overline>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gutter)' }} className="product-grid-3">
                {relatedProducts.map((p) => (
                  <ProductTile key={p.id} product={p} />
                ))}
              </div>
            </div>
          </section>
        )}

        {relatedPosts.length > 0 && (
          <>
            <hr className="hairline" />
            <section style={{ padding: '48px 0' }}>
              <div className="container">
                <Overline style={{ display: 'block', marginBottom: 24 }}>More from {post.category}</Overline>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--gutter)' }} className="duo-grid">
                  {relatedPosts.map((rp) => (
                    <Link key={rp.id} href={`/blog/${rp.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <article style={{ cursor: 'pointer' }}>
                        <div style={{ aspectRatio: '16/10', borderRadius: 'var(--radius-card)', overflow: 'hidden', marginBottom: 12 }}>
                          <ProductImage src={rp.image_url} alt={rp.title} sizes="(max-width: 700px) 100vw, 50vw" />
                        </div>
                        <Overline style={{ color: 'var(--ink-500)', display: 'block', marginBottom: 4 }}>{rp.category}</Overline>
                        <h3 className="h3" style={{ marginBottom: 4 }}>{rp.title}</h3>
                        <span className="small-text">{rp.date} · {rp.read_time}</span>
                      </article>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}
      </article>
    </div>
  );
}
