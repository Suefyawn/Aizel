'use client';

import Script from 'next/script';
import { useConsent } from '@/lib/consent';

// Privacy-friendly storefront analytics via Plausible. Loads only when:
//   1. NEXT_PUBLIC_PLAUSIBLE_DOMAIN is configured (operator opt-in), AND
//   2. The visitor has granted analytics consent in the cookie banner.
//
// Why Plausible (not GA4 / Meta Pixel) by default:
//   • No personal data collected, no cookies set, no consent required
//     under most readings of UK ICO guidance — but we still gate on the
//     consent flag for belt-and-braces.
//   • Single-script payload (< 1 KB), no third-party fonts or pixels.
//   • Owned by the merchant; can be self-hosted later if Plausible
//     Cloud isn't preferred.
//
// GA4 / Meta Pixel can be layered as additional consent-gated <Script>
// blocks if the operator decides to add them — same pattern: read the
// consent hook, return null when not consented or env not set.

export function PlausibleAnalytics() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  const { consent } = useConsent();

  // Three gates, each is a hard stop:
  //   • No domain → operator hasn't opted in (e.g. demo deploy).
  //   • consent === null → banner hasn't been answered; don't preload.
  //   • consent.analytics === false → explicit decline; stay quiet.
  if (!domain) return null;
  if (!consent || !consent.analytics) return null;

  // `strategy="afterInteractive"` so we don't block the initial render;
  // `defer` is the default for <Script> in this mode. The Plausible
  // script auto-fires a pageview on load and on subsequent client
  // navigations (via the History API hook it installs).
  return (
    <Script
      defer
      data-domain={domain}
      src="https://plausible.io/js/script.js"
      strategy="afterInteractive"
    />
  );
}
