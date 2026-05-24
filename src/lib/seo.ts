// ============================================================================
// SEO helpers — JSON-LD generators, OG/Twitter card builders, canonical URLs.
// Phase 1.10. Used by app/layout.tsx, product/[slug]/page.tsx, blog/[slug]/page.tsx.
// ============================================================================

import type { Metadata } from 'next';
import type { Product, BlogPost, ProductReview, ProductVariant } from '@/types';
import { brandPlusName } from '@/lib/product-display';

// Resolution order: explicit NEXT_PUBLIC_SITE_URL (set this once a custom
// domain is live) → Vercel's production URL → a safe default. The final
// fallback must be a real, reachable origin: og:image and the email logo
// are absolute URLs, so a stale default renders them broken.
function normalizeOrigin(value: string | undefined | null): string | null {
  const v = value?.trim().replace(/\/+$/, '');
  if (!v) return null;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

export const SITE_URL =
  normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL) ??
  normalizeOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
  'https://aizel.co.uk';

export const SITE_NAME = 'Aizel';

// ─── URL helpers ────────────────────────────────────────────────────────────
export function absoluteUrl(path: string = '/'): string {
  return `${SITE_URL.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
}

export function canonical(path: string = '/'): Pick<Metadata, 'alternates'> {
  return { alternates: { canonical: absoluteUrl(path) } };
}

// ─── Metadata helpers ───────────────────────────────────────────────────────
interface PageMetaInput {
  title: string;
  description: string;
  path?: string;
  image?: string;
  type?: 'website' | 'article' | 'product';
  keywords?: string[];
  noIndex?: boolean;
}

// Google truncates SERP titles around 60 characters and descriptions around
// 160. Strings longer than `MAX` are truncated at the last word boundary
// (no awkward "Foo Ba…"). Used by `pageMeta()` so every page-level helper
// gets safe lengths without each caller having to remember the limits.
const TITLE_MAX = 60;
const DESC_MAX  = 158;

export function truncateOnWord(s: string, max: number): string {
  if (!s || s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  const trimmed = (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd();
  return trimmed.replace(/[,;:!\-–—.]+$/, '') + '…';
}

export function pageMeta(input: PageMetaInput): Metadata {
  const url = absoluteUrl(input.path ?? '/');
  // If the caller didn't supply an explicit image, leave `images` undefined so
  // Next's file-convention auto-discovery picks up the generated
  // `app/opengraph-image.tsx` (1200x630 branded fallback). Setting any value
  // here — even a default — would shadow that and force every page to use the
  // same image.
  const image = input.image;
  const ogImages = image ? [{ url: image }] : undefined;
  const twImages = image ? [image] : undefined;

  // Cap title + description so we don't get Semrush "Title element is too
  // long" / "meta description too long" warnings. The original `title` is
  // still used for the OG/Twitter title where length matters less and the
  // canonical-URL alternate is unaffected.
  const safeTitle = truncateOnWord(input.title.trim(), TITLE_MAX);
  const safeDesc  = truncateOnWord(input.description.trim(), DESC_MAX);

  return {
    title: safeTitle,
    description: safeDesc,
    keywords: input.keywords,
    robots: input.noIndex ? { index: false, follow: false } : undefined,
    alternates: { canonical: url },
    openGraph: {
      title: safeTitle,
      description: safeDesc,
      url,
      siteName: SITE_NAME,
      locale: 'en_GB',
      type: input.type === 'article' ? 'article' : 'website',
      images: ogImages,
    },
    twitter: {
      card: 'summary_large_image',
      title: safeTitle,
      description: safeDesc,
      images: twImages,
    },
  };
}

// ─── JSON-LD generators ─────────────────────────────────────────────────────
// Embed via <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(...) }} />.
export function jsonLd<T extends Record<string, unknown>>(obj: T): string {
  // Strip undefined keys to keep payload small.
  return JSON.stringify(obj, (_k, v) => (v === undefined ? undefined : v));
}

// Stable @id for the publishing Organization. Other nodes (WebSite.publisher)
// reference this rather than re-declaring the entity, which is the linked-data
// pattern Google expects and avoids duplicate Organization nodes.
export const ORGANIZATION_ID = absoluteUrl('/#organization');

export interface OrgContact {
  phone?: string;
  email?: string;
}

// A ContactPoint is only meaningful with an actual contact method. Emitting
// one with just `contactType` triggers "missing telephone" markup warnings,
// so return undefined when neither phone nor email is configured.
function contactPointLd(contact: OrgContact) {
  const phone = contact.phone?.trim();
  const email = contact.email?.trim();
  if (!phone && !email) return undefined;
  return [
    {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      ...(phone ? { telephone: phone } : {}),
      ...(email ? { email } : {}),
      areaServed: 'GB',
      availableLanguage: ['en'],
    },
  ];
}

// The single canonical Organization node, rendered site-wide by the root
// layout. `sameAs` is the merchant's social profiles and `contact` the
// store phone/email — both owner-managed via admin Settings. Empty values
// are omitted rather than emitted as null/empty (which markup validators
// flag as errors).
export function organizationLd(sameAs: string[] = [], contact: OrgContact = {}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: SITE_NAME,
    url: SITE_URL,
    // Google explicitly recommends raster (PNG/JPG, ≥112×112) for
    // Organization.logo; SVG gets flagged in Rich Results Test.
    logo: absoluteUrl('/icon-192.png'),
    image: absoluteUrl('/icon-192.png'),
    description:
      'Authentic Afro/Black hair and body care brands delivered across the UK.',
    areaServed: { '@type': 'Country', name: 'United Kingdom' },
    sameAs: sameAs.length ? sameAs : undefined,
    contactPoint: contactPointLd(contact),
  };
}

export function websiteLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': absoluteUrl('/#website'),
    name: SITE_NAME,
    url: SITE_URL,
    publisher: { '@id': ORGANIZATION_ID },
    potentialAction: {
      '@type': 'SearchAction',
      // EntryPoint form — the current schema.org/Google recommendation;
      // a bare string `target` is the legacy syntax.
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/shop?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

// Reviews used for individual `review` entries — up to 5, most recent / highest signal.
// Only `rating` is required (the aggregate computes from that); the rest are
// nice-to-have so callers that only have ratings can still pass through.
type ReviewForLd = Pick<ProductReview, 'rating'>
  & Partial<Pick<ProductReview, 'body' | 'author_name' | 'created_at'>>;

export function productLd(
  product: Product,
  reviews: ReviewForLd[] = [],
  variants: ProductVariant[] = [],
) {
  const ratingCount = reviews.length;
  const avg = ratingCount
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / ratingCount) * 10) / 10
    : null;

  // ── Offer construction ──
  // If there are variants with distinct prices, emit an AggregateOffer with
  // lowPrice / highPrice so the SERP can show "from £X". Otherwise emit a
  // single Offer pulled from the parent product. Either way, hand Google the
  // shippingDetails + hasMerchantReturnPolicy blocks it needs for the
  // free-shipping / return-policy badges in product results.
  const enabledVariants = variants.filter(v => v.enabled);
  const variantPrices = enabledVariants.map(v => v.price);
  const lowPrice = variantPrices.length ? Math.min(...variantPrices) : product.price;
  const highPrice = variantPrices.length ? Math.max(...variantPrices) : product.price;
  // Untracked products (inventory managed externally) are always available.
  const anyVariantInStock = product.track_inventory === false
    || enabledVariants.some(v => v.stock > 0) || product.stock > 0;

  // Shipping + return policies — these qualify the listing for richer
  // free-shipping / 30-day-returns annotations in Google Shopping.
  const shippingDetails = {
    '@type': 'OfferShippingDetails',
    shippingRate: {
      '@type': 'MonetaryAmount',
      value: 0,
      currency: 'GBP',
    },
    shippingDestination: {
      '@type': 'DefinedRegion',
      addressCountry: 'GB',
    },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
      transitTime:  { '@type': 'QuantitativeValue', minValue: 2, maxValue: 5, unitCode: 'DAY' },
    },
  };
  const returnPolicy = {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: 'GB',
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    // 14 days is the statutory minimum cancellation window under the UK
    // Consumer Contracts (Information, Cancellation and Additional Charges)
    // Regulations 2013 for distance sales. The previous 7 was non-compliant.
    merchantReturnDays: 14,
    returnMethod: 'https://schema.org/ReturnByMail',
    returnFees: 'https://schema.org/FreeReturn',
  };

  // Google increasingly wants priceValidUntil on Offer / AggregateOffer.
  // Use a 12-month forward window; the page itself revalidates often
  // enough that this stays roughly accurate.
  const priceValidUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const offers = variantPrices.length > 1 && lowPrice !== highPrice
    ? {
        '@type': 'AggregateOffer',
        url: absoluteUrl(`/product/${product.slug}`),
        priceCurrency: 'GBP',
        lowPrice,
        highPrice,
        offerCount: enabledVariants.length,
        priceValidUntil,
        availability: anyVariantInStock
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        seller: { '@type': 'Organization', name: SITE_NAME },
        shippingDetails,
        hasMerchantReturnPolicy: returnPolicy,
      }
    : {
        '@type': 'Offer',
        url: absoluteUrl(`/product/${product.slug}`),
        priceCurrency: 'GBP',
        price: product.price,
        priceValidUntil,
        availability: anyVariantInStock
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        seller: { '@type': 'Organization', name: SITE_NAME },
        shippingDetails,
        hasMerchantReturnPolicy: returnPolicy,
      };

  // Top reviews (up to 5) for the `review` array — Google uses these to
  // surface review snippets even when there's no aggregate yet.
  const topReviews = reviews
    .slice(0, 5)
    .map(r => ({
      '@type': 'Review',
      reviewRating: {
        '@type': 'Rating',
        ratingValue: r.rating,
        bestRating: 5,
        worstRating: 1,
      },
      author: { '@type': 'Person', name: r.author_name ?? 'Verified buyer' },
      reviewBody: r.body ?? undefined,
      datePublished: r.created_at ?? undefined,
    }));

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': absoluteUrl(`/product/${product.slug}#product`),
    name: `${brandPlusName(product.brand, product.name)}${product.variant ? ` ${product.variant}` : ''}`,
    description: product.description ?? undefined,
    image: product.image_url ?? undefined,
    sku: product.id,
    // Omit `brand` entirely when the product has none — emitting
    // `{ name: null }` is an invalid-markup error. Many imported products
    // (generic/local SKUs) legitimately have no brand.
    brand: product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
    category: product.category || undefined,
    offers,
    aggregateRating: avg
      ? {
          '@type': 'AggregateRating',
          ratingValue: avg,
          reviewCount: ratingCount,
          bestRating: 5,
          worstRating: 1,
        }
      : undefined,
    review: topReviews.length ? topReviews : undefined,
  };
}

export function articleLd(post: BlogPost) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    image: post.image_url ?? undefined,
    datePublished: post.date,
    // Use updated_at when the row has been edited; falls back to date so
    // Google has a meaningful "Last updated" signal instead of identical
    // dates either side. The DB column exists (used by the blog sitemap)
    // even though the type previously omitted it.
    dateModified: post.updated_at ?? post.date,
    author: { '@type': 'Organization', name: SITE_NAME },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      // Raster logo per Google's Article schema requirements.
      logo: { '@type': 'ImageObject', url: absoluteUrl('/icon-192.png'), width: 192, height: 192 },
    },
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/**
 * ItemList for collection / index pages. Google uses this to associate
 * the listed URLs with the parent page and surface site-link grids.
 * Pass a header name (e.g. "Bestsellers" / "Skincare products") + the
 * items in display order; each item maps to a Product schema only when
 * we have the brand/name/price tuple, otherwise we emit a lean
 * ListItem with `url` + `name`.
 */
export function itemListLd(
  name: string,
  items: Array<{ name: string; path: string }>,
) {
  // A summary-page ItemList: each entry is a ListItem pointing at its detail
  // page via `url`. We deliberately do NOT embed partial Product objects —
  // an incomplete Product (no offers/review/rating) is flagged as a markup
  // error by validators, and a blog post is not a Product at all. The full
  // Product schema lives on each PDP via `productLd`.
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: absoluteUrl(it.path),
      name: it.name,
    })),
  };
}

// FAQ schema — pass an array of plain Q/A pairs. Google will surface the
// matching pairs as expandable cards in the SERP for the source URL.
export function faqLd(items: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

// Lightweight CMS-page Article schema — for editorial /page/* content that
// isn't a blog post (about, returns policy, shipping policy, etc.). Optional
// `dateModified` if the CMS exposes it; falls back to `datePublished`.
export function pageArticleLd(input: {
  title: string;
  description: string;
  path: string;
  datePublished?: string;
  dateModified?: string;
  image?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.title,
    description: input.description,
    image: input.image ?? undefined,
    datePublished: input.datePublished ?? undefined,
    dateModified: input.dateModified ?? input.datePublished ?? undefined,
    author: { '@type': 'Organization', name: SITE_NAME },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: { '@type': 'ImageObject', url: absoluteUrl('/icon-192.png'), width: 192, height: 192 },
    },
    mainEntityOfPage: absoluteUrl(input.path),
  };
}
