// Server-only reader for the analytics_cache table. All admin dashboard
// widgets call this so we share one Supabase client + share the same
// "cache miss" shape (returns null).
//
// The cache is populated by `refreshAnalytics()` in
// src/app/admin/dashboard/actions.ts. Each key holds a JSON blob whose
// shape is owned by the caller — typed at the call site, not here.

import 'server-only';
import { createClient } from '@supabase/supabase-js';

export interface CachedAnalytics<T> {
  data: T;
  updatedAt: string;
}

export async function readAnalyticsCache<T>(
  key: string,
): Promise<CachedAnalytics<T> | null> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const { data, error } = await supabase
      .from('analytics_cache')
      .select('data, updated_at')
      .eq('key', key)
      .single();
    if (error || !data) return null;
    return { data: data.data as T, updatedAt: data.updated_at };
  } catch {
    return null;
  }
}

/** Compact "5m ago / 2h ago / 3d ago" stamp. */
export function timeAgoShort(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1)    return 'just now';
  if (m < 60)   return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
}
