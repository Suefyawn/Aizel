// Homepage hair-quiz banner — surfaces the /quiz funnel above the fold so
// first-time shoppers who don't know which curl cream / leave-in / oil to
// pick can opt into a 60-second routine builder before bouncing.
//
// The quiz already existed but was only linked from the footer, which is
// where features go to die. This block sits between TrustBar and
// FeaturedProducts (top of the marketing column, but after the trust
// stripe so it doesn't compete with the hero) and is also surfaced as a
// primary header nav link via FLAT_ITEMS — a shopper deep-linked into a
// PDP still gets a route back to the quiz.
//
// Visual: brand-purple panel + a single bold CTA. Deliberately not a
// hero — the page already has one, and this block needs to read as a
// utility, not another marketing pitch.

import Link from 'next/link';

export function QuizBanner() {
  return (
    <section
      aria-labelledby="quiz-banner-heading"
      style={{
        // Full-bleed strip — the panel sits inside `container` but the
        // outer section keeps the surrounding section spacing consistent.
        padding: 'var(--section-gap) 0',
      }}
    >
      <div className="container">
        <div
          className="quiz-banner"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            alignItems: 'center',
            gap: 24,
            padding: '28px 32px',
            borderRadius: 'var(--radius-card)',
            background: 'linear-gradient(135deg, var(--brand-pink) 0%, var(--brand-pink-cta) 100%)',
            color: '#ffffff',
            boxShadow: '0 10px 28px rgba(74, 26, 107, 0.18)',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '0.6875rem',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                opacity: 0.8,
                marginBottom: 6,
              }}
            >
              New here?
            </div>
            <h2
              id="quiz-banner-heading"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1.5rem, 3.5vw, 2rem)',
                fontWeight: 500,
                letterSpacing: '-0.015em',
                lineHeight: 1.15,
                margin: '0 0 8px',
              }}
            >
              Build your routine in 60 seconds.
            </h2>
            <p
              className="body-text"
              style={{
                margin: 0,
                color: 'rgba(255,255,255,0.9)',
                fontSize: '0.9375rem',
                maxWidth: 560,
              }}
            >
              Five quick questions on curl pattern, porosity, and styling — we&apos;ll surface the
              wash-day picks (and the brands) that actually match your hair.
            </p>
          </div>

          <Link
            href="/quiz"
            data-quiz-cta="homepage-banner"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '14px 24px',
              borderRadius: 'var(--radius-pill)',
              background: '#ffffff',
              color: 'var(--brand-pink-cta)',
              fontFamily: 'var(--font-ui)',
              fontSize: '0.9375rem',
              fontWeight: 700,
              letterSpacing: '0.02em',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
          >
            Take the hair quiz
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
