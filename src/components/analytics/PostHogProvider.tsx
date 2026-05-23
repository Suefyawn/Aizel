'use client';

import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';

function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    let url = window.origin + pathname;
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
    posthog.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

// Forward `yp:track` window events (dispatched by lib/analytics.ts) to
// PostHog. lib/analytics stays vendor-neutral; PostHog gets the ecommerce
// events (add_to_cart, begin_checkout, purchase, etc.) without lib/analytics
// hard-importing posthog-js. Without this listener the funnel's add_to_cart
// step reads 0 even though the storefront fires the event on every add.
function YpTrackForwarder() {
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ name?: string; payload?: Record<string, unknown> }>).detail;
      if (!detail?.name) return;
      try { posthog.capture(detail.name, detail.payload); } catch { /* ignore */ }
    };
    window.addEventListener('yp:track', handler);
    return () => window.removeEventListener('yp:track', handler);
  }, []);
  return null;
}

export function PHProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;
    posthog.init(key, {
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
  }, []);

  return (
    <PostHogProvider client={posthog}>
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
      <YpTrackForwarder />
      {children}
    </PostHogProvider>
  );
}
