'use client';

import { useEffect } from 'react';
import { captureError } from '@/lib/monitoring';
import { isStaleServerActionError } from '@/lib/stale-action';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const isStale = isStaleServerActionError(error);

  useEffect(() => {
    if (isStale) return;
    void captureError(error, { source: 'app/global-error.tsx', digest: error.digest });
  }, [error, isStale]);

  const refresh = () => {
    if (typeof window !== 'undefined') window.location.reload();
    else reset();
  };

  return (
    <html lang="en">
      <body style={{ fontFamily: 'sans-serif', margin: 0, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '24px' }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          {isStale ? (
            <>
              <div style={{ fontSize: '3rem', marginBottom: 12 }} aria-hidden>↻</div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', margin: '0 0 10px' }}>
                Page is out of date
              </h1>
              <p style={{ color: '#6b7280', margin: '0 0 28px', lineHeight: 1.6 }}>
                We updated the site while this tab was open. Refresh to continue.
              </p>
              <button onClick={refresh} style={{
                padding: '11px 24px', background: '#4A1A6B', color: 'white',
                border: 'none', borderRadius: 8, fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer',
              }}>
                Refresh page
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: '4rem', fontWeight: 700, color: '#6B2C91', marginBottom: 16 }}>!</div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', margin: '0 0 12px' }}>Critical error</h1>
              <p style={{ color: '#6b7280', margin: '0 0 28px' }}>The application encountered a critical error.</p>
              <button onClick={reset} style={{
                padding: '11px 24px', background: '#4A1A6B', color: 'white',
                border: 'none', borderRadius: 8, fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer',
              }}>
                Try again
              </button>
            </>
          )}
        </div>
      </body>
    </html>
  );
}
