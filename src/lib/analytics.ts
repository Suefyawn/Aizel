// ============================================================================
// Lightweight product-analytics shim. Mirrors the GA4 Enhanced Ecommerce
// event names so a future plugin (Plausible, PostHog, GA4, etc.) can adapt
// without touching the rest of the codebase.
//
// At runtime: dispatches a `yp:track` CustomEvent on the window so any
// in-page analytics snippet can listen, and (if NEXT_PUBLIC_PLAUSIBLE_DOMAIN
// is set) issues a fire-and-forget POST to Plausible's events API.
//
// No deps, no extra weight in the bundle when no provider is configured.
// ============================================================================

'use client';

import { readConsent } from './consent';

export interface TrackProductPayload {
  product_id?: string;
  product_name?: string;
  brand?: string;
  category?: string;
  variant?: string;
  price?: number;
  qty?: number;
  currency?: string;
}

export interface TrackCartPayload {
  value?: number;
  currency?: string;
  items?: TrackProductPayload[];
}

export type TrackEvent =
  | { name: 'view_item';       payload: TrackProductPayload }
  | { name: 'add_to_cart';     payload: TrackProductPayload }
  | { name: 'remove_from_cart';payload: TrackProductPayload }
  | { name: 'view_cart';       payload: TrackCartPayload }
  | { name: 'begin_checkout';  payload: TrackCartPayload }
  | { name: 'purchase';        payload: TrackCartPayload & { transaction_id: string } }
  | { name: 'search';          payload: { query: string } }
  | { name: 'sign_up';         payload: { method?: string } };

const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

export function track(event: TrackEvent): void {
  if (typeof window === 'undefined') return;

  // Dispatch a DOM event so an in-page analytics snippet (the PostHog
  // forwarder in PostHogProvider, a GA4 snippet, etc.) can forward without us
  // hard-depending on any vendor. Dispatched unconditionally — PostHog already
  // captures $pageview / $autocapture for every visitor regardless of the
  // cookie-banner choice, so gating only the ecommerce subset would zero out
  // the funnel for unconsenting traffic while leaving the rest of PostHog
  // populated (the inconsistency QA caught: add_to_cart read 0 while
  // pageviews ran in the thousands). PostHog applies its own consent /
  // suppression rules; downstream listeners decide for themselves.
  try {
    window.dispatchEvent(new CustomEvent('yp:track', { detail: event }));
  } catch {
    /* ignore */
  }

  // The third-party HTTP / gtag sinks below DO honour the consent banner:
  // Plausible and gtag require an explicit opt-in to send anything because
  // they originate the network request from this code, not from a vendor SDK
  // that has its own consent UI.
  const consent = readConsent();
  if (!consent?.analytics) return;

  // Plausible has a tiny events endpoint that needs no SDK.
  if (PLAUSIBLE_DOMAIN) {
    try {
      void fetch('https://plausible.io/api/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: event.name,
          domain: PLAUSIBLE_DOMAIN,
          url: window.location.href,
          referrer: document.referrer || undefined,
          props: event.payload,
        }),
        keepalive: true,
      });
    } catch {
      /* ignore */
    }
  }

  // GA4 / gtag is a common in-page snippet. Forward if present.
  const w = window as unknown as { gtag?: (cmd: string, name: string, params?: unknown) => void };
  if (typeof w.gtag === 'function') {
    try { w.gtag('event', event.name, event.payload as unknown); } catch { /* ignore */ }
  }
}
