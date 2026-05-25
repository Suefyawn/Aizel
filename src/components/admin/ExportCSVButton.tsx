'use client';

import { useState, useTransition } from 'react';
import { useToast } from '@/components/admin/Toast';
import {
  exportOrdersCsv, exportProductsCsv, exportCustomersCsv,
} from '@/app/admin/export-actions';

// Generic "Export CSV" button used at the top of /admin/orders,
// /admin/products, /admin/users. The actual query lives in a server
// action — the button just dispatches to the right one and turns the
// returned payload into a download.
//
// We do NOT route through the browser supabase client any more — orders
// and the customer RPC are both service-role-only, so the previous
// implementation silently exported 0 rows.

type Kind = 'orders' | 'products' | 'customers';

interface BaseProps { kind: Kind }
interface OrdersProps   extends BaseProps { kind: 'orders';    status?: string; q?: string }
interface ProductsProps extends BaseProps { kind: 'products';  category?: string; tag?: string; q?: string }
interface CustomerProps extends BaseProps { kind: 'customers'; q?: string }

type Props = OrdersProps | ProductsProps | CustomerProps;

export function ExportCSVButton(props: Props) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const toast = useToast();

  const handle = () => {
    startTransition(async () => {
      try {
        const payload =
          props.kind === 'orders'    ? await exportOrdersCsv({ status: props.status, q: props.q }) :
          props.kind === 'products'  ? await exportProductsCsv({ category: props.category, tag: props.tag, q: props.q }) :
          /* customers */              await exportCustomersCsv({ q: props.q });

        if (!payload.csv || payload.csv.split('\r\n').length <= 1) {
          toast('Nothing to export — no rows match the current filters', 'error');
          return;
        }
        // Prepend UTF-8 BOM so Excel opens £ + accented characters cleanly
        // without re-encoding. Google Sheets / Numbers ignore the BOM.
        const blob = new Blob(['﻿', payload.csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = payload.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Export failed', 'error');
      }
    });
  };

  return (
    <button
      onClick={handle}
      disabled={pending}
      style={{
        padding: '8px 16px',
        background: pending ? '#f3f4f6' : 'white',
        border: '1px solid #d1d5db', borderRadius: 7,
        fontSize: '0.8125rem', fontWeight: 600,
        color: pending ? '#9ca3af' : '#374151',
        cursor: pending ? 'not-allowed' : 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 6,
        whiteSpace: 'nowrap', minHeight: 36,
      }}
    >
      {pending ? (
        <>
          <style>{`@keyframes aizel-export-spin { to { transform: rotate(360deg); } }`}</style>
          <span aria-hidden="true" style={{
            width: 12, height: 12, borderRadius: '50%',
            border: '2px solid #d1d5db', borderTopColor: '#4A1A6B',
            animation: 'aizel-export-spin 0.7s linear infinite',
          }} />
          Exporting…
        </>
      ) : done ? (
        <>✓ Downloaded</>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export CSV
        </>
      )}
    </button>
  );
}
