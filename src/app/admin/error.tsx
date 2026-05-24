'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { captureError } from '@/lib/monitoring';

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void captureError(error, { source: 'app/admin/error.tsx', digest: error.digest });
  }, [error]);

  // Never surface the raw error message to staff in production — Supabase
  // errors can include SQL text and table names that should stay internal.
  // The digest is the only thing we show; it lets us correlate against
  // Sentry / runtime logs without leaking implementation detail.
  const isDev = process.env.NODE_ENV === 'development';
  return (
    <div style={{ padding: '60px 36px', textAlign: 'center', maxWidth: 520, margin: '0 auto' }}>
      <div style={{ fontSize: '3rem', marginBottom: 16 }} aria-hidden="true">⚠</div>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>Something went wrong</h1>
      <p style={{ color: '#6b7280', margin: '0 0 12px', fontSize: '0.875rem' }}>
        {isDev
          ? (error.message || 'An unexpected error occurred.')
          : 'An unexpected error stopped this page from loading. The team has been notified — please try again.'}
      </p>
      {error.digest && (
        <p style={{ color: '#9ca3af', margin: '0 0 24px', fontSize: '0.75rem', fontFamily: 'monospace' }}>
          Reference: {error.digest}
        </p>
      )}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button onClick={reset} style={{
          padding: '10px 22px', background: '#4A1A6B', color: 'white',
          border: 'none', borderRadius: 7, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
          minHeight: 40,
        }}>
          Try again
        </button>
        <Link href="/admin/dashboard" style={{
          padding: '10px 22px', background: '#f3f4f6', color: '#374151',
          borderRadius: 7, textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500,
          display: 'inline-flex', alignItems: 'center', minHeight: 40,
        }}>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
