'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getBrowserClient } from '@/lib/supabase-browser';
import { Skeleton } from '@/components/ui/Skeleton';
import { EARN_RULES, REASON_LABELS, nextTierTarget, tierForLifetime } from '@/lib/loyalty';
import type { LoyaltyAccount, LoyaltyLedgerEntry, Profile } from '@/types';

const lbl: React.CSSProperties = { fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' };

export default function RewardsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [account, setAccount] = useState<LoyaltyAccount | null>(null);
  const [ledger,  setLedger]  = useState<LoyaltyLedgerEntry[]>([]);
  const [copied,  setCopied]  = useState(false);

  useEffect(() => {
    if (!loading && !user) { router.replace('/login'); return; }
    if (!user) return;
    const sb = getBrowserClient();
    (async () => {
      const [{ data: prof }, { data: acct }, { data: led }] = await Promise.all([
        sb.from('profiles').select('*').eq('id', user.id).single(),
        sb.from('loyalty_accounts').select('*').eq('user_id', user.id).maybeSingle(),
        sb.from('loyalty_ledger').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
      ]);
      setProfile(prof as Profile | null);
      setAccount(acct as LoyaltyAccount | null);
      setLedger((led ?? []) as LoyaltyLedgerEntry[]);
    })();
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="container" style={{ padding: '48px var(--side)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <Skeleton height={32} width="30%" style={{ marginBottom: 32 }} />
          <Skeleton height={140} radius={16} style={{ marginBottom: 24 }} />
          <Skeleton height={120} radius={12} style={{ marginBottom: 24 }} />
          <Skeleton height={180} radius={12} style={{ marginBottom: 24 }} />
          <Skeleton height={200} radius={12} />
        </div>
      </div>
    );
  }

  const balance  = account?.points_balance ?? 0;
  const lifetime = account?.lifetime_points ?? 0;
  const tier     = tierForLifetime(lifetime);
  const next     = nextTierTarget(lifetime);

  const referralCode = profile?.referral_code ?? '—';
  const referralUrl  = typeof window !== 'undefined'
    ? `${window.location.origin}/?ref=${encodeURIComponent(referralCode)}`
    : `?ref=${encodeURIComponent(referralCode)}`;

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(referralUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    }
  };

  return (
    <div className="container" style={{ padding: '48px var(--side)' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <Link href="/account" style={{ color: 'var(--ink-500)', textDecoration: 'none', fontSize: '0.875rem' }}>← Account</Link>
          <span style={{ color: 'var(--line)' }}>/</span>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 500 }}>Rewards</h1>
        </div>

        {/* Balance hero */}
        <div style={{ padding: '32px', borderRadius: 16, background: 'linear-gradient(135deg, var(--brand-pink), var(--brand-yellow))', color: 'white', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your balance</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 700, lineHeight: 1, marginTop: 4 }}>
                {balance.toLocaleString()} <span style={{ fontSize: '1.125rem', fontWeight: 500 }}>points</span>
              </div>
              <div style={{ fontSize: '0.8125rem', marginTop: 6, opacity: 0.85 }}>
                Worth approximately £{balance.toLocaleString()} at checkout.
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tier</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: 4 }}>{tier}</div>
              {next.next && (
                <div style={{ fontSize: '0.75rem', marginTop: 4, opacity: 0.85 }}>
                  {next.needed.toLocaleString()} pts to {next.next}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Referral */}
        <div style={{ padding: 24, background: 'white', borderRadius: 12, border: '1px solid var(--line)', marginBottom: 24 }}>
          <h2 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 700 }}>Refer friends, earn 500 pts each</h2>
          <p style={{ margin: '0 0 16px', color: 'var(--ink-700)', fontSize: '0.875rem' }}>
            Share your code with a friend. They get 10% off their first order; you get 500 points when it&apos;s delivered.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'var(--paper2)', borderRadius: 8, border: '1px solid var(--line)' }}>
            <div style={{ flex: 1, fontFamily: 'monospace', fontWeight: 700, color: 'var(--ink-900)' }}>{referralCode}</div>
            <button onClick={handleCopy} style={{
              padding: '6px 14px', background: copied ? '#16a34a' : 'var(--ink-900)',
              color: 'white', border: 'none', borderRadius: 6,
              fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
            }}>
              {copied ? 'Copied ✓' : 'Copy link'}
            </button>
          </div>
          <p style={{ margin: '8px 0 0', fontSize: '0.6875rem', color: 'var(--ink-500)' }}>
            Share link: {referralUrl}
          </p>
        </div>

        {/* Earn rules */}
        <div style={{ padding: 24, background: 'white', borderRadius: 12, border: '1px solid var(--line)', marginBottom: 24 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 700 }}>How to earn</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {EARN_RULES.map(r => (
              <div key={r.reason} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--ink-700)' }}>{r.description}</span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--brand-pink-text)', whiteSpace: 'nowrap' }}>{r.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* History */}
        <div style={{ padding: 24, background: 'white', borderRadius: 12, border: '1px solid var(--line)', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Recent activity</h2>
            <div style={lbl}>Lifetime: {lifetime.toLocaleString()} pts</div>
          </div>
          {ledger.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--ink-500)' }}>No points activity yet. Place an order to start earning.</p>
          ) : (
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: 380, borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  <th style={{ textAlign: 'left',  padding: '6px 0', color: '#6b7280', fontWeight: 600 }}>Reason</th>
                  <th style={{ textAlign: 'right', padding: '6px 0', color: '#6b7280', fontWeight: 600 }}>Points</th>
                  <th style={{ textAlign: 'right', padding: '6px 0', color: '#6b7280', fontWeight: 600 }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map(l => (
                  <tr key={l.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px 0', color: 'var(--ink-900)' }}>{REASON_LABELS[l.reason] ?? l.reason}{l.note ? ` — ${l.note}` : ''}</td>
                    <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600, color: l.delta > 0 ? '#15803d' : '#dc2626' }}>
                      {l.delta > 0 ? '+' : ''}{l.delta}
                    </td>
                    <td style={{ padding: '8px 0', textAlign: 'right', color: 'var(--ink-500)', fontSize: '0.75rem' }}>
                      {new Date(l.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
