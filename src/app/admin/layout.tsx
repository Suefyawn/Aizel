import { headers } from 'next/headers';
import { getStaffSession } from '@/lib/staff-auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { ToastProvider } from '@/components/admin/Toast';
import { supabaseAdmin } from '@/lib/supabase';
import { can, type Permission } from '@/lib/permissions';

// Routes that opt OUT of the standard AdminShell (sidebar + topbar +
// bottom nav). Each entry is an exact match — child paths still get
// the shell unless added here. The POS till is the only one today;
// the back-office POS dashboard at /admin/pos/dashboard stays inside
// the standard shell so the operator can flip between it and the
// Orders / Inventory / etc views without losing chrome.
const SHELL_OPT_OUT = new Set<string>([
  '/admin/pos',
]);

interface NotificationRow {
  id: string; kind: string; title: string; body: string | null;
  link: string | null; read: boolean; created_at: string;
}

// Notification kinds are filtered against the viewer's permissions so a
// marketer doesn't see Sentry stack-trace alerts, an inventory manager
// doesn't see customer-PII pings, etc. Owners see everything.
//
// `null` means anyone can see this kind.
const KIND_PERMISSION: Record<string, Permission | null> = {
  new_order:      'orders.view',
  low_stock:      'products.view',
  payment_failed: 'orders.view',
  return_request: 'returns',
  new_review:     'reviews',
  staff_added:    null,           // visible to all signed-in staff
  sentry_issue:   'analytics_errors',
  posthog_spike:  'analytics_traffic',
  posthog_drop:   'analytics_traffic',
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getStaffSession();

  // Pathname comes from middleware (src/middleware.ts sets x-pathname).
  // Shell-opt-out routes render their children raw — they own their own
  // full-screen chrome (currently only the POS till).
  const pathname = (await headers()).get('x-pathname') ?? '';
  if (session && SHELL_OPT_OUT.has(pathname)) {
    return <ToastProvider>{children}</ToastProvider>;
  }

  if (!session) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f0f1a 0%, #1a0a2e 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {children}
      </div>
    );
  }

  // orders + admin_notifications are RLS-locked with no anon SELECT —
  // staff-cookie auth doesn't go through Supabase Auth, so the public
  // client returns 0 rows. The badge count and notification feed need
  // the service role.
  const admin = supabaseAdmin();
  const [{ count: pendingOrderCount }, { data: rawNotifications }] = await Promise.all([
    // Orders still needing fulfilment — pending OR processing. Matches the
    // Dashboard's "Orders to fulfill" KPI so the two numbers agree.
    admin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'processing']),
    admin
      .from('admin_notifications')
      .select('id, kind, title, body, link, read, created_at')
      .order('created_at', { ascending: false })
      .limit(60),
  ]);

  // Per-viewer notification filter. Owners see everything; managers only see
  // kinds whose KIND_PERMISSION entry they hold (or the kind has no perm
  // requirement). We over-fetch 60 then trim so a low-perm user still gets
  // their ~30 most recent relevant ones.
  const allNotifications = (rawNotifications ?? []) as NotificationRow[];
  const notifications = allNotifications
    .filter(n => {
      const required = KIND_PERMISSION[n.kind];
      if (required === undefined) return true;     // unknown kind — let it through
      if (required === null)      return true;
      return can(session, required);
    })
    .slice(0, 30);

  return (
    <ToastProvider>
      <AdminShell
        session={session}
        pendingOrderCount={pendingOrderCount ?? 0}
        notifications={notifications}
      >
        {children}
      </AdminShell>
    </ToastProvider>
  );
}
