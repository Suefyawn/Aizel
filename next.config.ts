import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";

// Two bundle-analysis paths:
//
//   1. `npm run analyze` — Next 16's first-party Turbopack bundle analyzer
//      (`next experimental-analyze`). Recommended for everyday inspection.
//
//   2. `npm run build:analyze` — the older webpack-based @next/bundle-analyzer
//      treemap. Opts out of Turbopack (--no-turbopack) so the plugin can
//      actually hook the compile. Outputs HTML to `.next/analyze/`.
//
// We wire the webpack plugin here so it activates on the ANALYZE=true env;
// it's a no-op otherwise. Zero cost in normal CI runs.
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : null;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  // Image optimisation: allow Supabase Storage + the WP source host (set
  // WP_IMAGE_HOST in env if your Woo images live somewhere else).
  images: {
    formats: ['image/avif', 'image/webp'],
    // Tight breakpoint set so we don't generate dozens of derivatives per
    // image. Storefront tiles render at <= 480 px on phones, ~360 px in a
    // 4-up grid on desktop, and full-bleed at 1080 px on hero shots.
    deviceSizes: [360, 480, 640, 828, 1080, 1440, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // 30 d browser cache on the optimized URL (the source URL keeps its
    // own cache headers).
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      // Supabase Storage on the configured project.
      ...(supabaseHost ? [{ protocol: 'https' as const, hostname: supabaseHost, pathname: '/storage/v1/object/public/**' }] : []),
      // Allow an external image host via env (legacy migration / CDN).
      ...(process.env.WP_IMAGE_HOST ? [{ protocol: 'https' as const, hostname: process.env.WP_IMAGE_HOST }] : []),
      // Common CDNs people host product imagery on.
      { protocol: 'https' as const, hostname: 'images.unsplash.com' },
      { protocol: 'https' as const, hostname: 'res.cloudinary.com' },
      // eBay's image CDN — Aizel's initial inventory lives on eBay listings.
      { protocol: 'https' as const, hostname: 'i.ebayimg.com' },
      // Catch-all Supabase storage host so demo product images render even
      // when NEXT_PUBLIC_SUPABASE_URL is unset locally.
      { protocol: 'https' as const, hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
    ],
  },
  // Edge compression.
  compress: true,
  // Allow Claude Preview / common dev tooling to load HMR + dev fonts when the
  // browser hits 127.0.0.1 instead of localhost. Next 16 blocks cross-origin
  // dev resources by default; this is a dev-only allowlist (does NOT affect
  // production routing).
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  // Permanent redirects. `/products/*` (plural) is a stray path — the real
  // product route is the singular `/product/:slug`. A 308 keeps any inbound
  // link or stale crawl pointed at the right URL instead of hitting a 404.
  async redirects() {
    return [
      { source: '/products/:slug', destination: '/product/:slug', permanent: true },
      { source: '/products', destination: '/shop', permanent: true },
    ];
  },
  // Security + caching response headers. Applied to every storefront response
  // so we get HSTS (closes the Semrush "No HSTS support" finding), a sensible
  // Referrer-Policy + Permissions-Policy, and a strong X-Content-Type-Options.
  // Static `/_next/image/*` results also get a long browser cache.
  //
  // Caching strategy (Vercel CDN):
  // ─ Public catalog routes (home, shop, PDP, blog, /page/:slug) get a short
  //   `s-maxage` so the CDN serves cached HTML between renders, plus a long
  //   `stale-while-revalidate` window so a slow Supabase fetch never blocks
  //   the visitor.
  // ─ Private surfaces (admin, account, cart, checkout, login flows) get
  //   `private, no-store` so they never land in a shared cache — important
  //   because pages like /account/orders contain user-scoped data.
  // ─ Crawler endpoints (sitemap, robots, llms.txt) get longer s-maxage.
  // ─ Everything else falls through with the framework default.
  async headers() {
    // Content-Security-Policy in report-only mode: violations log to the
    // browser console without breaking anything, letting us collect what
    // legitimate sources need allowing before flipping to enforcement.
    // Allowlist covers the third parties this app already loads —
    // Stripe (checkout + Terminal), PostHog (analytics), Sentry (error
    // monitoring), Supabase Storage (product images), Unsplash (homepage
    // editorial banners), and inline scripts (Next.js inlines a small
    // hydration bootstrap + JSON-LD).
    const CSP_REPORT_ONLY = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.posthog.com https://*.sentry.io https://*.ingest.sentry.io https://*.ingest.de.sentry.io",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://i.ebayimg.com https://*.stripe.com",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.posthog.com https://*.sentry.io https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://api.stripe.com",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://checkout.stripe.com",
      "frame-ancestors 'self'",
      "upgrade-insecure-requests",
    ].join('; ');

    const SECURITY: Array<{ key: string; value: string }> = [
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'X-Content-Type-Options',    value: 'nosniff' },
      { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options',           value: 'SAMEORIGIN' },
      { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
      // Report-only initially. After 1-2 weeks of clean browser-console
      // reports (or zero reports if you'd wired a report-uri), switch the
      // header key to `Content-Security-Policy` to enforce.
      { key: 'Content-Security-Policy-Report-Only', value: CSP_REPORT_ONLY },
    ];

    // 5-minute edge freshness, 24-hour SWR — enough to absorb traffic bursts
    // and survive a Supabase blip, short enough that stock changes on the PDP
    // surface within ~5 min without an explicit revalidate.
    const PUBLIC_CACHE = 'public, s-maxage=300, stale-while-revalidate=86400';

    // 1-hour edge freshness for crawler endpoints — they regenerate from DB
    // but the shape changes less often than the catalog itself.
    const CRAWLER_CACHE = 'public, s-maxage=3600, stale-while-revalidate=86400';

    // Authenticated / user-scoped routes. CDN must never cache these.
    const PRIVATE_NO_STORE = 'private, no-store, max-age=0';

    return [
      // Every route gets security headers.
      { source: '/:path*', headers: SECURITY },

      // Public catalog HTML — explicit s-maxage so the Vercel edge serves
      // cached renders. Listed individually rather than as one big regex
      // so Vercel's matcher stays predictable.
      { source: '/',                 headers: [{ key: 'Cache-Control', value: PUBLIC_CACHE }] },
      { source: '/shop',             headers: [{ key: 'Cache-Control', value: PUBLIC_CACHE }] },
      { source: '/product/:slug',    headers: [{ key: 'Cache-Control', value: PUBLIC_CACHE }] },
      { source: '/blog',             headers: [{ key: 'Cache-Control', value: PUBLIC_CACHE }] },
      { source: '/blog/:slug',       headers: [{ key: 'Cache-Control', value: PUBLIC_CACHE }] },
      { source: '/page/:slug',       headers: [{ key: 'Cache-Control', value: PUBLIC_CACHE }] },
      { source: '/privacy',          headers: [{ key: 'Cache-Control', value: PUBLIC_CACHE }] },

      // Crawler endpoints — longer s-maxage. Note: /llms.txt sets its own
      // 24 h Cache-Control inside the route handler, so we don't override
      // it here (handler-set headers can race with these).
      { source: '/sitemap.xml',      headers: [{ key: 'Cache-Control', value: CRAWLER_CACHE }] },
      { source: '/robots.txt',       headers: [{ key: 'Cache-Control', value: CRAWLER_CACHE }] },

      // Private / user-scoped surfaces. Explicitly opt out of any shared
      // cache so a different user's session can't be served from the edge.
      { source: '/admin/:path*',     headers: [{ key: 'Cache-Control', value: PRIVATE_NO_STORE }] },
      { source: '/account/:path*',   headers: [{ key: 'Cache-Control', value: PRIVATE_NO_STORE }] },
      { source: '/cart',             headers: [{ key: 'Cache-Control', value: PRIVATE_NO_STORE }] },
      { source: '/checkout',         headers: [{ key: 'Cache-Control', value: PRIVATE_NO_STORE }] },
      { source: '/wishlist',         headers: [{ key: 'Cache-Control', value: PRIVATE_NO_STORE }] },
      { source: '/track',            headers: [{ key: 'Cache-Control', value: PRIVATE_NO_STORE }] },
      { source: '/login',            headers: [{ key: 'Cache-Control', value: PRIVATE_NO_STORE }] },
      { source: '/forgot-password',  headers: [{ key: 'Cache-Control', value: PRIVATE_NO_STORE }] },
      { source: '/reset-password',   headers: [{ key: 'Cache-Control', value: PRIVATE_NO_STORE }] },
      { source: '/thank-you',        headers: [{ key: 'Cache-Control', value: PRIVATE_NO_STORE }] },
      { source: '/api/:path*',       headers: [{ key: 'Cache-Control', value: PRIVATE_NO_STORE }] },
    ];
  },
  // Next 16 already sets `Cache-Control: public, max-age=…` on /_next/image
  // responses via `images.minimumCacheTTL`. Setting a custom header here
  // triggered a build-time warning + invalid-segment-config error, so we
  // leave it to the framework defaults.
};

export default withSentryConfig(withBundleAnalyzer(nextConfig), {
  org: process.env.SENTRY_ORG ?? 'trellee',
  project: process.env.SENTRY_PROJECT ?? 'aizel',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: true,
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  webpack: {
    automaticVercelMonitors: true,
    treeshake: { removeDebugLogging: true },
  },
});
