import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabase, isDemo } from '@/lib/supabase';
import { DEMO_PAGES } from '@/lib/demo-data';
import { sanitizeHtml } from '@/lib/sanitize';
import { pageMeta, jsonLd, pageArticleLd, faqLd, breadcrumbLd } from '@/lib/seo';
import { getPageFaq } from '@/lib/page-faqs';
import { log } from '@/lib/logger';
import type { Page } from '@/types';

// Static content imported from WordPress (About, Privacy, Terms, FAQ…).
// Slugs come from wp_pages.slug — the same slug WP used, so links + redirects
// stay stable.

async function loadPage(slug: string): Promise<Page | null> {
  if (isDemo) return DEMO_PAGES.find(p => p.slug === slug) ?? null;
  try {
    const { data } = await supabase
      .from('pages')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle();
    return (data as Page | null) ?? null;
  } catch (err) {
    // Same resilience pattern as the storefront getters — a missing `pages`
    // table shouldn't 404 every CMS slug.
    log.warn('supabase.fallback', { label: 'loadPage', slug, err: (err as Error).message });
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await loadPage(slug);
  if (!page) return {};
  return pageMeta({
    title: page.meta_title ?? page.title,
    description: page.meta_description ?? page.excerpt ?? page.title,
    path: `/page/${page.slug}`,
  });
}

export default async function StaticPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await loadPage(slug);
  if (!page) notFound();

  // body_html is sanitised once at import-time (see importer) but defensively
  // re-sanitise here in case content was edited via raw SQL.
  const safeHtml = sanitizeHtml(page.body_html);
  const faqs = getPageFaq(page.slug);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(pageArticleLd({
            title: page.title,
            description: page.meta_description ?? page.excerpt ?? page.title,
            path: `/page/${page.slug}`,
          })),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(breadcrumbLd([
            { name: 'Home',     path: '/' },
            { name: page.title, path: `/page/${page.slug}` },
          ])),
        }}
      />
      {faqs && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(faqLd(faqs)) }}
        />
      )}
      <article className="container" style={{ padding: '64px var(--side)' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <h1
            className="display-l"
            style={{ fontSize: '2.5rem', fontWeight: 500, margin: '0 0 32px', letterSpacing: '-0.025em' }}
          >
            {page.title}
          </h1>
          <div
            className="body-text"
            style={{ color: 'var(--ink-700)', lineHeight: 1.7, fontSize: '1.0625rem' }}
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />
          {faqs && (
            <section style={{ marginTop: 48 }} aria-label="Frequently asked questions">
              <h2 className="h2" style={{ marginBottom: 24 }}>Frequently asked questions</h2>
              <div>
                {faqs.map(f => (
                  <details
                    key={f.question}
                    className="faq-item"
                    style={{
                      borderBottom: '1px solid var(--line)',
                      padding: '16px 0',
                    }}
                  >
                    <summary
                      style={{
                        cursor: 'pointer', fontWeight: 600, fontSize: '1rem',
                        listStyle: 'none', display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', gap: 16,
                      }}
                    >
                      <span>{f.question}</span>
                      <span
                        aria-hidden="true"
                        className="faq-chevron"
                        style={{
                          color: 'var(--ink-500)', fontSize: '1.25rem',
                          flexShrink: 0,
                          // Rotates 45° when the details is open via CSS in
                          // globals.css — turns + into × cleanly.
                          transition: 'transform 200ms ease-out',
                          display: 'inline-block',
                        }}
                      >+</span>
                    </summary>
                    <p style={{ marginTop: 12, color: 'var(--ink-700)', lineHeight: 1.6 }}>
                      {f.answer}
                    </p>
                  </details>
                ))}
              </div>
            </section>
          )}
        </div>
      </article>
    </>
  );
}
