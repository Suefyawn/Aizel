'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getBrowserClient } from '@/lib/supabase-browser';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Profile } from '@/types';

const inp: React.CSSProperties = {
  width: '100%', padding: '11px 14px',
  border: '1px solid #d1d5db', borderRadius: 8,
  fontSize: '0.9375rem', color: '#111827', background: 'white',
  outline: 'none', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.8125rem', fontWeight: 600,
  color: '#374151', marginBottom: 5,
};

// UK phone: optional +44 / 0044 / 0 prefix, then a mobile (7…) or landline
// (1/2/3…). Mirrors normaliseUKPhone() in src/lib/notifications/twilio.ts so
// inline validation matches what Twilio will accept downstream.
const UK_PHONE = /^(?:\+?44|0044|0)(7\d{9}|[123]\d{8,9})$/;

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [originalSnap, setOriginalSnap] = useState<string>('');
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Load existing profile ────────────────────────────────────────────────
  useEffect(() => {
    if (!loading && !user) { router.replace('/login'); return; }
    if (!user) return;
    const sb = getBrowserClient();
    sb.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
      const profile = data as Profile | null;
      const f = profile?.first_name ?? '';
      const l = profile?.last_name ?? '';
      const p = profile?.phone ?? '';
      setFirstName(f); setLastName(l); setPhone(p);
      setOriginalSnap(JSON.stringify({ f, l, p }));
      setHydrated(true);
    });
  }, [user, loading, router]);

  // Auto-dismiss the success banner after 4 s so it doesn't linger forever.
  useEffect(() => {
    if (!success) return;
    successTimer.current = setTimeout(() => setSuccess(false), 4000);
    return () => { if (successTimer.current) clearTimeout(successTimer.current); };
  }, [success]);

  // ─── Dirty + valid checks ─────────────────────────────────────────────────
  const dirty = useMemo(() => {
    return JSON.stringify({ f: firstName, l: lastName, p: phone }) !== originalSnap;
  }, [firstName, lastName, phone, originalSnap]);

  const phoneNormalised = phone.replace(/\s+/g, '');
  const phoneValid = phone === '' || UK_PHONE.test(phoneNormalised);
  const canSave = hydrated && dirty && phoneValid && !saving;

  if (loading || !user) {
    return (
      <div className="container" style={{ padding: '48px var(--side)' }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <Skeleton height={32} width="40%" style={{ marginBottom: 32 }} />
          <div style={{ background: 'white', borderRadius: 16, padding: 32, border: '1px solid var(--line)' }}>
            <Skeleton height={48} width="100%" style={{ marginBottom: 20 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <Skeleton height={66} /> <Skeleton height={66} />
            </div>
            <Skeleton height={66} style={{ marginBottom: 20 }} />
            <Skeleton height={44} width="50%" radius={8} />
          </div>
        </div>
      </div>
    );
  }

  // ─── Save handler ─────────────────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setError('');
    setSuccess(false);
    setSaving(true);
    const sb = getBrowserClient();
    const { error } = await sb.from('profiles').upsert({
      id: user.id,
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      phone: phoneNormalised || null,
    } as never);
    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
      setOriginalSnap(JSON.stringify({ f: firstName, l: lastName, p: phone }));
    }
    setSaving(false);
  };

  return (
    <div className="container" style={{ padding: '48px var(--side)' }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <Link href="/account" style={{ color: 'var(--ink-500)', textDecoration: 'none', fontSize: '0.875rem' }}>← Account</Link>
          <span style={{ color: 'var(--line)' }} aria-hidden="true">/</span>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 500 }}>Profile</h1>
        </div>

        <div style={{ background: 'white', borderRadius: 16, padding: '32px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid var(--line)' }}>
          <div style={{
            // `--cream` was a previous-brand-era variable that no longer exists,
            // so this card was rendering with no background. `--paper2` is
            // the Aizel pale-paper surface for inset info blocks.
            marginBottom: 24, padding: '12px 16px', background: 'var(--paper2)',
            borderRadius: 8, fontSize: '0.875rem', color: 'var(--ink-500)',
          }}>
            Email: <strong style={{ color: 'var(--ink-900)' }}>{user.email}</strong>
            <div style={{ fontSize: '0.75rem', marginTop: 4 }}>
              To change your email, contact support.
            </div>
          </div>

          <div aria-live="polite" aria-atomic="true">
            {error && (
              <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 20, color: '#dc2626', fontSize: '0.875rem' }}>
                {error}
              </div>
            )}
            {success && (
              <div role="status" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 20, color: '#16a34a', fontSize: '0.875rem' }}>
                ✓ Profile saved
              </div>
            )}
          </div>

          <form onSubmit={handleSave} aria-busy={saving} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="duo-grid">
              <div>
                <label htmlFor="profile-fname" style={lbl}>First name</label>
                <input id="profile-fname" autoComplete="given-name" value={firstName} onChange={e => setFirstName(e.target.value)} style={inp} placeholder="Maya" />
              </div>
              <div>
                <label htmlFor="profile-lname" style={lbl}>Last name</label>
                <input id="profile-lname" autoComplete="family-name" value={lastName} onChange={e => setLastName(e.target.value)} style={inp} placeholder="Okoye" />
              </div>
            </div>
            <div>
              <label htmlFor="profile-phone" style={lbl}>Phone number</label>
              <input
                id="profile-phone"
                autoComplete="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                style={{ ...inp, borderColor: phoneValid ? '#d1d5db' : '#fca5a5' }}
                placeholder="07123456789"
                type="tel"
                inputMode="tel"
                aria-invalid={!phoneValid}
                aria-describedby="profile-phone-help"
              />
              <div
                id="profile-phone-help"
                style={{
                  marginTop: 6, fontSize: '0.75rem',
                  color: phoneValid ? 'var(--ink-500)' : '#dc2626',
                }}
              >
                {phoneValid
                  ? 'UK mobile, e.g. 07123456789 or +447123456789. Used for order updates.'
                  : 'Enter a valid UK mobile (e.g. 07123 456789 or +447123456789).'}
              </div>
            </div>
            <button
              type="submit"
              disabled={!canSave}
              style={{
                padding: '12px', background: canSave ? 'var(--brand-pink)' : '#f9a8d4',
                color: 'white', border: 'none', borderRadius: 8,
                fontSize: '0.9375rem', fontWeight: 600,
                cursor: canSave ? 'pointer' : 'not-allowed',
                marginTop: 4, transition: 'background 150ms',
              }}
            >
              {saving ? 'Saving…' : dirty ? 'Save profile' : 'No changes to save'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
