import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  // Production blocks nothing public but keeps the admin/account/checkout out
  // of indexes. Preview/staging gets a global "noindex" so SERPs don't see it.
  const isProd =
    process.env.VERCEL_ENV === 'production' ||
    (!process.env.VERCEL_ENV && process.env.NODE_ENV === 'production');

  if (!isProd) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/account/',
          '/checkout',
          '/thank-you',
          '/api/',
          '/login',
          '/forgot-password',
          '/reset-password',
          // P1 audit fixes — user-scoped or utility-only pages should not
          // be in indexes either.
          '/cart',
          '/wishlist',
          '/track',
        ],
      },
    ],
    // One comprehensive sitemap covers products, blog posts and CMS pages
    // (see app/sitemap.ts) — well under Google's 50k-URL cap.
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL.replace(/^https?:\/\//, ''),
  };
}
