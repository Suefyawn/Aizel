'use client';

// Meta (Facebook) Pixel loader. Gated on:
//   1. NEXT_PUBLIC_META_PIXEL_ID env var set (operator opt-in)
//   2. consent.MARKETING granted (not analytics — Meta Pixel is explicitly
//      for ad retargeting, which sits in the marketing bucket per ICO
//      guidance on cookie classification)
//
// Why a separate component from GoogleAnalytics:
//   • Different consent bucket — a shopper can opt into analytics
//     (Plausible / GA4 for site stats) without opting into marketing
//     (Meta Pixel / TikTok Pixel for retargeting). Splitting the loaders
//     keeps each gate honest.
//   • Different lifecycle — Meta wants `track('PageView')` per route
//     change; GA4 has its own page_view event with different field names.
//     Easier to maintain as parallel components than one tangled file.

import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { useConsent } from '@/lib/consent';

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[] };
    _fbq?: unknown;
  }
}

// Re-fires PageView on every soft navigation. Meta's `fbq('init')` only
// counts the FIRST PageView, so subsequent client-side route changes need
// an explicit `track('PageView')` call.
function PixelPageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    if (!PIXEL_ID || typeof window === 'undefined' || typeof window.fbq !== 'function') return;
    window.fbq('track', 'PageView');
    // Capture the path in a custom dimension so Meta's reports can
    // segment by URL without us needing event_source_url debugging.
    void pathname; void searchParams;
  }, [pathname, searchParams]);
  return null;
}

export function MetaPixel() {
  const { consent } = useConsent();
  if (!PIXEL_ID) return null;
  if (!consent?.marketing) return null;
  return (
    <>
      {/* Standard Meta Pixel bootstrap, lifted from facebook.com/business/help
          base-code docs and trimmed of the <noscript> img fallback (we run
          consent-gated, so the no-JS fallback shouldn't fire either). */}
      <Script id="meta-pixel-init" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${PIXEL_ID}');
          fbq('track', 'PageView');
        `}
      </Script>
      {/* useSearchParams() requires Suspense in the App Router. */}
      <Suspense fallback={null}>
        <PixelPageviewTracker />
      </Suspense>
    </>
  );
}
