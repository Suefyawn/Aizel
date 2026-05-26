'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getBrowserClient } from '@/lib/supabase-browser';
import { Skeleton } from '@/components/ui/Skeleton';
import { OrderStatusTimeline } from '@/components/order/OrderStatusTimeline';
import { brandPlusName } from '@/lib/product-display';
import type { Order, OrderStatus } from '@/types';

const fmt = (n: number) => `£${n.toLocaleString()}`;
const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const statusColors: Record<string, string> = {
  pending: '#f59e0b', processing: '#3b82f6', shipped: '#8b5cf6', delivered: '#10b981', cancelled: '#ef4444',
};

export default function AccountOrdersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [fetching, setFetching] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) { router.replace('/login'); return; }
    if (!user) return;
    const sb = getBrowserClient();
    (async () => {
      // Back-fill user_id onto any guest orders placed with this account's
      // email so they appear in the history below. Idempotent — once the
      // orders are claimed it matches zero rows.
      await sb.rpc('claim_guest_orders' as never);
      // Narrow projection + cap at 50 most-recent orders. The expanded-row
      // detail (items breakdown) was the only consumer of the full row;
      // it loads its own per-order detail on click, so the index doesn't
      // need to ship cart JSON for every historical order. Customers with
      // 100+ orders were downloading hundreds of KB of items on every
      // /account/orders visit before this.
      const { data } = await sb
        .from('orders')
        .select('id, order_number, status, total, pay_method, created_at, tracking_number, courier, items')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setOrders((data ?? []) as Order[]);
      setFetching(false);
    })();
  }, [user, loading, router]);

  if (loading || fetching) {
    return (
      <div className="container" style={{ padding: '48px var(--side)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Skeleton height={28} width="40%" style={{ marginBottom: 24 }} />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ background: 'white', borderRadius: 12, border: '1px solid var(--line)', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Skeleton height={16} width={120} />
                <Skeleton height={12} width={180} />
              </div>
              <Skeleton height={24} width={70} radius={20} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '48px var(--side)' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <Link href="/account" style={{ color: 'var(--ink-500)', textDecoration: 'none', fontSize: '0.875rem' }}>← Account</Link>
          <span style={{ color: 'var(--line)' }}>/</span>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 500 }}>My Orders</h1>
        </div>

        {orders.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '64px 32px',
            background: 'white', borderRadius: 16, border: '1px dashed var(--line)',
          }}>
            <div style={{ fontSize: '3.5rem', marginBottom: 16, opacity: 0.35 }} aria-hidden="true">◎</div>
            <h2 style={{ margin: '0 0 8px', fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 500 }}>
              No orders yet
            </h2>
            <p className="body-text" style={{ color: 'var(--ink-700)', marginBottom: 24, maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
              Once you place an order, you&apos;ll be able to track it and reorder favourites from here.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Link href="/shop" className="btn-primary">Start shopping</Link>
              <Link href="/track" style={{
                padding: '12px 24px', background: 'transparent',
                border: '1px solid var(--line)', borderRadius: 'var(--radius-card)',
                fontFamily: 'var(--font-ui)', fontSize: '0.875rem', fontWeight: 600,
                color: 'var(--ink-900)', letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>
                Track an order
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {orders.map(o => {
              const status = o.status ?? 'pending';
              const isExpanded = expanded === o.id;

              return (
                <div key={o.id} style={{ background: 'white', borderRadius: 12, border: '1px solid var(--line)', overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => setExpanded(isExpanded ? null : o.id!)}
                    aria-expanded={isExpanded}
                    aria-controls={`order-${o.id}-detail`}
                    style={{
                      width: '100%', textAlign: 'left', background: 'transparent',
                      border: 'none', font: 'inherit', color: 'inherit',
                      padding: '20px 24px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '1rem', color: 'var(--ink-900)', marginBottom: 4 }}>{o.order_number}</div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--ink-500)' }}>{o.created_at ? fmtDate(o.created_at) : ''} · {fmt(o.total)}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{
                        padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize',
                        background: (statusColors[status] ?? '#6b7280') + '20',
                        color: statusColors[status] ?? '#6b7280',
                      }}>
                        {status}
                      </span>
                      <span aria-hidden="true" style={{ color: 'var(--ink-400)', fontSize: '0.875rem' }}>{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div id={`order-${o.id}-detail`} style={{ borderTop: '1px solid var(--line)', padding: '20px 24px' }}>
                      <div style={{ marginBottom: 24 }}>
                        <OrderStatusTimeline status={status as OrderStatus} compact />
                      </div>

                      {o.tracking_number && (
                        <div style={{ marginBottom: 16, padding: '10px 14px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, fontSize: '0.875rem' }}>
                          <span style={{ color: '#0369a1', fontWeight: 600 }}>Tracking: </span>
                          <span style={{ fontFamily: 'monospace', color: '#0c4a6e' }}>{o.tracking_number}</span>
                          {o.courier && <span style={{ color: '#0369a1', marginLeft: 8 }}>· {o.courier}</span>}
                        </div>
                      )}

                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <tbody>
                          {(o.items ?? []).map((item, i) => (
                            <tr key={i} style={{ borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
                              <td style={{ padding: '8px 0', color: 'var(--ink-900)', fontWeight: 500, overflowWrap: 'anywhere' }}>{brandPlusName(item.brand, item.name)}</td>
                              <td style={{ padding: '8px 0', color: 'var(--ink-500)', textAlign: 'center' }}>×{item.qty}</td>
                              <td style={{ padding: '8px 0', color: 'var(--ink-900)', fontWeight: 600, textAlign: 'right' }}>{fmt(item.price * item.qty)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10, marginTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.9375rem' }}>
                        <span>Total</span>
                        <span style={{ color: 'var(--brand-pink-text)' }}>{fmt(o.total)}</span>
                      </div>

                      {status === 'delivered' && o.id && (
                        <div style={{ marginTop: 16, textAlign: 'right' }}>
                          <Link
                            href={`/account/orders/returns/new?order=${encodeURIComponent(o.id)}`}
                            style={{ fontSize: '0.8125rem', color: 'var(--ink-700)', textDecoration: 'underline' }}
                          >
                            Request a return →
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
