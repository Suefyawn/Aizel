'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Overline } from '@/components/ui/Overline';
import { ProductImage } from '@/components/ui/ProductImage';
import { ProductTile } from '@/components/ui/ProductTile';
import { StarRating } from '@/components/ui/StarRating';
import { useCart } from '@/context/CartContext';
import { BackInStockForm } from '@/components/pdp/BackInStockForm';
import { SubscribeAndSave } from '@/components/pdp/SubscribeAndSave';
import { KlarnaMessaging } from '@/components/pdp/KlarnaMessaging';
import { RecentlyViewedRail } from '@/components/product/RecentlyViewedRail';
import { useTrackView } from '@/lib/hooks/useRecentlyViewed';
import { track } from '@/lib/analytics';
import { stripBrandPrefix } from '@/lib/product-display';
import { whatsappUrl as waUrl, WA_TEMPLATES as WA_T } from '@/lib/whatsapp';
import { BenefitIcon } from '@/components/ui/BenefitIcon';
import type { Product, ProductImage as ProductImageT, ProductAttribute, AttributeValue, ProductVariant } from '@/types';

const SHIPPING_CONTENT = 'Free UK shipping on orders over £15. 14-day return policy on unopened items.';

interface AttributeWithValues extends ProductAttribute {
  values: AttributeValue[];
}

interface VariantWithOptions extends ProductVariant {
  option_value_ids: string[];
}

interface Props {
  product: Product;
  relatedProducts?: Product[];
  variants?: VariantWithOptions[];
  attributes?: AttributeWithValues[];
  gallery?: ProductImageT[];
  backInStockEnabled?: boolean;
  /** True for wellness consumables — enables the Subscribe & Save opt-in. */
  subscribeEligible?: boolean;
}

// ─── Variant picker ─────────────────────────────────────────────────────────
function VariantPicker({
  attributes, variants, selected, onChange,
}: {
  attributes: AttributeWithValues[];
  variants: VariantWithOptions[];
  selected: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  // Mark which attribute-values are still reachable given the current selection.
  function isReachable(attrId: string, valueId: string): boolean {
    const test = { ...selected, [attrId]: valueId };
    return variants.some(v =>
      Object.entries(test).every(([, vId]) => v.option_value_ids.includes(vId))
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
      {attributes.map(attr => {
        const selectedValueId = selected[attr.id];
        const selectedLabel = attr.values.find(v => v.id === selectedValueId)?.value;
        const hasColor = attr.values.some(v => v.color_hex);
        return (
          <div key={attr.id}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-900)' }}>{attr.name}</span>
              {selectedLabel && <span style={{ fontSize: '0.8125rem', color: 'var(--ink-500)' }}>{selectedLabel}</span>}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {attr.values.map(v => {
                const reachable = isReachable(attr.id, v.id);
                const active = selectedValueId === v.id;
                if (hasColor && v.color_hex) {
                  // Swatch button
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => onChange({ ...selected, [attr.id]: v.id })}
                      title={v.value}
                      disabled={!reachable && !active}
                      aria-label={v.value}
                      style={{
                        width: 34, height: 34, borderRadius: '50%',
                        border: active ? '2px solid var(--ink-900)' : '2px solid var(--line)',
                        outline: active ? '2px solid var(--paper)' : 'none',
                        outlineOffset: -4,
                        background: v.color_hex ?? '#eee',
                        cursor: reachable ? 'pointer' : 'not-allowed',
                        opacity: reachable || active ? 1 : 0.35,
                        padding: 0,
                      }}
                    />
                  );
                }
                // Pill button
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => onChange({ ...selected, [attr.id]: v.id })}
                    disabled={!reachable && !active}
                    style={{
                      padding: '8px 14px',
                      border: '1px solid ' + (active ? 'var(--ink-900)' : 'var(--line)'),
                      background: active ? 'var(--ink-900)' : 'var(--paper)',
                      color: active ? 'var(--paper)' : 'var(--ink-900)',
                      borderRadius: 'var(--radius-card)',
                      fontSize: '0.8125rem',
                      cursor: reachable ? 'pointer' : 'not-allowed',
                      opacity: reachable || active ? 1 : 0.35,
                      textDecoration: !reachable && !active ? 'line-through' : 'none',
                    }}
                  >
                    {v.value}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Multi-image gallery ───────────────────────────────────────────────────
// Hover-zoom wrapper. Tracks mouse position over the container, sets
// transform-origin to the cursor, and scales the inner image. Pointer-events
// only — touch users get the native pinch-zoom from the OS instead.
function ZoomableImage({ src, alt, label, fallback }: { src: string | null; alt: string; label?: string; fallback?: string | null }) {
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top)  / r.height) * 100;
    setOrigin({ x, y });
  };
  return (
    <div
      className="pdp-hero"
      style={{
        // Square (1/1) on every viewport. Product photography is shot
        // square, so a portrait box cropped the image with objectFit:cover
        // and made the bottle look zoomed-in on phones.
        flex: 1, aspectRatio: '1 / 1',
        borderRadius: 'var(--radius-card)', overflow: 'hidden',
        background: 'var(--paper2)',
        cursor: zoomed ? 'zoom-out' : 'zoom-in',
        position: 'relative',
      }}
      onPointerEnter={e => e.pointerType === 'mouse' && setZoomed(true)}
      onPointerLeave={() => setZoomed(false)}
      onMouseMove={onMove}
    >
      <div
        style={{
          width: '100%', height: '100%',
          transform: zoomed ? 'scale(1.8)' : 'scale(1)',
          transformOrigin: `${origin.x}% ${origin.y}%`,
          transition: 'transform 220ms ease-out',
          willChange: 'transform',
        }}
      >
        <ProductImage
          src={src ?? fallback}
          alt={alt}
          label={label}
          priority
          // PDP hero is the LCP: full column width on mobile (~100vw),
          // ~45vw on desktop (right column of a 2-col split). Without an
          // explicit sizes hint the default 320px clamp serves a blurry
          // upscale.
          sizes="(max-width: 900px) 100vw, 45vw"
        />
      </div>
    </div>
  );
}

function Gallery({
  images, alt, fallback, brandLabel,
}: {
  images: ProductImageT[];
  alt: string;
  fallback?: string | null;
  brandLabel?: string;
}) {
  const hero = images[0]?.url ?? fallback ?? null;
  const [active, setActive] = useState<string | null>(hero);

  if (images.length <= 1) {
    return <ZoomableImage src={active} alt={alt} label={brandLabel} fallback={fallback} />;
  }

  return (
    // Desktop: vertical thumbnail rail on the left + main image. Mobile (per
    // .pdp-gallery in globals.css): flip to column-reverse so the main image
    // gets the full width and the thumbnails sit underneath as a horizontal
    // strip — no more 64px sidebar stealing space on a phone.
    <div className="pdp-gallery" style={{ display: 'flex', gap: 12, flex: 1 }}>
      <div className="pdp-gallery-thumbs" style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 64, flexShrink: 0 }}>
        {images.map(img => (
          <button
            key={img.id}
            type="button"
            onClick={() => setActive(img.url)}
            aria-label={img.alt ?? alt}
            aria-current={active === img.url ? 'true' : undefined}
            className="pdp-gallery-thumb"
            style={{
              width: 64, height: 80, padding: 0,
              border: '1px solid ' + (active === img.url ? 'var(--ink-900)' : 'var(--line)'),
              borderRadius: 'var(--radius-card)', overflow: 'hidden',
              background: 'var(--paper2)', cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <ProductImage src={img.url} alt={img.alt ?? alt} label={brandLabel} width={80} height={80} />
          </button>
        ))}
      </div>
      <ZoomableImage src={active} alt={alt} label={brandLabel} fallback={fallback} />
    </div>
  );
}

// ─── PDPPage ───────────────────────────────────────────────────────────────
export function PDPPage({ product, relatedProducts = [], variants = [], attributes = [], gallery = [], backInStockEnabled = true, subscribeEligible = false }: Props) {
  const [qty, setQty] = useState(1);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [addedFlash, setAddedFlash] = useState(false);
  // Sticky mobile buy-bar: shown once the in-page buy panel scrolls out of
  // view so the Add-to-Cart action is always one tap away on a phone.
  const buyPanelRef = useRef<HTMLDivElement | null>(null);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const { addToCart } = useCart();

  // Track this PDP visit in the recently-viewed feed (localStorage). The
  // hook deduplicates by product id, so a refresh doesn't double-count.
  useTrackView(product);

  // Observe the in-page buy panel; surface the sticky bar only after it has
  // scrolled off the top of the viewport (not before the user reaches it).
  useEffect(() => {
    const el = buyPanelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setShowStickyBar(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // view_item analytics — fires once per product visit.
  useEffect(() => {
    track({
      name: 'view_item',
      payload: {
        product_id:   product.id,
        product_name: product.name,
        brand:        product.brand ?? undefined,
        category:     product.category,
        price:        product.price,
        currency:     'GBP',
      },
    });
  }, [product.id, product.name, product.brand, product.category, product.price]);

  // Pin every product page to the top. A client-side navigation from a
  // scrolled-down homepage / collection page (common on mobile) can hand the
  // PDP a stale scroll position, landing the viewport on the footer.
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.location.hash) {
      window.scrollTo(0, 0);
    }
  }, [product.id]);

  // Default-select the first reachable value for every attribute (or none).
  const [selected, setSelected] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    if (variants.length > 0 && attributes.length > 0) {
      // Try to pick a fully-defining first variant.
      const first = variants[0];
      for (const attr of attributes) {
        const match = attr.values.find(v => first.option_value_ids.includes(v.id));
        if (match) init[attr.id] = match.id;
      }
    }
    return init;
  });

  // Resolve the currently-matching variant (if all attributes have a selection).
  const activeVariant = useMemo(() => {
    if (variants.length === 0) return null;
    const need = attributes.length;
    const have = Object.values(selected).filter(Boolean).length;
    if (need > 0 && have < need) return null;
    return variants.find(v =>
      Object.values(selected).every(vId => v.option_value_ids.includes(vId))
    ) ?? null;
  }, [variants, attributes, selected]);

  const allAttrsSelected = attributes.length === 0 || attributes.every(a => Boolean(selected[a.id]));

  // Display values derive from the active variant when set, else from the product.
  const displayPrice          = activeVariant?.price ?? product.price;
  const displayOriginal       = activeVariant?.compare_at_price ?? product.original_price ?? null;
  const displayStock          = activeVariant?.stock ?? product.stock;
  const displayImageOverride  = activeVariant?.image_url ?? null;

  // Build gallery: if the variant has its own image, slot it in as the first thumbnail.
  const galleryToShow: ProductImageT[] = useMemo(() => {
    if (!displayImageOverride) return gallery;
    const synth: ProductImageT = {
      id: 'variant-image',
      product_id: product.id,
      variant_id: activeVariant?.id ?? null,
      url: displayImageOverride,
      alt: product.name,
      sort_order: -1,
    };
    return [synth, ...gallery.filter(g => g.url !== displayImageOverride)];
  }, [displayImageOverride, gallery, activeVariant, product]);

  const variantLabel = activeVariant && attributes.length
    ? attributes
        .map(a => {
          const valId = selected[a.id];
          const val = a.values.find(v => v.id === valId);
          return val ? `${a.name}: ${val.value}` : null;
        })
        .filter(Boolean)
        .join(' · ')
    : null;

  const handleAdd = () => {
    if (variants.length > 0 && !activeVariant) return;
    setAddedFlash(true);
    addToCart({
      ...product,
      qty,
      // Override line-item details from the variant when one is selected.
      price:      displayPrice,
      image_url:  displayImageOverride ?? product.image_url,
      variant_id: activeVariant?.id ?? null,
      variant_label: variantLabel,
    });
    setTimeout(() => setAddedFlash(false), 400);
  };

  // Untracked products (inventory managed externally) are always sellable —
  // their stock count is meaningless, so a 0 must not disable the buy button.
  const outOfStock = product.track_inventory !== false && displayStock === 0;
  const ctaDisabled = outOfStock || (variants.length > 0 && !activeVariant);

  // WP imports often include the brand inside the name (e.g. brand="Kiko Milano",
  // name="Kiko Milano 3D Hydra Lip Gloss"). Strip the brand prefix for the visible
  // h1 + breadcrumb crumb so we don't render "KIKO MILANO" twice in a row.
  const displayName = stripBrandPrefix(product.brand, product.name);

  // Middle breadcrumb crumb: prefer the brand (linked to its filtered
  // listing), fall back to the category. Products with neither get no
  // middle crumb at all — previously a no-brand product rendered an
  // empty "Home / / Name" segment.
  const midCrumb = product.brand
    ? { label: product.brand, href: `/shop?brand=${encodeURIComponent(product.brand)}` }
    : product.category
    ? { label: product.category, href: `/shop?category=${encodeURIComponent(product.category)}` }
    : null;

  return (
    <div>
      <div className="container" style={{ padding: '16px var(--side)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/" style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: '0.8125rem', color: 'var(--ink-500)', textDecoration: 'none' }}>Home</Link>
          <span style={{ color: 'var(--ink-500)', fontSize: '0.75rem' }}>/</span>
          {midCrumb && (
            <>
              <Link href={midCrumb.href} style={{ fontSize: '0.8125rem', color: 'var(--ink-500)', textDecoration: 'none' }}>{midCrumb.label}</Link>
              <span style={{ color: 'var(--ink-500)', fontSize: '0.75rem' }}>/</span>
            </>
          )}
          <span style={{ fontSize: '0.8125rem', color: 'var(--ink-900)' }}>{displayName}</span>
        </div>
      </div>

      <div className="container" style={{ borderTop: '1px solid var(--line)' }}>
        {/* minmax(0,1fr) lets each column shrink below its content's intrinsic
            width — without it a long product name forced the grid wider than
            the viewport. maxWidth caps the image column so the gallery isn't
            a ~700px monster on a wide desktop. */}
        {/* alignItems:start so the gallery cell sizes to the image and does
            NOT stretch to the row height — otherwise opening an accordion in
            the right column grows the row and the aspect-ratio image scales
            up/down with it. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 48, padding: '40px 0', maxWidth: 1080, margin: '0 auto', alignItems: 'start' }} className="pdp-grid">
          <Gallery images={galleryToShow} alt={`${product.brand ?? ''} ${displayName}`.trim()} fallback={product.image_url} brandLabel={product.brand ?? undefined} />

          <div style={{ minWidth: 0 }}>
            <Overline style={{ display: 'block', marginBottom: 8, color: 'var(--ink-500)' }}>{product.brand}</Overline>
            <h1 style={{
              fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 500,
              letterSpacing: '-0.025em', lineHeight: 1.1, marginBottom: 8,
              overflowWrap: 'break-word',
            }}>{displayName}</h1>
            {product.review_count != null && product.review_count > 0 && (
              <a
                href="#reviews"
                style={{ display: 'inline-flex', marginBottom: 12, textDecoration: 'none' }}
                aria-label={`${product.review_count} customer review${product.review_count === 1 ? '' : 's'} — read reviews`}
              >
                <StarRating rating={product.rating} count={product.review_count} size={15} />
              </a>
            )}
            {product.variant && variants.length === 0 && (
              <div className="body-text" style={{ color: 'var(--ink-500)', marginBottom: 16 }}>{product.variant}</div>
            )}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
              <span className="tabular-nums" style={{ fontSize: '1.5rem', fontWeight: 600 }}>£{displayPrice.toLocaleString()}</span>
              {(displayOriginal ?? 0) > displayPrice && (
                // Muted ink for the strikethrough — was purple (brand-pink-text)
                // which competed with the "you save" signal and confused the
                // colour role. Strikethroughs read clearer in a quiet grey.
                <span className="tabular-nums" style={{ textDecoration: 'line-through', color: 'var(--ink-500)', fontSize: '1rem' }}>
                  £{(displayOriginal ?? 0).toLocaleString()}
                </span>
              )}
            </div>
            {/* Klarna on-site messaging — gated entirely on
                NEXT_PUBLIC_KLARNA_CLIENT_ID; render-noop when the operator
                hasn't wired a real Klarna account. */}
            <KlarnaMessaging price={displayPrice} />
            <div style={{ marginBottom: 20 }}>
              {outOfStock ? (
                <span style={{ display: 'inline-block', padding: '3px 10px', background: '#fef2f2', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, color: '#dc2626' }}>Out of Stock</span>
              ) : product.track_inventory !== false && displayStock <= 5 ? (
                <span style={{ display: 'inline-block', padding: '3px 10px', background: '#fffbeb', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, color: '#d97706' }}>Only {displayStock} left</span>
              ) : (
                <span style={{ display: 'inline-block', padding: '3px 10px', background: '#f0fdf4', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, color: '#16a34a' }}>In Stock</span>
              )}
            </div>
            <hr className="hairline" style={{ marginBottom: 24 }} />

            {attributes.length > 0 && (
              <VariantPicker
                attributes={attributes}
                variants={variants}
                selected={selected}
                onChange={setSelected}
              />
            )}

            <div ref={buyPanelRef} style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)' }}>
                <button type="button" aria-label="Decrease quantity" onClick={() => setQty(Math.max(1, qty - 1))} style={{ width: 40, height: 44, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--ink-700)' }}>−</button>
                <span aria-live="polite" style={{ width: 32, textAlign: 'center', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{qty}</span>
                <button type="button" aria-label="Increase quantity" onClick={() => setQty(qty + 1)} style={{ width: 40, height: 44, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--ink-700)' }}>+</button>
              </div>
              <button onClick={handleAdd} disabled={ctaDisabled} className="btn-primary" style={{
                flex: 1,
                // Success-green flash on add (was gold — read as a YellowPink
                // signal on the most-clicked CTA on the site).
                background: ctaDisabled ? '#d1d5db' : addedFlash ? 'var(--success)' : 'var(--brand-pink)',
                transition: 'background 100ms ease-out',
                cursor: ctaDisabled ? 'not-allowed' : 'pointer',
              }}>
                {outOfStock ? 'Out of Stock'
                  : variants.length > 0 && !allAttrsSelected ? 'Select options'
                  : addedFlash ? 'Added ✓'
                  : 'Add to Cart'}
              </button>
            </div>

            {outOfStock && backInStockEnabled && (
              <div style={{ marginBottom: 24 }}>
                <BackInStockForm productId={product.id} variantId={activeVariant?.id ?? null} />
              </div>
            )}

            {subscribeEligible && (
              <div style={{ marginBottom: 24 }}>
                <SubscribeAndSave
                  productId={product.id}
                  variantId={activeVariant?.id ?? null}
                  productName={displayName}
                />
              </div>
            )}

            {/* WhatsApp CTA — pre-fills the merchant chat with this product's
                name so any "do you have shade X?" / "is this authentic?"
                question lands with full context. Hides if the env var
                isn't set. */}
            {(() => {
              const href = waUrl(WA_T.product(product.name));
              if (!href) return null;
              return (
                <div style={{ marginBottom: 24 }}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      background: 'transparent', color: '#128C7E',
                      textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600,
                      border: '1px solid #25D366', borderRadius: 999,
                      padding: '8px 16px',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Ask about this on WhatsApp
                  </a>
                </div>
              );
            })()}

            {/* Migration 081 — key benefits bar (admin-curated). High-leverage
                content block: scannable in 2 seconds, keyword-rich, and the
                emoji icons are pure design without hitting the bundle. */}
            {Array.isArray(product.key_benefits) && product.key_benefits.length > 0 && (
              <ul style={{
                listStyle: 'none', padding: 0, margin: '0 0 24px',
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10,
              }}>
                {product.key_benefits.map((b, i) => (
                  <li key={i} style={{
                    padding: '10px 14px', background: 'var(--paper2, #f5f5f5)', borderRadius: 8,
                    display: 'flex', alignItems: 'center', gap: 10,
                    fontSize: '0.8125rem', color: 'var(--ink-700)', lineHeight: 1.4,
                  }}>
                    {b.icon && (
                      <span aria-hidden="true" style={{
                        flex: '0 0 auto', display: 'inline-flex', alignItems: 'center',
                        color: 'var(--brand-pink-text, #4A1A6B)',
                      }}>
                        <BenefitIcon name={b.icon} size={18} />
                      </span>
                    )}
                    <span>{b.text}</span>
                  </li>
                ))}
              </ul>
            )}

            {product.description && (
              <p className="body-text" style={{ color: 'var(--ink-700)', marginBottom: 24, maxWidth: 440 }}>
                {product.description}
              </p>
            )}

            {/* Migration 081 — short testimonial / press quote, rendered as a
                paper2 callout so it reads as social signal rather than body
                copy. */}
            {product.social_proof && (
              <blockquote style={{
                margin: '0 0 24px', padding: '14px 18px',
                background: 'var(--paper2, #f5f5f5)', borderLeft: '3px solid var(--brand-pink, #4A1A6B)',
                borderRadius: 6,
                fontSize: '0.875rem', fontStyle: 'italic', color: 'var(--ink-700)', lineHeight: 1.5,
              }}>
                {product.social_proof}
              </blockquote>
            )}

            <hr className="hairline" style={{ marginBottom: 0 }} />
            {([
              product.how_to_use ? { key: 'use', title: 'How to Use', content: product.how_to_use } : null,
              product.ingredients ? { key: 'ingredients', title: 'Ingredients', content: product.ingredients } : null,
              product.usage_tips ? { key: 'tips', title: 'Usage Tips', content: product.usage_tips } : null,
              { key: 'shipping', title: 'Shipping & Returns', content: SHIPPING_CONTENT },
            ] as Array<{ key: string; title: string; content: string } | null>)
              .filter(Boolean)
              .map(sec => sec && (
              <div key={sec.key} style={{ borderBottom: '1px solid var(--line)' }}>
                <button
                  type="button"
                  aria-expanded={expandedSection === sec.key}
                  aria-controls={`pdp-section-${sec.key}`}
                  onClick={() => setExpandedSection(expandedSection === sec.key ? null : sec.key)}
                  style={{
                    width: '100%', padding: '16px 0', background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    fontFamily: 'var(--font-ui)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink-900)',
                  }}
                >
                  {sec.title}
                  <span aria-hidden="true" style={{ transform: expandedSection === sec.key ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 200ms ease-out', fontSize: '0.75rem' }}>▼</span>
                </button>
                {expandedSection === sec.key && (
                  <div id={`pdp-section-${sec.key}`} className="body-text" style={{ color: 'var(--ink-700)', paddingBottom: 16 }}>{sec.content}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <section
        style={{
          // Paper → pale purple wash (#F5EFF8). Was paper → cream (#FFF8E1)
          // which read as a YellowPink hangover on the PDP. The pale purple
          // anchors the section in the Aizel brand without dominating.
          background: 'linear-gradient(120deg, var(--paper2) 0%, var(--paper) 60%, #F5EFF8 100%)',
          padding: '64px 0',
          borderTop: '1px solid var(--line)',
          borderBottom: '1px solid var(--line)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative brand-tint blobs — replaces the missing editorial
            photo placeholder with something that always looks intentional. */}
        {/* Two purple blobs at different opacities — was a gold/purple pair
            but the gold tint pushed the section toward YellowPink. Pure
            purple keeps the decorative interest in the Aizel palette. */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', top: -80, left: -60,
            width: 220, height: 220, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(107, 44, 145,0.14), transparent 65%)',
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', bottom: -100, right: -80,
            width: 280, height: 280, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(107, 44, 145,0.20), transparent 65%)',
          }}
        />

        <div className="container" style={{ position: 'relative' }}>
          <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 40px' }}>
            <Overline style={{ display: 'block', marginBottom: 12, color: 'var(--ink-500)' }}>Why Aizel</Overline>
            <h2 className="display-l" style={{ fontSize: '2.25rem', margin: '0 0 12px', letterSpacing: '-0.02em' }}>
              Why this product earns a spot in your routine
            </h2>
            <p className="body-text" style={{ color: 'var(--ink-700)', margin: 0 }}>
              Every product is curated for Afro & textured hair, sourced from authorised UK distributors, and shipped Royal Mail Tracked across the UK.
            </p>
          </div>

          <div
            className="trust-grid"
            style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gutter)',
              maxWidth: 960, margin: '0 auto',
            }}
          >
            {[
              { icon: '✓', label: '100% authentic', sub: 'Direct from authorised UK distributors' },
              { icon: '◐', label: 'Built for textured hair', sub: 'Curated for type 3 & type 4 curls' },
              { icon: '◎', label: 'Royal Mail Tracked', sub: 'Free UK delivery over £15' },
              { icon: '↩', label: '14-day returns', sub: 'UK Consumer Contracts Regs · unopened items' },
            ].map(t => (
              <div
                key={t.label}
                style={{
                  background: 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(26,26,26,0.06)',
                  borderRadius: 'var(--radius-card)',
                  padding: '20px 18px',
                  backdropFilter: 'blur(6px)',
                  WebkitBackdropFilter: 'blur(6px)',
                  textAlign: 'left',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 36, height: 36, borderRadius: 8,
                    // Purple square in the Aizel brand colour — was gold and
                    // read as a YellowPink hangover at this size.
                    background: 'var(--brand-pink)', color: '#fff',
                    fontSize: '1.125rem', fontWeight: 700, marginBottom: 12,
                  }}
                >{t.icon}</span>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--ink-900)', marginBottom: 4 }}>
                  {t.label}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--ink-700)', lineHeight: 1.45 }}>
                  {t.sub}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Migration 081 — FAQ section. Renders below the gallery split so the
          accordion is the first thing the visitor sees after deciding to
          scroll past the buy-bar. FAQPage schema is emitted by the route
          (see app/product/[slug]/page.tsx) so the rich-result is paired
          with visible content. */}
      {Array.isArray(product.faq) && product.faq.length > 0 && (
        <section style={{ padding: '48px 0', borderTop: '1px solid var(--line)' }}>
          <div className="container" style={{ maxWidth: 760 }}>
            <Overline style={{ display: 'block', marginBottom: 16 }}>Frequently asked</Overline>
            <h2 className="display-l" style={{ fontSize: '1.75rem', marginBottom: 24 }}>Questions about this product</h2>
            <div style={{ borderTop: '1px solid var(--line)' }}>
              {product.faq.map((f, i) => (
                <details key={i} style={{ borderBottom: '1px solid var(--line)', padding: '14px 0' }}>
                  <summary style={{
                    cursor: 'pointer', listStyle: 'none',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16,
                    fontFamily: 'var(--font-ui)', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--ink-900)',
                  }}>
                    <span>{f.q}</span>
                    <span aria-hidden="true" style={{ flex: '0 0 auto', fontSize: '0.75rem', color: 'var(--ink-500, #6b7280)' }}>▼</span>
                  </summary>
                  <div className="body-text" style={{ marginTop: 10, color: 'var(--ink-700)', whiteSpace: 'pre-wrap' }}>
                    {f.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {relatedProducts.length > 0 && (
        <section style={{ padding: '64px 0' }}>
          <div className="container">
            <Overline style={{ display: 'block', marginBottom: 32 }}>Pairs With</Overline>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gutter)' }} className="product-grid">
              {relatedProducts.map((p) => (
                <ProductTile key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* localStorage-backed recently-viewed feed. Hides itself when the
          shopper has only ever viewed this one product (the hook applies
          the dedupe + the <2 items guard). */}
      <RecentlyViewedRail excludeId={product.id} />

      {/* Sticky mobile buy-bar — fixed to the bottom of the viewport once the
          in-page buy panel scrolls off the top. Mobile-only via the
          `pdp-sticky-bar` CSS class (display:none ≥768px). Reuses the same
          qty + handleAdd as the in-page panel so state stays in sync. */}
      <div
        className="pdp-sticky-bar"
        aria-hidden={!showStickyBar}
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 90,
          background: 'rgba(255, 255, 255,0.97)',
          backdropFilter: 'saturate(140%) blur(8px)',
          WebkitBackdropFilter: 'saturate(140%) blur(8px)',
          borderTop: '1px solid var(--line)',
          boxShadow: '0 -6px 18px rgba(0,0,0,0.06)',
          padding: '10px var(--side)',
          paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
          display: 'flex', alignItems: 'center', gap: 12,
          transform: showStickyBar ? 'translateY(0)' : 'translateY(110%)',
          transition: 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
          pointerEvents: showStickyBar ? 'auto' : 'none',
        }}
      >
        <div style={{ minWidth: 0, flex: '0 1 auto' }}>
          <div style={{
            fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-900)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{displayName}</div>
          <div className="tabular-nums" style={{ fontSize: '0.875rem', fontWeight: 700 }}>
            £{displayPrice.toLocaleString()}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', flexShrink: 0 }}>
          <button type="button" aria-label="Decrease quantity" onClick={() => setQty(Math.max(1, qty - 1))} style={{ width: 34, height: 40, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--ink-700)' }}>−</button>
          <span aria-live="polite" style={{ width: 26, textAlign: 'center', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{qty}</span>
          <button type="button" aria-label="Increase quantity" onClick={() => setQty(qty + 1)} style={{ width: 34, height: 40, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--ink-700)' }}>+</button>
        </div>
        <button
          onClick={handleAdd}
          disabled={ctaDisabled}
          className="btn-primary"
          style={{
            flex: 1, minWidth: 0, padding: '12px 16px',
            background: ctaDisabled ? '#d1d5db' : addedFlash ? 'var(--success)' : 'var(--brand-pink-cta)',
            cursor: ctaDisabled ? 'not-allowed' : 'pointer',
            transition: 'background 100ms ease-out',
          }}
        >
          {outOfStock ? 'Out of Stock'
            : variants.length > 0 && !allAttrsSelected ? 'Select options'
            : addedFlash ? 'Added ✓'
            : 'Add to Cart'}
        </button>
      </div>
    </div>
  );
}
