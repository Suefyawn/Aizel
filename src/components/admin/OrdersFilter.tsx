'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useRef, useTransition } from 'react';
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/types';
import { SavedViewsMenu } from '@/components/admin/SavedViewsMenu';

// Pill order + colour. Labels come from the shared ORDER_STATUS_LABELS map so
// the filter can't drift from the Orders table and the order detail page.
const STATUSES: { value: string; color?: string }[] = [
  { value: 'all' },
  { value: 'payment_pending', color: '#d97706' },
  { value: 'payment_failed',  color: '#ef4444' },
  { value: 'pending',         color: '#f59e0b' },
  { value: 'processing',      color: '#3b82f6' },
  { value: 'shipped',         color: '#8b5cf6' },
  { value: 'delivered',       color: '#10b981' },
  { value: 'cancelled',       color: '#ef4444' },
  { value: 'returned',        color: '#6b7280' },
  { value: 'refunded',        color: '#0891b2' },
];

const statusLabel = (v: string) =>
  v === 'all' ? 'All' : (ORDER_STATUS_LABELS[v as OrderStatus] ?? v);

export function OrdersFilter({ total }: { total: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const status = params.get('status') ?? 'all';
  const q = params.get('q') ?? '';

  const push = useCallback((next: URLSearchParams) => {
    startTransition(() => router.push(`/admin/orders?${next.toString()}`));
  }, [router]);

  const setStatus = (s: string) => {
    const next = new URLSearchParams(params.toString());
    if (s === 'all') { next.delete('status'); } else { next.set('status', s); }
    next.delete('page');
    push(next);
  };

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setSearch = (v: string) => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (v) { next.set('q', v); } else { next.delete('q'); }
      next.delete('page');
      push(next);
    }, 300);
  };

  const clearAll = () => push(new URLSearchParams());
  const hasFilters = status !== 'all' || !!q;

  return (
    <div style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
      <div className="adm-filter-pills" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {STATUSES.map(s => {
          const isActive = status === s.value;
          const color = s.color;
          return (
            <button key={s.value} onClick={() => setStatus(s.value)} style={{
              padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontSize: '0.8125rem', fontWeight: isActive ? 600 : 400,
              background: isActive
                ? (color ? color + '20' : '#111827')
                : '#f3f4f6',
              color: isActive ? (color ?? '#f9fafb') : '#6b7280',
              outline: isActive && color ? `2px solid ${color}` : (isActive ? '2px solid #111827' : 'none'),
              outlineOffset: -2,
            }}>
              {statusLabel(s.value)}
            </button>
          );
        })}
      </div>
      <input
        key={q}
        defaultValue={q}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search order # or customer…"
        className="adm-orders-search"
        style={{
          padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 8,
          fontSize: '0.875rem', color: '#111827', background: 'white', outline: 'none',
          minWidth: 220,
        }}
      />
      {hasFilters && (
        <button onClick={clearAll} style={{
          padding: '6px 12px', border: '1px solid #e5e7eb', borderRadius: 8,
          fontSize: '0.8125rem', color: '#6b7280', background: 'white', cursor: 'pointer',
        }}>
          Clear ✕
        </button>
      )}
      {/* Saved views — Linear / Jira pattern. Lives at the end of the
          filter row so it sits next to Clear. */}
      <SavedViewsMenu surface="orders" basePath="/admin/orders" />
      <span style={{ fontSize: '0.8125rem', color: '#9ca3af', marginLeft: 'auto' }}>
        {total} order{total !== 1 ? 's' : ''}
      </span>
    </div>
  );
}
