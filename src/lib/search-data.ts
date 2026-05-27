// Server-only helpers that derive the "Trending brands" and "Popular categories"
// lists shown in the search overlay from real catalog data.
//
// Lives in lib/ (not in components/) because the calling tree starts at
// app/layout.tsx (a server component). SiteChrome is `'use client'`, so we
// cannot pass an async server-component wrapper through it — the data has
// to be resolved at the layout level and handed down as plain props.

import { supabase, isDemo } from '@/lib/supabase';

export async function loadTrendingBrands(): Promise<string[]> {
  if (isDemo) return ['CeraVe', 'NARS', 'Kiko Milano', 'PIXI', 'Rhode'];
  try {
    const { data } = await supabase
      .from('products')
      .select('brand')
      .eq('status', 'published')
      .or('stock.gt.0,track_inventory.is.false')
      .limit(1000);
    const counts = new Map<string, number>();
    for (const row of (data ?? []) as Array<{ brand: string | null }>) {
      const b = row.brand?.trim();
      if (!b) continue;
      counts.set(b, (counts.get(b) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([brand]) => brand);
  } catch {
    return [];
  }
}

export async function loadPopularCategories(): Promise<string[]> {
  // Demo-mode default mirrors the five fattest leaves after the Hair Care
  // taxonomy expansion (migrations 146 + 147) so the search overlay shows
  // useful trending categories without hitting the DB.
  if (isDemo) return ['Hair Oils & Serums', 'Hair Colour', 'Hair Treatments & Masks', 'Curl & Styling Creams', 'Cocoa & Shea Butter'];
  try {
    const { data } = await supabase
      .from('products')
      .select('subcategory, category')
      .eq('status', 'published')
      .or('stock.gt.0,track_inventory.is.false')
      .limit(1000);
    const counts = new Map<string, number>();
    for (const row of (data ?? []) as Array<{ subcategory: string | null; category: string | null }>) {
      const c = row.subcategory?.trim() || row.category?.trim();
      if (!c) continue;
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([c]) => c);
  } catch {
    return [];
  }
}
