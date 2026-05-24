export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { PosTerminal, type PosProduct, type PosSession } from '@/components/pos/PosTerminal';

export default async function PosPage() {
  // Permission gate first — POS is sensitive (cash + payments) so we
  // bounce non-permitted staff back to the admin dashboard rather than
  // showing a "no access" splash inside the dark POS layout.
  const session = await getStaffSession();
  if (!session) redirect('/login?next=/admin/pos');
  if (!session.isOwner && !session.permissions.includes('pos.operate')) {
    redirect('/admin/dashboard');
  }

  const admin = supabaseAdmin();

  // Catalogue — every published product the cashier can ring up. We
  // pull once on the server, ship to the client; the picker filters
  // client-side without a per-keystroke round-trip. 600 SKUs is the
  // expected ceiling; the payload weighs ~150 KB gzipped which is
  // fine for a terminal that loads once per shift.
  const { data: productRows } = await admin
    .from('products')
    .select('id, brand, name, price, slug, image_url, stock, track_inventory, sku, barcode, variant')
    .eq('status', 'published')
    .order('name');

  const products: PosProduct[] = ((productRows ?? []) as Array<{
    id: string; brand: string | null; name: string; price: number; slug: string;
    image_url: string | null; stock: number | null; track_inventory: boolean | null;
    sku: string | null; barcode: string | null; variant: string | null;
  }>).map(r => ({
    id: r.id,
    brand: r.brand,
    name: r.name,
    price: Number(r.price ?? 0),
    slug: r.slug,
    image_url: r.image_url,
    in_stock: r.track_inventory === false ? true : (r.stock ?? 0) > 0,
    stock: r.track_inventory === false ? null : (r.stock ?? 0),
    sku: r.sku,
    barcode: r.barcode,
    variant: r.variant,
  }));

  // Open shift (if any) — the cashier's till. There can only be one open
  // shift per staff at a time (the open-shift form enforces this).
  const { data: openSession } = await admin
    .from('pos_sessions')
    .select('id, opening_float, opened_at')
    .eq('status', 'open')
    .eq('staff_id', session.id)
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; opening_float: number; opened_at: string }>();

  const activeSession: PosSession | null = openSession ? {
    id: openSession.id,
    opening_float: Number(openSession.opening_float),
    opened_at: openSession.opened_at,
  } : null;

  // The till uses its own dark, full-screen chrome — wrap inline rather
  // than via a layout file because the layout would also wrap the
  // back-office /admin/pos/dashboard route, which wants the standard
  // admin sidebar.
  return (
    <div style={{ minHeight: '100vh', background: '#0F0F10', color: '#F5F5F7', fontFamily: 'var(--font-ui)' }}>
      <PosTerminal
        products={products}
        cashier={{ id: session.id, name: session.name }}
        session={activeSession}
      />
    </div>
  );
}
