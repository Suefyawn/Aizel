import { SectionDivider } from '@/components/ui/SectionDivider';
import { Overline } from '@/components/ui/Overline';

// Brand-promise section on the home page. Replaces an earlier "Real
// shoppers. Real results." block that carried three hand-written fake
// testimonials + four stats ("4.9★", "94% would buy again", "50k+ orders
// shipped", "2-3 days") that the catalogue couldn't actually back up
// (zero orders + zero verified-purchase reviews in the DB on launch).
//
// Under the UK Digital Markets, Competition and Consumers Act 2024 +
// CMA / ASA guidance, posting fabricated testimonials and unverifiable
// stats is unsafe — fines run into 10% of global revenue. So this block
// was rebuilt as three verifiable brand promises (authenticity / UK
// delivery / honest pricing) until real verified-purchase reviews
// accumulate. When they do, swap this for a server-loaded selection of
// reviews where product_reviews.verified_purchase = true.

interface Promise {
  /** Quick top label for the card. */
  badge: string;
  /** Headline statement. */
  title: string;
  /** Supporting body copy. */
  body: string;
}

const PROMISES: Promise[] = [
  {
    badge: 'Authentic',
    title: 'Direct from authorised distributors.',
    body: 'Every brand on Aizel — Cantu, ORS, Palmer\'s, Kuza, ApHogee, KeraCare and 11 more — is sourced from the brand or an authorised UK distributor. No grey market, no expired stock, no counterfeit lookalikes.',
  },
  {
    badge: 'UK delivery',
    title: 'Royal Mail Tracked, free over £30.',
    body: 'Orders ship the same working day if placed before 2 PM. Free standard delivery over £30; flat-rate below that. DPD next-day available at checkout.',
  },
  {
    badge: 'Fair pricing',
    title: 'No tourist tax for shopping online.',
    body: 'We price-match the local Black hair shops you already trust, then add free UK delivery. Same brands, same authenticity, no mark-up for the convenience.',
  },
];

export function RealResults() {
  return (
    <section style={{ paddingBottom: 'var(--section-gap)' }}>
      <div className="container">
        <SectionDivider />

        <div style={{ marginTop: 'var(--section-gap)' }}>
          <Overline style={{ display: 'block', marginBottom: 8 }}>Why shop with Aizel</Overline>
          <h2
            className="display-l"
            style={{ fontSize: '2.5rem', marginBottom: 6, maxWidth: 720, letterSpacing: '-0.025em' }}
          >
            The three things we promise.<br />
            <em style={{ color: 'var(--brand-pink-text)', fontStyle: 'italic' }}>Every order, every time.</em>
          </h2>
          <p className="body-text" style={{ color: 'var(--ink-700)', maxWidth: 600, marginBottom: 36, fontSize: '1.0625rem' }}>
            We&apos;d rather earn your trust over time than borrow it with star ratings. Here&apos;s what you can hold us to from day one.
          </p>

          <div
            className="promise-grid"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gutter)' }}
          >
            {PROMISES.map((p) => (
              <article
                key={p.badge}
                style={{
                  position: 'relative',
                  padding: '28px 26px 26px',
                  borderRadius: 'var(--radius-card)',
                  background: 'var(--paper)',
                  border: '1px solid var(--line)',
                  display: 'flex', flexDirection: 'column', gap: 14,
                  boxShadow: '0 2px 18px rgba(10, 10, 10, 0.04)',
                }}
              >
                <span
                  style={{
                    alignSelf: 'flex-start',
                    padding: '4px 12px',
                    borderRadius: 'var(--radius-pill)',
                    background: 'var(--brand-pink)',
                    color: '#ffffff',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >{p.badge}</span>

                <h3
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.375rem', fontWeight: 500,
                    color: 'var(--ink-900)', margin: 0,
                    lineHeight: 1.2, letterSpacing: '-0.018em',
                  }}
                >
                  {p.title}
                </h3>

                <p
                  className="body-text"
                  style={{
                    margin: 0, color: 'var(--ink-700)',
                    lineHeight: 1.6, fontSize: '0.9375rem',
                  }}
                >
                  {p.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
