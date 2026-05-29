'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getBrowserClient } from '@/lib/supabase-browser';
import { ProductImage } from '@/components/ui/ProductImage';
import { Skeleton } from '@/components/ui/Skeleton';
import { brandPlusName } from '@/lib/product-display';
import { setSubscriptionStatus, updateSubscriptionCadence } from './actions';
import { SUBSCRIPTION_INTERVALS } from '@/lib/subscriptions';
import type { ReorderSubscription } from '@/types';

interface SubRow extends ReorderSubscription {
  products: { brand: string | null; name: string; slug: string; image_url: string | null } | null;
}

const STATUS_BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  active: { bg: '#f0fdf4', fg: '#16a34a', label: 'Active' },
  paused: { bg: '#fffbeb', fg: '#d97706', label: 'Paused' },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function SubscriptionsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [subs, setSubs] = useState<SubRow[] | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/login?next=/account/subscriptions');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const sb = getBrowserClient();
    sb.from('reorder_subscriptions')
      .select('*, products(brand, name, slug, image_url)')
      .eq('user_id', user.id)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .then(({ data }) => setSubs((data ?? []) as SubRow[]));
  }, [user]);

  if (loading || !user) {
    return (
      <div className="container" style={{ padding: '48px var(--side)' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <Skeleton height={32} width="40%" style={{ marginBottom: 32 }} />
          {[0, 1].map(i => <Skeleton key={i} height={104} radius={12} style={{ marginBottom: 16 }} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '48px var(--side)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <Link href="/account" style={{ color: 'var(--ink-500)', textDecoration: 'none', fontSize: '0.875rem' }}>← Account</Link>
          <span style={{ color: 'var(--line)' }}>/</span>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 500 }}>Subscriptions</h1>
        </div>
        <p style={{ color: 'var(--ink-500)', margin: '0 0 32px', fontSize: '0.9375rem' }}>
          Reorder reminders for the products you restock. Save 10% on every reorder with code <strong>SUBSCRIBE10</strong>.
        </p>

        {subs == null && <p style={{ color: '#9ca3af' }}>Loading subscriptions…</p>}

        {subs && subs.length === 0 && (
          <div style={{ background: 'white', border: '1px dashed var(--line)', borderRadius: 12, padding: 32, textAlign: 'center' }}>
            <p style={{ color: 'var(--ink-500)', margin: '0 0 16px' }}>No subscriptions yet.</p>
            <Link href="/shop" style={{
              display: 'inline-block', padding: '10px 18px', background: 'var(--brand-pink-cta)',
              color: 'white', textDecoration: 'none', borderRadius: 8, fontSize: '0.875rem', fontWeight: 600,
            }}>
              Browse products
            </Link>
          </div>
        )}

        {subs && subs.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {subs.map(sub => {
              const badge = STATUS_BADGE[sub.status] ?? STATUS_BADGE.active;
              const name = sub.products ? brandPlusName(sub.products.brand, sub.products.name) : 'Product';
              return (
                <div key={sub.id} style={{
                  background: 'white', borderRadius: 12, padding: 16,
                  border: '1px solid var(--line)', display: 'flex', gap: 16, alignItems: 'flex-start',
                }}>
                  <div style={{ width: 64, height: 64, flexShrink: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--line)' }}>
                    <ProductImage src={sub.products?.image_url ?? undefined} alt={name} width={64} height={64} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      {sub.products ? (
                        <Link href={`/product/${sub.products.slug}`} style={{ fontWeight: 600, color: 'var(--ink-900)', textDecoration: 'none' }}>
                          {name}
                        </Link>
                      ) : <span style={{ fontWeight: 600 }}>{name}</span>}
                      <span style={{
                        background: badge.bg, color: badge.fg, fontSize: '0.6875rem', fontWeight: 700,
                        padding: '2px 8px', borderRadius: 4,
                      }}>{badge.label}</span>
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--ink-500)', marginBottom: 12 }}>
                      {sub.status === 'active'
                        ? `Every ${sub.interval_days} days · next reminder ${formatDate(sub.next_reminder_at)}`
                        : `Every ${sub.interval_days} days · paused`}
                    </div>

                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                      <form action={updateSubscriptionCadence}>
                        <input type="hidden" name="id" value={sub.id} />
                        <label htmlFor={`cadence-${sub.id}`} className="sr-only">Reorder frequency</label>
                        <select
                          id={`cadence-${sub.id}`}
                          name="interval_days"
                          defaultValue={sub.interval_days}
                          onChange={e => e.currentTarget.form?.requestSubmit()}
                          style={{
                            padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 6,
                            fontSize: '0.8125rem', background: 'white', color: 'var(--ink-900)',
                          }}
                        >
                          {SUBSCRIPTION_INTERVALS.map(d => (
                            <option key={d} value={d}>Every {d} days</option>
                          ))}
                        </select>
                      </form>

                      <form action={setSubscriptionStatus}>
                        <input type="hidden" name="id" value={sub.id} />
                        <input type="hidden" name="status" value={sub.status === 'active' ? 'paused' : 'active'} />
                        <button type="submit" style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                          color: 'var(--brand-pink-text)', fontWeight: 600, fontSize: '0.8125rem',
                        }}>
                          {sub.status === 'active' ? 'Pause' : 'Resume'}
                        </button>
                      </form>

                      <form
                        action={setSubscriptionStatus}
                        onSubmit={e => { if (!confirm(`Cancel your ${name} subscription?`)) e.preventDefault(); }}
                      >
                        <input type="hidden" name="id" value={sub.id} />
                        <input type="hidden" name="status" value="cancelled" />
                        <button type="submit" style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                          color: '#ef4444', fontSize: '0.8125rem',
                        }}>
                          Cancel
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
