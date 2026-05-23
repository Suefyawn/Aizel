// ============================================================================
// Pakistan courier registry + adapter resolver.
//
// Each PK courier has:
//   (a) A CourierProfile — display name + the public tracking-URL builder
//       used by the /track page so customers can deep-link to the courier's
//       site.
//   (b) Optionally, an API-backed CourierAdapter (see types.ts + tcs.ts)
//       that can book + cancel + track via HTTP. Adapters are looked up via
//       getAdapter(id); merchants without API credentials fall back to the
//       manual tracking-number workflow.
//
// To add another courier (Leopards / M&P / BlueEx):
//   1. Create src/lib/couriers/<name>.ts implementing CourierAdapter.
//   2. Import + add to ADAPTERS below.
//   3. Document its required env vars in the file header.
// ============================================================================

import type { CourierAdapter } from './types';
import { tcs } from './tcs';

export interface CourierProfile {
  id: string;
  name: string;
  trackingUrl: (n: string) => string;
}

export const COURIERS: Record<string, CourierProfile> = {
  TCS: {
    id: 'TCS',
    name: 'TCS',
    trackingUrl: (n) => `https://www.tcsexpress.com/track/${encodeURIComponent(n)}`,
  },
  Leopards: {
    id: 'Leopards',
    name: 'Leopards Courier',
    trackingUrl: (n) => `https://www.leopardscourier.com/leopards/tracking?tracking_number=${encodeURIComponent(n)}`,
  },
  'M&P': {
    id: 'M&P',
    name: 'M&P',
    trackingUrl: (n) => `https://www.mulphilog.com/tracking?cnno=${encodeURIComponent(n)}`,
  },
  BlueEx: {
    id: 'BlueEx',
    name: 'BlueEx',
    trackingUrl: (n) => `https://www.blue-ex.com/tracking/${encodeURIComponent(n)}`,
  },
  Other: {
    id: 'Other',
    name: 'Other / Manual',
    trackingUrl: (n) => `https://www.google.com/search?q=track+${encodeURIComponent(n)}`,
  },
};

export const COURIER_LIST = Object.values(COURIERS);

// ─── API adapter map ───────────────────────────────────────────────────────
// Only couriers with a real adapter live here. Look up via getAdapter(id);
// returns null if the courier is manual-only or the env isn't configured.
const ADAPTERS: Record<string, CourierAdapter> = {
  TCS: tcs,
};

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
  const profile = COURIERS[courier]
    ?? Object.values(COURIERS).find(p => courier.toLowerCase().includes(p.id.toLowerCase()));
  return profile ? profile.trackingUrl(tracking) : null;
}

// Re-export the status mapper so the existing webhook route's
// `import { normaliseCourierStatus } from '@/lib/couriers'` keeps working.
export { normaliseCourierStatus } from './status-mapper';
