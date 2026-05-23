'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { readConsent, writeConsent, acceptAll, rejectAll } from '@/lib/consent';

// Bottom-left consent prompt shown until the user makes a choice. We keep
// it small + dismissible (no full-screen modal blocking the page) so first
// impressions aren't ruined by a compliance wall. Once a choice is recorded
// it never reappears unless the user resets from /privacy.
//
// Mounted once in src/app/layout.tsx so it's available on every route.

const ESCAPE_DELAY_MS = 600;

export function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(true);

  // Mount-time gate so we don't render the banner during SSR — the consent
  // state lives in document.cookie (external), and only the client side
  // knows whether to surface the banner.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    // Wait a beat so we don't compete with the page load animation.
    const t = setTimeout(() => {
      if (!readConsent()) setVisible(true);
    }, ESCAPE_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  if (!mounted || !visible) return null;

  const handleAccept = () => { acceptAll(); setVisible(false); };
  const handleReject = () => { rejectAll(); setVisible(false); };
  const handleSave   = () => { writeConsent({ analytics, marketing }); setVisible(false); };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookie preferences"
      style={{
        position: 'fixed',
        left: 16, bottom: 16,
        width: 'min(420px, calc(100vw - 32px))',
        background: 'var(--paper)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-card)',
        boxShadow: '0 18px 48px rgba(0,0,0,0.18)',
        padding: 20,
        zIndex: 400,
        fontFamily: 'var(--font-ui)',
      }}
    >
      <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--ink-900)' }}>
        Cookies on Aizel
      </h2>
      <p style={{ margin: '6px 0 14px', fontSize: '0.8125rem', lineHeight: 1.5, color: 'var(--ink-700)' }}>
        We use essential cookies for cart + checkout. With your permission we also use analytics
        cookies to understand which pages help shoppers and marketing cookies for retargeting.{' '}
        <Link href="/privacy" className="underline" style={{ color: 'var(--ink-900)' }}>
          Privacy & cookie policy
        </Link>
        .
      </p>

      {expanded && (
        <div style={{ marginBottom: 14, padding: 12, border: '1px solid var(--line)', borderRadius: 6, background: 'var(--paper2)' }}>
          <Row label="Essential" description="Required for cart, checkout, login. Cannot be disabled." disabled checked />
          <Row label="Analytics" description="Helps us see which pages convert (no PII)." checked={analytics} onChange={setAnalytics} />
          <Row label="Marketing" description="Used to retarget you with relevant ads." checked={marketing} onChange={setMarketing} />
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <button
          onClick={handleAccept}
          className="btn-primary"
          style={{ padding: '10px 18px', fontSize: '0.75rem', minHeight: 40 }}
        >
          Accept all
        </button>
        <button
          onClick={expanded ? handleSave : handleReject}
          style={{
            background: 'none', border: '1px solid var(--ink-900)', cursor: 'pointer',
            padding: '10px 16px', borderRadius: 'var(--radius-card)',
            fontFamily: 'var(--font-ui)', fontSize: '0.75rem', fontWeight: 600,
            letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-900)',
            minHeight: 40,
          }}
        >
          {expanded ? 'Save choices' : 'Reject non-essential'}
        </button>
        <button
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '10px 8px', color: 'var(--ink-700)', fontFamily: 'var(--font-ui)',
            fontSize: '0.75rem', fontWeight: 500, textDecoration: 'underline',
            textUnderlineOffset: 2,
          }}
        >
          {expanded ? 'Hide options' : 'Customise'}
        </button>
      </div>
    </div>
  );
}

function Row({ label, description, checked, onChange, disabled }: {
  label: string; description: string; checked: boolean;
  onChange?: (v: boolean) => void; disabled?: boolean;
}) {
  const id = `consent-${label.toLowerCase()}`;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 0' }}>
      <input
        id={id} type="checkbox" checked={checked} disabled={disabled}
        onChange={e => onChange?.(e.target.checked)}
        style={{ marginTop: 3, accentColor: 'var(--brand-pink)' }}
      />
      <label htmlFor={id} style={{ flex: 1, cursor: disabled ? 'default' : 'pointer' }}>
        <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--ink-900)' }}>{label}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--ink-700)', lineHeight: 1.4 }}>{description}</div>
      </label>
    </div>
  );
}
