// ============================================================================
// Aizel service worker — minimal, hand-written.
//
// Strategy:
//   • Storefront pages (HTML)           → network-first with cached fallback.
//   • Static assets (_next/static, css) → cache-first.
//   • Images (Supabase Storage, public) → stale-while-revalidate.
//
// No background sync / push for now — opt in via a follow-up commit.
// ============================================================================

const VERSION = 'yp-v1';
const HTML_CACHE   = `${VERSION}-html`;
const ASSET_CACHE  = `${VERSION}-assets`;
const IMAGE_CACHE  = `${VERSION}-images`;

self.addEventListener('install', (event) => {
  // Skip waiting so we activate the new SW immediately on next nav.
  self.skipWaiting();
  event.waitUntil(
    caches.open(HTML_CACHE).then(c => c.add('/').catch(() => null))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never cache auth-sensitive / mutating endpoints.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin')) return;

  // Static assets — cache-first (long-lived hashes).
  if (url.pathname.startsWith('/_next/static') || /\.(css|js|woff2?)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(req, ASSET_CACHE));
    return;
  }

  // Product images — stale-while-revalidate from Supabase Storage.
  if (url.pathname.includes('/storage/v1/object/public/images/') || /\.(png|jpg|jpeg|webp|avif|svg)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(req, IMAGE_CACHE));
    return;
  }

  // HTML — network-first, fall back to cached or the offline shell.
  if (req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(req, HTML_CACHE));
    return;
  }
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone()).catch(() => {});
  return res;
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch {
    const hit = await cache.match(req);
    if (hit) return hit;
    // Last resort: the home page (cached at install).
    return (await cache.match('/')) ?? Response.error();
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const fetchPromise = fetch(req).then(res => {
    if (res.ok) cache.put(req, res.clone()).catch(() => {});
    return res;
  }).catch(() => hit ?? Response.error());
  return hit ?? fetchPromise;
}
