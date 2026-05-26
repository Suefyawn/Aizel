import { createClient } from '@supabase/supabase-js';
import { cache } from 'react';
import type { Product, BlogPost } from '@/types';
import { DEMO_PRODUCTS, DEMO_BLOG_POSTS, DEMO_SITE_SETTINGS } from './demo-data';
import { isDemo } from './is-demo';
import { log } from './logger';

/** True when no Supabase env vars are configured. Storefront helpers fall
 *  back to stub data so the site renders for design / a11y review on a
 *  fresh clone without setting up Supabase. Re-exported from ./is-demo so
 *  client components can read the flag without pulling this module (and its
 *  `createClient` call) into the browser bundle. */
export { isDemo };

const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Placeholder URL/key so createClient doesn't throw on import in demo mode.
const supabaseUrl = envUrl || 'https://demo.invalid';
const supabaseAnonKey = envKey || 'demo-anon-key';

// In demo mode (no Supabase env), every supabase-js call targets the
// placeholder `https://demo.invalid` host. On Windows / long-lived Node
// processes the OS-level connect failure for that unreachable hostname
// takes ~7 seconds — and each admin page fires several parallel reads
// (AdminLayout adds 2 by itself, before the page's own queries), so the
// whole admin stalls for 7+ s on every render in demo mode.
//
// Short-circuit at the fetch layer: any request whose URL contains the
// placeholder host resolves immediately with an empty PostgREST response
// (`[]` body + `content-range: */0` for HEAD count queries). supabase-js
// parses it as `{ data: [], error: null }` and the page renders in
// milliseconds. Storefront getters that override empty data with demo
// fixtures (getProducts → DEMO_PRODUCTS, getBlogPosts → DEMO_BLOG_POSTS)
// already check `isDemo` BEFORE the supabase call, so they're not
// affected by the empty `[]` from this fast path.
const demoTimeoutFetch: typeof fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
  if (url.includes('demo.invalid')) {
    return Promise.resolve(new Response('[]', {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'content-range': '*/0',
      },
    }));
  }
  return fetch(input, init);
};
const clientFetch = isDemo ? demoTimeoutFetch : undefined;

// Anonymous storefront read client. It NEVER manages a user session — the
// logged-in customer session is owned exclusively by the @supabase/ssr
// cookie client (lib/supabase-browser + lib/supabase-server). persistSession
// / autoRefreshToken are off so that, even if this module is ever pulled
// into the browser bundle, it can't construct a competing session store that
// races the cookie client and makes signed-in customers look logged-out.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  ...(clientFetch && { global: { fetch: clientFetch } }),
});

// ─── Service-role client (server-only) ──────────────────────────────────────
// Use for sensitive tables that have RLS enabled with service-role-only
// policies (`staff_members`, `audit_log`, `analytics_*`). NEVER import from a
// `'use client'` file — the service-role key would leak into the JS bundle.
//
// Lazy getter so a client-bundled import of this module doesn't trip the
// missing-env-var path at module-evaluation time. Throws on first call if
// the key really is missing at runtime on the server.
let _admin: ReturnType<typeof createClient> | null = null;
export function supabaseAdmin() {
  if (_admin) return _admin;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    if (isDemo) return supabase;
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin operations');
  }
  _admin = createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

// ─── Resilience layer ───────────────────────────────────────────────────────
// Every public storefront getter routes through this so a missing-table or
// RLS-denied error returns the demo fallback instead of throwing — that way a
// half-configured production (env vars set but schema not yet migrated) still
// renders pages instead of triggering the global-error boundary on every
// page that touches the database. Errors are logged so the deployment can
// still be debugged via Vercel logs.

async function safe<T>(
  label: string,
  fn: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    // Don't spam the demo client with errors — demo mode is opt-in for offline
    // rendering and the placeholder URL deliberately can't be reached.
    if (!isDemo) {
      log.warn('supabase.fallback', { label, err: (err as Error).message });
    }
    return fallback;
  }
}

// Tile-projection for collection / listing pages — narrow on purpose so
// the inline RSC payload that ships every Product to the client doesn't
// carry per-row description / how_to_use / ingredients / key_benefits /
// faq strings. P0-3 finding in the 2026-05-19 launch audit: /shop was
// shipping ~277KB of inline JSON, the bulk of it long-form fields no
// tile reads. Switching from select('*') saves ~400KB on /shop and
// /shop?taxon=*.
// Exported so the PDP cross-sells / FBT / recently-viewed helpers can
// reuse the same narrow projection — they were calling select('*') and
// shipping description/ingredients/faq for every related tile.
export const PRODUCT_TILE_COLUMNS =
  'id, brand, name, variant, price, original_price, category, subcategory, tag, slug, stock, track_inventory, image_url, is_bestseller, is_featured, free_from, status, created_at, rating, review_count';

export async function getProducts(): Promise<Product[]> {
  if (isDemo) return DEMO_PRODUCTS;
  return safe('getProducts', async () => {
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_TILE_COLUMNS)
      // Storefront catalogue — published only. Draft products aren't live
      // yet, and archived products (a soft-deleted product with order
      // history) must drop off the storefront while keeping their row for
      // Analytics + order detail.
      .eq('status', 'published')
      .order('id');
    if (error) throw error;
    return (data ?? []) as unknown as Product[];
  }, DEMO_PRODUCTS);
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  if (isDemo) return DEMO_PRODUCTS.find(p => p.slug === slug) ?? null;
  return safe('getProductBySlug', async () => {
    // Published only — an archived/draft product has no live PDP; the page
    // 404s on a null product (see product/[slug]/page.tsx).
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .single();
    if (data) return data as Product;

    // Fallback: some slugs have a doubled brand prefix (e.g. cerave-cerave-acne-control-cleanser).
    // If the exact slug fails, try matching any slug that ends with -{slug}.
    const { data: fallback } = await supabase
      .from('products')
      .select('*')
      .ilike('slug', `%-${slug}`)
      .eq('status', 'published')
      .limit(1)
      .single();
    return (fallback as Product | null) ?? null;
  }, DEMO_PRODUCTS.find(p => p.slug === slug) ?? null);
}

/** Editorial bestsellers, flagged by `is_bestseller=true`. Falls back to
 *  the highest-stock published products if the flag hasn't been seeded yet
 *  — homepage rails should never go empty. */
export async function getBestsellers(limit = 8): Promise<Product[]> {
  if (isDemo) return DEMO_PRODUCTS.slice(0, limit);
  return safe('getBestsellers', async () => {
    const { data: flagged } = await supabase
      .from('products')
      .select(PRODUCT_TILE_COLUMNS)
      .eq('is_bestseller', true)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (flagged && flagged.length >= limit) return flagged as Product[];
    // Backfill from healthy-stock catalog so the rail still renders pre-curation.
    const fill = limit - (flagged?.length ?? 0);
    const { data: rest } = await supabase
      .from('products')
      .select(PRODUCT_TILE_COLUMNS)
      .eq('status', 'published')
      .or('stock.gt.0,track_inventory.is.false')
      .order('stock', { ascending: false })
      .limit(fill + (flagged?.length ?? 0));
    const flaggedIds = new Set((flagged ?? []).map(p => p.id));
    const merged = [
      ...(flagged ?? []),
      ...(rest ?? []).filter(p => !flaggedIds.has(p.id)),
    ];
    return merged.slice(0, limit) as Product[];
  }, DEMO_PRODUCTS.slice(0, limit));
}

/** Featured picks for the homepage hero/editorial slots, flagged by
 *  `is_featured=true`. Same fallback as bestsellers. */
export async function getFeatured(limit = 6): Promise<Product[]> {
  if (isDemo) return DEMO_PRODUCTS.slice(0, limit);
  return safe('getFeatured', async () => {
    const { data: flagged } = await supabase
      .from('products')
      .select(PRODUCT_TILE_COLUMNS)
      .eq('is_featured', true)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (flagged && flagged.length >= limit) return flagged as Product[];
    const fill = limit - (flagged?.length ?? 0);
    const { data: rest } = await supabase
      .from('products')
      .select(PRODUCT_TILE_COLUMNS)
      .eq('status', 'published')
      .or('stock.gt.0,track_inventory.is.false')
      .order('created_at', { ascending: false })
      .limit(fill + (flagged?.length ?? 0));
    const flaggedIds = new Set((flagged ?? []).map(p => p.id));
    const merged = [
      ...(flagged ?? []),
      ...(rest ?? []).filter(p => !flaggedIds.has(p.id)),
    ];
    return merged.slice(0, limit) as Product[];
  }, DEMO_PRODUCTS.slice(0, limit));
}

/** Products on sale = `original_price > price`. Sorted by discount % so the
 *  deepest deals lead. */
export async function getOnSale(limit = 8): Promise<Product[]> {
  if (isDemo) return DEMO_PRODUCTS.filter(p => p.original_price && p.original_price > p.price).slice(0, limit);
  return safe('getOnSale', async () => {
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_TILE_COLUMNS)
      .not('original_price', 'is', null)
      .order('original_price', { ascending: false })
      .limit(limit * 4);
    if (error) throw error;
    return (data ?? [])
      .filter((p: { price: number; original_price: number | null }) =>
        p.original_price !== null && p.original_price > p.price)
      .slice(0, limit) as Product[];
  }, DEMO_PRODUCTS.slice(0, limit));
}

/** Resolve a taxon slug ("makeup" / "wellness" / etc.) or a single-category
 *  name into a product list. Returns []  if the taxon is unknown so the home
 *  sections render their empty-state, not their full catalog. */
export async function getProductsByTaxon(taxonOrCategory: string, limit = 8): Promise<Product[]> {
  const { categoriesForTaxon } = await import('./category-taxonomy');
  const taxonCats = categoriesForTaxon(taxonOrCategory);
  const cats = taxonCats ?? [taxonOrCategory];
  if (isDemo) return DEMO_PRODUCTS.filter(p => cats.includes(p.category)).slice(0, limit);
  return safe('getProductsByTaxon', async () => {
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_TILE_COLUMNS)
      .in('category', cats as string[])
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as Product[];
  }, DEMO_PRODUCTS.filter(p => cats.includes(p.category)).slice(0, limit));
}

/** Products from a single brand — powers the "More from {brand}" rail on
 *  the PDP. Published only; returns [] for a missing brand so the rail
 *  collapses cleanly. */
export async function getProductsByBrand(brand: string | null | undefined, limit = 8): Promise<Product[]> {
  if (!brand) return [];
  if (isDemo) return DEMO_PRODUCTS.filter(p => p.brand === brand).slice(0, limit);
  return safe('getProductsByBrand', async () => {
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_TILE_COLUMNS)
      .eq('brand', brand)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as Product[];
  }, []);
}

/** ALL products from a single brand — used by the /brand/[slug] landing
 *  page. No limit (the brand-landing template paginates client-side if
 *  needed). Published + in-stock-first ordering. */
export async function getAllProductsByBrand(brand: string): Promise<Product[]> {
  if (!brand) return [];
  if (isDemo) return DEMO_PRODUCTS.filter(p => p.brand === brand);
  return safe('getAllProductsByBrand', async () => {
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_TILE_COLUMNS)
      .eq('brand', brand)
      .eq('status', 'published')
      // In-stock products first so the landing doesn't lead with sold-outs,
      // then newest within each stock bucket. Postgres `nulls last` keeps
      // products with track_inventory=false (the "always available" set) at
      // the top alongside genuinely-stocked rows.
      .order('stock', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Product[];
  }, []);
}

/** Every distinct brand in the catalogue, mapped to its slug + product count.
 *  Powers the /brand/[slug] route generation, the sitemap, and the index of
 *  brands shown at /brand. */
export interface BrandSummary {
  brand: string;
  slug: string;
  productCount: number;
  /** First in-stock product image — used as the brand-tile thumbnail. */
  sampleImage: string | null;
}

export function brandSlug(brand: string): string {
  return brand
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    // Drop apostrophes (both straight ' and curly ’) FIRST so possessive
    // brand names produce clean slugs: "Palmer's" → "palmers" (not
    // "palmer-s") and "Ghana's Best" → "ghanas-best".
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function getAllBrands(): Promise<BrandSummary[]> {
  const summarise = (products: Pick<Product, 'brand' | 'image_url'>[]): BrandSummary[] => {
    const map = new Map<string, { count: number; image: string | null }>();
    for (const p of products) {
      if (!p.brand) continue;
      const existing = map.get(p.brand);
      if (existing) {
        existing.count++;
        if (!existing.image && p.image_url) existing.image = p.image_url;
      } else {
        map.set(p.brand, { count: 1, image: p.image_url ?? null });
      }
    }
    return [...map.entries()]
      .map(([brand, { count, image }]) => ({
        brand,
        slug: brandSlug(brand),
        productCount: count,
        sampleImage: image,
      }))
      .filter(b => b.slug)          // drop brands whose slug normalises away
      .sort((a, b) => b.productCount - a.productCount);
  };

  if (isDemo) return summarise(DEMO_PRODUCTS);
  return safe('getAllBrands', async () => {
    const { data, error } = await supabase
      .from('products')
      .select('brand, image_url')
      .eq('status', 'published');
    if (error) throw error;
    return summarise((data ?? []) as Pick<Product, 'brand' | 'image_url'>[]);
  }, summarise(DEMO_PRODUCTS));
}

/** Lookup a brand by its URL slug. Slug → brand name is reversible only by
 *  scanning every brand and slugifying each; we accept that cost (the
 *  catalogue has <100 brands) for the readability win at the URL. */
export async function getBrandBySlug(slug: string): Promise<BrandSummary | null> {
  const all = await getAllBrands();
  return all.find(b => b.slug === slug) ?? null;
}

// Tile-projection for the blog index. P0-2 finding in the 2026-05-19
// launch audit: /blog was shipping 1.95 MB of HTML, ~1.76 MB of which
// was the full WP body of every post embedded in the RSC payload — the
// tile component only renders title / excerpt / image / category /
// date. Narrowing the select cuts /blog from ~2 MB to ~150 KB.
const BLOG_TILE_COLUMNS =
  'id, slug, title, excerpt, category, date, read_time, featured, image_url, updated_at';

export async function getBlogPosts(): Promise<BlogPost[]> {
  if (isDemo) return DEMO_BLOG_POSTS;
  return safe('getBlogPosts', async () => {
    const { data, error } = await supabase
      .from('blog_posts')
      .select(BLOG_TILE_COLUMNS)
      .order('date', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as BlogPost[];
  }, DEMO_BLOG_POSTS);
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  if (isDemo) return DEMO_BLOG_POSTS.find(p => p.slug === slug) ?? null;
  return safe('getBlogPostBySlug', async () => {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('slug', slug)
      .single();
    if (error) return null;
    return data as BlogPost;
  }, DEMO_BLOG_POSTS.find(p => p.slug === slug) ?? null);
}

// React.cache() deduplicates calls within a single server render — layout +
// page + child server components share one DB hit per request instead of N.
// site_settings is read on every storefront page render via the layout AND
// on most pages directly; without cache that's 2-4 redundant queries per
// render. Same change applied to getStaffSession in lib/staff-auth.ts.
export const getSiteSettings = cache(async (): Promise<Record<string, string>> => {
  if (isDemo) return DEMO_SITE_SETTINGS;
  return safe('getSiteSettings', async () => {
    const { data } = await supabase.from('site_settings').select('key, value');
    return Object.fromEntries((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
  }, DEMO_SITE_SETTINGS);
});

/** Pick one representative product image per category — used by the
 *  homepage to populate category tiles and editorial banners with real
 *  catalogue photography instead of the gradient placeholder. Ranks
 *  is_bestseller > is_featured > newest, all `published`, so the picks
 *  reflect editorial intent when the operator has flagged them and fall
 *  back to "freshest in catalogue" otherwise. Cached per-request. */
export const getCategoryHeroImages = cache(async (categories: readonly string[]): Promise<Record<string, string>> => {
  if (isDemo || categories.length === 0) return {};
  return safe('getCategoryHeroImages', async () => {
    // One round-trip pulling 1-3 candidates per category, then pick the
    // best per category client-side. Cheaper than N round-trips.
    const { data } = await supabase
      .from('products')
      .select('category, image_url, is_bestseller, is_featured, created_at')
      .in('category', categories as string[])
      .eq('status', 'published')
      .not('image_url', 'is', null)
      .order('is_bestseller', { ascending: false })
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false });
    const out: Record<string, string> = {};
    for (const row of (data ?? []) as Array<{ category: string; image_url: string | null }>) {
      if (!out[row.category] && row.image_url) out[row.category] = row.image_url;
    }
    return out;
  }, {});
});
