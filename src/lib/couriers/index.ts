// ============================================================================
// UK courier registry + adapter resolver.
//
// Each courier has:
//   (a) A CourierProfile — display name + the public tracking-URL builder
//       used by the /track page so customers can deep-link to the courier's
//       site.
//   (b) Optionally, an API-backed CourierAdapter (see types.ts) that can
//       book + cancel + track via HTTP. The previous codebase shipped a TCS
//       (Pakistan) adapter; no UK adapter is wired yet, so the booking
//       flow falls back to manual tracking-number entry for every courier
//       below until a Royal Mail / DPD / Evri integration is added.
//
// To add a UK adapter (e.g. Royal Mail Shipping API or DPD WebShipper):
//   1. Create src/lib/couriers/<name>.ts implementing CourierAdapter.
//   2. Import + add to ADAPTERS below.
//   3. Document its required env vars in the file header.
// ============================================================================

import type { CourierAdapter } from './types';

export interface CourierProfile {
  id: string;
  name: string;
  trackingUrl: (n: string) => string;
}

/**
 * UK couriers we actively offer in admin. Order roughly mirrors
 * the volume a small UK D2C retailer would see:
 *   • Royal Mail Tracked 24/48 — the default for small parcels.
 *   • Royal Mail Special Delivery — high-value / signed-for next day.
 *   • DPD — > 2 kg parcels, next-day with hour-window tracking.
 *   • Evri — light parcels at the cheapest rate.
 *   • Yodel — bulk / Sunday delivery.
 *   • Parcelforce — heavier / international.
 *   • Other — manual catch-all for one-off carriers.
 *
 * Tracking-URL builders are all the canonical public pages — clicking
 * "Open courier page" on /track deep-links straight to the carrier's
 * status view.
 */
export const COURIERS: Record<string, CourierProfile> = {
  RoyalMail: {
    id: 'RoyalMail',
    name: 'Royal Mail',
    trackingUrl: (n) => `https://www.royalmail.com/track-your-item#/tracking-results/${encodeURIComponent(n)}`,
  },
  RoyalMailSpecial: {
    id: 'RoyalMailSpecial',
    name: 'Royal Mail Special Delivery',
    trackingUrl: (n) => `https://www.royalmail.com/track-your-item#/tracking-results/${encodeURIComponent(n)}`,
  },
  DPD: {
    id: 'DPD',
    name: 'DPD',
    trackingUrl: (n) => `https://track.dpd.co.uk/parcels/${encodeURIComponent(n)}`,
  },
  Evri: {
    id: 'Evri',
    name: 'Evri',
    trackingUrl: (n) => `https://www.evri.com/track/parcel/${encodeURIComponent(n)}`,
  },
  Yodel: {
    id: 'Yodel',
    name: 'Yodel',
    trackingUrl: (n) => `https://www.yodel.co.uk/tracking/${encodeURIComponent(n)}`,
  },
  Parcelforce: {
    id: 'Parcelforce',
    name: 'Parcelforce',
    trackingUrl: (n) => `https://www.parcelforce.com/portal/pw/track?trackNumber=${encodeURIComponent(n)}`,
  },
  Other: {
    id: 'Other',
    name: 'Other / Manual',
    trackingUrl: (n) => `https://www.google.com/search?q=track+${encodeURIComponent(n)}`,
  },
};

export const COURIER_LIST = Object.values(COURIERS);

// ─── API adapter map ───────────────────────────────────────────────────────
// Empty until a UK courier adapter is wired. The legacy TCS adapter is no
// longer registered here — it stays in src/lib/couriers/tcs.ts for the
// edge-function shipping webhook to import directly during the transition,
// but storefront / admin code paths route through getAdapter() and so will
// fall back to manual tracking until a Royal Mail / DPD adapter ships.
const ADAPTERS: Record<string, CourierAdapter> = {};

/**
 * Returns the live API adapter for a courier id, or null if:
 *   - the courier doesn't have an adapter implemented yet, OR
 *   - the adapter's required env vars aren't set in this deployment.
 *
 * Callers should fall back to manual tracking-number entry in either case.
 */
export function getAdapter(courierId: string | null | undefined): CourierAdapter | null {
  if (!courierId) return null;
  const adapter = ADAPTERS[courierId];
  if (!adapter) return null;
  return adapter.isConfigured() ? adapter : null;
}

/** List of courier ids that have a configured + live adapter. UI uses this
 *  to decide whether to show "Book pickup" or "Enter tracking manually". */
export function configuredAdapterIds(): string[] {
  return Object.keys(ADAPTERS).filter(id => ADAPTERS[id].isConfigured());
}

export function courierTrackingUrl(courier: string | null | undefined, tracking: string): string | null {
  if (!courier) return null;
  // First try an exact id match; fall back to a fuzzy contains so that legacy
  // free-text courier strings (e.g. "Royal Mail Tracked 24") resolve to the
  // base Royal Mail profile.
  const profile = COURIERS[courier]
    ?? Object.values(COURIERS).find(p => courier.toLowerCase().includes(p.id.toLowerCase()))
    ?? Object.values(COURIERS).find(p => courier.toLowerCase().includes(p.name.toLowerCase().split(' ')[0]));
  return profile ? profile.trackingUrl(tracking) : null;
}

// Re-export the status mapper so the existing webhook route's
// `import { normaliseCourierStatus } from '@/lib/couriers'` keeps working.
export { normaliseCourierStatus } from './status-mapper';
