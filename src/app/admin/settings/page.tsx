import Link from 'next/link';

// /admin/settings landing page. Was a redirect to /admin/settings/profile,
// which made the URL flicker and gave the operator no sense of what
// else lives in here. Now: a card index of every settings sub-page,
// each with a one-line description of what it controls.

interface SettingsCard {
  href:  string;
  title: string;
  desc:  string;
  icon:  string;
}

const CARDS: SettingsCard[] = [
  { href: '/admin/settings/profile',       icon: '👤', title: 'Profile & password',  desc: 'Your name, email, password, two-factor authentication.' },
  { href: '/admin/settings/branding',      icon: '🎨', title: 'Branding',            desc: 'Storefront colour palette, logo, favicon.' },
  { href: '/admin/settings/homepage',      icon: '🏠', title: 'Homepage',            desc: 'Hero headline, sub-line, trust strip copy.' },
  { href: '/admin/settings/shipping',      icon: '📦', title: 'Shipping',            desc: 'Couriers, zones, free-delivery threshold, weights.' },
  { href: '/admin/settings/payments',      icon: '💳', title: 'Payments',            desc: 'Which payment methods appear at checkout.' },
  { href: '/admin/settings/receipts',      icon: '🧾', title: 'Receipts',            desc: 'Header tagline, footer message, return policy, VAT details.' },
  { href: '/admin/settings/loyalty',       icon: '⭐', title: 'Loyalty',             desc: 'Tier thresholds (Bronze → Platinum) and rewards copy.' },
  { href: '/admin/settings/integrations',  icon: '🔌', title: 'Integrations',        desc: 'WhatsApp, Stripe, Twilio, Klarna, GA4, Plausible, Sentry.' },
  { href: '/admin/settings/notifications', icon: '🔔', title: 'Notifications',       desc: 'Who gets emailed for new orders, low stock, payment failures.' },
  // Audit / debug surfaces — these are full pages elsewhere but they're
  // checked weekly at most, so they live here rather than in the sidebar.
  { href: '/admin/audit',                  icon: '📋', title: 'Activity log',        desc: 'Who did what, when — staff sign-ins, edits, deletes.' },
  { href: '/admin/emails',                 icon: '✉️', title: 'Email log',           desc: 'Every transactional + marketing email Aizel sent.' },
];

export default function SettingsIndex() {
  return (
    <div>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Settings</h1>
      <p style={{ margin: '0 0 24px', fontSize: '0.8125rem', color: '#6b7280' }}>
        Store-wide configuration. Each section is owner-only unless you&apos;ve granted a staff member the matching permission.
      </p>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 14,
      }}>
        {CARDS.map(c => (
          <Link
            key={c.href}
            href={c.href}
            className="kpi-card"
            style={{
              background: 'white', borderRadius: 10, padding: '20px 22px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              border: '1px solid transparent',
              textDecoration: 'none', color: 'inherit',
              display: 'flex', flexDirection: 'column', gap: 8, minHeight: 120,
              transition: 'box-shadow 150ms ease-out, transform 150ms ease-out',
            }}
          >
            <span style={{ fontSize: '1.5rem' }} aria-hidden="true">{c.icon}</span>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#111827' }}>{c.title}</div>
            <div style={{ fontSize: '0.8125rem', color: '#6b7280', lineHeight: 1.45 }}>{c.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
