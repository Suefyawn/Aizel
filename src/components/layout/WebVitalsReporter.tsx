'use client';

import { useEffect } from 'react';
import { captureMessage } from '@/lib/monitoring';
import { useConsent } from '@/lib/consent';

// Reports Core Web Vitals (LCP, CLS, INP, etc.) using Next.js' built-in
// reportWebVitals hook via useReportWebVitals. We forward to:
//   • console (dev) — always, regardless of consent (developer signal only)
//   • Sentry / captureMessage (prod) — ONLY when the visitor has opted in
//     via the cookie-consent banner (`consent.analytics === true`)
//
// Next 16 ships useReportWebVitals via 'next/web-vitals'.

import { useReportWebVitals } from 'next/web-vitals';

interface Metric {
  name: string;
  value: number;
  id: string;
  rating?: 'good' | 'needs-improvement' | 'poor';
  navigationType?: string;
}

export function WebVitalsReporter() {
  const { consent } = useConsent();
  const analyticsAllowed = consent?.analytics === true;

  useReportWebVitals((metric: Metric) => {
    // Dev console is always-on — pure developer signal, no PII leaves the
    // browser. Production reporting is gated on consent.
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[vitals]', metric.name, Math.round(metric.value), metric.rating);
      return;
    }
    if (!analyticsAllowed) return;
    if (metric.rating === 'poor') {
      void captureMessage(`Web Vital ${metric.name} = ${Math.round(metric.value)} (poor)`, 'warning');
    }
  });

  // Render nothing — it's a side-effect-only component.
  useEffect(() => () => undefined, []);
  return null;
}
