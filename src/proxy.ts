import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// ============================================================================
// Middleware. Lives at src/proxy.ts (this Next.js build's renamed middleware
// convention). Handles:
//   1. Admin / account / sensitive-path auth gates
//   2. 301 redirects from the `redirects` table (WP URL preservation)
//
// Redirect lookup runs only on paths that we don't already know are handled
// (i.e. when the matcher would let the request fall through to a 404). To
// avoid hammering Supabase on every request, we keep a 60-second in-memory
// LRU of resolved (or known-missing) lookups per edge instance.
// ============================================================================

// ─── tiny LRU cache (Map preserves insertion order) ─────────────────────────
const REDIRECT_CACHE_MAX = 500;
const REDIRECT_TTL_MS = 60_000;

interface CacheEntry { to: string | null; expiresAt: number }
const redirectCache = new Map<string, CacheEntry>();

function cacheGet(key: string): string | null | undefined {
  const entry = redirectCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    redirectCache.delete(key);
    return undefined;
  }
  // Touch for LRU (delete + re-insert).
  redirectCache.delete(key);
  redirectCache.set(key, entry);
  return entry.to;
}

function cacheSet(key: string, to: string | null): void {
  if (redirectCache.size >= REDIRECT_CACHE_MAX) {
    const first = redirectCache.keys().next().value;
    if (first !== undefined) redirectCache.delete(first);
  }
  redirectCache.set(key, { to, expiresAt: Date.now() + REDIRECT_TTL_MS });
}

// Paths Next.js definitely owns (avoid useless lookups + redirect-loops).
function isOwnedPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/account') ||
    pathname === '/checkout' ||
    pathname === '/thank-you' ||
    pathname === '/cart' ||
    pathname === '/wishlist' ||
    pathname === '/login' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname === '/track' ||
    pathname === '/shop' ||
    pathname === '/blog' ||
    pathname.startsWith('/product/') ||
    pathname.startsWith('/blog/') ||
    pathname.startsWith('/page/') ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname === '/favicon.ico' ||
    pathname === '/icon.svg'
  );
}

async function resolveRedirect(pathname: string): Promise<string | null> {
  const cached = cacheGet(pathname);
  if (cached !== undefined) return cached;

  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!sbUrl || !sbKey) {
    cacheSet(pathname, null);
    return null;
  }

  try {
    // PostgREST direct call — avoids pulling the full SDK into edge middleware.
    const url = `${sbUrl}/rest/v1/redirects?from_path=eq.${encodeURIComponent(pathname)}&select=to_path&limit=1`;
    const res = await fetch(url, {
      headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` },
      // Vercel-edge friendly: no body, GET, short.
    });
    if (!res.ok) {
      cacheSet(pathname, null);
      return null;
    }
    const rows = (await res.json()) as { to_path: string }[];
    const to = rows[0]?.to_path ?? null;
    cacheSet(pathname, to);
    return to;
  } catch {
    cacheSet(pathname, null);
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // ─── Admin auth gate ──────────────────────────────────────────────────────
  // The legacy admin_session cookie is HMAC-signed (see lib/signed-cookie.ts);
  // we verify the signature + age here in Edge. A staff_session cookie is
  // also accepted; its body verification happens at the page layer because
  // it needs the DB-backed staff_members lookup that Edge can't do cheaply.
  if (pathname === '/admin') return NextResponse.next();
  if (pathname.startsWith('/admin/')) {
    const session = request.cookies.get('admin_session')?.value;
    const staff   = request.cookies.get('staff_session')?.value;
    const pass    = process.env.ADMIN_PASSWORD;
    let ownerOk = false;
    if (pass && session) {
      const { verify, OWNER_COOKIE_TTL_SEC } = await import('@/lib/signed-cookie');
      const { STAFF_SESSION_SECRET } = await import('@/lib/session-secret');
      const payload = await verify(session, STAFF_SESSION_SECRET(), OWNER_COOKIE_TTL_SEC);
      ownerOk = payload?.sub === 'owner';
    }
    if (!ownerOk && !staff) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  // ─── Customer-account auth gate ───────────────────────────────────────────
  // The session lives in cookies written by the @supabase/ssr browser client.
  // We build a server client over the request cookies and call getUser(),
  // which cryptographically verifies the token (and refreshes it if near
  // expiry, writing the new cookies onto the response). No hand-rolled JWT
  // decode — that couldn't read @supabase/ssr's chunked cookie format, which
  // is what bounced every signed-in customer back to /login.
  if (pathname.startsWith('/account')) {
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const sbKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    // Demo / unconfigured: skip the gate, the client-side check still guards.
    if (sbUrl && sbKey) {
      let res = NextResponse.next({ request });
      const supabase = createServerClient(sbUrl, sbKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
            res = NextResponse.next({ request });
            for (const { name, value, options } of cookiesToSet) res.cookies.set(name, value, options);
          },
        },
      });
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
      // Authenticated — return the response carrying any refreshed cookies.
      return res;
    }
  }

  // ─── Canonical query-param 301 (audit SEV-2) ──────────────────────────────
  // The /shop page historically wrote `?cat=` and `?sub=` to the URL, while
  // header nav + sitemap + breadcrumb canonical URLs all use `?category=` /
  // `?subcategory=`. That dual-URL surface dilutes SEO ranking — fold every
  // legacy short-form back to the canonical name.
  if (pathname === '/shop') {
    const url = request.nextUrl;
    const cat = url.searchParams.get('cat');
    const sub = url.searchParams.get('sub');
    if (cat !== null || sub !== null) {
      const next = url.clone();
      if (cat !== null) { next.searchParams.delete('cat'); next.searchParams.set('category', cat); }
      if (sub !== null) { next.searchParams.delete('sub'); next.searchParams.set('subcategory', sub); }
      return NextResponse.redirect(next, 301);
    }
  }

  // ─── WP pattern 301s (URL preservation for legacy slugs) ──────────────────
  // The Semrush audit of the live WP site flagged a thousand+ broken internal
  // links pointing at WP-style URLs (/about-us/, /shop/page/2/, /category/x/,
  // /?page_id=3). These rules cover the common shapes; per-slug redirects are
  // still served from the `redirects` table below (built by the WP importer
  // from old product / blog ids).
  //
  // Runs on ALL paths (incl. `/`) because `/?s=foo` is itself a WP redirect
  // target — `isOwnedPath` would otherwise filter it out before we got here.
  {
    const patternTo = wpPatternRedirect(pathname, request.nextUrl.searchParams);
    if (patternTo && patternTo !== pathname + (search ?? '')) {
      return NextResponse.redirect(new URL(patternTo, request.url), 301);
    }
  }

  // ─── 301 redirect lookup (WordPress URL preservation) ─────────────────────
  // Only run on paths we don't already own to avoid useless work and any
  // potential loops with route-handler-owned URLs.
  if (!isOwnedPath(pathname)) {
    const to = await resolveRedirect(pathname);
    if (to && to !== pathname) {
      const target = new URL(to + (search ?? ''), request.url);
      return NextResponse.redirect(target, 301);
    }
  }

  // Fall-through — emit the response with `x-pathname` set so server
  // components downstream can read the active path (used by AdminLayout
  // to skip AdminShell for /admin/pos — see SHELL_OPT_OUT).
  const res = NextResponse.next();
  res.headers.set('x-pathname', pathname);
  return res;
}

// Map a known WP-style URL to the Next route, or null if no rule matches and
// we should fall through to the per-slug `redirects` lookup. Pure function —
// no DB hits, no async — runs at edge speed.
function wpPatternRedirect(pathname: string, params: URLSearchParams): string | null {
  // /shop/page/2/ → /shop?page=2
  const shopPage = pathname.match(/^\/shop\/page\/(\d+)\/?$/);
  if (shopPage) return `/shop?page=${shopPage[1]}`;

  // /blog/page/2/ → /blog?page=2
  const blogPage = pathname.match(/^\/blog\/page\/(\d+)\/?$/);
  if (blogPage) return `/blog?page=${blogPage[1]}`;

  // /category/<slug>/ + /product-category/<slug>/ → /shop?category=<slug>
  // (Note: /brand/<slug> is no longer redirected — it now serves its own
  // brand landing page at src/app/brand/[slug]/page.tsx.)
  const cat = pathname.match(/^\/(?:product-category|category)\/([^/]+)\/?$/);
  if (cat) return `/shop?category=${encodeURIComponent(cat[1])}`;

  // /author/<name>/<page?>/ → /blog (we don't have author archives)
  if (/^\/author\/[^/]+(?:\/page\/\d+)?\/?$/.test(pathname)) return '/blog';

  // WP standard slugs that map to our CMS page route.
  const PAGE_SLUG_MAP: Record<string, string> = {
    '/about-us':         '/page/about',
    '/about':            '/page/about',
    '/contact-us':       '/page/contact',
    '/contact':          '/page/contact',
    '/shipping-policy':  '/page/shipping',
    '/shipping':         '/page/shipping',
    '/return-policy':    '/page/returns',
    '/returns-policy':   '/page/returns',
    '/returns-refunds':  '/page/returns',
    '/refund-policy':    '/page/returns',
    '/faqs':             '/page/faq',
    '/faq':              '/page/faq',
    '/privacy-policy':   '/privacy',
    '/terms':            '/page/terms',
    '/terms-conditions': '/page/terms',
  };
  const trimmed = pathname.replace(/\/$/, '') || '/';
  if (PAGE_SLUG_MAP[trimmed]) return PAGE_SLUG_MAP[trimmed];

  // /?s=foo&post_type=product (or any /?s=) → /shop with q param
  if (pathname === '' || pathname === '/') {
    const s = params.get('s');
    if (s) return `/shop?q=${encodeURIComponent(s)}`;
    // /?page_id=N is a WP fallback; route to home (page_ids aren't preserved
    // post-migration but the redirects table handles per-id mappings).
    if (params.get('page_id')) return '/';
  }

  return null;
}

// Run on everything except Next.js internals and static assets.
export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static, _next/image, _next/data
     * - any file with an extension (.svg, .png, .jpg, .css, .js, .woff…)
     */
    '/((?!_next/static|_next/image|_next/data|.*\\..*).*)',
  ],
};
