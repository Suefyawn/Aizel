// Single comprehensive sitemap. The catalog (a few hundred URLs) is far
// below Google's 50,000-per-sitemap cap, so one flat sitemap is the
// recommended shape — simpler than a sitemap index, and submitting
// /sitemap.xml in Search Console discovers every page in one pass.

import type { MetadataRoute } from 'next';
import { supabase, isDemo, getAllBrands } from '@/lib/supabase';
import { SITE_URL, absoluteUrl } from '@/lib/seo';

// Robots-disallowed (utility / private) routes are deliberately excluded —
// listing them would send a conflicting signal to crawlers.
const STATIC_ROUTES: { path: string; priority: number; freq: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
  { path: '/',      priority: 1.0, freq: 'daily' },
  { path: '/shop',  priority: 0.9, freq: 'daily' },
  { path: '/brand', priority: 0.7, freq: 'weekly' },
  { path: '/blog',  priority: 0.7, freq: 'weekly' },
  { path: '/faq',   priority: 0.5, freq: 'monthly' },
];

interface ProductRow {
  slug: string;
  category: string | null;
  image_url: string | null;
  updated_at: string | null;
  created_at: string | null;
}
interface PostRow {
  slug: string;
  image_url: string | null;
  updated_at: string | null;
  date: string | null;
}
interface PageRow {
  slug: string;
  updated_at: string | null;
  created_at: string | null;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  let products: ProductRow[] = [];
  let posts: PostRow[] = [];
  let pages: PageRow[] = [];

  if (isDemo) {
    const { DEMO_PRODUCTS, DEMO_BLOG_POSTS, DEMO_PAGES } = await import('@/lib/demo-data');
    products = DEMO_PRODUCTS.map(p => ({
      slug: p.slug, category: p.category ?? null, image_url: p.image_url ?? null,
      updated_at: null, created_at: null,
    }));
    posts = DEMO_BLOG_POSTS.map(p => ({
      slug: p.slug, image_url: p.image_url ?? null, updated_at: null, date: p.date ?? null,
    }));
    pages = DEMO_PAGES.map(p => ({ slug: p.slug, updated_at: null, created_at: null }));
  } else {
    // Only published products / pages — drafts and archived rows must not
    // appear in the sitemap (they 404 or noindex).
    const [prod, blog, cms] = await Promise.all([
      supabase.from('products').select('slug, category, image_url, updated_at, created_at').eq('status', 'published'),
      supabase.from('blog_posts').select('slug, image_url, updated_at, date'),
      supabase.from('pages').select('slug, updated_at, created_at').eq('status', 'published'),
    ]);
    products = (prod.data ?? []) as ProductRow[];
    posts = (blog.data ?? []) as PostRow[];
    pages = (cms.data ?? []) as PageRow[];
  }

  const staticUrls: MetadataRoute.Sitemap = STATIC_ROUTES.map(r => ({
    url: absoluteUrl(r.path),
    lastModified: now,
    changeFrequency: r.freq,
    priority: r.priority,
  }));

  // Category landing pages — ?category= matches what canonical / breadcrumb /
  // footer links emit, so the sitemap and the canonical agree.
  const categories = Array.from(
    new Set(products.map(p => p.category).filter((c): c is string => Boolean(c))),
  );
  const categoryUrls: MetadataRoute.Sitemap = categories.map(cat => ({
    url: `${SITE_URL}/shop?category=${encodeURIComponent(cat)}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  // Brand landing pages — one URL per /brand/[slug] so Google can index
  // them individually. Brand searches ("Cantu UK", "Palmer's cocoa butter")
  // typically have higher intent than category browses.
  const brands = await getAllBrands().catch(() => []);
  const brandUrls: MetadataRoute.Sitemap = brands.map(b => ({
    url: absoluteUrl(`/brand/${b.slug}`),
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const productUrls: MetadataRoute.Sitemap = products.map(p => {
    const last = p.updated_at ?? p.created_at;
    return {
      url: absoluteUrl(`/product/${p.slug}`),
      lastModified: last ? new Date(last) : now,
      changeFrequency: 'weekly',
      priority: 0.8,
      images: p.image_url ? [p.image_url] : undefined,
    };
  });

  const blogUrls: MetadataRoute.Sitemap = posts.map(p => {
    const last = p.updated_at ?? p.date;
    return {
      url: absoluteUrl(`/blog/${p.slug}`),
      lastModified: last ? new Date(last) : now,
      changeFrequency: 'monthly',
      priority: 0.6,
      images: p.image_url ? [p.image_url] : undefined,
    };
  });

  const pageUrls: MetadataRoute.Sitemap = pages.map(p => {
    const last = p.updated_at ?? p.created_at;
    return {
      url: absoluteUrl(`/page/${p.slug}`),
      lastModified: last ? new Date(last) : now,
      changeFrequency: 'monthly',
      priority: 0.5,
    };
  });

  return [...staticUrls, ...categoryUrls, ...brandUrls, ...productUrls, ...blogUrls, ...pageUrls];
}
