// ISR: cache the rendered PDP for 5 min; admin edits call revalidatePath('/product/...') to bust.
export const revalidate = 300;

// Known limitation: /product/<unknown-slug> returns HTTP 200 with the
// not-found.tsx body rendered, not a clean 404. This is a Next 16 quirk
// affecting ISR'd dynamic routes that call notFound() — see GitHub issue
// vercel/next.js#55561 and related. The body is correct (Google can soft-
// 404 from content), but the HTTP status is wrong. dynamicParams=false
// would fix it but blocks admin-added products until a redeploy — not
// acceptable for an active catalogue. Revisit when Next ships a proper
// fix or when a sitemap-driven 410 strategy is in place.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProductBySlug, supabase, isDemo, getProductsByBrand, getProductsByTaxon, getProducts } from '@/lib/supabase';
import { PDPPage } from '@/sections/pdp/PDPPage';
import { ReviewsSection } from '@/components/pdp/ReviewsSection';
import { RecentlyViewed } from '@/components/pdp/RecentlyViewed';
import { FrequentlyBoughtTogether } from '@/components/pdp/FrequentlyBoughtTogether';
import { MoreToExplore } from '@/components/pdp/MoreToExplore';
import { pageMeta, jsonLd, productLd, breadcrumbLd, faqLd } from '@/lib/seo';
import { isEnabled } from '@/lib/flags';
import { brandPlusName, stripBrandPrefix } from '@/lib/product-display';
import type { Product, ProductReview, ProductImage, ProductVariant, ProductAttribute, AttributeValue } from '@/types';

// Pre-render every published PDP at build time so first-paint LCP stays
// fast for organic-traffic landings. dynamicParams stays at its default
// (true) so a newly-added admin product still serves via ISR without
// blocking on a redeploy — the pattern Next 16 documents for an
// evolving catalogue.
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const products = await getProducts().catch(() => []);
  return products
    .filter(p => p.status !== 'archived' && p.status !== 'draft')
    .map(p => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};
  // Use the dedupe-aware composer so WP imports that already prefix the
  // brand inside `name` don't render "Kiko Milano Kiko Milano …" in titles.
  const displayName = brandPlusName(product.brand, product.name);
  const autoTitle = `${displayName}${product.variant ? ` — ${product.variant}` : ''}`;
  const autoDescription = product.short_description?.trim()
    ?? (product.description?.trim().slice(0, 160) || `Buy ${displayName} in the UK. £${product.price.toLocaleString()}. Free UK delivery over £15.`);
  // Migration 081: admin-controlled overrides win when set; otherwise fall
  // back to the auto-templated values so existing rows keep working.
  const title = product.seo_title?.trim() || autoTitle;
  const description = product.seo_description?.trim() || autoDescription;
  const image = product.og_image_url?.trim() || product.image_url || undefined;
  return pageMeta({
    title,
    description,
    path: `/product/${product.slug}`,
    image,
    type: 'product',
    keywords: [product.brand, stripBrandPrefix(product.brand, product.name), product.category, 'UK', 'Hair Care', 'Body Care']
      .filter((s): s is string => Boolean(s)),
  });
}

// Each variant carries the option ids that identify it (e.g. [shade=coral, size=250ml]).
export interface VariantWithOptions extends ProductVariant {
  option_value_ids: string[];
}

interface AttributeWithValues extends ProductAttribute {
  values: AttributeValue[];
}

async function loadVariantData(productId: string): Promise<{
  variants: VariantWithOptions[];
  attributes: AttributeWithValues[];
}> {
  if (isDemo) return { variants: [], attributes: [] };
  const { data: variantRows } = await supabase
    .from('product_variants')
    .select('id, product_id, sku, price, compare_at_price, stock, image_url, weight_grams, enabled, sort_order')
    .eq('product_id', productId)
    .eq('enabled', true)
    .order('sort_order');

  const variants = (variantRows ?? []) as ProductVariant[];
  if (variants.length === 0) return { variants: [], attributes: [] };

  const variantIds = variants.map(v => v.id);
  const { data: vavRows } = await supabase
    .from('variant_attribute_values')
    .select('variant_id, attribute_value_id')
    .in('variant_id', variantIds);

  const valueIds = Array.from(new Set((vavRows ?? []).map(r => r.attribute_value_id as string)));
  if (valueIds.length === 0) return { variants: variants.map(v => ({ ...v, option_value_ids: [] })), attributes: [] };

  const { data: valueRows } = await supabase
    .from('attribute_values')
    .select('id, attribute_id, slug, value, color_hex, image_url, sort_order')
    .in('id', valueIds)
    .order('sort_order');

  const values = (valueRows ?? []) as AttributeValue[];
  const attributeIds = Array.from(new Set(values.map(v => v.attribute_id)));

  const { data: attrRows } = await supabase
    .from('product_attributes')
    .select('id, slug, name, visible_on_pdp, usable_in_filter, sort_order')
    .in('id', attributeIds)
    .order('sort_order');

  const attributes: AttributeWithValues[] = ((attrRows ?? []) as ProductAttribute[]).map(a => ({
    ...a,
    values: values.filter(v => v.attribute_id === a.id),
  }));

  // Build variant.option_value_ids lookup.
  const byVariant = new Map<string, string[]>();
  for (const row of vavRows ?? []) {
    const list = byVariant.get(row.variant_id as string) ?? [];
    list.push(row.attribute_value_id as string);
    byVariant.set(row.variant_id as string, list);
  }
  const variantsWithOptions: VariantWithOptions[] = variants.map(v => ({
    ...v,
    option_value_ids: byVariant.get(v.id) ?? [],
  }));

  return { variants: variantsWithOptions, attributes };
}

async function loadGallery(productId: string): Promise<ProductImage[]> {
  if (isDemo) return [];
  const { data } = await supabase
    .from('product_images')
    .select('id, product_id, variant_id, url, alt, sort_order')
    .eq('product_id', productId)
    .order('sort_order');
  return (data ?? []) as ProductImage[];
}

async function loadFrequentlyBoughtTogether(productId: string): Promise<Product[]> {
  if (isDemo) return [];
  // RPC returns [{ product_id, co_count }] ordered desc.
  const { data, error } = await supabase.rpc('frequently_bought_with' as never, {
    p_product_id: productId,
    p_limit:      4,
  } as never);
  if (error) return [];
  const rows = (data ?? []) as Array<{ product_id: string; co_count: number }>;
  if (rows.length === 0) return [];
  const ids = rows.map(r => r.product_id);
  const { data: products } = await supabase.from('products').select('*').in('id', ids);
  const map = new Map(((products ?? []) as Product[]).map(p => [p.id, p]));
  // Preserve RPC order.
  return ids.map(id => map.get(id)).filter((p): p is Product => Boolean(p));
}

async function loadCrossSells(productId: string, fallbackCategory: string): Promise<Product[]> {
  if (isDemo) {
    // In demo, surface a few same-category products from stub data.
    const { DEMO_PRODUCTS } = await import('@/lib/demo-data');
    return DEMO_PRODUCTS.filter(p => p.id !== productId && p.category === fallbackCategory).slice(0, 4);
  }
  // Prefer explicit cross-sells / upsells from product_relations.
  const { data: rels } = await supabase
    .from('product_relations')
    .select('related_product_id, kind, sort_order')
    .eq('product_id', productId)
    .in('kind', ['cross_sell', 'upsell'])
    .order('sort_order')
    .limit(8);

  const relatedIds = Array.from(new Set((rels ?? []).map(r => r.related_product_id as string)));

  if (relatedIds.length > 0) {
    const { data } = await supabase.from('products').select('*').in('id', relatedIds);
    const map = new Map(((data ?? []) as Product[]).map(p => [p.id, p]));
    return relatedIds.map(id => map.get(id)).filter((p): p is Product => Boolean(p)).slice(0, 4);
  }

  // Fallback: same category.
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('category', fallbackCategory)
    .neq('id', productId)
    .limit(8);
  return ((data ?? []) as Product[]).sort(() => Math.random() - 0.5).slice(0, 4);
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [backInStockEnabled, reviewPhotosEnabled] = await Promise.all([
    isEnabled('back_in_stock'),
    isEnabled('reviews_photos'),
  ]);

  const [{ data: reviewRows }, variantData, gallery, crossSells, fbt, brandProducts, categoryProducts] = await Promise.all([
    isDemo
      ? Promise.resolve({ data: [] as Array<Pick<ProductReview, 'id' | 'author_name' | 'rating' | 'body' | 'created_at' | 'photo_urls' | 'verified_purchase' | 'helpful_count'>> })
      : supabase
          .from('product_reviews')
          .select('id, author_name, rating, body, created_at, photo_urls, verified_purchase, helpful_count')
          .eq('product_id', product.id)
          .eq('approved', true)
          .order('created_at', { ascending: false }),
    product.kind === 'variable' ? loadVariantData(product.id) : Promise.resolve({ variants: [], attributes: [] }),
    loadGallery(product.id),
    loadCrossSells(product.id, product.category),
    loadFrequentlyBoughtTogether(product.id),
    getProductsByBrand(product.brand, 12),
    getProductsByTaxon(product.category, 12),
  ]);

  const reviews = (reviewRows ?? []) as Pick<ProductReview, 'id' | 'author_name' | 'rating' | 'body' | 'created_at' | 'photo_urls' | 'verified_purchase' | 'helpful_count'>[];

  return (
    // minHeight: 100vh — guarantees the PDP block fills the viewport before
    // the gallery image decodes. Without it, on mobile between SSR delivery
    // and image-decode, the main column can be shorter than the screen and
    // the Footer (next in DOM) flashes above the fold. Pair with the same
    // min-height on loading.tsx so the skeleton swap is also shift-free.
    <main className="fade-in" style={{ minHeight: '100vh' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(productLd(product, reviews, variantData.variants)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(breadcrumbLd([
            { name: 'Home',           path: '/' },
            { name: 'Shop',           path: '/shop' },
            { name: product.category, path: `/shop?category=${encodeURIComponent(product.category)}` },
            { name: product.name,     path: `/product/${product.slug}` },
          ])),
        }}
      />
      {/* Migration 081: FAQPage schema for rich-result eligibility. Only
          emitted when admin has set a non-empty FAQ array. */}
      {Array.isArray(product.faq) && product.faq.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd(faqLd(product.faq.map(f => ({ question: f.q, answer: f.a })))),
          }}
        />
      )}
      <PDPPage
        product={product}
        relatedProducts={crossSells}
        variants={variantData.variants}
        attributes={variantData.attributes}
        gallery={gallery}
        backInStockEnabled={backInStockEnabled}
        subscribeEligible={false}
      />
      <FrequentlyBoughtTogether anchor={product} suggestions={fbt} />
      <MoreToExplore
        brand={product.brand}
        category={product.category}
        brandProducts={brandProducts}
        categoryProducts={categoryProducts}
        excludeIds={[product.id, ...crossSells.map(p => p.id), ...fbt.map(p => p.id)]}
      />
      <ReviewsSection productId={product.id} reviews={reviews} photosEnabled={reviewPhotosEnabled} />
      <RecentlyViewed currentProductId={product.id} />
    </main>
  );
}
