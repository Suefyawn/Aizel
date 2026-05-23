'use client';

// GA4 (gtag.js) loader. Activated by NEXT_PUBLIC_GA_MEASUREMENT_ID and gated
// on analytics consent — visitors who haven't opted in never download the
// script, matching the rest of the consent gating (see lib/analytics.ts).
//
// Commerce events (view_item / add_to_cart / begin_checkout / purchase / etc.)
// are already forwarded to window.gtag by lib/analytics.ts's track() helper,
// so the moment this script is in the page they start flowing to GA4 with no
// further wiring. This component only adds the base tag + a client-side
// pageview tracker (App Router doesn't auto-fire page_view on soft nav).

import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { useConsent } from '@/lib/consent';

const MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

// Fires a manual `page_view` on every route change. The base `config` call
// runs once with send_page_view:false so the initial load + every soft nav
// produce exactly one event each.
function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    if (!MEASUREMENT_ID || typeof window === 'undefined' || typeof window.gtag !== 'function') return;
    const qs = searchParams?.toString();
    const path = qs ? `${pathname}?${qs}` : pathname;
    window.gtag('event', 'page_view', {
      page_path: path,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [pathname, searchParams]);
  return null;
}

export function GoogleAnalytics() {
  const { consent } = useConsent();
  if (!MEASUREMENT_ID) return null;
  if (!consent?.analytics) return null;
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${MEASUREMENT_ID}', {
            send_page_view: false,
            anonymize_ip: true,
          });
        `}
      </Script>
      {/* useSearchParams() requires a Suspense boundary in the App Router. */}
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
    </>
  );
}
