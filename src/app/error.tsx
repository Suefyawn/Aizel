'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { captureError } from '@/lib/monitoring';
import { isStaleServerActionError } from '@/lib/stale-action';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const isStale = isStaleServerActionError(error);

  useEffect(() => {
    // Stale-tab Server Action mismatches happen after a deploy and a reload
    // fixes them — they're not real bugs. Don't pollute Sentry with them.
    if (isStale) return;
    // Fire-and-forget — captureError lazy-loads the Sentry SDK; the page
    // can still re-render before that promise settles.
    void captureError(error, { source: 'app/error.tsx', digest: error.digest });
  }, [error, isStale]);

  if (isStale) {
    return <StaleActionView reset={reset} />;
  }

  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 24px' }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '5rem', fontWeight: 500, color: 'var(--brand-pink-text)', lineHeight: 1, marginBottom: 16 }}>
          Oops
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--ink-900)', margin: '0 0 12px' }}>
          Something went wrong
        </h1>
        <p style={{ color: 'var(--ink-500)', margin: '0 0 32px', lineHeight: 1.6 }}>
          An unexpected error occurred. Our team has been notified.
          {error.digest && (
            <>
              <br />
              <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--ink-400)' }}>
                Ref: {error.digest}
              </span>
            </>
          )}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={reset} style={{
            padding: '11px 24px', background: 'var(--brand-pink-cta)', color: 'white',
            border: 'none', borderRadius: 8, fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer',
          }}>
            Try again
          </button>
          <Link href="/" style={{
            padding: '11px 24px', background: 'white', color: 'var(--ink-700)',
            border: '1px solid var(--line)', borderRadius: 8, fontSize: '0.9375rem',
            textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
          }}>
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function StaleActionView({ reset }: { reset: () => void }) {
  const refresh = () => {
    if (typeof window !== 'undefined') window.location.reload();
    else reset();
  };
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 24px' }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <div style={{ fontSize: '3rem', marginBottom: 12 }} aria-hidden>↻</div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--ink-900)', margin: '0 0 10px' }}>
          Page is out of date
        </h1>
        <p style={{ color: 'var(--ink-500)', margin: '0 0 28px', lineHeight: 1.6, fontSize: '0.9375rem' }}>
          We updated the site while this tab was open. Refresh to pick up the latest version and continue.
        </p>
        <button onClick={refresh} style={{
          padding: '11px 24px', background: 'var(--brand-pink-cta)', color: 'white',
          border: 'none', borderRadius: 8, fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer',
        }}>
          Refresh page
        </button>
      </div>
    </div>
  );
}
