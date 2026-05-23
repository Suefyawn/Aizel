'use client';

import { useEffect, useState } from 'react';
import { readConsent, writeConsent, DEFAULT_CONSENT, type Consent } from '@/lib/consent';

// Inline interactive consent management for /privacy. Mirrors the banner
// toggles so a user who already made a choice (and dismissed the banner)
// can change their mind without us having to nag them with the banner again.

export function PrivacyCenter() {
  const [consent, setLocal] = useState<Consent>(DEFAULT_CONSENT);
  const [saved, setSaved] = useState<'idle' | 'just-saved'>('idle');

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setLocal(readConsent() ?? DEFAULT_CONSENT); }, []);

  const persist = (next: Partial<Consent>) => {
    const merged = writeConsent({ ...consent, ...next });
    setLocal(merged);
    setSaved('just-saved');
    setTimeout(() => setSaved('idle'), 2000);
  };

  return (
    <section
      aria-labelledby="cookie-prefs-heading"
      style={{
        padding: 24, border: '1px solid var(--line)', borderRadius: 'var(--radius-card)',
        background: 'var(--paper2)', marginTop: 8,
      }}
    >
      <h2 id="cookie-prefs-heading" className="h2" style={{ marginBottom: 6 }}>
        Your cookie preferences
      </h2>
      <p className="small-text" style={{ marginBottom: 16, color: 'var(--ink-700)' }}>
        Changes save automatically. Disabling a category will stop the corresponding scripts on
        your next page load.
      </p>

      <Toggle
        label="Essential"
        description="Required for cart, checkout, login. Always on."
        checked
        disabled
      />
      <Toggle
        label="Analytics"
        description="Anonymous page-view + Web Vitals data so we can see which pages help shoppers."
        checked={consent.analytics}
        onChange={v => persist({ analytics: v })}
      />
      <Toggle
        label="Marketing"
        description="Retargeting cookies so we can show you relevant offers off-site."
        checked={consent.marketing}
        onChange={v => persist({ marketing: v })}
      />

      <div
        aria-live="polite"
        style={{
          marginTop: 12, fontSize: '0.75rem', color: 'var(--success)',
          minHeight: 16,
        }}
      >
        {saved === 'just-saved' ? 'Preferences saved.' : ''}
      </div>
    </section>
  );
}

function Toggle({ label, description, checked, onChange, disabled }: {
  label: string; description: string; checked: boolean;
  onChange?: (v: boolean) => void; disabled?: boolean;
}) {
  const id = `pref-${label.toLowerCase()}`;
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '12px 0', borderTop: '1px solid var(--line)',
    }}>
      <input
        id={id} type="checkbox" checked={checked} disabled={disabled}
        onChange={e => onChange?.(e.target.checked)}
        style={{ marginTop: 4, accentColor: 'var(--brand-pink)', width: 18, height: 18, cursor: disabled ? 'default' : 'pointer' }}
      />
      <label htmlFor={id} style={{ flex: 1, cursor: disabled ? 'default' : 'pointer' }}>
        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--ink-900)' }}>{label}</div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--ink-700)', lineHeight: 1.5 }}>{description}</div>
      </label>
    </div>
  );
}
