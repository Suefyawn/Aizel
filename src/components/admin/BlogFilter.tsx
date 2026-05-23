'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useRef, useTransition } from 'react';

export function BlogFilter({ total, categories }: { total: number; categories: string[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const q = params.get('q') ?? '';
  const category = params.get('category') ?? 'All';

  const push = useCallback((next: URLSearchParams) => {
    startTransition(() => router.push(`/admin/blog?${next.toString()}`));
  }, [router]);

  const setCategory = (c: string) => {
    const next = new URLSearchParams(params.toString());
    if (c === 'All') { next.delete('category'); } else { next.set('category', c); }
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
  const hasFilters = !!q || (category !== 'All');

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
    fontSize: '0.8125rem', fontWeight: active ? 600 : 400,
    background: active ? '#111827' : '#f3f4f6',
    color: active ? 'white' : '#6b7280',
  });

  return (
    <div style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <button onClick={() => setCategory('All')} style={btnStyle(category === 'All')}>All</button>
        {categories.map(c => (
          <button key={c} onClick={() => setCategory(c)} style={btnStyle(category === c)}>{c}</button>
        ))}
      </div>
      <input
        defaultValue={q}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search posts…"
        style={{
          padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 8,
          fontSize: '0.875rem', color: '#111827', background: 'white', outline: 'none',
          minWidth: 200,
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
      <span style={{ fontSize: '0.8125rem', color: '#9ca3af', marginLeft: 'auto' }}>
        {total} post{total !== 1 ? 's' : ''}
      </span>
    </div>
  );
}
