'use client';

// Cookie / tracking consent. Three buckets — `essential` is always on (we
// need it for cart, login, CSRF), the other two are opt-in. Persisted to
// localStorage and a cookie (the cookie is so server actions and edge
// middleware can also see the preference without round-tripping the client).
//
// Consumer pattern:
//   import { useConsent } from '@/lib/consent';
//   const { consent } = useConsent();
//   if (consent.analytics) loadAnalytics();
//
// Or, for one-shot reads outside React:
//   import { readConsent } from '@/lib/consent';

import { useEffect, useState } from 'react';

export type ConsentBucket = 'essential' | 'analytics' | 'marketing';

export interface Consent {
  essential: true;            // always on; encoded so types stay clean
  analytics: boolean;
  marketing: boolean;
  ts: number;                 // unix ms when the choice was set
  v: 1;                       // schema version, bump if shape changes
}

const STORAGE_KEY = 'yp_consent_v1';
const COOKIE_NAME = 'yp_consent';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export const DEFAULT_CONSENT: Consent = {
  essential: true,
  analytics: false,
  marketing: false,
  ts: 0,
  v: 1,
};

export function readConsent(): Consent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Consent>;
    if (parsed.v !== 1) return null;
    return {
      essential: true,
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing),
      ts: Number(parsed.ts ?? 0),
      v: 1,
    };
  } catch {
    return null;
  }
}

export function writeConsent(input: Partial<Consent>): Consent {
  const next: Consent = {
    essential: true,
    analytics: Boolean(input.analytics),
    marketing: Boolean(input.marketing),
    ts: Date.now(),
    v: 1,
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
    // Cookie mirror so SSR + edge middleware can read it.
    // Compact stringly-typed format: `a=1;m=0`.
    const cookieVal = `a=${next.analytics ? 1 : 0};m=${next.marketing ? 1 : 0}`;
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(cookieVal)}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
    // Broadcast so other tabs / components can react.
    window.dispatchEvent(new CustomEvent('yp:consent', { detail: next }));
  }
  return next;
}

/** Accept-all helper used by the banner's primary button. */
export function acceptAll(): Consent {
  return writeConsent({ analytics: true, marketing: true });
}

/** Reject-all (essentials still on) helper. */
export function rejectAll(): Consent {
  return writeConsent({ analytics: false, marketing: false });
}

/** React subscriber. Returns the current consent or null if the user
 *  hasn't chosen yet — `null` means the banner should be shown. */
export function useConsent(): {
  consent: Consent | null;
  setConsent: (c: Partial<Consent>) => void;
} {
  const [consent, setLocal] = useState<Consent | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocal(readConsent());
    const onUpdate = (e: Event) => setLocal((e as CustomEvent<Consent>).detail);
    window.addEventListener('yp:consent', onUpdate);
    return () => window.removeEventListener('yp:consent', onUpdate);
  }, []);

  return {
    consent,
    setConsent: (c: Partial<Consent>) => setLocal(writeConsent(c)),
  };
}
