// Homepage "Shop by hair type" strip — three direct entry points to the
// quiz (Type 2 / Type 3 / Type 4) plus a "Not sure" card that routes
// into the standard quiz intro. Each card seeds the quiz's first question
// so the shopper lands two questions deep instead of starting from scratch.
//
// Sits below the QuizBanner so the page reads:
//   1. QuizBanner — "build your routine in 60 seconds" — for first-time
//      shoppers who don't know their hair type yet
//   2. HairTypeStrip — "I already know my type, take me in" — for shoppers
//      who have a type in mind
//   3. FeaturedProducts — the rest of the homepage
//
// No new products schema needed: routing is via `?seed=<answer-id>` on
// /quiz which the QuizClient reads to pre-select the curl-pattern answer.

import Link from 'next/link';
import { Overline } from '@/components/ui/Overline';

interface TypeCard {
  /** Quiz answer id this card pre-selects (matches QUESTIONS[0].answers[].id). */
  seed: string;
  /** Top-of-card chip text. */
  badge: string;
  /** Card headline. */
  title: string;
  /** Short body copy. */
  body: string;
}

const TYPE_CARDS: TypeCard[] = [
  {
    seed: 'type-2',
    badge: 'Type 2',
    title: 'Wavy & loose',
    body: 'Soft S-bends that need lift without weighing down. Light mousse, hold-friendly cream, gentle cleanse.',
  },
  {
    seed: 'type-3',
    badge: 'Type 3',
    title: 'Defined curls',
    body: 'Springy spiral curls that crave moisture and definition. Curl creams, hydrating treatments, slip-rich conditioner.',
  },
  {
    seed: 'type-4',
    badge: 'Type 4',
    title: 'Tight coils',
    body: 'Dense, drier coils that thrive on protein + moisture balance. Deep treatments, butters, leave-in essentials.',
  },
  {
    seed: 'unsure',
    badge: 'Not sure',
    title: 'Take the full quiz',
    body: 'Five questions on curl pattern, porosity, scalp + wash-day routine. Personal routine in under a minute.',
  },
];

export function HairTypeStrip() {
  return (
    <section
      aria-labelledby="hair-type-heading"
      style={{ padding: '0 0 var(--section-gap)' }}
    >
      <div className="container">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <Overline style={{ display: 'block', marginBottom: 6, color: 'var(--ink-500)' }}>Shop by hair type</Overline>
            <h2
              id="hair-type-heading"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1.5rem, 3vw, 2rem)',
                fontWeight: 500,
                letterSpacing: '-0.015em',
                margin: 0,
              }}
            >
              Know your hair? Jump straight in.
            </h2>
          </div>
          <Link href="/quiz" className="text-link" style={{ fontSize: '0.8125rem' }}>
            Take the full quiz →
          </Link>
        </div>

        <div
          className="hair-type-grid"
          // Responsive grid:
          //   ≥ 1024px → 4 cards in a row (default)
          //   720–1023 → 2 cards × 2 rows
          //   < 720    → 1 card per row, full-width
          // auto-fit + minmax(220, 1fr) handles all three breakpoints in
          // a single CSS rule without an explicit media-query stack.
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
            gap: 'var(--gutter)',
          }}
        >
          {TYPE_CARDS.map(card => (
            <Link
              key={card.seed}
              href={`/quiz?seed=${encodeURIComponent(card.seed)}`}
              data-hair-type={card.seed}
              style={{
                display: 'block',
                textDecoration: 'none',
                color: 'inherit',
                padding: '24px 22px',
                background: 'var(--paper)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-card)',
                transition: 'border-color 160ms, transform 160ms, box-shadow 160ms',
                cursor: 'pointer',
                position: 'relative',
                minHeight: 200,
              }}
              onMouseEnter={undefined /* hover handled in CSS via .hair-type-grid > a:hover */}
            >
              <span
                style={{
                  display: 'inline-block',
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--brand-pink)',
                  color: '#ffffff',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: 14,
                }}
              >
                {card.badge}
              </span>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.25rem',
                  fontWeight: 500,
                  letterSpacing: '-0.015em',
                  margin: '0 0 10px',
                }}
              >
                {card.title}
              </h3>
              <p
                className="small-text"
                style={{ color: 'var(--ink-700)', lineHeight: 1.5, margin: 0 }}
              >
                {card.body}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
