export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { ManualOrderForm, type ProductOption } from '@/components/admin/ManualOrderForm';

export default async function NewOrderPage() {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('orders.edit')) {
    return <NoAccess section="Orders" />;
  }

  // Pull every published product so the picker can search the catalogue
  // without a per-keystroke round-trip. ~600 SKUs at most — fine to ship
  // to the client. The shape is trimmed to what the picker actually uses.
  const admin = supabaseAdmin();
  const { data: rows } = await admin
    .from('products')
    .select('id, brand, name, price, slug, image_url, stock, track_inventory')
    .eq('status', 'published')
    .order('name');

  const products: ProductOption[] = ((rows ?? []) as Array<{
    id: string; brand: string | null; name: string; price: number; slug: string;
    image_url: string | null; stock: number | null; track_inventory: boolean | null;
  }>).map(r => ({
    id: r.id,
    brand: r.brand,
    name: r.name,
    price: Number(r.price ?? 0),
    slug: r.slug,
    image_url: r.image_url,
    in_stock: r.track_inventory === false ? true : (r.stock ?? 0) > 0,
  }));

  return (
    <div className="adm-page" style={{ padding: '32px 36px', maxWidth: 980 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <Link href="/admin/orders" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem' }}>← Orders</Link>
        <span style={{ color: '#d1d5db' }}>/</span>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>New manual order</h1>
      </div>
      <p style={{ margin: '0 0 24px', fontSize: '0.8125rem', color: '#6b7280' }}>
        For phone orders, gifts, or vendor / store-credit issuance — anything
        that didn&apos;t come through the customer checkout but needs an order
        row so it reaches dispatch + analytics. Status starts at <strong>Pending</strong>;
        no payment is captured. Customer email is sent only when you tick the box below.
      </p>

      <ManualOrderForm products={products} />
    </div>
  );
}
