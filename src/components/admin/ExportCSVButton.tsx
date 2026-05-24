'use client';

import { useState } from 'react';
import { getBrowserClient } from '@/lib/supabase-browser';
import type { Order, OrderStatus } from '@/types';

function toCSV(orders: Order[]): string {
  // UK-friendly column names — was ZIP/Province (US/Canada vocabulary). The
  // VAT column reads from `tax_amount` so accountants can reconcile the
  // export against HMRC submissions without dropping into the DB.
  const headers = ['Order #', 'Date', 'Name', 'Email', 'Phone', 'City / Town', 'Country / Region', 'Postcode', 'Address', 'Payment', 'Status', 'Subtotal', 'Discount', 'Shipping', 'VAT', 'Total', 'Tracking #', 'Coupon'];
  const rows = orders.map(o => [
    o.order_number,
    o.created_at ? new Date(o.created_at).toISOString().split('T')[0] : '',
    `${o.first_name} ${o.last_name}`,
    o.email ?? '',
    o.phone,
    o.city,
    o.province ?? '',
    o.zip ?? '',
    o.address.replace(/,/g, ';'),
    o.pay_method.toUpperCase(),
    o.status ?? 'pending',
    o.subtotal,
    o.discount_amount ?? 0,
    o.shipping,
    // `tax_amount` may be missing on orders predating the VAT column; fall
    // back to 0 so the export stays a clean rectangular CSV.
    (o as Order & { tax_amount?: number }).tax_amount ?? 0,
    o.total,
    o.tracking_number ?? '',
    o.coupon_code ?? '',
  ]);
  return [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}

interface Props {
  status?: string;
  q?: string;
}

export function ExportCSVButton({ status, q }: Props) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    const sb = getBrowserClient();
    let query = sb.from('orders').select('*').order('created_at', { ascending: false });
    if (status && status !== 'all') query = query.eq('status', status as OrderStatus);
    if (q) {
      const filter = `order_number.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`;
      query = query.or(filter);
    }
    const { data } = await query;
    setLoading(false);
    if (!data || data.length === 0) return;
    const csv = toCSV(data as Order[]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      style={{
        padding: '8px 16px', background: loading ? '#f3f4f6' : 'white',
        border: '1px solid #d1d5db', borderRadius: 7,
        fontSize: '0.8125rem', fontWeight: 600, color: loading ? '#9ca3af' : '#374151',
        cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6,
        whiteSpace: 'nowrap',
      }}
    >
      {loading ? '…' : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export CSV
        </>
      )}
    </button>
  );
}
