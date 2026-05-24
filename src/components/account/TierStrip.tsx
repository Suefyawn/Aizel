'use client';

import { useEffect, useState } from 'react';
import { getBrowserClient } from '@/lib/supabase-browser';
import { useAuth } from '@/context/AuthContext';
import { tierFor, nextTier } from '@/lib/loyalty-tiers';
import { TierBadge } from '@/components/ui/TierBadge';

interface DeliveredOrderRow { total: number | null }

const fmtGBP = (n: number) =>
  `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Sits at the top of /account — small horizontal hero showing the
// customer's tier + spend + how far to the next level. Pulls lifetime
// spend client-side (the account page is already client-rendered) so
// it stays accurate as orders ship without any server-side wiring.
export function TierStrip() {
  const { user } = useAuth();
  const [spend, setSpend] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const sb = getBrowserClient();
    sb.from('orders')
      .select('total')
      .eq('user_id', user.id)
      .eq('status', 'delivered')
      .then(({ data }) => {
        if (cancelled) return;
        const rows = (data ?? []) as DeliveredOrderRow[];
        const sum = rows.reduce((s, r) => s + Number(r.total ?? 0), 0);
        setSpend(sum);
      });
    return () => { cancelled = true; };
  }, [user]);

  // While the query resolves, render a slim placeholder so the page
  // doesn't jump when the tier strip lands.
  if (spend === null) {
    return (
      <div style={{ ...wrapStyle, color: 'var(--ink-500)', fontSize: '0.8125rem' }}>
        Loading your tier…
      </div>
    );
  }

  const tier = tierFor(spend);
  const next = nextTier(spend);
  const progress = next ? `${fmtGBP(next.gbpRemaining)} to ${next.next.label}` : 'Top tier — thank you ❤';

  return (
    <div style={wrapStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--ink-500)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
            Your tier
          </div>
          <TierBadge tier={tier} size="lg" progress={tier.key === 'none' ? undefined : progress} />
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--ink-500)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
            Lifetime spend
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 500, color: 'var(--ink-900)' }}>
            {fmtGBP(spend)}
          </div>
        </div>
      </div>
      {next && tier.key !== 'none' && (
        // Subtle progress meter — anchors the "£X to next tier" copy
        // visually without competing with the page's primary CTAs.
        <div style={{ marginTop: 14 }}>
          <div style={{ height: 4, background: 'var(--paper2)', borderRadius: 999, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.round(((spend - (tier.minSpend || 0)) / (next.next.minSpend - (tier.minSpend || 0))) * 100)}%`,
                background: 'var(--brand-pink)',
                transition: 'width 400ms ease-out',
              }}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={next.next.minSpend}
              aria-valuenow={spend}
              aria-label={`Progress to ${next.next.label} tier`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const wrapStyle: React.CSSProperties = {
  background: 'white', borderRadius: 12,
  padding: '20px 24px', marginBottom: 24,
  border: '1px solid var(--line)',
  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
};
