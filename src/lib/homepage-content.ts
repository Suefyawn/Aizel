// Homepage content blocks — operator-managed cards + tile rows that drive
// the EditorialDuo section and the "Shop by category" tile section on the
// storefront homepage. Single source of truth lives in the
// `homepage_content` DB table (migration 144); the admin page at
// /admin/settings/homepage edits it; the homepage server component
// loads via `loadHomepageContent()`.
//
// The loader is `unstable_cache`'d with the `homepage_content` tag so an
// admin edit flushes the cache across every page render in one shot.

import type { Product } from '@/types';
import { supabase } from './supabase';

export interface HomepageBlock {
  id:             string;
  kind:           'banner_card' | 'category_row';
  title:          string;
  subtitle:       string | null;
  cta_text:       string | null;
  cta_href:       string | null;
  image_url:      string | null;
  category_slugs: string[];
  sort_order:     number;
  active:         boolean;
}

export interface HomepageContent {
  banners:    HomepageBlock[];
  tileGroups: HomepageBlock[];
  /** Concatenated for cache-tagging / change-detection only. */
  raw:        HomepageBlock[];
}

export const HOMEPAGE_CONTENT_TAG = 'homepage_content';

/** Read blocks from DB (anon read policy on homepage_content). Returns
 *  separate buckets for the two render surfaces so callers don't have to
 *  re-filter. */
async function fetchFromDb(): Promise<HomepageContent> {
  const { data } = await supabase
    .from('homepage_content')
    .select('id, kind, title, subtitle, cta_text, cta_href, image_url, category_slugs, sort_order, active')
    .eq('active', true)
    .order('sort_order');
  const rows = (data ?? []) as HomepageBlock[];
  return {
    banners:    rows.filter(r => r.kind === 'banner_card'),
    tileGroups: rows.filter(r => r.kind === 'category_row'),
    raw:        rows,
  };
}

let _cachedLoader: (() => Promise<HomepageContent>) | null = null;

export async function loadHomepageContent(): Promise<HomepageContent> {
  if (_cachedLoader === null) {
    const { unstable_cache } = await import('next/cache');
    _cachedLoader = unstable_cache(
      fetchFromDb,
      ['homepage-content-v1'],
      { tags: [HOMEPAGE_CONTENT_TAG], revalidate: 300 },
    );
  }
  try {
    return await _cachedLoader();
  } catch {
    return { banners: [], tileGroups: [], raw: [] };
  }
}

// ── Helper: pick an auto-image for a banner when image_url is blank ──
// Banner cards can reference a category by slug; if image_url isn't set,
// the homepage falls back to the lead product image from that category.
// Existing helper `getCategoryHeroImages(catLabels)` already does this for
// us — this function just maps slug → label so the caller can re-use it.
export function bannerImageCategory(
  block: HomepageBlock,
  slugToLabel: Record<string, string>,
): string | null {
  const slug = block.category_slugs[0];
  if (!slug) return null;
  return slugToLabel[slug] ?? null;
}

// ── Helper for the admin page: hydrate every block with the live product
// counts + hero image URL per category, so the cards in the editor render
// the same imagery the storefront would. Keeps the admin and the live
// site visually in sync.
export interface HydratedTile {
  label: string;
  slug: string;
  href: string;
  image: string | null;
  productCount: number;
}

export function hydrateTileGroup(
  block: HomepageBlock,
  slugToLabel: Record<string, string>,
  labelToImage: Record<string, string>,
  labelToCount: Record<string, number>,
): HydratedTile[] {
  return block.category_slugs.map(slug => {
    const label = slugToLabel[slug] ?? slug;
    return {
      label,
      slug,
      href:  `/shop?category=${encodeURIComponent(label)}`,
      image: labelToImage[label] ?? null,
      productCount: labelToCount[label] ?? 0,
    };
  });
}

// Tiny utility re-exported for the homepage to convert a slug + the
// loaded taxonomy into the rendered tile shape.
export type ProductLike = Pick<Product, 'image_url'>;
