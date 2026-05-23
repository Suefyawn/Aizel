'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getBrowserClient } from '@/lib/supabase-browser';
import { LogoWordmark } from '@/components/ui/LogoWordmark';

const inp: React.CSSProperties = {
  width: '100%', padding: '11px 14px',
  border: '1px solid #d1d5db', borderRadius: 8,
  fontSize: '0.9375rem', color: '#111827', background: 'white',
  outline: 'none', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 5 };

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const sb = getBrowserClient();
    try {
      const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) { setError(error.message); return; }
      setSent(true);
    } catch (err) {
      // Network/CORS rejection — without this catch the button stays stuck
      // on "Sending…" indefinitely.
      setError((err as Error).message || 'Could not send reset email. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ marginBottom: 32 }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <LogoWordmark />
        </Link>
      </div>

      <div style={{ width: '100%', maxWidth: 400, background: 'white', borderRadius: 16, padding: '36px 32px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: 16 }}>📬</div>
            <h1 style={{ margin: '0 0 8px', fontSize: '1.375rem', fontWeight: 700, color: '#111827' }}>Check your inbox</h1>
            <p style={{ margin: '0 0 24px', color: '#6b7280', fontSize: '0.875rem', lineHeight: 1.6 }}>
              We&apos;ve sent a password reset link to <strong>{email}</strong>. It may take a minute to arrive.
            </p>
            <Link href="/login" style={{ color: 'var(--brand-pink-text)', fontWeight: 600, fontSize: '0.875rem', textDecoration: 'none' }}>
              ← Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 style={{ margin: '0 0 6px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Reset password</h1>
            <p style={{ margin: '0 0 28px', color: '#6b7280', fontSize: '0.875rem' }}>
              Enter your email and we&apos;ll send you a reset link.
            </p>

            <div aria-live="polite" aria-atomic="true">
              {error && (
                <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 20, color: '#dc2626', fontSize: '0.875rem' }}>
                  {error}
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} aria-busy={loading} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label htmlFor="forgot-email" style={lbl}>Email address</label>
                <input id="forgot-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} style={inp} placeholder="you@example.com" autoComplete="email" />
              </div>
              <button type="submit" disabled={loading} style={{
                padding: '12px', background: loading ? '#f9a8d4' : 'var(--brand-pink)',
                color: 'white', border: 'none', borderRadius: 8,
                fontSize: '0.9375rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: 4,
              }}>
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>

            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <Link href="/login" style={{ fontSize: '0.875rem', color: '#6b7280', textDecoration: 'none' }}>
                ← Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
