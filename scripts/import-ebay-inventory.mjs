// Import Aizel's initial catalogue from an eBay seller export.
//
// Input — one of:
//   A) ./inventory/ebay.csv          (CSV export from eBay Seller Hub or
//                                     File Exchange / "Active Listings" report)
//   B) EBAY_INVENTORY_CSV=<path>     env var pointing at a CSV anywhere
//   C) EBAY_SELLER_URL=<url>         public seller listings page to scrape
//                                     (least reliable; CSV is preferred)
//
// Output: rows in Supabase `public.products` (and `public.product_images`
// when image URLs are present). Re-running is idempotent — products are
// keyed by `slug`, which we derive from the eBay item title.
//
// Usage:
//   npm run import:ebay              # uses defaults
//   npm run import:ebay -- --dry-run # parses + logs, no DB writes
//   node --env-file=.env.local scripts/import-ebay-inventory.mjs
//
// The mapping below covers the standard columns eBay's CSV exports include;
// adjust `mapRow()` if your export has different headings.

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// ─── Config ────────────────────────────────────────────────────────────────
const CSV_PATH = process.env.EBAY_INVENTORY_CSV
  || resolve(process.cwd(), 'inventory', 'ebay.csv');
const SELLER_URL = process.env.EBAY_SELLER_URL || '';
const DRY_RUN = process.env.EBAY_IMPORT_DRY_RUN === 'true'
  || process.argv.includes('--dry-run');
const BATCH_SIZE = Number(process.env.EBAY_IMPORT_BATCH_SIZE || 25);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!DRY_RUN && (!SUPABASE_URL || !SUPABASE_KEY)) {
  throw new Error(
    'Supabase env missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY,\n' +
    'or pass --dry-run to parse the CSV without writing.',
  );
}

// ─── CSV parsing ───────────────────────────────────────────────────────────
// Minimal RFC-4180 parser — eBay exports use commas + double-quoted fields
// with embedded commas/newlines. No external dependency needed.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; continue; }
      if (c === '"') { inQuotes = false; continue; }
      field += c;
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === ',') { row.push(field); field = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const header = rows[0].map(h => h.trim());
  return rows.slice(1)
    .filter(r => r.some(cell => cell.trim().length))
    .map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
}

function slugify(s) {
  return s.toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 110);
}

// eBay's CSV column names vary by report. Common ones supported below; the
// `coalesce()` helper picks the first non-empty match so a single mapper
// works across the "Active listings", "File Exchange", and "Seller Hub /
// Listings" exports.
function coalesce(row, keys) {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim().length) return String(v).trim();
  }
  return '';
}

// Keyword → Aizel taxonomy. Tuned for the gorgeousbeaut_0 catalogue
// (Afro/Black hair & body care). Order matters — the first matching key
// wins, so more specific terms come before generic ones.
//
// Schema note: `category` is the LEAF (Shampoo & Conditioner, Cocoa & Shea
// Butter, etc.) — Aizel's taxon resolver expects the leaf-as-category.
// `subcategory` carries the parent taxon for breadcrumbs / filters.
const CATEGORY_MAP = {
  // ── Hair Care: oils first (more specific than "hair") ──
  'Jamaican Black Castor': { category: 'Hair Oils & Serums', subcategory: 'Hair Care' },
  'Castor Oil':            { category: 'Hair Oils & Serums', subcategory: 'Hair Care' },
  'Amla Oil':              { category: 'Hair Oils & Serums', subcategory: 'Hair Care' },
  'Hair Oil':              { category: 'Hair Oils & Serums', subcategory: 'Hair Care' },
  'Hair Serum':            { category: 'Hair Oils & Serums', subcategory: 'Hair Care' },
  // Edge & gels
  'Edge Control':          { category: 'Edge Control & Gels', subcategory: 'Hair Care' },
  'Eco Style':             { category: 'Edge Control & Gels', subcategory: 'Hair Care' },
  'Styling Gel':           { category: 'Edge Control & Gels', subcategory: 'Hair Care' },
  'Shine ‘n Jam':          { category: 'Edge Control & Gels', subcategory: 'Hair Care' },
  "Shine 'n Jam":          { category: 'Edge Control & Gels', subcategory: 'Hair Care' },
  'Hair Gel':              { category: 'Edge Control & Gels', subcategory: 'Hair Care' },
  // Treatments / masks
  'Protein Treatment':     { category: 'Hair Treatments & Masks', subcategory: 'Hair Care' },
  'Deep Conditioner':      { category: 'Hair Treatments & Masks', subcategory: 'Hair Care' },
  'Hair Treatment':        { category: 'Hair Treatments & Masks', subcategory: 'Hair Care' },
  'Hair Mask':             { category: 'Hair Treatments & Masks', subcategory: 'Hair Care' },
  // Mousse / hairspray / dry shampoo
  'Dry Shampoo':           { category: 'Mousse & Hairspray',     subcategory: 'Hair Care' },
  'Hair Spray':            { category: 'Mousse & Hairspray',     subcategory: 'Hair Care' },
  'Hairspray':             { category: 'Mousse & Hairspray',     subcategory: 'Hair Care' },
  'Mousse':                { category: 'Mousse & Hairspray',     subcategory: 'Hair Care' },
  // Curl / leave-in
  'Curl Cream':            { category: 'Curl & Styling Creams',  subcategory: 'Hair Care' },
  'Curl Activator':        { category: 'Curl & Styling Creams',  subcategory: 'Hair Care' },
  'Leave-In':              { category: 'Curl & Styling Creams',  subcategory: 'Hair Care' },
  'Leave In':              { category: 'Curl & Styling Creams',  subcategory: 'Hair Care' },
  // Relaxers
  'Relaxer':               { category: 'Relaxers & Kits',        subcategory: 'Hair Care' },
  'No-Lye':                { category: 'Relaxers & Kits',        subcategory: 'Hair Care' },
  // Shampoo / conditioner (after the more specific terms above)
  'Shampoo':               { category: 'Shampoo & Conditioner',  subcategory: 'Hair Care' },
  'Conditioner':           { category: 'Shampoo & Conditioner',  subcategory: 'Hair Care' },
  // ── Body Care ──
  'Cocoa Butter':          { category: 'Cocoa & Shea Butter',    subcategory: 'Body Care' },
  'Shea Butter':           { category: 'Cocoa & Shea Butter',    subcategory: 'Body Care' },
  'Body Butter':           { category: 'Cocoa & Shea Butter',    subcategory: 'Body Care' },
  'Body Oil':              { category: 'Body Oils',              subcategory: 'Body Care' },
  'Body Lotion':           { category: 'Body Lotions',           subcategory: 'Body Care' },
  'Petroleum Jelly':       { category: 'Petroleum Jelly',        subcategory: 'Body Care' },
  'Vaseline':              { category: 'Petroleum Jelly',        subcategory: 'Body Care' },
  'Body Wash':             { category: 'Body Wash',              subcategory: 'Body Care' },
  // ── Styling & Tools ──
  'Wonder Lace':           { category: 'Wig & Lace Adhesives',   subcategory: 'Styling & Tools' },
  'Lace Bond':             { category: 'Wig & Lace Adhesives',   subcategory: 'Styling & Tools' },
  'Wig Glue':              { category: 'Wig & Lace Adhesives',   subcategory: 'Styling & Tools' },
  'Bonding Glue':          { category: 'Bonding Glue',           subcategory: 'Styling & Tools' },
  'Hair Bonding':          { category: 'Bonding Glue',           subcategory: 'Styling & Tools' },
  // ── Grooming ──
  'Magic Shaving':         { category: 'Shaving',                subcategory: 'Grooming' },
  'Shaving Powder':        { category: 'Shaving',                subcategory: 'Grooming' },
  'Shaving Cream':         { category: 'Shaving',                subcategory: 'Grooming' },
  'Bump Stopper':          { category: 'Bump Treatments',        subcategory: 'Grooming' },
  'Beard Oil':             { category: 'Beard Care',             subcategory: 'Grooming' },
  'Beard Balm':            { category: 'Beard Care',             subcategory: 'Grooming' },
  // ── Generic catch-all for anything hair-adjacent we missed ──
  'Hair':                  { category: 'Shampoo & Conditioner',  subcategory: 'Hair Care' },
};

function guessCategory(rawCategory, title) {
  const haystack = `${rawCategory} ${title}`.toLowerCase();
  for (const [needle, mapped] of Object.entries(CATEGORY_MAP)) {
    if (haystack.includes(needle.toLowerCase())) return mapped;
  }
  return { category: 'Makeup', subcategory: null };
}

// Known brands stocked at Aizel. Used as the first pass at brand detection
// (the scraper's first-words heuristic catches multi-word phrases like
// "Cantu Avocado", which is a Cantu *line*, not a brand). Order doesn't
// matter — `detectBrand` picks the longest matching prefix so "Mane 'n Tail"
// beats "Mane".
const KNOWN_BRANDS = [
  // Heritage Afro/Black hair brands
  'Cantu', 'ORS', "Palmer's", 'Palmers', 'Kuza', 'ApHogee', 'Aphogee',
  "Mane 'n Tail", 'Mane n Tail', 'Ebin', 'As I Am', 'Blue Magic',
  'KeraCare', 'Kera Care', 'Salon Pro', 'Dabur', 'Magic Shaving',
  "Ghana's Best", 'Ghanas Best', "Let's Jam", 'Lets Jam', 'Got2b',
  'got2b', 'Vaseline', 'Jergens', 'Bump Stopper', 'SoftSheen-Carson',
  'SoftSheen', 'Eco Style', 'Eco Styler', 'Ampro', 'Optimum',
  'Just for Me', 'Murray', "Murray's", 'Doo Gro', 'Lustrasilk', 'Tropic Isle',
  'Tropic Isle Living', 'TCB', 'Pink', 'Africa', "Africa's Best",
  'Shine n Jam', "Shine 'n Jam", 'Clippercide', 'Fair And White',
  'Neutrogena', 'LA Girl', 'Gabri', 'Sulfur8', 'Sulfur 8',
  // Added 2026-05-26 after the 593-product import audit surfaced 361 NULL
  // brands — these are the ones the heuristic was missing, sorted roughly
  // by frequency in the catalogue.
  'Shea Moisture', 'Aunt Jackie', "Aunt Jackie's", 'Aunt Jackies',
  'The Doux', 'Camille Rose', 'Creme of Nature', 'Design Essentials',
  'Bigen', 'Crazy Color', 'Crazy Colour', 'Bold Hold', 'African Pride',
  'Dark and Lovely', 'Dark & Lovely', 'Aloe Pura', 'Astral', 'Aztec Secret',
  'Brut', 'Gillette', 'Andis', 'Allored', 'Beauty Ambition', 'Benjamins',
  'Dressmaker', 'Honey Baby Naturals', 'Maui Moisture', 'Carol\'s Daughter',
  "Miss Jessie's", 'Miss Jessie', 'Pantene', 'Head & Shoulders', 'TRESemmé',
  "L'Oréal", 'Loreal', 'Garnier', 'Herbal Essences', 'Lottabody', 'Dax',
];
const ACCESSIBILITY_SUFFIX = /\s*Opens?\s+in\s+a\s+new\s+window\s+or\s+tab\s*$/i;

function detectBrand(title, fallback) {
  // Try the explicit CSV `Brand` column first — but only if it's a SHORT
  // single-brand value, not a multi-word phrase like the scraper produces.
  if (fallback) {
    const matchInFallback = KNOWN_BRANDS.find(b => fallback.toLowerCase().startsWith(b.toLowerCase()));
    if (matchInFallback) return matchInFallback;
  }
  // Otherwise scan the title for a known brand prefix.
  const lower = (title || '').toLowerCase();
  // Sort by length DESC so "Mane 'n Tail" matches before "Mane".
  const sorted = [...KNOWN_BRANDS].sort((a, b) => b.length - a.length);
  for (const b of sorted) {
    if (lower.startsWith(b.toLowerCase())) return b;
  }
  // Last resort: the scraper's first-capitalised-word heuristic.
  return fallback || null;
}

function mapRow(row) {
  let title = coalesce(row, ['Title', 'Item title', 'Product name']);
  if (!title) return null;
  // Strip the eBay "Opens in a new window or tab" accessibility suffix the
  // scraper sometimes captures from card-link text.
  title = title.replace(ACCESSIBILITY_SUFFIX, '').trim();
  const priceRaw = coalesce(row, ['Current price', 'Start price', 'Price', 'BuyItNowPrice']);
  const price = Number(String(priceRaw).replace(/[^0-9.]/g, '')) || 0;
  const stock = Number(coalesce(row, ['Available quantity', 'Quantity', 'Qty'])) || 0;
  const brandFallback = coalesce(row, ['Brand', 'Manufacturer']);
  const brand = detectBrand(title, brandFallback);
  const rawCategory = coalesce(row, ['eBay Category 1 Name', 'Primary Category', 'Category']);
  const description = coalesce(row, ['Description', 'Item description', 'HTML description']);
  const imageRaw = coalesce(row, ['Item photo URL', 'Picture URL', 'Image URLs', 'PicURL']);
  // eBay sometimes pipe-separates multiple image URLs.
  const imageUrls = imageRaw.split(/[|;,\s]+/).filter(u => /^https?:\/\//.test(u));
  const itemId = coalesce(row, ['Item number', 'ItemID', 'Listing ID']);
  const sku = coalesce(row, ['Custom label (SKU)', 'SKU', 'Custom label']);
  const { category, subcategory } = guessCategory(rawCategory, title);

  // Avoid "brand-brand-name" when the title already starts with the brand.
  const titleHasBrand = brand && title.toLowerCase().startsWith(brand.toLowerCase());
  const slugSeed = titleHasBrand || !brand ? title : `${brand} ${title}`;

  return {
    name: title,
    brand: brand || null,
    price,
    stock,
    category,
    subcategory: subcategory || null,
    slug: slugify(slugSeed),
    description: description.replace(/<[^>]+>/g, '').trim().slice(0, 8000) || null,
    short_description: title.slice(0, 220),
    kind: 'simple',
    status: 'published',
    track_inventory: stock > 0,
    image_url: imageUrls[0] || null,
    ebay_item_id: itemId || null,
    ebay_sku: sku || null,
    extra_image_urls: imageUrls.slice(1),
  };
}

// ─── Supabase writes ───────────────────────────────────────────────────────
async function sbUpsertProducts(rows) {
  // Strip the auxiliary fields (ebay_*, extra_image_urls) before sending —
  // they aren't columns on `products`. Keep them on the JS object so the
  // post-upsert image-insert step can use them.
  const productRows = rows.map(({ ebay_item_id, ebay_sku, extra_image_urls, ...rest }) => {
    void ebay_item_id; void ebay_sku; void extra_image_urls;
    return rest;
  });
  const r = await fetch(`${SUPABASE_URL}/rest/v1/products?on_conflict=slug`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(productRows),
  });
  if (!r.ok) throw new Error(`products upsert failed: ${r.status} ${await r.text()}`);
  return r.json();
}

async function sbInsertExtraImages(productId, urls) {
  if (!urls.length) return;
  const rows = urls.map((url, i) => ({
    product_id: productId,
    url,
    sort_order: i + 1,
  }));
  const r = await fetch(`${SUPABASE_URL}/rest/v1/product_images`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!r.ok) {
    console.warn(`product_images insert failed for ${productId}: ${r.status} ${await r.text()}`);
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  if (SELLER_URL && !existsSync(CSV_PATH)) {
    console.error(
      `[import-ebay] Seller-URL scraping is not implemented yet — please export\n` +
      `your listings from eBay Seller Hub as CSV and drop the file at:\n` +
      `  ${CSV_PATH}\n` +
      `Or set EBAY_INVENTORY_CSV to its path.`,
    );
    process.exit(2);
  }
  if (!existsSync(CSV_PATH)) {
    console.error(`[import-ebay] CSV not found at ${CSV_PATH}`);
    console.error(`Drop your eBay export there or set EBAY_INVENTORY_CSV.`);
    process.exit(2);
  }

  const text = readFileSync(CSV_PATH, 'utf8');
  const parsed = parseCsv(text);
  console.log(`[import-ebay] Parsed ${parsed.length} rows from ${CSV_PATH}`);

  const mapped = parsed.map(mapRow).filter(Boolean);
  console.log(`[import-ebay] Mapped ${mapped.length} sellable rows`);

  if (DRY_RUN) {
    console.log('\n[import-ebay] DRY RUN — first 3 mapped rows:');
    console.log(JSON.stringify(mapped.slice(0, 3), null, 2));
    console.log(`\n[import-ebay] Would upsert ${mapped.length} products. No DB writes.`);
    return;
  }

  let okCount = 0;
  for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
    const batch = mapped.slice(i, i + BATCH_SIZE);
    const inserted = await sbUpsertProducts(batch);
    okCount += inserted.length;
    // Insert any secondary image URLs against the new product row.
    for (let j = 0; j < inserted.length; j++) {
      const extras = batch[j].extra_image_urls;
      if (extras?.length) await sbInsertExtraImages(inserted[j].id, extras);
    }
    process.stdout.write(`\r[import-ebay] Upserted ${okCount}/${mapped.length}...`);
  }
  console.log(`\n[import-ebay] Done. ${okCount} products in Supabase.`);
}

main().catch(err => {
  console.error('[import-ebay] Failed:', err);
  process.exit(1);
});
