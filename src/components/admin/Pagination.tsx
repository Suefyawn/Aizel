'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface Props {
  total: number;
  pageSize: number;
  currentPage: number;
  basePath: string;
}

export function Pagination({ total, pageSize, currentPage, basePath }: Props) {
  const params = useSearchParams();
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const pageUrl = (p: number) => {
    const next = new URLSearchParams(params.toString());
    if (p === 1) { next.delete('page'); } else { next.set('page', String(p)); }
    const qs = next.toString();
    return `${basePath}${qs ? `?${qs}` : ''}`;
  };

  const pages: (number | '…')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push('…');
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push('…');
    pages.push(totalPages);
  }

  const btn: React.CSSProperties = {
    padding: '6px 11px', borderRadius: 6, border: '1px solid #e5e7eb',
    fontSize: '0.8125rem', fontWeight: 500, textDecoration: 'none',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 34,
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '20px 0 4px' }}>
      {currentPage > 1 ? (
        <Link href={pageUrl(currentPage - 1)} style={{ ...btn, background: 'white', color: '#374151' }}>‹</Link>
      ) : (
        <span style={{ ...btn, background: '#f9fafb', color: '#d1d5db', cursor: 'not-allowed' }}>‹</span>
      )}

      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`ellipsis-${i}`} style={{ ...btn, border: 'none', color: '#9ca3af', cursor: 'default' }}>…</span>
        ) : (
          <Link key={p} href={pageUrl(p as number)} style={{
            ...btn,
            background: p === currentPage ? '#C5286A' : 'white',
            color: p === currentPage ? 'white' : '#374151',
            borderColor: p === currentPage ? '#C5286A' : '#e5e7eb',
          }}>{p}</Link>
        )
      )}

      {currentPage < totalPages ? (
        <Link href={pageUrl(currentPage + 1)} style={{ ...btn, background: 'white', color: '#374151' }}>›</Link>
      ) : (
        <span style={{ ...btn, background: '#f9fafb', color: '#d1d5db', cursor: 'not-allowed' }}>›</span>
      )}

      <span style={{ marginLeft: 12, fontSize: '0.8125rem', color: '#9ca3af' }}>
        Page {currentPage} of {totalPages}
      </span>
    </div>
  );
}
