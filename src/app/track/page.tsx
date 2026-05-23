'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getBrowserClient } from '@/lib/supabase-browser';
import { ORDER_STATUS_LABELS } from '@/types';
import { OrderStatusTimeline } from '@/components/order/OrderStatusTimeline';
import type { Order, OrderStatus } from '@/types';

const fmt = (n: number) => `£${n.toLocaleString()}`;

const statusColors: Record<string, string> = {
  payment_pending: '#9ca3af',
  payment_failed:  '#ef4444',
  pending:         '#f59e0b',
  processing:      '#3b82f6',
  shipped:         '#8b5cf6',
  delivered:       '#10b981',
  cancelled:       '#ef4444',
  returned:        '#6b7280',
  refunded:        '#6b7280',
};

const statusMessages: Record<string, string> = {
  payment_pending: 'We\'re waiting for your payment to come through.',
  payment_failed:  'Your payment didn\'t go through. Please reorder or contact us.',
  pending:         'Your order has been received and is awaiting processing.',
  processing:      "We're preparing your items for shipment.",
  shipped:         'Your order is on its way! Check the tracking number below.',
  delivered:       'Your order has been delivered. Enjoy your products!',
  cancelled:       'This order was cancelled.',
  returned:        'This order was returned.',
  refunded:        'This order has been refunded.',
};

// Quick courier tracking URL builders for the most common PK carriers.
function courierTrackingUrl(courier: string | undefined, tracking: string): string | null {
  if (!courier) return null;
  const c = courier.toLowerCase();
  if (c.includes('tcs'))      return `https://www.tcsexpress.com/track/${encodeURIComponent(tracking)}`;
  if (c.includes('leopard'))  return `https://www.leopardscourier.com/leopards/tracking?tracking_number=${encodeURIComponent(tracking)}`;
  if (c.includes('m&p') || c.includes('mp'))
                              return `https://www.mulphilog.com/tracking?cnno=${encodeURIComponent(tracking)}`;
  if (c.includes('bluex') || c.includes('blueex'))
                              return `https://www.blue-ex.com/tracking/${encodeURIComponent(tracking)}`;
  return null;
}

const RATE_LIMIT_WINDOW = 60_000;
const MAX_ATTEMPTS = 5;
const attempts: { count: number; since: number } = { count: 0, since: Date.now() };

export default function TrackPage() {
  const [orderNumber, setOrderNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber.trim() || !phone.trim()) return;

    const now = Date.now();
    if (now - attempts.since > RATE_LIMIT_WINDOW) { attempts.count = 0; attempts.since = now; }
    attempts.count++;
    if (attempts.count > MAX_ATTEMPTS) {
      setError('Too many attempts. Please wait a minute before trying again.');
      return;
    }

    setError('');
    setOrder(null);
    setLoading(true);
    const sb = getBrowserClient();
    // Server-side lookup via SECURITY DEFINER RPC: only returns the row if
    // (order_number, phone) match. No anon read on the orders table needed.
    const { data, error: rpcError } = await sb.rpc('lookup_order' as never, {
      p_order_number: orderNumber.trim().toUpperCase(),
      p_phone: phone.trim(),
    } as never);
    setLoading(false);

    const row = Array.isArray(data) ? (data[0] as Order | undefined) : (data as Order | null);

    if (rpcError || !row) {
      setError('No order matches that order number and phone. Please check and try again.');
      return;
    }
    setOrder(row);
  };

  const status = (order?.status ?? 'pending') as OrderStatus;
  const trackingUrl = order?.tracking_number ? courierTrackingUrl(order.courier, order.tracking_number) : null;

  return (
    <div className="container" style={{ padding: '64px var(--side)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', fontWeight: 500, margin: '0 0 8px', letterSpacing: '-0.025em' }}>Track Order</h1>
        <p style={{ color: 'var(--ink-500)', margin: '0 0 40px', fontSize: '1rem' }}>
          Enter your order number and the phone you used at checkout.
        </p>

        <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 40 }}>
          <label htmlFor="track-order" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
            Order number
          </label>
          <input
            id="track-order"
            value={orderNumber}
            onChange={e => setOrderNumber(e.target.value)}
            placeholder="Order number — e.g. YP-A1B2C3"
            required
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            style={{
              padding: '12px 16px', border: '1px solid var(--line)', borderRadius: 10,
              fontFamily: 'monospace', fontSize: '1rem', color: 'var(--ink-900)', outline: 'none',
              background: 'white', boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 12 }}>
            <label htmlFor="track-phone" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
              Phone number
            </label>
            <input
              id="track-phone"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Phone number used at checkout"
              required
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              style={{
                flex: 1, padding: '12px 16px', border: '1px solid var(--line)', borderRadius: 10,
                fontSize: '1rem', color: 'var(--ink-900)', outline: 'none',
                background: 'white', boxSizing: 'border-box',
              }}
            />
            <button type="submit" disabled={loading} style={{
              padding: '12px 24px', background: loading ? '#f9a8d4' : 'var(--brand-pink)',
              color: 'white', border: 'none', borderRadius: 10,
              fontSize: '0.9375rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
            }}>
              {loading ? 'Looking up…' : 'Track'}
            </button>
          </div>
        </form>

        <div aria-live="polite" aria-atomic="true">
          {error && (
            <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '16px 20px', color: '#dc2626', marginBottom: 32 }}>
              {error}
            </div>
          )}
        </div>

        {order && (
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--line)', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ padding: '24px 28px', background: 'var(--cream)', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1.25rem', color: 'var(--ink-900)', marginBottom: 4 }}>{order.order_number}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--ink-500)' }}>
                    {order.first_name} {order.last_name} · {fmt(order.total)}
                  </div>
                </div>
                <span style={{
                  padding: '6px 16px', borderRadius: 20, fontSize: '0.875rem', fontWeight: 700, textTransform: 'capitalize',
                  background: (statusColors[status] ?? '#6b7280') + '20',
                  color: statusColors[status] ?? '#6b7280',
                }}>
                  {ORDER_STATUS_LABELS[status]}
                </span>
              </div>
            </div>

            <div style={{ padding: '28px' }}>
              <p style={{ margin: '0 0 28px', fontSize: '0.9375rem', color: 'var(--ink-700)' }}>
                {statusMessages[status]}
              </p>

              <div style={{ marginBottom: 28 }}>
                <OrderStatusTimeline
                  status={status}
                  // We only have `created_at` on the order itself today;
                  // shipped / delivered timestamps will come from
                  // `order_events` once that join is wired here.
                  events={{ pending: order.created_at ?? undefined }}
                />
              </div>

              {order.tracking_number && (
                <div style={{ padding: '14px 18px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, marginBottom: 24, fontSize: '0.9375rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <span style={{ color: '#0369a1', fontWeight: 600 }}>Tracking: </span>
                      <span style={{ fontFamily: 'monospace', color: '#0c4a6e', fontWeight: 700 }}>{order.tracking_number}</span>
                      {order.courier && <span style={{ color: '#0369a1', marginLeft: 8 }}>· {order.courier}</span>}
                    </div>
                    {trackingUrl && (
                      <a href={trackingUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#0369a1', fontWeight: 600, textDecoration: 'none', fontSize: '0.8125rem' }}>
                        Open courier page →
                      </a>
                    )}
                  </div>
                </div>
              )}

              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 20 }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-700)', marginBottom: 10 }}>Items ordered</div>
                {(order.items ?? []).map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', padding: '4px 0', color: 'var(--ink-700)' }}>
                    <span>{item.brand} {item.name} × {item.qty}</span>
                    <span style={{ fontWeight: 600 }}>{fmt(item.price * item.qty)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: 40, textAlign: 'center', fontSize: '0.875rem', color: 'var(--ink-500)' }}>
          Have an account?{' '}
          <Link href="/account/orders" style={{ color: 'var(--brand-pink-text)', fontWeight: 600, textDecoration: 'none' }}>
            View all your orders →
          </Link>
        </div>
      </div>
    </div>
  );
}
