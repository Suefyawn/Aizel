'use client';
import { useActionState, useState } from 'react';
import { loginAdmin, loginStaff } from '@/app/admin/actions';
import { LogoWordmark } from '@/components/ui/LogoWordmark';

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 14px',
  border: '1px solid #d1d5db', borderRadius: 8,
  fontSize: '0.875rem', color: '#111827', outline: 'none',
  boxSizing: 'border-box',
};
const btn: React.CSSProperties = {
  // Brand pink CTA (#4A1A6B) — passes WCAG AA at 15 px / 600 wt.
  // Was Tailwind pink-500 (#ec4899), which fails 4.5:1 with white text.
  width: '100%', padding: 11,
  background: '#4A1A6B', color: 'white',
  border: 'none', borderRadius: 8,
  fontSize: '0.9375rem', fontWeight: 600,
  cursor: 'pointer',
};
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.8125rem',
  fontWeight: 600, color: '#374151', marginBottom: 6,
};
const err: React.CSSProperties = {
  color: '#ef4444', fontSize: '0.8125rem', marginTop: 6, marginBottom: 0,
};

function OwnerTab() {
  const [state, action, pending] = useActionState(loginAdmin, null);
  return (
    <form action={action}>
      <div style={{ marginBottom: 16 }}>
        <label style={lbl}>Admin Password</label>
        <input type="password" name="password" placeholder="Enter admin password"
          required autoFocus
          style={{ ...inp, borderColor: state?.error ? '#ef4444' : '#d1d5db' }} />
        {state?.error && <p style={err}>{state.error}</p>}
      </div>
      <button type="submit" disabled={pending} style={{ ...btn, opacity: pending ? 0.6 : 1 }}>
        {pending ? 'Signing in…' : 'Sign In as Owner'}
      </button>
    </form>
  );
}

function StaffTab() {
  const [state, action, pending] = useActionState(loginStaff, null);
  return (
    <form action={action}>
      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Email</label>
        <input type="email" name="email" placeholder="you@example.com"
          required autoFocus
          style={{ ...inp, borderColor: state?.error ? '#ef4444' : '#d1d5db' }} />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Password</label>
        <input type="password" name="password" placeholder="Your password"
          required
          style={{ ...inp, borderColor: state?.error ? '#ef4444' : '#d1d5db' }} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={lbl}>2FA code <span style={{ color: '#9ca3af', fontWeight: 400 }}>(if enabled)</span></label>
        <input
          name="totp" inputMode="numeric" autoComplete="one-time-code" maxLength={8}
          placeholder="123 456"
          style={{ ...inp, borderColor: state?.error ? '#ef4444' : '#d1d5db', fontFamily: 'monospace', letterSpacing: '0.2em' }}
        />
        {state?.error && <p style={err}>{state.error}</p>}
      </div>
      <button type="submit" disabled={pending} style={{ ...btn, background: '#6366f1', opacity: pending ? 0.6 : 1 }}>
        {pending ? 'Signing in…' : 'Sign In as Staff'}
      </button>
    </form>
  );
}

export function LoginForm() {
  const [tab, setTab] = useState<'owner' | 'staff'>('owner');

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '8px 0', border: 'none', cursor: 'pointer',
    background: active ? 'white' : 'transparent',
    color: active ? '#111827' : '#6b7280',
    fontWeight: active ? 600 : 400,
    fontSize: '0.875rem',
    borderRadius: 6,
    transition: 'all 0.15s',
  });

  return (
    <div style={{
      background: 'white', borderRadius: 12, padding: '40px 36px',
      width: 360, boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
        <div style={{ marginBottom: 10 }}><LogoWordmark height={32} /></div>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>Sign in to admin panel</p>
      </div>

      {/* Tab switcher */}
      <div style={{
        display: 'flex', background: '#f3f4f6', borderRadius: 8,
        padding: 4, marginBottom: 24,
      }}>
        <button type="button" style={tabStyle(tab === 'owner')} onClick={() => setTab('owner')}>
          Owner
        </button>
        <button type="button" style={tabStyle(tab === 'staff')} onClick={() => setTab('staff')}>
          Staff
        </button>
      </div>

      {tab === 'owner' ? <OwnerTab /> : <StaffTab />}
    </div>
  );
}
