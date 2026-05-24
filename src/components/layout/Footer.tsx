'use client';

import Link from 'next/link';
import { LogoWordmark } from '@/components/ui/LogoWordmark';
import { Overline } from '@/components/ui/Overline';
import { NewsletterSignup } from '@/components/marketing/NewsletterSignup';
import { PaymentMethodStrip } from '@/components/layout/PaymentMethodStrip';
import type { SocialLink } from '@/lib/socials';

// Footer link list rendered with a consistent "overline-ish" treatment —
// slightly tighter letter-spacing and weight than body text, so each
// column reads as a navigable group rather than a paragraph.
function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <li style={{ marginBottom: 10, listStyle: 'none' }}>
      <Link
        href={href}
        style={{
          color: 'rgba(255, 255, 255,0.7)',
          textDecoration: 'none',
          fontFamily: 'var(--font-ui)',
          fontSize: '0.8125rem',
          fontWeight: 500,
          letterSpacing: '0.01em',
          transition: 'color 150ms',
          display: 'inline-block',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--paper)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255, 255, 255,0.7)')}
      >
        {label}
      </Link>
    </li>
  );
}

const SHOP_LINKS = [
  // Taxon URLs match the nav: ?taxon=<key> expands to the category set
  // defined in lib/category-taxonomy.ts.
  { label: 'Hair Care',     href: '/shop?taxon=hair' },
  { label: 'Body Care',     href: '/shop?taxon=body' },
  { label: 'Shop by Brand', href: '/brand' },
  { label: 'All Products',  href: '/shop' },
  { label: 'Hair Quiz',     href: '/quiz' },
];

const COMPANY_LINKS = [
  { label: 'About Us',         href: '/page/about' },
  { label: 'Blog',             href: '/blog' },
  { label: 'Contact',          href: '/page/contact' },
  { label: 'Shipping Policy',  href: '/page/shipping' },
];

const HELP_LINKS = [
  { label: 'Track Order',  href: '/track' },
  { label: 'My Account',   href: '/account' },
  { label: 'Returns',      href: '/page/returns' },
  { label: 'FAQ',          href: '/page/faq' },
  { label: 'Privacy',      href: '/privacy' },
];

export function Footer({ socials = [] }: { socials?: SocialLink[] }) {
  return (
    <footer
      role="contentinfo"
      aria-label="Site footer"
      style={{ background: 'var(--ink-900)', color: 'var(--paper)', padding: '64px 0 32px', position: 'relative', overflow: 'hidden' }}
    >
      {/* Removed: an oversized LogoMark watermark + an italic-serif scrolling
          marquee that both read as YellowPink-era decorative chrome. The
          footer wordmark column below carries the brand identity; the
          payment-method strip + © line close the footer cleanly without
          either. */}
      <div className="container">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 40 }}>
          <div>
            <div style={{ marginBottom: 24 }}><LogoWordmark color="var(--paper)" /></div>
            <p className="small-text" style={{ color: 'rgba(255, 255, 255,0.55)', maxWidth: 260, marginBottom: 16 }}>
              Authentic Black hair and body care brands, shipped across the United Kingdom.
            </p>
            <address style={{ fontStyle: 'normal' }}>
              <p className="small-text" style={{ color: 'rgba(255, 255, 255,0.5)', fontSize: '0.75rem', lineHeight: 1.7 }}>
                Free UK delivery on orders over £15<br />
                Royal Mail Tracked · DPD next-day available<br />
                14-day returns · Card · PayPal · Apple Pay<br />
                All prices include VAT
              </p>
            </address>
          </div>

          <nav aria-label="Shop">
            <Overline style={{ color: 'rgba(255, 255, 255, 0.7)', display: 'block', marginBottom: 16 }}>Shop</Overline>
            <ul style={{ padding: 0, margin: 0 }}>
              {SHOP_LINKS.map(l => <FooterLink key={l.label} {...l} />)}
            </ul>
          </nav>

          <nav aria-label="Company">
            <Overline style={{ color: 'rgba(255, 255, 255, 0.7)', display: 'block', marginBottom: 16 }}>Company</Overline>
            <ul style={{ padding: 0, margin: 0 }}>
              {COMPANY_LINKS.map(l => <FooterLink key={l.label} {...l} />)}
            </ul>
          </nav>

          <nav aria-label="Help">
            <Overline style={{ color: 'rgba(255, 255, 255, 0.7)', display: 'block', marginBottom: 16 }}>Help</Overline>
            <ul style={{ padding: 0, margin: 0 }}>
              {HELP_LINKS.map(l => <FooterLink key={l.label} {...l} />)}
            </ul>
          </nav>

          <div>
            <Overline style={{ color: 'rgba(255, 255, 255, 0.7)', display: 'block', marginBottom: 16 }}>Newsletter</Overline>
            <p className="small-text" style={{ color: 'rgba(255, 255, 255,0.55)', marginBottom: 12 }}>Hair-care edits, restocks & subscriber-only offers — twice a month, never spammy.</p>
            <NewsletterSignup source="footer" variant="dark" />
          </div>
        </div>

        {/* Payment-method strip — UK trust pattern shoppers scan for
            before committing to a checkout. Visa / MC / Amex / PayPal /
            Apple Pay / Google Pay / Klarna in the canonical lockup. */}
        <div style={{
          marginTop: 36, paddingTop: 24, borderTop: '1px solid rgba(255, 255, 255,0.08)',
          display: 'flex', justifyContent: 'flex-start',
        }}>
          <PaymentMethodStrip />
        </div>

        <div style={{
          marginTop: 20, paddingTop: 20, borderTop: '1px solid rgba(255, 255, 255,0.05)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16,
        }}>
          <span className="small-text" style={{ color: 'rgba(255, 255, 255, 0.65)' }}>© {new Date().getFullYear()} Aizel. All rights reserved.</span>
          {socials.length > 0 && (
            <div style={{ display: 'flex', gap: 8 }} aria-label="Social media">
              {socials.map(s => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Aizel on ${s.label}`}
                  style={{
                    color: 'rgba(255, 255, 255, 0.7)',
                    textDecoration: 'none',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    fontFamily: 'var(--font-ui)',
                    // Pad to a comfortable tap target (~32+ px) and round so the
                    // hover bg (if we add one later) reads as a chip not a slab.
                    padding: '10px 12px',
                    borderRadius: 6,
                    minHeight: 36,
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--paper)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)')}
                >{s.label}</a>
              ))}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
