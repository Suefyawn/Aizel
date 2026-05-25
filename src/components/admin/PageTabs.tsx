import Link from 'next/link';

// Shared sub-page tab strip — used at the top of pages that absorbed
// sibling features the sidebar no longer surfaces:
//
//   /admin/users        — Customers (default) + Segments
//   /admin/newsletter   — Subscribers (default) + Compose blast
//   /admin/settings     — Profile / Branding / ... + Activity log + Email log
//
// Renders as a borderless underlined tab bar — Shopify / Stripe pattern,
// readable on every viewport. Active tab gets the brand-purple underline.

export interface PageTab {
  label: string;
  href: string;
  /** Optional small count chip on the right of the label (e.g. unread). */
  count?: number;
}

export function PageTabs({ tabs, current }: {
  tabs: PageTab[];
  /** Pathname of the currently rendered page. Used to decide which tab
   *  is active without needing client-side state. */
  current: string;
}) {
  return (
    <nav
      aria-label="Section tabs"
      style={{
        display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb',
        marginBottom: 24, overflowX: 'auto',
      }}
    >
      {tabs.map(t => {
        const active = current === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            style={{
              padding: '10px 16px',
              fontSize: '0.875rem', fontWeight: 600,
              color: active ? '#4A1A6B' : '#6b7280',
              borderBottom: active ? '2px solid #4A1A6B' : '2px solid transparent',
              marginBottom: -1,
              textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
            {typeof t.count === 'number' && t.count > 0 && (
              <span style={{
                padding: '0 7px', minWidth: 18, height: 18,
                background: active ? '#4A1A6B' : '#e5e7eb',
                color: active ? 'white' : '#6b7280',
                borderRadius: 9, fontSize: '0.625rem', fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>{t.count > 99 ? '99+' : t.count}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
