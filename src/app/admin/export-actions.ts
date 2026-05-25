'use server';

import { supabaseAdmin } from '@/lib/supabase';
import { assertPermission } from '@/lib/admin-auth';
import { buildCsv } from '@/lib/csv';
import type { Order, OrderStatus, Product, AdminUser } from '@/types';

// Server-side CSV builders. Browser-side queries used to do this, but
// `orders` and `auth.users` are both RLS-locked to the service role —
// staff-cookie auth doesn't go through Supabase Auth so the anon path
// silently returned 0 rows. Routing through a server action means each
// export checks the matching admin permission and reads via the service
// client.
//
// We bake the CSV string here and ship it back to the client; the browser
// then turns it into a Blob and downloads. The alternative (streaming a
// Response) would scale further but our tables cap at the low thousands,
// so an in-memory build is simpler and saves a route handler.

type CsvPayload = { csv: string; filename: string };

const todayStamp = () => new Date().toISOString().slice(0, 10);

// ────────── Orders ──────────
export async function exportOrdersCsv({ status, q }: { status?: string; q?: string }): Promise<CsvPayload> {
  await assertPermission('orders.view');
  const admin = supabaseAdmin();
  let query = admin.from('orders').select('*').order('created_at', { ascending: false });
  if (status && status !== 'all') query = query.eq('status', status as OrderStatus);
  if (q) {
    query = query.or(`order_number.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`);
  }
  const { data } = await query;
  const orders = (data ?? []) as (Order & { tax_amount?: number })[];

  const headers = [
    'Order #', 'Date', 'Name', 'Email', 'Phone',
    'City / Town', 'Country / Region', 'Postcode', 'Address',
    'Payment', 'Status', 'Subtotal', 'Discount', 'Shipping', 'VAT', 'Total',
    'Tracking #', 'Coupon',
  ];
  const rows = orders.map(o => [
    o.order_number,
    o.created_at ? new Date(o.created_at).toISOString().slice(0, 10) : '',
    `${o.first_name} ${o.last_name}`.trim(),
    o.email ?? '',
    o.phone,
    o.city,
    o.province ?? '',
    o.zip ?? '',
    // Commas inside the address are fine — buildCsv quotes the whole cell.
    o.address,
    o.pay_method.toUpperCase(),
    o.status ?? 'pending',
    o.subtotal,
    o.discount_amount ?? 0,
    o.shipping,
    o.tax_amount ?? 0,
    o.total,
    o.tracking_number ?? '',
    o.coupon_code ?? '',
  ]);
  return { csv: buildCsv(headers, rows), filename: `orders-${todayStamp()}.csv` };
}

// ────────── Products ──────────
export async function exportProductsCsv({
  category, tag, q,
}: { category?: string; tag?: string; q?: string }): Promise<CsvPayload> {
  await assertPermission('products.view');
  const admin = supabaseAdmin();
  let query = admin.from('products').select('*').order('created_at', { ascending: false });
  if (category && category !== 'All') query = query.eq('category', category);
  if (tag && tag !== 'All') query = query.eq('tag', tag);
  if (q) query = query.or(`name.ilike.%${q}%,brand.ilike.%${q}%`);
  const { data } = await query;
  const products = (data ?? []) as Product[];

  const headers = [
    'ID', 'SKU', 'Barcode', 'Brand', 'Name', 'Variant', 'Category', 'Subcategory',
    'Price', 'Original price', 'Cost', 'Stock', 'Re-order point', 'Status',
    'Track inventory', 'Tag', 'Weight (g)', 'Created',
  ];
  const rows = products.map(p => [
    p.id,
    p.sku ?? '',
    p.barcode ?? '',
    p.brand ?? '',
    p.name,
    p.variant ?? '',
    p.category,
    p.subcategory ?? '',
    p.price,
    p.original_price ?? '',
    p.vendor_cost ?? '',
    p.stock,
    p.reorder_point ?? '',
    p.status ?? 'published',
    // Default for track_inventory is true (managed in-house). Spell it out.
    p.track_inventory === false ? 'no' : 'yes',
    p.tag ?? '',
    p.weight_grams ?? '',
    p.created_at ? new Date(p.created_at).toISOString().slice(0, 10) : '',
  ]);
  return { csv: buildCsv(headers, rows), filename: `products-${todayStamp()}.csv` };
}

// ────────── Customers ──────────
// Uses the same `get_admin_users` SECURITY DEFINER RPC the customers page
// hits — keeps the export and the on-screen list in lockstep. We hydrate
// the order aggregates from get_customer_order_stats so the CSV mirrors
// the UI columns exactly.
interface CustomerStatRow {
  user_id: string;
  order_count: number | string;
  total_spent: number | string;
  last_order_at: string | null;
}

export async function exportCustomersCsv({ q }: { q?: string }): Promise<CsvPayload> {
  await assertPermission('customers.view');
  const admin = supabaseAdmin();
  const [{ data: users }, { data: stats }] = await Promise.all([
    admin.rpc('get_admin_users' as never),
    admin.rpc('get_customer_order_stats' as never),
  ]);
  const statById = new Map<string, CustomerStatRow>();
  for (const st of (stats ?? []) as CustomerStatRow[]) statById.set(st.user_id, st);

  let list = (users ?? []) as AdminUser[];
  if (q) {
    const lower = q.toLowerCase();
    list = list.filter(u =>
      u.email?.toLowerCase().includes(lower) ||
      u.first_name?.toLowerCase().includes(lower) ||
      u.last_name?.toLowerCase().includes(lower),
    );
  }

  const headers = ['ID', 'Email', 'First name', 'Last name', 'Phone', 'Orders', 'Total spent (£)', 'Last order', 'Joined'];
  const rows = list.map(u => {
    const st = statById.get(u.id);
    return [
      u.id,
      u.email,
      u.first_name ?? '',
      u.last_name ?? '',
      u.phone ?? '',
      st ? Number(st.order_count) : 0,
      st ? Number(st.total_spent) : 0,
      st?.last_order_at ? new Date(st.last_order_at).toISOString().slice(0, 10) : '',
      new Date(u.created_at).toISOString().slice(0, 10),
    ];
  });
  return { csv: buildCsv(headers, rows), filename: `customers-${todayStamp()}.csv` };
}
