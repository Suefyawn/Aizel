'use client';

import Link from 'next/link';

// Mobile-only floating action button for a page's primary "create" action,
// so it's always one tap away without scrolling back to the top of the page.
// Hidden on desktop, where the top-of-page button is always visible.
export function AdminFab({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="adm-fab" aria-label={label} title={label}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </Link>
  );
}
