'use client';

import { useState, useTransition } from 'react';
import { refreshAnalytics } from '@/app/admin/dashboard/actions';

export function RefreshAnalyticsButton() {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; errors?: string[] } | null>(null);

  function handleClick() {
    setStatus(null);
    startTransition(async () => {
      const result = await refreshAnalytics();
      setStatus(result);
    });
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {status?.ok && (
        <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 500 }}>✓ Refreshed</span>
      )}
      {status && !status.ok && (
        <span style={{ fontSize: '0.75rem', color: '#ef4444', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={status.errors?.join(' · ')}>
          {status.errors?.join(' · ')}
        </span>
      )}
      <button
        disabled={isPending}
        onClick={handleClick}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 14px',
          background: isPending ? '#f3f4f6' : '#C5286A',
          color: isPending ? '#9ca3af' : 'white',
          border: 'none', borderRadius: 8,
          fontSize: '0.8125rem', fontWeight: 600,
          cursor: isPending ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s',
        }}
      >
        <span style={{ display: 'inline-block', transform: isPending ? 'rotate(360deg)' : 'none', transition: isPending ? 'transform 1s linear' : 'none' }}>↻</span>
        {isPending ? 'Refreshing…' : 'Refresh Analytics'}
      </button>
    </div>
  );
}
