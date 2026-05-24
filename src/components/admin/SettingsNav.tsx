'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Left-rail navigation for the Settings sub-pages. Stays in sync with the
// route via usePathname so the active item is always highlighted; on small
// screens the rail collapses to a horizontal scroller above the content.

type Item = { href: string; label: string; desc?: string };

const ITEMS: Item[] = [
  { href: '/admin/settings/profile',       label: 'Store profile',   desc: 'Name, contact, social' },
  { href: '/admin/settings/branding',      label: 'Branding & theme', desc: 'Colours, seasonal' },
  { href: '/admin/settings/homepage',      label: 'Homepage',         desc: 'Hero, sale, banner' },
  { href: '/admin/settings/shipping',      label: 'Shipping & tax',   desc: 'Rates, thresholds' },
  { href: '/admin/settings/payments',      label: 'Payments',         desc: 'Methods, bank accounts' },
  { href: '/admin/settings/loyalty',       label: 'Loyalty',          desc: 'Points & rewards' },
  { href: '/admin/settings/notifications', label: 'Notifications',    desc: 'Staff alerts' },
  { href: '/admin/settings/integrations',  label: 'Integrations',     desc: 'GA4, Sentry, email' },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <aside className="adm-settings-nav" style={{
      width: 220, flexShrink: 0, paddingRight: 16,
    }}>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {ITEMS.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className="adm-settings-nav-link"
              style={{
                display: 'block', padding: '10px 12px', borderRadius: 8,
                background: active ? '#fdf2f8' : 'transparent',
                color: active ? '#111827' : '#374151',
                textDecoration: 'none',
                borderLeft: `3px solid ${active ? '#4A1A6B' : 'transparent'}`,
                transition: 'background 0.15s',
              }}
            >
              <div style={{ fontSize: '0.875rem', fontWeight: active ? 600 : 500 }}>{item.label}</div>
              {item.desc && (
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2 }}>{item.desc}</div>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
