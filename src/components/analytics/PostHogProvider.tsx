'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, Suspense } from 'react';
import { useConsent } from '@/lib/consent';

// posthog-js is ~50 KB gz and was pulling into every storefront route's
// first-load bundle via static `import posthog from 'posthog-js'`. Nothing
// outside this file uses the `posthog-js/react` provider hooks, so the
// React provider wrapper is gone — we only need the global `posthog`
// singleton, lazy-loaded after first paint. Pageview + yp:track forwarding
// happen via the same singleton once it's loaded.
//
// CONSENT GATING (UK PECR / GDPR): posthog-js sets cookies + runs session
// recording / autocapture, so it is an "analytics cookie" that legally
// requires prior opt-in. We therefore DO NOT call loadPostHog() until the
// visitor has accepted the analytics bucket in the consent banner
// (consent.analytics === true). If they later revoke, we opt the SDK out.
// Sentry is left ungated — operational error monitoring is strictly
// necessary, not behavioural tracking.

type PostHog = typeof import('posthog-js').default;

let phPromise: Promise<PostHog> | null = null;
function loadPostHog(): Promise<PostHog> {
  if (!phPromise) {
    phPromise = import('posthog-js').then(mod => {
      const ph = mod.default;
      const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
      if (!key) return ph;
      ph.init(key, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
        capture_pageview: false,
        capture_pageleave: true,
        person_profiles: 'identified_only',
        // Drop every event that happens inside /admin. Staff working in the
        // dashboard is not real storefront traffic — capturing it skews the
        // pageview / top-pages / funnel analytics the owner reads.
        before_send: (event) => {
          if (event) {
            const raw = event.properties?.['$current_url'] ?? event.properties?.['$pathname'];
            let path = '';
            if (typeof raw === 'string') {
              try { path = new URL(raw, 'http://_').pathname; } catch { path = raw; }
            }
            if (path.startsWith('/admin')) return null;
          }
          return event;
        },
      });
      return ph;
    });
  }
  return phPromise;
}

function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { consent } = useConsent();
  const analyticsOn = consent?.analytics === true;

  // Capture pageviews only while analytics consent is granted. The effect
  // also re-runs when `analyticsOn` flips true (the moment the visitor
  // clicks "Accept" in the banner), so the page they're on still counts.
  useEffect(() => {
    if (!pathname || !analyticsOn) return;
    loadPostHog().then(ph => {
      // Re-enable if a previous session revoked + opted the SDK out.
      ph.opt_in_capturing?.();
      let url = window.origin + pathname;
      const qs = searchParams.toString();
      if (qs) url += `?${qs}`;
      ph.capture('$pageview', { $current_url: url });
    }).catch(() => { /* PostHog opt-out / network — ignore */ });
  }, [pathname, searchParams, analyticsOn]);

  // Revocation: if analytics is switched off after the SDK has loaded,
  // stop capturing. We only touch posthog if it was ever loaded
  // (phPromise non-null) so a never-consented visitor never inits it.
  useEffect(() => {
    if (analyticsOn || !phPromise) return;
    phPromise.then(ph => ph.opt_out_capturing?.()).catch(() => { /* ignore */ });
  }, [analyticsOn]);

  return null;
}

// Forward `yp:track` window events (dispatched by lib/analytics.ts) to
// PostHog. lib/analytics stays vendor-neutral; PostHog gets the ecommerce
// events (add_to_cart, begin_checkout, purchase, etc.) without lib/analytics
// hard-importing posthog-js. Gated on analytics consent like the pageview
// tracker — no consent, no forwarding (and no SDK load).
function YpTrackForwarder() {
  const { consent } = useConsent();
  const analyticsOn = consent?.analytics === true;
  // Queue events that fire before posthog-js finishes loading so we don't
  // miss the early add_to_cart on a first-visit fast-clicker.
  const queue = useRef<Array<{ name: string; payload?: Record<string, unknown> }>>([]);
  const phRef = useRef<PostHog | null>(null);

  useEffect(() => {
    if (!analyticsOn) return;
    let cancelled = false;
    loadPostHog().then(ph => {
      if (cancelled) return;
      ph.opt_in_capturing?.();
      phRef.current = ph;
      for (const e of queue.current) {
        try { ph.capture(e.name, e.payload); } catch { /* ignore */ }
      }
      queue.current = [];
    }).catch(() => { /* ignore */ });

    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ name?: string; payload?: Record<string, unknown> }>).detail;
      if (!detail?.name) return;
      if (phRef.current) {
        try { phRef.current.capture(detail.name, detail.payload); } catch { /* ignore */ }
      } else {
        queue.current.push({ name: detail.name, payload: detail.payload });
      }
    };
    window.addEventListener('yp:track', handler);
    return () => { cancelled = true; window.removeEventListener('yp:track', handler); };
  }, [analyticsOn]);
  return null;
}

export function PHProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
      <YpTrackForwarder />
      {children}
    </>
  );
}
