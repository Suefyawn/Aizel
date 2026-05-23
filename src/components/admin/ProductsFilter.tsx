'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useRef, useTransition } from 'react';

const CATEGORIES = ['All', 'Hair Care', 'Body Care', 'Styling & Tools', 'Grooming'];
const TAGS = ['All', 'New', 'Sale', 'Bestseller', 'Featured', 'Limited'];
const SORTS: { value: string; label: string }[] = [
  { value: 'newest',     label: 'Newest first' },
  { value: 'name',       label: 'Name A–Z' },
  { value: 'price_high', label: 'Price: high to low' },
  { value: 'price_low',  label: 'Price: low to high' },
  { value: 'stock_low',  label: 'Stock: low to high' },
  { value: 'stock_high', label: 'Stock: high to low' },
];

export function ProductsFilter({ total }: { total: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const category = params.get('category') ?? 'All';
  const tag = params.get('tag') ?? 'All';
  const q = params.get('q') ?? '';
  const sort = params.get('sort') ?? 'newest';

  const push = useCallback((next: URLSearchParams) => {
    startTransition(() => router.push(`/admin/products?${next.toString()}`));
  }, [router]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value === 'All') { next.delete(key); } else { next.set(key, value); }
    next.delete('page');
    push(next);
  };

  const setSort = (value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value === 'newest') { next.delete('sort'); } else { next.set('sort', value); }
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
  const hasFilters = category !== 'All' || tag !== 'All' || !!q;

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
    fontSize: '0.8125rem', fontWeight: active ? 600 : 400,
    background: active ? '#111827' : '#f3f4f6',
    color: active ? 'white' : '#6b7280',
  });

  return (
    <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <div className="adm-filter-pills" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setParam('category', c)} style={btnStyle(category === c)}>{c}</button>
          ))}
        </div>
        <div className="adm-filter-pills" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {TAGS.map(t => (
            <button key={t} onClick={() => setParam('tag', t)} style={btnStyle(tag === t)}>{t}</button>
          ))}
        </div>
        <input
          key={q}
          defaultValue={q}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search brand or name…"
          style={{
            padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 8,
            fontSize: '0.875rem', color: '#111827', background: 'white', outline: 'none', minWidth: 200,
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
        <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: '#6b7280' }}>
          Sort
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            style={{
              padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 8,
              fontSize: '0.8125rem', color: '#111827', background: 'white', cursor: 'pointer',
            }}
          >
            {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <span style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>
          {total} product{total !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}
