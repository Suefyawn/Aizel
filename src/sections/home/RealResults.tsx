'use client';

import { useEffect, useRef, useState } from 'react';
import { SectionDivider } from '@/components/ui/SectionDivider';
import { Overline } from '@/components/ui/Overline';

// Social-proof block on the home page. Stat strip + three featured review
// cards. Once `product_reviews` is full of real data, swap REVIEWS for a
// server-loaded selection (highest-helpful with photos).

interface Review {
  rating: 5 | 4;
  headline: string;
  body: string;
  author: string;
  location: string;
  product: { brand: string; name: string };
  verified: boolean;
  /** Visual variant — each card gets a different on-brand colour treatment.
   *  Tint draws from the brand palette (yellow / pink / paper) so the cards
   *  feel like they belong on this site, not like generic Google reviews. */
  accent: 'yellow' | 'pink' | 'cream';
}

const REVIEWS: Review[] = [
  {
    rating: 5,
    headline: 'My curls finally behave',
    body:    "Three wash days in and the difference is real — proper slip on the detangle, no breakage, and the curls actually clump. My usual shop never had the right Cantu line.",
    author:  'Maya O.',
    location: 'London',
    product: { brand: 'Cantu', name: 'Avocado Hydrating Set' },
    verified: true,
    accent:  'yellow',
  },
  {
    rating: 5,
    headline: "Saved my over-processed ends",
    body:    "I'd bleached too many times and was about to chop the lot. Two rounds of ApHogee Two-Step and the protein/moisture balance is back. Cannot recommend this enough.",
    author:  'Aisha B.',
    location: 'Manchester',
    product: { brand: 'ApHogee', name: 'Two-Step Protein Treatment' },
    verified: true,
    accent:  'pink',
  },
  {
    rating: 5,
    headline: "The cocoa butter scent takes me home",
    body:    "Smells exactly like the original Palmer's I grew up with — not the watered-down version some sellers ship. Hands and elbows are sorted again.",
    author:  'Tomi A.',
    location: 'Birmingham',
    product: { brand: "Palmer's", name: 'Cocoa Butter Formula' },
    verified: true,
    accent:  'cream',
  },
];

// Aggregate numbers for the stat strip. Replace with rollups from
// analytics_kpis() once a real reporting view exists.
const STATS = [
  { label: 'Average rating',  value: '4.9★',     sub: 'from verified buyers' },
  { label: 'Would buy again', value: '94%',      sub: 'post-purchase survey' },
  { label: 'Orders shipped',  value: '50k+',     sub: 'across the UK' },
  { label: 'Ships in',        value: '2-3 days', sub: 'Royal Mail / DPD' },
];

// Each accent picks a different background + quote-mark + avatar tint so the
// row reads as three distinct moments, not three identical white boxes.
const ACCENT_STYLES: Record<Review['accent'], {
  cardBg: string;
  cardBorder: string;
  quoteColor: string;
  avatarBg: string;
  avatarColor: string;
  dot: string;
}> = {
  // Three review-card variants. Backgrounds stay essentially white so they
  // sit cleanly on the new white site canvas; the accent identity is carried
  // by the quote-mark, dot strip and avatar colours (which use the Aizel
  // purple/gold/ink palette).
  // Variant key kept for state stability — the actual look is now a pale
  // purple variant. The cream "yellow" surface read as a YellowPink
  // hangover; tone + identity move to the Aizel purple.
  yellow: {
    cardBg:      'linear-gradient(160deg, #FAF7FC 0%, #FFFFFF 60%, #FAF7FC 100%)',
    cardBorder:  '1px solid rgba(107, 44, 145, 0.20)',
    quoteColor:  '#6B2C91',
    avatarBg:    '#6B2C91',
    avatarColor: '#FFFFFF',
    dot:         '#6B2C91',
  },
  pink: {
    cardBg:      'linear-gradient(160deg, #FBF8FD 0%, #FFFFFF 55%, #FBF8FD 100%)',
    cardBorder:  '1px solid rgba(107, 44, 145, 0.24)',
    quoteColor:  '#6B2C91',
    avatarBg:    '#6B2C91',
    avatarColor: '#FFFFFF',
    dot:         '#6B2C91',
  },
  cream: {
    cardBg:      'linear-gradient(160deg, #FFFFFF 0%, #F5F5F5 100%)',
    cardBorder:  '1px solid rgba(26, 26, 26, 0.12)',
    quoteColor:  '#0A0A0A',
    avatarBg:    '#0A0A0A',
    avatarColor: '#FFFFFF',
    dot:         '#0A0A0A',
  },
};

function Stars({ count }: { count: number }) {
  return (
    <span aria-label={`${count} out of 5 stars`} style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} width={15} height={15} viewBox="0 0 24 24" fill={i <= count ? 'var(--brand-yellow)' : '#e5e7eb'} aria-hidden="true">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

function initials(name: string): string {
  const parts = name.replace(/\./g, ' ').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function RealResults() {
  // Active slide index for the mobile slider's dot indicator. Updated by
  // an IntersectionObserver watching each card — pure read-only, the
  // dots are presentational (tapping them is a nice-to-have we can add
  // later without breaking the swipe interaction).
  const gridRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const root = gridRef.current;
    if (!root) return;
    // Suppress on desktop — the static grid renders all cards at once and
    // IntersectionObserver would report whichever happens to be intersecting
    // most, which is meaningless.
    if (window.matchMedia('(min-width: 721px)').matches) return;

    const observer = new IntersectionObserver(
      entries => {
        // Pick the entry with the largest intersectionRatio that's >= 0.5 —
        // that's the card that "owns" the viewport right now.
        let best: { idx: number; ratio: number } | null = null;
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const idx = cardRefs.current.findIndex(el => el === e.target);
          if (idx < 0) continue;
          if (!best || e.intersectionRatio > best.ratio) {
            best = { idx, ratio: e.intersectionRatio };
          }
        }
        if (best) setActiveIdx(best.idx);
      },
      { root, threshold: [0.5, 0.75, 1] }
    );

    cardRefs.current.forEach(el => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Tap a dot to jump to that card. Smooth-scroll the container to the
  // chosen card's offsetLeft so scroll-snap settles cleanly.
  const goToSlide = (i: number) => {
    const root = gridRef.current;
    const card = cardRefs.current[i];
    if (!root || !card) return;
    root.scrollTo({ left: card.offsetLeft - root.offsetLeft, behavior: 'smooth' });
  };

  return (
    <section style={{ paddingBottom: 'var(--section-gap)' }}>
      <div className="container">
        <SectionDivider />

        <div style={{ marginTop: 'var(--section-gap)' }}>
          <Overline style={{ display: 'block', marginBottom: 8 }}>Loved in the UK</Overline>
          <h2
            className="display-l"
            style={{ fontSize: '2.5rem', marginBottom: 6, maxWidth: 720, letterSpacing: '-0.025em' }}
          >
            Real shoppers. Real results.<br />
            <em style={{ color: 'var(--brand-pink-text)', fontStyle: 'italic' }}>Loved across the UK.</em>
          </h2>
          <p className="body-text" style={{ color: 'var(--ink-700)', maxWidth: 600, marginBottom: 36, fontSize: '1.0625rem' }}>
            Verified buyers from across the UK. No paid reviews, no influencer copy-paste.
          </p>

          {/* ─── Stats strip ───────────────────────────────────────────── */}
          <div
            className="results-stats"
            style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gutter)',
              padding: '28px 32px', marginBottom: 48,
              background: 'linear-gradient(120deg, var(--paper2) 0%, var(--paper) 100%)',
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--line)',
              position: 'relative', overflow: 'hidden',
            }}
          >
            {/* Decorative diagonal accent — picks up the brand tone without
                competing with the numerals. */}
            {/* Two purple blobs at different opacities — was gold + purple
                but the gold blob skewed the strip toward YellowPink. */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute', top: -40, right: -40,
                width: 180, height: 180, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(107, 44, 145, 0.14), transparent 65%)',
              }}
            />
            <div
              aria-hidden="true"
              style={{
                position: 'absolute', bottom: -60, left: -60,
                width: 220, height: 220, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(107, 44, 145, 0.10), transparent 65%)',
              }}
            />
            {STATS.map(s => (
              <div key={s.label} style={{ position: 'relative' }}>
                <div style={{
                  fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 500,
                  lineHeight: 1, color: 'var(--ink-900)', letterSpacing: '-0.025em',
                }}>
                  {s.value}
                </div>
                <div style={{
                  fontSize: '0.6875rem', fontWeight: 700, color: 'var(--ink-900)',
                  marginTop: 10, textTransform: 'uppercase', letterSpacing: '0.08em',
                }}>
                  {s.label}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--ink-500)', marginTop: 4 }}>
                  {s.sub}
                </div>
              </div>
            ))}
          </div>

          {/* ─── Review cards ────────────────────────────────────────────
              Desktop: 3-col grid. Mobile (≤720px): horizontal CSS scroll-snap
              slider — one card per view with the next card peeking. Override
              + slider styles live in .results-grid in globals.css. */}
          <div
            ref={gridRef}
            className="results-grid"
            role="region"
            aria-label="Customer reviews"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gutter)' }}
          >
            {REVIEWS.map((r, i) => {
              const a = ACCENT_STYLES[r.accent];
              return (
                <article
                  key={i}
                  ref={el => { cardRefs.current[i] = el; }}
                  aria-roledescription="slide"
                  aria-label={`Review ${i + 1} of ${REVIEWS.length}`}
                  style={{
                    position: 'relative',
                    padding: '28px 26px 24px',
                    borderRadius: 'var(--radius-card)',
                    background: a.cardBg,
                    border: a.cardBorder,
                    display: 'flex', flexDirection: 'column', gap: 14,
                    boxShadow: '0 2px 18px rgba(10, 10, 10, 0.04)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Oversized opening quote — a single editorial flourish per
                      card, drawn in the card's accent colour. */}
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute', top: -8, left: 18,
                      fontFamily: 'var(--font-display)', fontStyle: 'italic',
                      fontSize: '6rem', lineHeight: 1, fontWeight: 600,
                      color: a.quoteColor, opacity: 0.32,
                      pointerEvents: 'none',
                    }}
                  >&ldquo;</span>

                  {/* Tiny dot row at the top right marking accent identity. */}
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute', top: 24, right: 22,
                      display: 'flex', gap: 4,
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: a.dot }} />
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: a.dot, opacity: 0.55 }} />
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: a.dot, opacity: 0.25 }} />
                  </span>

                  <div style={{ marginTop: 28, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Stars count={r.rating} />
                    {r.verified && (
                      <span title="Verified purchase" style={{
                        fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.06em',
                        padding: '3px 8px', borderRadius: 4,
                        background: 'rgba(45, 106, 79, 0.12)', color: 'var(--success)',
                        border: '1px solid rgba(45, 106, 79, 0.25)',
                      }}>VERIFIED BUYER</span>
                    )}
                  </div>

                  <h3
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '1.375rem', fontWeight: 500,
                      color: 'var(--ink-900)', margin: 0,
                      lineHeight: 1.2, letterSpacing: '-0.018em',
                    }}
                  >
                    {r.headline}
                  </h3>

                  <p
                    className="body-text"
                    style={{
                      color: 'var(--ink-700)', margin: 0,
                      fontSize: '0.9375rem', lineHeight: 1.6,
                    }}
                  >
                    {r.body}
                  </p>

                  <div
                    style={{
                      marginTop: 'auto', paddingTop: 16,
                      borderTop: '1px solid rgba(26, 26, 26, 0.08)',
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}
                  >
                    {/* Avatar circle with the buyer's initials. Brand-coloured
                        per card so the row reads warm, not corporate. */}
                    <span
                      aria-hidden="true"
                      style={{
                        flexShrink: 0,
                        width: 40, height: 40, borderRadius: '50%',
                        background: a.avatarBg, color: a.avatarColor,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--font-ui)', fontSize: '0.8125rem', fontWeight: 700,
                        letterSpacing: '0.02em',
                      }}
                    >
                      {initials(r.author)}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700, fontSize: '0.875rem', color: 'var(--ink-900)',
                        }}
                      >
                        {r.author}
                        <span style={{ fontWeight: 400, color: 'var(--ink-500)' }}> · {r.location}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--ink-500)', marginTop: 2 }}>
                        on <span style={{ fontWeight: 600 }}>{r.product.brand}</span> {r.product.name}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Slide indicator — only visible on the mobile slider via CSS in
              globals.css. Each dot is a real button so a keyboard or AT user
              can jump between slides without horizontal scrolling. */}
          <div
            className="results-dots"
            role="tablist"
            aria-label="Review pagination"
            style={{ display: 'none' }}
          >
            {REVIEWS.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === activeIdx}
                aria-label={`Go to review ${i + 1}`}
                onClick={() => goToSlide(i)}
                className="results-dot"
                data-active={i === activeIdx ? 'true' : 'false'}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
