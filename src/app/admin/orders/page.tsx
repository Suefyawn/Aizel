export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { OrdersFilter } from '@/components/admin/OrdersFilter';
import { OrdersTable } from '@/components/admin/OrdersTable';
import { Pagination } from '@/components/admin/Pagination';
import { ExportCSVButton } from '@/components/admin/ExportCSVButton';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import type { Order, OrderStatus } from '@/types';

const PAGE_SIZE = 25;

export default async function OrdersPage({
  // permission check happens before searchParams destructure
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...rawProps}: any) {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('orders.view')) {
    return <NoAccess section="Orders" />;
  }
  const { searchParams } = rawProps;
  return <OrdersPageInner searchParams={searchParams} />;
}

async function OrdersPageInner({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const { status, q, page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? '1', 10));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // orders RLS (migration 070) removed the anon SELECT path — the table
  // is now service-role / authenticated-self-only. Staff-cookie auth
  // doesn't go through Supabase Auth, so admin reads MUST use the
  // service-role client. The anon path returned 0 rows silently.
  const admin = supabaseAdmin();
  let countQuery = admin.from('orders').select('*', { count: 'exact', head: true });
  let dataQuery = admin.from('orders').select('*').order('created_at', { ascending: false }).range(from, to);

  if (status && status !== 'all') {
    countQuery = countQuery.eq('status', status as OrderStatus);
    dataQuery = dataQuery.eq('status', status as OrderStatus);
  }
  if (q) {
    const filter = `order_number.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`;
    countQuery = countQuery.or(filter);
    dataQuery = dataQuery.or(filter);
  }

  const [{ count: totalCount }, { data: orders }] = await Promise.all([countQuery, dataQuery]);
  const total = totalCount ?? 0;
  const list = (orders ?? []) as Order[];

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div className="adm-page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Orders</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* "+ New order" lands the operator on the manual-order form
              for phone orders, gifts, or store-credit issuance. */}
          <Link href="/admin/orders/new" style={{
            padding: '8px 16px', background: '#4A1A6B', color: 'white',
            borderRadius: 7, textDecoration: 'none',
            fontSize: '0.8125rem', fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', gap: 6,
            whiteSpace: 'nowrap',
          }}>+ New order</Link>
          <ExportCSVButton status={status} q={q} />
        </div>
      </div>

      <Suspense fallback={null}>
        <OrdersFilter total={total} />
      </Suspense>

      <div className="adm-table-scroll" style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <OrdersTable orders={list} hasFilters={Boolean(q) || (!!status && status !== 'all')} />
      </div>

      <Suspense fallback={null}>
        <Pagination total={total} pageSize={PAGE_SIZE} currentPage={page} basePath="/admin/orders" />
      </Suspense>
    </div>
  );
}
