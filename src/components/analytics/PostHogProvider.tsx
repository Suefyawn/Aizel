'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, Suspense } from 'react';

// posthog-js is ~50 KB gz and was pulling into every storefront route's
// first-load bundle via static `import posthog from 'posthog-js'`. Nothing
// outside this file uses the `posthog-js/react` provider hooks, so the
// React provider wrapper is gone — we only need the global `posthog`
// singleton, lazy-loaded after first paint. Pageview + yp:track forwarding
// happen via the same singleton once it's loaded.
//
// Trade-off: PostHog misses the very first paint event for ~50ms while the
// chunk loads; given person-on-event mode + the back-end's own server-side
// $pageview capture this is invisible in the funnel.

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

  useEffect(() => {
    if (!pathname) return;
    loadPostHog().then(ph => {
      let url = window.origin + pathname;
      const qs = searchParams.toString();
      if (qs) url += `?${qs}`;
      ph.capture('$pageview', { $current_url: url });
    }).catch(() => { /* PostHog opt-out / network — ignore */ });
  }, [pathname, searchParams]);

  return null;
}

// Forward `yp:track` window events (dispatched by lib/analytics.ts) to
// PostHog. lib/analytics stays vendor-neutral; PostHog gets the ecommerce
// events (add_to_cart, begin_checkout, purchase, etc.) without lib/analytics
// hard-importing posthog-js. Without this listener the funnel's add_to_cart
// step reads 0 even though the storefront fires the event on every add.
function YpTrackForwarder() {
  // Queue events that fire before posthog-js finishes loading so we don't
  // miss the early add_to_cart on a first-visit fast-clicker.
  const queue = useRef<Array<{ name: string; payload?: Record<string, unknown> }>>([]);
  const phRef = useRef<PostHog | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadPostHog().then(ph => {
      if (cancelled) return;
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
  }, []);
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
