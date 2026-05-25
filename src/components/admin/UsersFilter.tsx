'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useRef, useTransition } from 'react';
import { SavedViewsMenu } from '@/components/admin/SavedViewsMenu';

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'recent',     label: 'Recently joined' },
  { value: 'last_order', label: 'Recent order' },
  { value: 'spent',      label: 'Top spenders' },
  { value: 'orders',     label: 'Most orders' },
  { value: 'name',       label: 'Name A–Z' },
];

export function UsersFilter({ total }: { total: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const q = params.get('q') ?? '';
  const sort = params.get('sort') ?? 'recent';

  const push = useCallback((next: URLSearchParams) => {
    startTransition(() => router.push(`/admin/users?${next.toString()}`));
  }, [router]);

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

  const setSort = (v: string) => {
    const next = new URLSearchParams(params.toString());
    if (v && v !== 'recent') { next.set('sort', v); } else { next.delete('sort'); }
    next.delete('page');
    push(next);
  };

  const clearAll = () => {
    push(new URLSearchParams());
  };

  const hasFilters = !!q || sort !== 'recent';

  const controlStyle: React.CSSProperties = {
    padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 8,
    fontSize: '0.875rem', color: '#111827', background: 'white', outline: 'none',
  };

  return (
    <div style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
      <input
        defaultValue={q}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by email, name…"
        style={{ ...controlStyle, minWidth: 240 }}
      />
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: '#6b7280' }}>
        Sort
        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          style={{ ...controlStyle, cursor: 'pointer' }}
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      {hasFilters && (
        <button onClick={clearAll} style={{
          padding: '6px 12px', border: '1px solid #e5e7eb', borderRadius: 8,
          fontSize: '0.8125rem', color: '#6b7280', background: 'white', cursor: 'pointer',
        }}>
          Clear ✕
        </button>
      )}
      {/* Saved-views (same pattern as Orders + Products). Good for
          "VIP customers", "Top spenders this quarter", etc. */}
      <SavedViewsMenu surface="customers" basePath="/admin/users" />
      <span style={{ fontSize: '0.8125rem', color: '#9ca3af', marginLeft: 'auto' }}>
        {total} customer{total !== 1 ? 's' : ''}
      </span>
    </div>
  );
}
