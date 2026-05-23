// Feature-flag loader. Cached for 30 s per instance to avoid hammering DB.
//
// Server-side only — the storefront / admin call await isEnabled('key')
// from a server component or server action. For client components, fetch
// the flag in the parent server component and pass it down as a prop.

import { supabase, isDemo } from './supabase';

interface Flag {
  key: string;
  enabled: boolean;
  audience: 'all' | 'staff' | 'percent';
  percent_rollout: number;
}

// Hard-coded fallbacks matching the seeds in 20260523_060_feature_flags.sql.
// Used when (a) demo mode is on (no DB), or (b) the table is empty for that key.
const DEFAULTS: Record<string, boolean> = {
  back_in_stock:     true,
  reviews_photos:    true,
  promo_banner:      true,
  exit_intent_modal: false,
};

interface Cache { rows: Flag[]; expiresAt: number }
let cache: Cache | null = null;
const TTL_MS = 30_000;

async function loadFlags(): Promise<Flag[]> {
  if (isDemo) return [];
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.rows;
  const { data } = await supabase.from('feature_flags').select('key, enabled, audience, percent_rollout');
  const rows = (data ?? []) as Flag[];
  cache = { rows, expiresAt: now + TTL_MS };
  return rows;
}

export function bustFlagCache(): void { cache = null; }

/** True if the flag is enabled for the current request. `staffSession` and
 *  `bucketKey` (e.g. user id or session cookie) feed the audience math.
 *  Falls back to a hard-coded default in DEFAULTS when there's no row. */
export async function isEnabled(
  key: string,
  opts: { isStaff?: boolean; bucketKey?: string } = {}
): Promise<boolean> {
  const rows = await loadFlags();
  const f = rows.find(r => r.key === key);
  if (!f) return DEFAULTS[key] ?? false;
  if (!f.enabled) return false;
  if (f.audience === 'all')    return true;
  if (f.audience === 'staff')  return Boolean(opts.isStaff);
  if (f.audience === 'percent') {
    // Deterministic bucketing on the provided key (fallback: random).
    const hash = simpleHash(opts.bucketKey ?? Math.random().toString(36));
    return hash % 100 < f.percent_rollout;
  }
  return false;
}

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
