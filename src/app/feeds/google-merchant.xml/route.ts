// Google Merchant Center product feed (RSS 2.0 + g: namespace).
//
// Submit this URL — https://www.aizel.co.uk/feeds/google-merchant.xml — as a
// scheduled-fetch feed in Merchant Center → Products → Feeds. Google re-reads
// it on whatever cadence you set there; one fetch a day is the typical choice.
// We don't paginate: the catalogue is well under the 150 000-item-per-feed cap.
//
// Field reference: https://support.google.com/merchants/answer/7052112
//
// Items emitted at the parent-product level (one row per /product/[slug]).
// Variant-level emission with item_group_id is a future expansion if/when we
// want per-variant prices to show in Shopping; for now Shopping shows the
// parent price and the PDP handles variant selection.

import { supabase, isDemo } from '@/lib/supabase';
import { SITE_NAME, SITE_URL, absoluteUrl } from '@/lib/seo';

export const revalidate = 3600; // 1h — Merchant Center polls daily, this is plenty.

interface FeedProduct {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  description: string | null;
  short_description: string | null;
  image_url: string | null;
  price: number;
  original_price: number | null;
  stock: number;
  track_inventory: boolean | null;
  category: string | null;
  status: string | null;
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Merchant Center hard-limits the description at 5000 chars and the title at
// 150 chars. We keep the description shorter (1000) so it stays a meaningful
// summary rather than a wall of marketing copy, and we strip HTML — feed text
// must be plain.
function clean(text: string | null, max: number): string {
  if (!text) return '';
  const stripped = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return stripped.length > max ? stripped.slice(0, max - 1).trimEnd() + '…' : stripped;
}

function item(p: FeedProduct): string {
  const title = clean(p.brand ? `${p.brand} — ${p.name}` : p.name, 150);
  const description = clean(p.description || p.short_description || p.name, 1000);
  const link = absoluteUrl(`/product/${p.slug}`);
  const imageLink = p.image_url ?? '';
  const available =
    p.track_inventory === false || p.stock > 0 ? 'in_stock' : 'out_of_stock';
  // Merchant Center convention: g:price is the regular/MSRP price, g:sale_price
  // is the discounted price. When original_price > price, the product is on
  // sale — show both so Shopping can render the strikethrough. Otherwise just
  // g:price = current price.
  const onSale = p.original_price != null && p.original_price > p.price;
  const regularPrice = onSale ? p.original_price! : p.price;
  const salePrice = onSale ? p.price : null;

  const lines = [
    `    <item>`,
    `      <g:id>${xmlEscape(p.id)}</g:id>`,
    `      <g:title>${xmlEscape(title)}</g:title>`,
    `      <g:description>${xmlEscape(description)}</g:description>`,
    `      <g:link>${xmlEscape(link)}</g:link>`,
    imageLink ? `      <g:image_link>${xmlEscape(imageLink)}</g:image_link>` : '',
    `      <g:availability>${available}</g:availability>`,
    `      <g:price>${regularPrice} GBP</g:price>`,
    salePrice != null ? `      <g:sale_price>${salePrice} GBP</g:sale_price>` : '',
    `      <g:condition>new</g:condition>`,
    p.brand ? `      <g:brand>${xmlEscape(p.brand)}</g:brand>` : '',
    // Most imported beauty SKUs we resell don't have a GTIN/MPN we can publish.
    // identifier_exists=no tells Merchant Center to skip the unique-product-
    // identifier requirement rather than reject the row.
    `      <g:identifier_exists>no</g:identifier_exists>`,
    p.category ? `      <g:google_product_category>${xmlEscape(p.category)}</g:google_product_category>` : '',
    p.category ? `      <g:product_type>${xmlEscape(p.category)}</g:product_type>` : '',
    `    </item>`,
  ].filter(Boolean);
  return lines.join('\n');
}

async function loadProducts(): Promise<FeedProduct[]> {
  if (isDemo) {
    const { DEMO_PRODUCTS } = await import('@/lib/demo-data');
    return DEMO_PRODUCTS.map(p => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      brand: p.brand ?? null,
      description: p.description ?? null,
      short_description: p.short_description ?? null,
      image_url: p.image_url ?? null,
      price: p.price,
      original_price: p.original_price ?? null,
      stock: p.stock,
      track_inventory: p.track_inventory ?? true,
      category: p.category ?? null,
      status: 'published',
    }));
  }
  const { data } = await supabase
    .from('products')
    .select('id, slug, name, brand, description, short_description, image_url, price, original_price, stock, track_inventory, category, status')
    .eq('status', 'published');
  return (data ?? []) as FeedProduct[];
}

export async function GET(): Promise<Response> {
  const products = await loadProducts();
  const items = products
    .filter(p => p.image_url) // Merchant Center requires an image_link
    .map(item)
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${xmlEscape(SITE_NAME)}</title>
    <link>${xmlEscape(SITE_URL)}</link>
    <description>${xmlEscape(`${SITE_NAME} product feed for Google Merchant Center`)}</description>
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      // Merchant Center fetches this URL directly; it should never appear as
      // its own result in regular Google Search.
      'X-Robots-Tag': 'noindex',
    },
  });
}
