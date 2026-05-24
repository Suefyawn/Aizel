'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Skeleton } from '@/components/ui/Skeleton';
import { TierStrip } from '@/components/account/TierStrip';

export default function AccountPage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="container" style={{ padding: '48px var(--side)' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <Skeleton height={40} width="50%" style={{ marginBottom: 8 }} />
          <Skeleton height={16} width="35%" style={{ marginBottom: 40 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
            {[0, 1, 2, 3].map(i => (
              <Skeleton key={i} height={130} radius={12} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  return (
    <div className="container" style={{ padding: '48px var(--side)' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 500, margin: '0 0 8px' }}>My Account</h1>
        <p style={{ color: 'var(--ink-500)', margin: '0 0 24px', fontSize: '0.9375rem' }}>{user.email}</p>

        {/* Tier strip — derived from lifetime delivered spend, no schema
            change. Surfaces "£X to Gold" progress alongside the badge. */}
        <TierStrip />

        {/* Drop `.duo-grid` — that class forces 1-col under 900px, which
            collapses six dashboard tiles into a tall single column on
            tablet. The auto-fit minmax already gives a 3-up tablet / 2-up
            phone / 1-up tiny-phone layout naturally. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
          <Link href="/account/orders" style={{
            display: 'block', padding: '28px 24px', background: 'white', borderRadius: 12,
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)', textDecoration: 'none', border: '1px solid var(--line)',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>◎</div>
            <div style={{ fontWeight: 600, fontSize: '1.0625rem', color: 'var(--ink-900)', marginBottom: 4 }}>My Orders</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--ink-500)' }}>View order history and track shipments</div>
          </Link>
          <Link href="/account/addresses" style={{
            display: 'block', padding: '28px 24px', background: 'white', borderRadius: 12,
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)', textDecoration: 'none', border: '1px solid var(--line)',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>◇</div>
            <div style={{ fontWeight: 600, fontSize: '1.0625rem', color: 'var(--ink-900)', marginBottom: 4 }}>Addresses</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--ink-500)' }}>Save shipping addresses for faster checkout</div>
          </Link>
          <Link href="/account/rewards" style={{
            display: 'block', padding: '28px 24px', background: 'white', borderRadius: 12,
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)', textDecoration: 'none', border: '1px solid var(--line)',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>★</div>
            <div style={{ fontWeight: 600, fontSize: '1.0625rem', color: 'var(--ink-900)', marginBottom: 4 }}>Rewards</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--ink-500)' }}>Points, tier, and your referral code</div>
          </Link>
          <Link href="/account/subscriptions" style={{
            display: 'block', padding: '28px 24px', background: 'white', borderRadius: 12,
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)', textDecoration: 'none', border: '1px solid var(--line)',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>⟳</div>
            <div style={{ fontWeight: 600, fontSize: '1.0625rem', color: 'var(--ink-900)', marginBottom: 4 }}>Subscriptions</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--ink-500)' }}>Reorder reminders for your wellness essentials</div>
          </Link>
          <Link href="/account/profile" style={{
            display: 'block', padding: '28px 24px', background: 'white', borderRadius: 12,
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)', textDecoration: 'none', border: '1px solid var(--line)',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>◈</div>
            <div style={{ fontWeight: 600, fontSize: '1.0625rem', color: 'var(--ink-900)', marginBottom: 4 }}>Profile</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--ink-500)' }}>Manage your personal details</div>
          </Link>
          {/* UK GDPR Article 15 self-serve — download the data Aizel holds
              on you as a JSON file, no email round-trip needed. */}
          <Link href="/account/data-export" style={{
            display: 'block', padding: '28px 24px', background: 'white', borderRadius: 12,
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)', textDecoration: 'none', border: '1px solid var(--line)',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>↓</div>
            <div style={{ fontWeight: 600, fontSize: '1.0625rem', color: 'var(--ink-900)', marginBottom: 4 }}>My data</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--ink-500)' }}>Download everything we hold about you</div>
          </Link>
        </div>

        <button onClick={handleSignOut} style={{
          padding: '10px 20px', background: 'transparent', border: '1px solid #d1d5db',
          borderRadius: 8, color: '#6b7280', cursor: 'pointer', fontSize: '0.875rem',
        }}>
          Sign out
        </button>
      </div>
    </div>
  );
}
