'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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

// Map Supabase SDK / URL error strings to user-friendly copy. We never want to
// render the raw SDK message (e.g. "PKCE code verifier not found in
// storage… use @supabase/ssr") to end users — it's developer jargon that
// suggests something is broken when in fact the link is just stale or being
// opened on a different device. Log the raw message to console for debug.
function friendlyLinkError(raw: string | null | undefined): string {
  const text = (raw ?? '').toLowerCase();
  if (raw) console.warn('[reset-password] link error:', raw);
  if (text.includes('pkce') || text.includes('code verifier') || text.includes('different browser')) {
    return 'Open this reset link in the same browser you requested it from. If you switched devices, request a new link.';
  }
  if (text.includes('expired') || text.includes('used') || text.includes('consumed')) {
    return 'This reset link has expired or was already used. Request a new one to continue.';
  }
  return 'This reset link is invalid or has expired. Request a new one to continue.';
}

function ResetPasswordInner() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  // Live validation hints: surface mismatches as the user types instead of
  // waiting for submit. We only flag mismatch once the confirm field has
  // some content, so the user isn't yelled at on first keystroke.
  const tooShort = password.length > 0 && password.length < 6;
  const mismatch = confirm.length > 0 && password !== confirm;

  useEffect(() => {
    // Supabase has two recovery flows depending on @supabase/ssr / supabase-js
    // version + project config:
    //   1. Legacy implicit flow — redirects with `#access_token=...&type=recovery`
    //      in the hash. supabase-js auto-detects on first load and fires
    //      onAuthStateChange('PASSWORD_RECOVERY').
    //   2. PKCE flow — redirects with `?code=...` in the query. The browser
    //      client does NOT auto-exchange in all client constructions;
    //      we have to call exchangeCodeForSession(code) explicitly.
    //
    // The page used to only listen for flow #1 and silently get stuck on
    // "Verifying…" when flow #2 was in play (the actual case in production
    // after the switch to @supabase/ssr). This effect handles both, and
    // shows a real error after a timeout so users aren't stranded.
    const sb = getBrowserClient();
    let cancelled = false;

    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setReady(true);
      }
    });

    (async () => {
      // PKCE: an explicit ?code=... in the URL means we must exchange it
      // ourselves. Do this first, then fall back to whatever state the
      // client already settled into.
      const code = searchParams?.get('code') ?? null;
      const urlError = searchParams?.get('error_description') ?? searchParams?.get('error') ?? null;
      if (urlError) {
        if (!cancelled) setLinkError(friendlyLinkError(decodeURIComponent(urlError.replace(/\+/g, ' '))));
        return;
      }
      if (code) {
        const { error } = await sb.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (error) {
          setLinkError(friendlyLinkError(error.message));
          return;
        }
        setReady(true);
        return;
      }

      // No code — fall back to existing session (covers implicit flow whose
      // hash was already consumed by an earlier auto-detect).
      const { data: { session } } = await sb.auth.getSession();
      if (cancelled) return;
      if (session) {
        setReady(true);
        return;
      }

      // Last resort: a small grace period for onAuthStateChange to fire if
      // the hash flow is still settling, then surface a clear error rather
      // than spinning forever.
      setTimeout(() => {
        if (!cancelled && !ready) {
          setLinkError('This reset link is invalid or has expired. Request a new one to continue.');
        }
      }, 3000);
    })();

    return () => { cancelled = true; subscription.unsubscribe(); };
    // searchParams is stable across renders; ready intentionally read via
    // closure in the timeout so we don't re-run this whole flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    const sb = getBrowserClient();
    try {
      const { error } = await sb.auth.updateUser({ password });
      if (error) { setError(error.message); return; }
      setSuccess(true);
      setTimeout(() => router.push('/account'), 2000);
    } catch (err) {
      setError((err as Error).message || 'Could not update password. Try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
        <div style={{ marginBottom: 32 }}>
          <Link href="/" style={{ textDecoration: 'none' }}><LogoWordmark /></Link>
        </div>
        <div style={{ width: '100%', maxWidth: 400, background: 'white', borderRadius: 16, padding: '36px 32px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', textAlign: 'center' }}>
          {linkError ? (
            <>
              <div style={{ fontSize: '1.75rem', marginBottom: 12 }} aria-hidden>⚠️</div>
              <h1 style={{ margin: '0 0 8px', fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>Can&apos;t open this link</h1>
              <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: 16 }}>{linkError}</p>
              <Link href="/forgot-password" style={{ display: 'inline-block', padding: '10px 18px', background: 'var(--brand-pink)', color: 'white', textDecoration: 'none', borderRadius: 8, fontSize: '0.875rem', fontWeight: 600 }}>
                Request a new link
              </Link>
            </>
          ) : (
            <>
              <p style={{ color: '#6b7280', fontSize: '0.9375rem' }}>Verifying reset link…</p>
              <p style={{ marginTop: 16, color: '#9ca3af', fontSize: '0.8125rem' }}>
                If nothing happens, your link may have expired.{' '}
                <Link href="/forgot-password" style={{ color: 'var(--brand-pink-text)', fontWeight: 600 }}>Request a new one</Link>.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ marginBottom: 32 }}>
        <Link href="/" style={{ textDecoration: 'none' }}><LogoWordmark /></Link>
      </div>

      <div style={{ width: '100%', maxWidth: 400, background: 'white', borderRadius: 16, padding: '36px 32px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        {success ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: 16 }}>✓</div>
            <h1 style={{ margin: '0 0 8px', fontSize: '1.375rem', fontWeight: 700, color: '#111827' }}>Password updated</h1>
            <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Redirecting you to your account…</p>
          </div>
        ) : (
          <>
            <h1 style={{ margin: '0 0 6px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Set new password</h1>
            <p style={{ margin: '0 0 28px', color: '#6b7280', fontSize: '0.875rem' }}>Choose a strong password for your account.</p>

            <div aria-live="polite" aria-atomic="true">
              {error && (
                <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 20, color: '#dc2626', fontSize: '0.875rem' }}>
                  {error}
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} aria-busy={loading} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label htmlFor="reset-password" style={lbl}>New password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="reset-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    style={{ ...inp, paddingRight: 44, borderColor: tooShort ? '#fca5a5' : '#d1d5db' }}
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                    aria-invalid={tooShort}
                    aria-describedby="reset-password-hint"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    style={{
                      position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '0.75rem', fontWeight: 600, color: '#6b7280',
                      padding: '4px 8px', borderRadius: 6,
                    }}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                {tooShort && (
                  <div id="reset-password-hint" style={{ marginTop: 6, fontSize: '0.75rem', color: '#dc2626' }}>
                    Use at least 6 characters.
                  </div>
                )}
              </div>
              <div>
                <label htmlFor="reset-password-confirm" style={lbl}>Confirm password</label>
                <input
                  id="reset-password-confirm"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  style={{ ...inp, borderColor: mismatch ? '#fca5a5' : '#d1d5db' }}
                  placeholder="Repeat your new password"
                  autoComplete="new-password"
                  aria-invalid={mismatch}
                  aria-describedby="reset-password-confirm-hint"
                />
                <div
                  id="reset-password-confirm-hint"
                  style={{
                    marginTop: 6, fontSize: '0.75rem',
                    color: mismatch ? '#dc2626' : confirm.length > 0 && !mismatch ? '#16a34a' : 'var(--ink-500)',
                  }}
                >
                  {mismatch
                    ? 'Passwords do not match.'
                    : confirm.length > 0 && !mismatch
                    ? '✓ Passwords match'
                    : 'Type the same password again.'}
                </div>
              </div>
              <button type="submit" disabled={loading || tooShort || mismatch || confirm.length === 0} style={{
                padding: '12px',
                background: (loading || tooShort || mismatch || confirm.length === 0) ? '#f9a8d4' : 'var(--brand-pink)',
                color: 'white', border: 'none', borderRadius: 8,
                fontSize: '0.9375rem', fontWeight: 600,
                cursor: (loading || tooShort || mismatch || confirm.length === 0) ? 'not-allowed' : 'pointer',
                marginTop: 4,
              }}>
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// useSearchParams() forces this page into client-side rendering — Next 16
// requires a Suspense boundary around it so the page can still be server-
// prerendered (showing the shell until the params arrive on the client).
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
        <div style={{ marginBottom: 32 }}>
          <Link href="/" style={{ textDecoration: 'none' }}><LogoWordmark /></Link>
        </div>
        <div style={{ width: '100%', maxWidth: 400, background: 'white', borderRadius: 16, padding: '36px 32px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', textAlign: 'center' }}>
          <p style={{ color: '#6b7280', fontSize: '0.9375rem' }}>Loading…</p>
        </div>
      </div>
    }>
      <ResetPasswordInner />
    </Suspense>
  );
}
