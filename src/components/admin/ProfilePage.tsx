'use client';
import { useActionState, useState } from 'react';
import { changeMyPassword } from '@/app/admin/team/actions';
import { begin2faEnrollment, confirm2faEnrollment, disable2fa } from '@/app/admin/profile/2fa-actions';

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid #d1d5db',
  borderRadius: 8, fontSize: '0.875rem', color: '#111827',
  outline: 'none', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.8125rem', fontWeight: 600,
  color: '#374151', marginBottom: 5,
};

export function ProfilePage({ name, email, twoFaEnabled = false }: { name: string; email: string; twoFaEnabled?: boolean }) {
  const [state, action, pending] = useActionState(changeMyPassword, null);

  return (
    <div className="adm-page" style={{ padding: '32px 36px', maxWidth: 600 }}>
      <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>My Profile</h1>
      <p style={{ margin: '0 0 32px', color: '#6b7280', fontSize: '0.875rem' }}>Manage your account settings</p>

      {/* Info card */}
      <div style={{
        background: 'white', borderRadius: 12, border: '1px solid #e5e7eb',
        padding: '24px', marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%', background: '#eef2ff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#6366f1', fontWeight: 700, fontSize: '1.25rem',
          }}>
            {name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#111827' }}>{name}</div>
            <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>{email}</div>
            <div style={{
              display: 'inline-block', marginTop: 4,
              background: '#eef2ff', color: '#6366f1',
              borderRadius: 4, padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600,
            }}>
              Manager
            </div>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div style={{
        background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: '24px',
      }}>
        <h2 style={{ margin: '0 0 20px', fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
          Change Password
        </h2>

        {state && 'success' in state && (
          <div style={{
            background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8,
            padding: '12px 16px', marginBottom: 16, color: '#166534', fontSize: '0.875rem', fontWeight: 600,
          }}>
            ✓ Password updated successfully
          </div>
        )}

        <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={lbl}>Current Password</label>
            <input type="password" name="current_password" required style={inp} />
          </div>
          <div>
            <label style={lbl}>New Password</label>
            <input type="password" name="new_password" required minLength={8} style={inp} />
            <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>Minimum 8 characters</p>
          </div>
          <div>
            <label style={lbl}>Confirm New Password</label>
            <input type="password" name="confirm_password" required style={inp} />
          </div>

          {state && 'error' in state && (
            <p style={{ margin: 0, color: '#ef4444', fontSize: '0.8125rem' }}>{state.error}</p>
          )}

          <button type="submit" disabled={pending} style={{
            padding: '10px 20px', background: '#6366f1', color: 'white',
            border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.9375rem',
            cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.6 : 1,
            alignSelf: 'flex-start',
          }}>
            {pending ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>

      <div style={{ marginTop: 24 }}>
        <TwoFactorCard enabled={twoFaEnabled} />
      </div>
    </div>
  );
}

function TwoFactorCard({ enabled }: { enabled: boolean }) {
  const [phase, setPhase] = useState<'idle' | 'setup' | 'done'>('idle');
  const [secret, setSecret] = useState<string | null>(null);
  const [url, setUrl]       = useState<string | null>(null);
  const [code, setCode]     = useState('');
  const [backup, setBackup] = useState<string[] | null>(null);
  const [err, setErr]       = useState<string | null>(null);
  const [busy, setBusy]     = useState(false);

  async function startSetup() {
    setBusy(true); setErr(null);
    const r = await begin2faEnrollment();
    setSecret(r.secret); setUrl(r.url); setPhase('setup');
    setBusy(false);
  }

  async function confirm() {
    setBusy(true); setErr(null);
    const r = await confirm2faEnrollment(code);
    setBusy(false);
    if (r.error) { setErr(r.error); return; }
    setBackup(r.backupCodes ?? []);
    setPhase('done');
  }

  async function turnOff() {
    if (!window.confirm('Disable two-factor authentication?')) return;
    setBusy(true); setErr(null);
    await disable2fa('');
    setPhase('idle'); setSecret(null); setUrl(null); setBackup(null);
    setBusy(false);
  }

  return (
    <div style={{
      background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: '24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
          Two-factor authentication
        </h2>
        <span style={{
          padding: '3px 10px', borderRadius: 999, fontSize: '0.6875rem', fontWeight: 700,
          background: enabled ? '#dcfce7' : '#fef2f2',
          color: enabled ? '#166534' : '#dc2626',
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>{enabled ? 'On' : 'Off'}</span>
      </div>

      <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: '#6b7280' }}>
        Adds a one-time code from an authenticator app to your login.
        Strongly recommended for any account that touches orders or payments.
      </p>

      {enabled && phase !== 'done' && (
        <button onClick={turnOff} disabled={busy} style={{
          padding: '8px 16px', background: 'transparent', color: '#dc2626',
          border: '1px solid #fecaca', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600,
          cursor: busy ? 'not-allowed' : 'pointer',
        }}>
          Turn off 2FA
        </button>
      )}

      {!enabled && phase === 'idle' && (
        <button onClick={startSetup} disabled={busy} style={{
          padding: '10px 18px', background: '#111827', color: 'white',
          border: 'none', borderRadius: 8, fontSize: '0.875rem', fontWeight: 600,
          cursor: busy ? 'not-allowed' : 'pointer',
        }}>
          Set up 2FA
        </button>
      )}

      {phase === 'setup' && secret && url && (
        <div style={{ marginTop: 8 }}>
          <p style={{ fontSize: '0.8125rem', color: '#374151', marginBottom: 8 }}>
            Open Google Authenticator / Authy / 1Password, scan the QR or paste this secret:
          </p>
          <div style={{
            padding: '10px 14px', background: '#f9fafb', border: '1px solid #e5e7eb',
            borderRadius: 6, fontFamily: 'monospace', fontSize: '0.875rem',
            wordBreak: 'break-all', marginBottom: 12,
          }}>
            {secret}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt="2FA QR code"
            src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(url)}`}
            width={160} height={160}
            style={{ borderRadius: 6, border: '1px solid #e5e7eb', marginBottom: 12 }}
          />
          <label style={lbl}>Enter the 6-digit code from your app</label>
          <input
            value={code}
            onChange={e => setCode(e.target.value)}
            inputMode="numeric"
            maxLength={6}
            style={{ ...inp, fontFamily: 'monospace', letterSpacing: '0.2em', textAlign: 'center', maxWidth: 160 }}
          />
          {err && <p style={{ margin: '6px 0 0', color: '#dc2626', fontSize: '0.75rem' }}>{err}</p>}
          <button onClick={confirm} disabled={busy || code.length !== 6} style={{
            marginTop: 12, padding: '8px 16px', background: '#16a34a', color: 'white',
            border: 'none', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600,
            cursor: busy || code.length !== 6 ? 'not-allowed' : 'pointer',
          }}>
            Confirm + enable
          </button>
        </div>
      )}

      {phase === 'done' && backup && (
        <div style={{ marginTop: 8 }}>
          <p style={{ fontSize: '0.875rem', color: '#16a34a', fontWeight: 600, margin: '0 0 12px' }}>
            ✓ 2FA enabled. Save these one-time backup codes somewhere safe — each works once if you lose your authenticator app.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, fontFamily: 'monospace', fontSize: '0.8125rem', padding: 12, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6 }}>
            {backup.map(c => <div key={c}>{c}</div>)}
          </div>
          <button onClick={() => setPhase('idle')} style={{ marginTop: 12, padding: '8px 14px', background: 'transparent', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.8125rem', cursor: 'pointer' }}>
            Done
          </button>
        </div>
      )}
    </div>
  );
}
