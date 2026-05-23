'use client';

import { useState } from 'react';
import { getBrowserClient } from '@/lib/supabase-browser';

// Shown on the PDP when stock is 0. Lets a guest drop their email and
// get pinged when the product is back. variantId is optional — pass it
// when on a variant whose own stock just hit 0.
export function BackInStockForm({ productId, variantId = null }: { productId: string; variantId?: string | null }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus('error'); setErrorMsg('Please enter a valid email address.'); return;
    }
    setStatus('submitting'); setErrorMsg('');
    const sb = getBrowserClient();
    const { error } = await sb.rpc('subscribe_back_in_stock' as never, {
      p_email: email, p_product_id: productId, p_variant_id: variantId,
    } as never);
    if (error) { setStatus('error'); setErrorMsg(error.message); return; }
    setStatus('done');
  };

  if (status === 'done') {
    return (
      <div style={{ padding: '12px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, color: '#15803d', fontSize: '0.875rem', fontWeight: 500 }}>
        ✓ Thanks — we&apos;ll email you the moment this is back in stock.
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label htmlFor="back-in-stock-email" style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-900)' }}>
        Notify me when it&apos;s back
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          id="back-in-stock-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          disabled={status === 'submitting'}
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          aria-invalid={status === 'error'}
          style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, fontSize: '0.875rem', outline: 'none', background: 'white' }}
        />
        <button type="submit" disabled={status === 'submitting'} className="btn-primary" style={{ padding: '10px 16px', minHeight: 44 }}>
          {status === 'submitting' ? '…' : 'Notify me'}
        </button>
      </div>
      {errorMsg && <span role="alert" style={{ color: 'var(--error)', fontSize: '0.75rem' }}>{errorMsg}</span>}
    </form>
  );
}
