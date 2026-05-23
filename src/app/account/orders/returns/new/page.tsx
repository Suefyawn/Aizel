'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getBrowserClient } from '@/lib/supabase-browser';
import { requestReturn } from '@/app/account/orders/returns/actions';
import { brandPlusName } from '@/lib/product-display';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Order } from '@/types';

function ReturnForm() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();
  const orderId = sp.get('order');
  const [order, setOrder] = useState<Order | null>(null);
  const [selected, setSelected] = useState<Record<number, number>>({});  // index → qty
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!loading && !user) { router.replace('/login'); return; }
    if (!user || !orderId) return;
    const sb = getBrowserClient();
    sb.from('orders').select('*').eq('id', orderId).eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setOrder(data as Order | null));
  }, [user, loading, orderId, router]);

  if (loading || (orderId && !order)) {
    return (
      <div className="container" style={{ padding: '48px var(--side)' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <Skeleton height={28} width="40%" style={{ marginBottom: 24 }} />
          <Skeleton height={180} radius={12} style={{ marginBottom: 16 }} />
          <Skeleton height={120} radius={12} style={{ marginBottom: 16 }} />
          <Skeleton height={44} width="35%" radius={8} />
        </div>
      </div>
    );
  }
  if (!orderId) return <p style={{ padding: 48, textAlign: 'center', color: '#9ca3af' }}>Missing order reference.</p>;
  if (!order)   return <p style={{ padding: 48, textAlign: 'center', color: '#9ca3af' }}>Order not found.</p>;
  if (order.status !== 'delivered') {
    return (
      <div style={{ padding: 48, textAlign: 'center', maxWidth: 520, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 500 }}>Not eligible</h1>
        <p style={{ color: 'var(--ink-700)', marginBottom: 16 }}>This order isn&apos;t delivered yet, so we can&apos;t accept a return for it.</p>
        <Link href="/account/orders" style={{ color: 'var(--brand-pink-text)' }}>Back to orders</Link>
      </div>
    );
  }
  if (done) {
    return (
      <div style={{ padding: 48, textAlign: 'center', maxWidth: 520, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 500, marginBottom: 12 }}>Return request submitted</h1>
        <p style={{ color: 'var(--ink-700)', marginBottom: 24 }}>We&apos;ll review it and email you within 48 hours.</p>
        <Link href="/account/orders" style={{ padding: '10px 18px', background: 'var(--brand-pink-cta)', color: 'white', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>
          Back to orders
        </Link>
      </div>
    );
  }

  const handleSubmit = async () => {
    setErr(null);
    const items = (order.items ?? [])
      .map((it, i) => ({ idx: i, it }))
      .filter(({ idx }) => (selected[idx] ?? 0) > 0)
      .map(({ idx, it }) => ({
        product_id: it.id ?? '',
        qty: Math.min(selected[idx] ?? 0, it.qty),
        name: brandPlusName(it.brand, it.name),
        price: it.price,
      }));
    if (items.length === 0) { setErr('Select at least one item to return.'); return; }
    if (reason.trim().length < 5) { setErr('Tell us briefly why you\'re returning.'); return; }
    setSubmitting(true);
    const res = await requestReturn({ order_id: order.id!, reason, items });
    setSubmitting(false);
    if ('error' in res && !res.ok) setErr(res.error);
    else setDone(true);
  };

  return (
    <div className="container" style={{ padding: '48px var(--side)' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <Link href="/account/orders" style={{ color: 'var(--ink-500)', textDecoration: 'none', fontSize: '0.875rem' }}>← Orders</Link>
          <span style={{ color: 'var(--line)' }}>/</span>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 500 }}>Request a return</h1>
        </div>

        <p style={{ color: 'var(--ink-700)', marginBottom: 24, fontSize: '0.9375rem' }}>
          Order <strong style={{ fontFamily: 'monospace' }}>{order.order_number}</strong>. Select items to return and tell us why.
        </p>

        <div style={{ background: 'white', borderRadius: 12, border: '1px solid var(--line)', padding: 20, marginBottom: 20 }}>
          {(order.items ?? []).map((it, i) => {
            const max = it.qty;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{it.brand} {it.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--ink-500)' }}>Ordered: {it.qty} · £{it.price.toLocaleString()}</div>
                </div>
                <label style={{ fontSize: '0.75rem', color: 'var(--ink-500)' }}>Return qty</label>
                <input
                  type="number" min={0} max={max}
                  value={selected[i] ?? 0}
                  onChange={e => setSelected(prev => ({ ...prev, [i]: Math.max(0, Math.min(max, Number(e.target.value))) }))}
                  style={{ width: 64, padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 6, fontSize: '0.8125rem', textAlign: 'right' }}
                />
              </div>
            );
          })}
        </div>

        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Reason *</label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={4}
          placeholder="Tell us what went wrong, what arrived damaged, or why this isn't right for you."
          style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, fontSize: '0.875rem', resize: 'vertical', fontFamily: 'inherit' }}
        />

        {err && <p style={{ margin: '10px 0 0', color: '#ef4444', fontSize: '0.8125rem' }}>{err}</p>}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="btn-primary"
          style={{ marginTop: 16, width: '100%' }}
        >
          {submitting ? 'Submitting…' : 'Submit return request'}
        </button>
        <p style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--ink-500)', textAlign: 'center' }}>
          We&apos;ll email you within 48 hours with next steps.
        </p>
      </div>
    </div>
  );
}

export default function ReturnRequestPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '40vh' }} />}>
      <ReturnForm />
    </Suspense>
  );
}
