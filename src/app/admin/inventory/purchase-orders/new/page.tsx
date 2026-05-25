export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { NewPurchaseOrderForm } from '@/components/admin/NewPurchaseOrderForm';

export default async function NewPurchaseOrderPage() {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('products.edit')) {
    return <NoAccess section="Inventory" />;
  }

  const admin = supabaseAdmin();
  const { data: rows } = await admin
    .from('products')
    .select('id, brand, name, stock, track_inventory, vendor_cost, sku, barcode')
    .eq('track_inventory', true)
    .order('name');

  const products = ((rows ?? []) as Array<{
    id: string; brand: string | null; name: string; stock: number;
    track_inventory: boolean | null; vendor_cost: number | null;
    sku: string | null; barcode: string | null;
  }>).map(r => ({
    id: r.id,
    brand: r.brand,
    name: r.name,
    stock: r.stock,
    default_cost: r.vendor_cost,
    sku: r.sku,
    barcode: r.barcode,
  }));

  return (
    <div className="adm-page" style={{ padding: '32px 36px', maxWidth: 960 }}>
      <div className="adm-page-header" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
        <Link href="/admin/inventory/purchase-orders" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem' }}>← Purchase orders</Link>
        <span style={{ color: '#d1d5db' }}>/</span>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>New purchase order</h1>
      </div>
      <p style={{ margin: '0 0 24px', fontSize: '0.8125rem', color: '#6b7280' }}>
        Log incoming stock. Cost per unit is optional — fill it if you want the margin reporting to stay accurate.
      </p>
      <NewPurchaseOrderForm products={products} />
    </div>
  );
}
