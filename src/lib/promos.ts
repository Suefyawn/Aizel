// Promo resolver — given the visitor's audience, returns the single best-fit
// promo for each slot (top_bar, hero_strip) for the current request. Falls
// back to site_settings if the `promos` table is missing / empty, so the
// storefront keeps something on the bar even before the merchant edits any
// rows.

import { supabase, isDemo } from '@/lib/supabase';

export type PromoPosition = 'top_bar' | 'hero_strip';
export type PromoAudience = 'guest' | 'logged_in' | 'first_time' | 'returning';

export interface Promo {
  id: string;
  kind: 'announcement' | 'promo';
  position: PromoPosition;
  label: string | null;
  headline: string;
  subline: string | null;
  cta_text: string | null;
  cta_url: string | null;
  bg_color: string | null;
  text_color: string | null;
  start_at: string | null;
  end_at: string | null;
  show_countdown: boolean;
  audience: PromoAudience | null;
  enabled: boolean;
  priority: number;
}

/** Build the visitor "audience" tag from request signals so the resolver
 *  can filter properly. `signedIn` + `hasOrdered` come from the layout's
 *  session lookup; both are server-side, no client tracking. */
export function audienceFor(signedIn: boolean, hasOrdered: boolean): PromoAudience {
  if (!signedIn) return 'guest';
  return hasOrdered ? 'returning' : 'first_time';
}

/** Pick the single best-fit row per slot. Server-side filter ensures we never
 *  expose a row the visitor shouldn't see. */
export async function getActivePromos(audience: PromoAudience): Promise<{
  top_bar: Promo | null;
  hero_strip: Promo | null;
}> {
  if (isDemo) return { top_bar: null, hero_strip: null };

  try {
    const { data, error } = await supabase
      .from('promos')
      .select('*')
      // The RLS policy already filters by enabled + schedule, but we re-assert
      // here so demo-mode clients that bypass RLS still get the right answer.
      .eq('enabled', true)
      .order('priority', { ascending: false });

    if (error || !data) return { top_bar: null, hero_strip: null };

    const now = Date.now();
    const live = (data as Promo[]).filter(p => {
      if (p.start_at && new Date(p.start_at).getTime() > now) return false;
      if (p.end_at   && new Date(p.end_at).getTime()   <= now) return false;
      if (p.audience && p.audience !== audience) return false;
      return true;
    });

    return {
      // First match per slot wins; the SQL order already sorted by priority desc.
      top_bar:    live.find(p => p.position === 'top_bar')    ?? null,
      hero_strip: live.find(p => p.position === 'hero_strip') ?? null,
    };
  } catch {
    return { top_bar: null, hero_strip: null };
  }
}
