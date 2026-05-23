// ============================================================================
// Shipping rate resolution. Phase 1.5.
//
// Reads shipping_zones / shipping_rates / province_zones from Supabase and
// resolves the rate for a given province + subtotal. Defaults match the
// default `FREE_SHIPPING = 15 / shipping = 4` (GBP) behaviour so the
// storefront keeps working even if the tables aren't populated yet.
// ============================================================================

import { supabase } from './supabase';

const DEFAULT_FREE_THRESHOLD = 15;
const DEFAULT_RATE = 4;

export interface ResolvedRate {
  rate: number;
  free: boolean;
  label: string;
  estimatedDays?: { min: number; max: number } | null;
}

interface Row {
  rate: number;
  free_shipping_threshold: number | null;
  label: string;
  estimated_days_min: number | null;
  estimated_days_max: number | null;
}

export async function resolveShipping(opts: {
  province?: string;
  subtotal: number;
}): Promise<ResolvedRate> {
  const { province, subtotal } = opts;

  // Look up zone by province, then the cheapest rate for that zone.
  let zoneId: string | null = null;
  if (province) {
    const { data } = await supabase
      .from('province_zones')
      .select('zone_id')
      .eq('province', province)
      .maybeSingle();
    zoneId = (data?.zone_id as string | undefined) ?? null;
  }

  // Fallback to any active zone if no province match.
  if (!zoneId) {
    const { data } = await supabase
      .from('shipping_zones')
      .select('id')
      .eq('active', true)
      .order('sort_order')
      .limit(1)
      .maybeSingle();
    zoneId = (data?.id as string | undefined) ?? null;
  }

  if (!zoneId) {
    // No zones configured — use legacy defaults.
    const free = subtotal >= DEFAULT_FREE_THRESHOLD;
    return { rate: free ? 0 : DEFAULT_RATE, free, label: 'Standard' };
  }

  const { data: rateRow } = await supabase
    .from('shipping_rates')
    .select('rate, free_shipping_threshold, label, estimated_days_min, estimated_days_max')
    .eq('zone_id', zoneId)
    .order('rate', { ascending: true })
    .limit(1)
    .maybeSingle();

  const row = (rateRow as Row | null) ?? {
    rate: DEFAULT_RATE,
    free_shipping_threshold: DEFAULT_FREE_THRESHOLD,
    label: 'Standard',
    estimated_days_min: null,
    estimated_days_max: null,
  };

  const free = row.free_shipping_threshold != null && subtotal >= row.free_shipping_threshold;
  return {
    rate: free ? 0 : row.rate,
    free,
    label: row.label,
    estimatedDays:
      row.estimated_days_min != null && row.estimated_days_max != null
        ? { min: row.estimated_days_min, max: row.estimated_days_max }
        : null,
  };
}
