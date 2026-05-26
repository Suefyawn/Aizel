'use server';

import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';

// Live search backend for the ⌘K command palette. Three categories,
// fired in parallel — each capped at 5 results so the palette stays
// scannable:
//
//   Products — name / brand / SKU / barcode ilike
//   Orders   — order number exact-ish (top of order_number)
//   Customers — name / email / phone ilike
//
// Permission-gated: each category is only returned if the staff has
// view rights for that surface. An owner sees everything.

export interface CommandSearchResult {
  kind: 'product' | 'order' | 'customer';
  id:    string;
  title: string;
  subtitle?: string;
  href:  string;
}

export async function searchCommandPalette(q: string): Promise<CommandSearchResult[]> {
  const session = await getStaffSession();
  if (!session) return [];
  const trimmed = q.trim();
  if (trimmed.length < 2) return [];

  const admin = supabaseAdmin();
  const like = `%${trimmed.replace(/[%_]/g, '\\$&')}%`;

  const canProducts  = session.isOwner || session.permissions.includes('products.view');
  const canOrders    = session.isOwner || session.permissions.includes('orders.view');
  const canCustomers = session.isOwner || session.permissions.includes('customers.view');

  const queries: Promise<CommandSearchResult[]>[] = [];

  if (canProducts) {
    queries.push((async () => {
      const { data } = await admin
        .from('products')
        .select('id, brand, name, sku, barcode')
        .or(`name.ilike.${like},brand.ilike.${like},sku.ilike.${like},barcode.ilike.${like}`)
        .limit(5);
      return ((data ?? []) as Array<{ id: string; brand: string | null; name: string; sku: string | null; barcode: string | null }>)
        .map(p => ({
          kind: 'product' as const,
          id: p.id,
          title: p.brand ? `${p.brand} — ${p.name}` : p.name,
          subtitle: p.sku ? `SKU ${p.sku}` : (p.barcode ?? undefined),
          href: `/admin/products/${p.id}`,
        }));
    })());
  }

  if (canOrders) {
    queries.push((async () => {
      // Order numbers are short codes — match on prefix + ilike for partials.
      const upper = trimmed.toUpperCase();
      const { data } = await admin
        .from('orders')
        .select('id, order_number, first_name, last_name, total, status')
        .or(`order_number.ilike.${upper}%,order_number.ilike.%${upper}%`)
        .order('created_at', { ascending: false })
        .limit(5);
      return ((data ?? []) as Array<{ id: string; order_number: string; first_name: string | null; last_name: string | null; total: number; status: string }>)
        .map(o => ({
          kind: 'order' as const,
          id: o.id,
          title: o.order_number,
          subtitle: `${[o.first_name, o.last_name].filter(Boolean).join(' ') || 'Counter sale'} · £${Number(o.total).toFixed(2)} · ${o.status}`,
          href: `/admin/orders/${o.id}`,
        }));
    })());
  }

  if (canCustomers) {
    queries.push((async () => {
      // profiles has no email column — email is owned by auth.users. We
      // search by name + phone (the two PII fields the profile actually
      // owns); email-based search lives on the admin users page itself,
      // which can call a service-role join against auth.users. The
      // command palette stays narrow and fast.
      const { data } = await admin
        .from('profiles')
        .select('id, first_name, last_name, phone')
        .or(`first_name.ilike.${like},last_name.ilike.${like},phone.ilike.${like}`)
        .limit(5);
      return ((data ?? []) as Array<{ id: string; first_name: string | null; last_name: string | null; phone: string | null }>)
        .map(c => ({
          kind: 'customer' as const,
          id: c.id,
          title: [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Customer',
          subtitle: c.phone ?? '',
          href: `/admin/users/${c.id}`,
        }));
    })());
  }

  const batches = await Promise.all(queries);
  return batches.flat();
}
