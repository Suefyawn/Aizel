// Rehost product images from eBay's CDN (i.ebayimg.com) to Aizel's own
// Supabase Storage bucket. eBay images can be rotated or removed without
// notice when a listing changes — and serving from a US CDN to UK
// shoppers adds 200-400 ms of latency per image. Hosting them in our
// own bucket fixes both.
//
// Idempotent: products already pointing at vregfkpahmgouemmslcz.supabase.co
// are skipped. Safe to re-run if it fails partway through.
//
// Usage (local):
//   1. Ensure .env.local has NEXT_PUBLIC_SUPABASE_URL and
//      SUPABASE_SERVICE_ROLE_KEY (the latter NEVER ships to the browser).
//   2. node --env-file=.env.local scripts/rehost-product-images.mjs
//   3. Add --dry-run to log what would change without writing.
//
// Concurrency: 5 in-flight at a time. eBay's CDN tolerates this; bumping
// higher tends to get throttled.
//
// Storage layout: products/{slug}.webp in the `images` bucket. Public
// read is on (set when the bucket was created), no signed URLs needed.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const CONCURRENCY = Number(process.env.REHOST_CONCURRENCY || 5);
const BUCKET = process.env.REHOST_BUCKET || 'images';
const PATH_PREFIX = process.env.REHOST_PATH_PREFIX || 'products';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[rehost] NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  console.error('         Drop them into .env.local and re-run via `node --env-file=.env.local …`.');
  process.exit(2);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── 1. Load the catalogue ───────────────────────────────────────────────
const { data: rows, error } = await supabase
  .from('products')
  .select('id, slug, image_url')
  .not('image_url', 'is', null);

if (error) {
  console.error('[rehost] failed to load products:', error.message);
  process.exit(1);
}

const ownHost = new URL(SUPABASE_URL).host;
const candidates = rows.filter(r =>
  r.image_url && !r.image_url.includes(ownHost) && r.image_url.startsWith('http')
);
console.log(`[rehost] ${rows.length} products with images; ${candidates.length} need rehosting`);

if (candidates.length === 0) {
  console.log('[rehost] nothing to do — every product is already on our CDN.');
  process.exit(0);
}

// ─── 2. Per-product rehost ───────────────────────────────────────────────
async function rehostOne(p) {
  try {
    const res = await fetch(p.image_url, {
      headers: { 'user-agent': 'AizelImageRehost/1.0 (+https://aizel.co.uk)' },
    });
    if (!res.ok) return { slug: p.slug, ok: false, error: `${res.status} ${res.statusText}` };
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') || 'image/webp';
    // Slug → filename. .webp because eBay serves WebP for product images,
    // and Next/Image will re-encode to AVIF on the storefront anyway.
    const ext = contentType.includes('jpeg') ? 'jpg'
              : contentType.includes('png')  ? 'png'
              : 'webp';
    const path = `${PATH_PREFIX}/${p.slug}.${ext}`;

    if (DRY_RUN) {
      return { slug: p.slug, ok: true, dryRun: true, bytes: buf.length, path };
    }

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, buf, { contentType, upsert: true, cacheControl: '31536000' });
    if (upErr) return { slug: p.slug, ok: false, error: `upload: ${upErr.message}` };

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const { error: dbErr } = await supabase
      .from('products')
      .update({ image_url: pub.publicUrl })
      .eq('id', p.id);
    if (dbErr) return { slug: p.slug, ok: false, error: `db: ${dbErr.message}` };

    return { slug: p.slug, ok: true, url: pub.publicUrl, bytes: buf.length };
  } catch (e) {
    return { slug: p.slug, ok: false, error: e.message };
  }
}

// ─── 3. Bounded-concurrency runner ───────────────────────────────────────
async function runAll(items, concurrency, work) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      const r = await work(items[idx]);
      results[idx] = r;
      const tag = r.ok ? (r.dryRun ? 'DRY' : '✓') : '✗';
      process.stdout.write(`[${idx + 1}/${items.length}] ${tag} ${r.slug}${r.error ? ` — ${r.error}` : ''}\n`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

const results = await runAll(candidates, CONCURRENCY, rehostOne);
const ok   = results.filter(r => r.ok).length;
const fail = results.filter(r => !r.ok);
console.log(`\n[rehost] done. ${ok}/${candidates.length} succeeded. ${fail.length} failed.`);
if (fail.length) {
  console.log('[rehost] failures:');
  for (const f of fail.slice(0, 20)) console.log('  -', f.slug, '→', f.error);
  if (fail.length > 20) console.log(`  … and ${fail.length - 20} more`);
}
if (DRY_RUN) console.log('[rehost] DRY RUN — no DB or storage writes performed.');
