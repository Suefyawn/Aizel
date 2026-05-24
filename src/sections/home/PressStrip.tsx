'use client';

// UK-leaning beauty / lifestyle press outlets shoppers will recognise.
// Names are placeholders (no live coverage from these titles yet), but each
// links to the masthead's UK edition so the row reads as a real
// affiliations strip rather than dead text. Swap to actual coverage URLs
// (e.g. https://www.vogue.co.uk/article/aizel-...) once the merchant has
// real press to point at.
//
// Editable here without a DB change.

interface PressOutlet {
  name: string;
  href: string;
}

const OUTLETS: PressOutlet[] = [
  { name: 'ELLE',         href: 'https://www.elle.com/uk/' },
  { name: 'VOGUE',        href: 'https://www.vogue.co.uk/' },
  { name: 'STYLIST',      href: 'https://www.stylist.co.uk/' },
  { name: 'GLAMOUR',      href: 'https://www.glamourmagazine.co.uk/' },
  { name: 'COSMOPOLITAN', href: 'https://www.cosmopolitan.com/uk/' },
  { name: 'GRAZIA',       href: 'https://graziadaily.co.uk/' },
];

export function PressStrip() {
  return (
    <section style={{ background: 'var(--ink-900)', padding: '24px 0' }} aria-label="Featured in">
      <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 48, flexWrap: 'wrap' }}>
        {OUTLETS.map(o => (
          <a
            key={o.name}
            href={o.href}
            target="_blank"
            // `noopener` for security (the target page can't reach back via
            // window.opener); `noreferrer` so the outbound click doesn't leak
            // the originating URL into the masthead's analytics.
            rel="noopener noreferrer"
            aria-label={`Visit ${o.name} (opens in a new tab)`}
            style={{
              fontFamily: 'var(--font-ui)', fontSize: '0.75rem', fontWeight: 600,
              letterSpacing: '0.2em', textTransform: 'uppercase',
              color: 'rgba(255, 255, 255, 0.35)',
              textDecoration: 'none',
              transition: 'color 160ms ease-out',
              padding: '6px 4px', // comfortable tap target without breaking the row rhythm
            }}
            // Inline hover via JS event handlers — keeps the strip self-
            // contained without adding a CSS rule for one component.
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.85)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.35)')}
            onFocus={e => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.85)')}
            onBlur={e => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.35)')}
          >{o.name}</a>
        ))}
      </div>
    </section>
  );
}
