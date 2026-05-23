'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { subscribeToProduct, type SubscribeResult } from '@/app/account/subscriptions/actions';
import { SUBSCRIPTION_INTERVALS } from '@/lib/subscriptions';

// Subscribe & Save opt-in — rendered on wellness PDPs only (eligibility is
// decided server-side in the product route). Creating a subscription is
// decoupled from the cart/checkout: it's a standalone "remind me to reorder"
// record, so this never touches the place_order path.

function CycleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius-card)',
  background: 'var(--paper2, #faf6ee)',
  padding: '16px 18px',
};

export function SubscribeAndSave({
  productId,
  variantId,
  productName,
}: {
  productId: string;
  variantId: string | null;
  productName: string;
}) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [state, formAction, pending] = useActionState<SubscribeResult, FormData>(
    subscribeToProduct,
    null,
  );

  const error = state && 'ok' in state && !state.ok ? state.error : null;

  if (state && 'ok' in state && state.ok) {
    return (
      <div style={cardStyle} role="status" aria-live="polite">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ color: 'var(--brand-pink-text)' }}><CycleIcon /></span>
          <strong style={{ fontSize: '0.9375rem' }}>You&apos;re subscribed</strong>
        </div>
        <p className="small-text" style={{ margin: 0, lineHeight: 1.5 }}>
          We&apos;ll remind you to reorder {productName} every {state.interval_days} days.
          Use code <strong>SUBSCRIBE10</strong> at checkout for 10% off.{' '}
          <Link href="/account/subscriptions" style={{ color: 'var(--brand-pink-text)', fontWeight: 600 }}>
            Manage subscriptions
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ color: 'var(--brand-pink-text)' }}><CycleIcon /></span>
        <strong style={{ fontSize: '0.9375rem' }}>Subscribe &amp; Save 10%</strong>
      </div>
      <p className="small-text" style={{ margin: '0 0 14px', lineHeight: 1.5 }}>
        Never run out. We&apos;ll send a reorder reminder on your schedule and you
        save 10% every time with code <strong>SUBSCRIBE10</strong>.
      </p>

      {!loading && !user ? (
        <Link
          href={`/login?next=${encodeURIComponent(pathname)}`}
          className="btn-primary"
          style={{
            display: 'block', textAlign: 'center', textDecoration: 'none',
            background: 'var(--brand-pink)',
          }}
        >
          Sign in to subscribe
        </Link>
      ) : (
        <form action={formAction}>
          <input type="hidden" name="product_id" value={productId} />
          <input type="hidden" name="variant_id" value={variantId ?? 'null'} />
          <div style={{ display: 'flex', gap: 8 }}>
            <label htmlFor="sub-interval" className="sr-only">Reorder frequency</label>
            <select
              id="sub-interval"
              name="interval_days"
              defaultValue={30}
              style={{
                flex: 1, minWidth: 0, padding: '10px 12px',
                border: '1px solid var(--line)', borderRadius: 'var(--radius-card)',
                background: '#fff', color: 'var(--ink-900)',
                fontSize: '0.8125rem', fontFamily: 'var(--font-ui)',
              }}
            >
              {SUBSCRIPTION_INTERVALS.map(d => (
                <option key={d} value={d}>Every {d} days</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={pending || loading}
              className="btn-primary"
              style={{
                background: pending || loading ? '#d1d5db' : 'var(--brand-pink)',
                cursor: pending || loading ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {pending ? 'Subscribing…' : 'Start subscription'}
            </button>
          </div>
          {error && (
            <p role="alert" style={{ margin: '8px 0 0', fontSize: '0.75rem', color: 'var(--error)' }}>
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
