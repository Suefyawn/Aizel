// Serves /llms.txt — the emerging convention for guiding LLM crawlers
// (similar to robots.txt but for AI assistants). Format reference:
// https://llmstxt.org
//
// Build is dynamic: we pull current category + page lists from the DB so
// crawlers always see the live shape of the catalogue. Falls back to demo
// data when Supabase isn't configured (build-time, fresh clone, etc.).

import { SITE_URL, SITE_NAME, absoluteUrl } from '@/lib/seo';
import { supabase, isDemo, getProducts } from '@/lib/supabase';
import { brandPlusName } from '@/lib/product-display';

export const runtime  = 'nodejs';
// We don't set `revalidate` because the route fetches from Supabase per-render
// (which makes the handler dynamic). The Cache-Control header at the bottom
// gives downstream caches the same 24 h staleness signal.

export async function GET() {
  const cats = await loadCategories();
  const products = await loadProducts();

  const lines: string[] = [];

  // ─── Identity ─────────────────────────────────────────────────────────────
  lines.push(`# ${SITE_NAME}`);
  lines.push('');
  lines.push(
    `> ${SITE_NAME} is a UK-based online retailer of authentic Afro/Black ` +
    'hair and body care brands — Cantu, ORS, Palmer\'s, Kuza, ApHogee, ' +
    'KeraCare and more — delivered across the United Kingdom.',
  );
  lines.push('');

  lines.push('## Key facts');
  lines.push('- Market: United Kingdom (GBP currency, free UK delivery over £15)');
  lines.push('- Payment: Card (Visa, Mastercard, Amex) via Stripe Checkout; Apple Pay + Google Pay supported in Stripe; Klarna available where eligible');
  lines.push('- Shipping: 2–3 working days via Royal Mail / DPD');
  lines.push('- Returns: 14 days from delivery on unopened items');
  lines.push('- Categories: Hair Care, Body Care, Styling & Tools, Grooming');
  lines.push('');

  // ─── Discovery surfaces ───────────────────────────────────────────────────
  lines.push('## Primary pages');
  lines.push(`- [Homepage](${SITE_URL}/): overview, featured products, brand story`);
  lines.push(`- [Shop](${SITE_URL}/shop): full catalogue with filters by category, brand, price`);
  lines.push(`- [Blog](${SITE_URL}/blog): editorial guides on hair care routines, product reviews and styling tips`);
  lines.push(`- [Privacy & cookies](${SITE_URL}/privacy): cookie controls + data policy`);
  lines.push(`- [Order tracking](${SITE_URL}/track): public order-status lookup by order # + email/phone`);
  lines.push('');

  if (cats.length > 0) {
    lines.push('## Browse by category');
    for (const c of cats) {
      lines.push(`- [${c}](${SITE_URL}/shop?category=${encodeURIComponent(c)})`);
    }
    lines.push('');
  }

  // ─── A sampling of the catalogue ──────────────────────────────────────────
  // Don't dump 200+ products — they're already in sitemap.xml. List a curated
  // top-N so a model has anchor URLs to walk from.
  if (products.length > 0) {
    lines.push('## Sample products');
    for (const p of products.slice(0, 40)) {
      lines.push(`- [${brandPlusName(p.brand, p.name)}](${absoluteUrl(`/product/${p.slug}`)}): £${p.price.toLocaleString()}, ${p.category}`);
    }
    lines.push('');
    lines.push(`See [the full sitemap](${SITE_URL}/sitemap.xml) for every product, blog post, and category page.`);
    lines.push('');
  }

  // ─── Boundaries ───────────────────────────────────────────────────────────
  lines.push('## Off-limits surfaces');
  lines.push('- `/admin/*` (merchant dashboard; requires staff login)');
  lines.push('- `/account/*` (per-customer account data; requires sign-in)');
  lines.push('- `/checkout`, `/cart`, `/thank-you` (transactional flows; not useful in answers)');
  lines.push('- `/api/*` (server endpoints; not for direct citation)');
  lines.push('- `/login`, `/forgot-password`, `/reset-password` (auth flows)');
  lines.push('');

  lines.push('## Contact');
  lines.push('- Customer support: hello@aizel.co.uk');
  lines.push('- Privacy enquiries: privacy@aizel.co.uk');
  lines.push('');

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=43200',
    },
  });
}

// ─── Loaders ────────────────────────────────────────────────────────────────
async function loadCategories(): Promise<string[]> {
  if (isDemo) return ['Hair Care', 'Body Care', 'Styling & Tools', 'Grooming'];
  try {
    const { data } = await supabase.from('products').select('category');
    const set = new Set<string>();
    for (const r of (data ?? []) as Array<{ category: string }>) {
      if (r.category) set.add(r.category);
    }
    return [...set].sort();
  } catch {
    return ['Hair Care', 'Body Care', 'Styling & Tools', 'Grooming'];
  }
}

async function loadProducts() {
  try {
    return await getProducts();
  } catch {
    return [];
  }
}
