'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAdmin } from '@/app/admin/actions';
import type { StaffSession, Permission } from '@/lib/permissions';

// `permissionsAny` = nav item visible if the session holds ANY of these perms
// (mirrors the canAny() helper). Use the array form for surfaces that can be
// granted via multiple permissions (e.g. dashboard reachable via any of three
// analytics perms). Single-permission rows use `permission` for brevity.
type NavItem = {
  href: string;
  label: string;
  icon: string;
  permission?: Permission;
  permissionsAny?: Permission[];
  ownerOnly?: boolean;
};

type NavGroup = { label: string; items: NavItem[] };

// Nav order reflects who Aizel actually is now: a single-brand UK retailer
// that runs an in-house catalogue across a website AND a brick-and-mortar
// shop. The Trade group surfaces the till and its back-office view RIGHT
// AFTER the dashboards, ahead of the e-commerce ops — because once the
// store's open, the till is what the cashier looks at most. Sell stays
// for the catalogue + online-orders work, but without the Vendors item
// (Aizel doesn't drop-ship; everything's stocked in-house).
const GROUPS: NavGroup[] = [
  { label: 'Insights', items: [
    { href: '/admin/dashboard', label: 'Dashboard', icon: '▣', permissionsAny: ['analytics','analytics_traffic','analytics_errors'] },
    { href: '/admin/analytics', label: 'Analytics', icon: '◐', permission: 'analytics' },
  ]},
  { label: 'Trade', items: [
    { href: '/admin/pos',           label: 'POS Till',       icon: '⌖', permission: 'pos.operate' },
    { href: '/admin/pos/dashboard', label: 'POS Dashboard',  icon: '◑', permission: 'pos.operate' },
  ]},
  { label: 'Sell', items: [
    { href: '/admin/orders',    label: 'Orders',    icon: '◎', permission: 'orders.view' },
    { href: '/admin/products',  label: 'Products',  icon: '◈', permission: 'products.view' },
    { href: '/admin/inventory', label: 'Inventory', icon: '⧉', permission: 'products.view' },
    { href: '/admin/returns',   label: 'Returns',   icon: '↩', permission: 'returns' },
  ]},
  { label: 'People', items: [
    { href: '/admin/users',     label: 'Customers', icon: '◉', permission: 'customers.view' },
    { href: '/admin/segments',  label: 'Segments',  icon: '◐', permission: 'customers.view' },
    { href: '/admin/coupons',   label: 'Coupons',   icon: '◇', permission: 'coupons' },
  ]},
  { label: 'Marketing', items: [
    { href: '/admin/promos',    label: 'Promos',    icon: '✧', permission: 'promos' },
    { href: '/admin/blog',      label: 'Blog',      icon: '✦', permission: 'blog' },
    { href: '/admin/reviews',   label: 'Reviews',   icon: '★', permission: 'reviews' },
    { href: '/admin/newsletter', label: 'Newsletter', icon: '✉', permission: 'newsletter' },
    { href: '/admin/marketing/blast', label: 'Email blast', icon: '⌁', permission: 'newsletter' },
    { href: '/admin/emails',    label: 'Email log', icon: '❏', permission: 'settings' },
  ]},
  { label: 'Store', items: [
    { href: '/admin/audit',     label: 'Activity log', icon: '◉', ownerOnly: true },
    { href: '/admin/team',      label: 'Team',      icon: '⬡', ownerOnly: true },
    { href: '/admin/settings',  label: 'Settings',  icon: '⚙', permission: 'settings' },
  ]},
];

function canSee(item: NavItem, session: StaffSession): boolean {
  if (item.ownerOnly) return session.isOwner;
  if (session.isOwner) return true;
  if (item.permission)     return session.permissions.includes(item.permission);
  if (item.permissionsAny) return item.permissionsAny.some(p => session.permissions.includes(p));
  return true;
}

export function AdminSidebar({ session, onClose, pendingOrderCount = 0 }: { session: StaffSession; onClose?: () => void; pendingOrderCount?: number }) {
  const pathname = usePathname();
  const visibleGroups = GROUPS
    .map(g => ({ ...g, items: g.items.filter(item => canSee(item, session)) }))
    .filter(g => g.items.length > 0);

  return (
    <aside id="admin-sidebar" style={{
      width: 240, background: '#111827', minHeight: '100vh', height: '100%',
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto',
    }}>
      {/* Brand */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid #1f2937', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.125rem', letterSpacing: '-0.02em', color: '#D4A437' }}>
            Aizel
          </div>
          <div style={{ color: '#6b7280', fontSize: '0.6875rem', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Admin Panel
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close admin menu"
            style={{
              background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer',
              fontSize: '1.25rem', lineHeight: 1,
              width: 40, height: 40, borderRadius: 8,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              marginRight: -8,
            }}
          >✕</button>
        )}
      </div>

      {/* User badge */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #1f2937', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: session.isOwner ? '#4A1A6B' : '#6366f1',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 700, fontSize: '0.8125rem', flexShrink: 0,
        }}>
          {session.name.charAt(0).toUpperCase()}
        </div>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ color: '#f9fafb', fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {session.name}
          </div>
          <div style={{ color: session.isOwner ? '#D4A437' : '#a5b4fc', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {session.isOwner ? 'Owner' : (session.roleName ?? 'Staff')}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, paddingTop: 8 }}>
        {visibleGroups.map((group, groupIdx) => (
          <div key={group.label} style={{ marginTop: groupIdx === 0 ? 0 : 12 }}>
            <div style={{
              padding: '8px 20px 4px',
              color: '#6b7280',
              fontSize: '0.6875rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              {group.label}
            </div>
            {group.items.map(({ href, label, icon }) => {
              const active = pathname === href || (href !== '/admin/dashboard' && pathname.startsWith(href));
              const isOrders = href === '/admin/orders';
              const badgeCount = isOrders && pendingOrderCount > 0 ? pendingOrderCount : 0;
              return (
                <Link key={href} href={href} onClick={onClose} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  // 44 px min tap target for mobile phones — desktop still looks
                  // tight because the font size is 0.875rem so the row reads
                  // compactly.
                  padding: '12px 20px',
                  minHeight: 44,
                  color: active ? '#f9fafb' : '#9ca3af',
                  // Active row tint + border use Aizel purple (was pink-300/400
                  // — Tailwind YellowPink-era leftovers).
                  background: active ? 'rgba(139, 92, 246, 0.12)' : 'transparent',
                  textDecoration: 'none', fontSize: '0.875rem',
                  fontWeight: active ? 600 : 400,
                  borderLeft: `3px solid ${active ? '#8B5CF6' : 'transparent'}`,
                  transition: 'all 0.15s',
                }}>
                  <span style={{ fontSize: '1rem', opacity: active ? 1 : 0.6 }}>{icon}</span>
                  <span style={{ flex: 1 }}>{label}</span>
                  {badgeCount > 0 && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      minWidth: 20, height: 20, borderRadius: '50%',
                      background: '#ef4444', color: '#ffffff',
                      fontSize: '0.7rem', fontWeight: 700, lineHeight: 1,
                      padding: '0 4px',
                    }}>
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom links — My Profile is shown to everyone (owners change
          their own password / 2FA there too). */}
      <div style={{ padding: '12px 20px 0', borderTop: '1px solid #1f2937' }}>
        <Link href="/admin/profile" style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 0', color: '#9ca3af', textDecoration: 'none',
          fontSize: '0.8125rem', borderBottom: '1px solid #1f2937', marginBottom: 8,
        }}>
          <span>⚙</span> My Profile
        </Link>
      </div>

      {/* Logout */}
      <div style={{ padding: '12px 20px 16px' }}>
        <form action={logoutAdmin}>
          <button type="submit" style={{
            width: '100%', padding: '8px 12px',
            background: 'transparent', border: '1px solid #374151', borderRadius: 6,
            color: '#9ca3af', cursor: 'pointer', fontSize: '0.8125rem',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>↩</span> Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
