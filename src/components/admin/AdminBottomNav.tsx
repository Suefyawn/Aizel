'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { StaffSession, Permission } from '@/lib/permissions';

// Mobile-only bottom navigation bar — the 4 most-used admin destinations
// plus a "More" button that opens the full sidebar drawer. Hidden on
// desktop (the permanent sidebar covers navigation there).
interface NavSlot {
  href: string;
  label: string;
  icon: string;
  permission?: Permission;
}

const SLOTS: NavSlot[] = [
  { href: '/admin/dashboard', label: 'Home',     icon: '▣' },
  { href: '/admin/orders',    label: 'Orders',   icon: '◎', permission: 'orders.view' },
  { href: '/admin/products',  label: 'Products', icon: '◈', permission: 'products.view' },
  { href: '/admin/inventory', label: 'Stock',    icon: '⧉', permission: 'products.view' },
];

export function AdminBottomNav({
  session,
  pendingOrderCount = 0,
  onMore,
}: {
  session: StaffSession;
  pendingOrderCount?: number;
  onMore: () => void;
}) {
  const pathname = usePathname();
  const slots = SLOTS.filter(
    s => !s.permission || session.isOwner || session.permissions.includes(s.permission),
  );

  return (
    <nav className="adm-bottom-nav" aria-label="Admin quick navigation">
      {slots.map(s => {
        const active = pathname === s.href
          || (s.href !== '/admin/dashboard' && pathname.startsWith(s.href));
        const badge = s.href === '/admin/orders' ? pendingOrderCount : 0;
        return (
          <Link
            key={s.href}
            href={s.href}
            className={`adm-bottom-nav-item${active ? ' active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <span className="adm-bottom-nav-icon" aria-hidden="true">
              {s.icon}
              {badge > 0 && (
                <span className="adm-bottom-nav-badge">{badge > 99 ? '99+' : badge}</span>
              )}
            </span>
            <span>{s.label}</span>
          </Link>
        );
      })}
      <button type="button" onClick={onMore} className="adm-bottom-nav-item" aria-label="More menu">
        <span className="adm-bottom-nav-icon" aria-hidden="true">☰</span>
        <span>More</span>
      </button>
    </nav>
  );
}
