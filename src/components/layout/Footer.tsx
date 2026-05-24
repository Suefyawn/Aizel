'use client';

import Link from 'next/link';
import { LogoMark } from '@/components/ui/LogoMark';
import { LogoWordmark } from '@/components/ui/LogoWordmark';
import { Overline } from '@/components/ui/Overline';
import { NewsletterSignup } from '@/components/marketing/NewsletterSignup';
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
  { label: 'Hair Care',    href: '/shop?taxon=hair' },
  { label: 'Body Care',    href: '/shop?taxon=body' },
  { label: 'Shop by Brand', href: '/brand' },
  { label: 'All Products', href: '/shop' },
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
      <div style={{ position: 'absolute', bottom: 20, right: 30, opacity: 0.04 }}>
        <LogoMark size={200} />
      </div>
      <div className="container">
        {/* Marquee — paused on hover + when prefers-reduced-motion is set
            (see .footer-marquee in globals.css). aria-hidden so screen
            readers don't read the scrolling text. */}
        <div
          aria-hidden="true"
          style={{ borderBottom: '1px solid rgba(255, 255, 255,0.1)', paddingBottom: 32, marginBottom: 40, overflow: 'hidden', whiteSpace: 'nowrap' }}
        >
          <div
            className="footer-marquee"
            style={{
              display: 'inline-block',
              fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontStyle: 'italic',
              color: 'rgba(255, 255, 255,0.2)',
            }}
          >
            {Array(6).fill('Aizel · Hair & Body Care · UK · ').join('')}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 40 }}>
          <div>
            <div style={{ marginBottom: 24 }}><LogoWordmark color="var(--paper)" /></div>
            <p className="small-text" style={{ color: 'rgba(255, 255, 255,0.55)', maxWidth: 260, marginBottom: 16 }}>
              Authentic Black hair and body care brands, delivered across the UK.
            </p>
            <address style={{ fontStyle: 'normal' }}>
              <p className="small-text" style={{ color: 'rgba(255, 255, 255,0.5)', fontSize: '0.75rem' }}>
                Free UK delivery on orders over £15<br />
                14-day returns · Card &amp; PayPal accepted
              </p>
            </address>
          </div>

          <nav aria-label="Shop">
            <Overline style={{ color: 'rgba(255, 255, 255,0.4)', display: 'block', marginBottom: 16 }}>Shop</Overline>
            <ul style={{ padding: 0, margin: 0 }}>
              {SHOP_LINKS.map(l => <FooterLink key={l.label} {...l} />)}
            </ul>
          </nav>

          <nav aria-label="Company">
            <Overline style={{ color: 'rgba(255, 255, 255,0.4)', display: 'block', marginBottom: 16 }}>Company</Overline>
            <ul style={{ padding: 0, margin: 0 }}>
              {COMPANY_LINKS.map(l => <FooterLink key={l.label} {...l} />)}
            </ul>
          </nav>

          <nav aria-label="Help">
            <Overline style={{ color: 'rgba(255, 255, 255,0.4)', display: 'block', marginBottom: 16 }}>Help</Overline>
            <ul style={{ padding: 0, margin: 0 }}>
              {HELP_LINKS.map(l => <FooterLink key={l.label} {...l} />)}
            </ul>
          </nav>

          <div>
            <Overline style={{ color: 'rgba(255, 255, 255,0.4)', display: 'block', marginBottom: 16 }}>Newsletter</Overline>
            <p className="small-text" style={{ color: 'rgba(255, 255, 255,0.55)', marginBottom: 12 }}>Sign up for health tips & exclusive offers.</p>
            <NewsletterSignup source="footer" variant="dark" />
          </div>
        </div>

        <div style={{
          marginTop: 48, paddingTop: 24, borderTop: '1px solid rgba(255, 255, 255,0.08)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16,
        }}>
          <span className="small-text" style={{ color: 'rgba(255, 255, 255,0.3)' }}>© {new Date().getFullYear()} Aizel. All rights reserved.</span>
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
                    color: 'rgba(255, 255, 255,0.4)',
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
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255, 255, 255,0.4)')}
                >{s.label}</a>
              ))}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
