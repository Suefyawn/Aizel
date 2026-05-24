'use client';
import { useActionState, useState } from 'react';
import Link from 'next/link';
import { createProduct, updateProduct } from '@/app/admin/actions';
import { ImageUpload } from './ImageUpload';
import { KeyBenefitsEditor, FaqEditor } from './ProductContentEditors';
import { TAXONS } from '@/lib/category-taxonomy';
import type { Product } from '@/types';

function toSlug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  border: '1px solid #d1d5db', borderRadius: 7,
  fontSize: '0.875rem', color: '#111827',
  background: 'white', outline: 'none', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.8125rem',
  fontWeight: 600, color: '#374151', marginBottom: 5,
};
const fieldWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column' };
const hint: React.CSSProperties = { marginTop: 4, fontSize: '0.6875rem', color: '#6b7280' };
const row2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 };
const row3: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 };

// One titled block of the form. Sections are separated by a hairline so a
// long product edit reads as grouped steps, not one undifferentiated wall.
function Section({ title, desc, first, children }: {
  title: string; desc?: string; first?: boolean; children: React.ReactNode;
}) {
  return (
    <section style={{
      marginBottom: 24, paddingTop: first ? 0 : 24,
      borderTop: first ? 'none' : '1px solid #f3f4f6',
    }}>
      <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#111827' }}>{title}</h2>
      <p style={{ margin: '2px 0 16px', fontSize: '0.75rem', color: '#6b7280' }}>
        {desc ?? ' '}
      </p>
      {children}
    </section>
  );
}

export function ProductForm({ product }: { product?: Product }) {
  const isEdit = Boolean(product);
  const boundAction = isEdit ? updateProduct.bind(null, product!.id) : createProduct;
  const [state, action, pending] = useActionState(boundAction, null);

  const [name, setName] = useState(product?.name ?? '');
  const [slug, setSlug] = useState(product?.slug ?? '');
  const [trackInv, setTrackInv] = useState(product?.track_inventory !== false);
  // Tracked so the live margin readout updates as the owner edits.
  const [price, setPrice] = useState<number>(product?.price ?? 0);
  // Unit cost (what Aizel paid for this product). Optional — when set,
  // the margin readout shows gross margin per unit + %.
  const [unitCost, setUnitCost] = useState(product?.vendor_cost != null ? String(product.vendor_cost) : '');

  const costNum = unitCost.trim() !== '' ? Number(unitCost) : null;
  const marginInfo: { cost: number; margin: number; pct: number } | null =
    costNum != null && Number.isFinite(costNum) && price > 0
      ? { cost: costNum, margin: price - costNum, pct: ((price - costNum) / price) * 100 }
      : null;

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <Link href="/admin/products" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem' }}>
          ← Products
        </Link>
        <span style={{ color: '#d1d5db' }}>/</span>
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>
          {isEdit ? 'Edit Product' : 'New Product'}
        </h1>
      </div>

      <div style={{ background: 'white', borderRadius: 10, padding: '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', maxWidth: 820 }}>
        {state?.error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, padding: '10px 14px', marginBottom: 20, color: '#dc2626', fontSize: '0.875rem' }}>
            {state.error}
          </div>
        )}

        <form action={action}>
          {/* ── Basics ─────────────────────────────────────────────────── */}
          <Section title="Basics" first>
            <div className="adm-form-2col" style={row2}>
              <div style={fieldWrap}>
                <label style={lbl}>Brand</label>
                <input name="brand" defaultValue={product?.brand ?? ''} style={inp} placeholder="e.g. CeraVe — blank for own-label" />
              </div>
              <div style={fieldWrap}>
                <label style={lbl}>Product Name *</label>
                <input
                  name="name" required
                  value={name}
                  onChange={e => { setName(e.target.value); if (!isEdit) setSlug(toSlug(e.target.value)); }}
                  style={inp} placeholder="e.g. Moisturizing Cream"
                />
              </div>
            </div>

            <div className="adm-form-2col" style={row2}>
              <div style={fieldWrap}>
                <label style={lbl}>Category *</label>
                <select name="category" required defaultValue={product?.category ?? ''} style={inp}>
                  <option value="" disabled>— Select —</option>
                  {TAXONS.map(t => (
                    <optgroup key={t.key} label={t.label}>
                      {t.categories.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div style={fieldWrap}>
                <label style={lbl}>Tag</label>
                <select name="tag" defaultValue={product?.tag ?? ''} style={inp}>
                  <option value="">— None —</option>
                  <option value="New">New</option>
                  <option value="Sale">Sale</option>
                  <option value="Bestseller">Bestseller</option>
                  <option value="Featured">Featured</option>
                  <option value="Limited">Limited</option>
                </select>
              </div>
            </div>

            <div style={{ ...row2, marginBottom: 0 }}>
              <div style={fieldWrap}>
                <label style={lbl}>Variant</label>
                <input name="variant" defaultValue={product?.variant ?? ''} style={inp} placeholder="e.g. 250ml" />
              </div>
              <div style={fieldWrap}>
                <label style={lbl}>Type</label>
                <select name="kind" defaultValue={product?.kind ?? 'simple'} style={inp}>
                  <option value="simple">Simple (single SKU)</option>
                  <option value="variable">Variable (with variants)</option>
                  <option value="bundle">Bundle / grouped</option>
                  <option value="external">External</option>
                </select>
                <span style={hint}>Variable products manage stock per variant.</span>
              </div>
            </div>
          </Section>

          {/* ── Pricing & stock ────────────────────────────────────────── */}
          <Section title="Pricing & stock">
            <div style={{ ...row3, marginBottom: 16 }}>
              <div style={fieldWrap}>
                <label style={lbl}>Price (GBP) *</label>
                {/* `step="0.01"` lets the operator type £14.99 / £24.99 etc.
                    Previous defaults (2400 / 3000) were PKR-scale. */}
                <input name="price" type="number" step="0.01" required min={0} defaultValue={product?.price} style={inp} placeholder="14.99"
                  onChange={e => setPrice(Number(e.target.value) || 0)} />
              </div>
              <div style={fieldWrap}>
                <label style={lbl}>Original Price (GBP)</label>
                <input name="original_price" type="number" step="0.01" min={0} defaultValue={product?.original_price ?? ''} style={inp} placeholder="19.99" />
                <span style={hint}>Set higher than price to show a strikethrough sale.</span>
              </div>
              <div style={fieldWrap}>
                <label style={lbl}>Stock Quantity{trackInv ? ' *' : ''}</label>
                {trackInv ? (
                  <input name="stock" type="number" required min={0} defaultValue={product?.stock ?? 0} style={inp} placeholder="0" />
                ) : (
                  <>
                    <input type="hidden" name="stock" value={product?.stock ?? 0} />
                    <div style={{ ...inp, color: '#6b7280', background: '#f9fafb', display: 'flex', alignItems: 'center' }}>
                      Managed externally
                    </div>
                  </>
                )}
              </div>
            </div>
            {/* Always submit track_inventory so an unchecked box reads as false. */}
            <input type="hidden" name="track_inventory" value={trackInv ? 'true' : 'false'} />
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb' }}>
              <input
                type="checkbox"
                checked={trackInv}
                onChange={e => setTrackInv(e.target.checked)}
                style={{ marginTop: 2, accentColor: '#4A1A6B' }}
              />
              <span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>Track stock for this product</span>
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>
                  On (default) — each sale decrements the count and Aizel won&apos;t oversell. Untick for products with no physical stock to count: services, made-to-order items, or anything pre-order / on-demand.
                </span>
              </span>
            </label>
          </Section>

          {/* ── Cost & margin ─────────────────────────────────────────────
              Optional cost-per-unit input so the owner sees gross margin
              alongside retail price. Posted under the legacy `vendor_cost`
              form field name so the existing server action + DB column
              continue to work without a migration. */}
          <Section title="Cost & margin" desc="Optional — what you paid for one unit. Shows the live gross margin against the retail price above.">
            <div className="adm-form-2col" style={row2}>
              <div style={fieldWrap}>
                <label style={lbl}>Unit cost (GBP)</label>
                <input
                  name="vendor_cost" type="number" min={0} step="0.01"
                  value={unitCost} onChange={e => setUnitCost(e.target.value)}
                  style={inp} placeholder="e.g. 4.20"
                />
                <span style={hint}>Used for margin reporting only — never shown to the customer.</span>
              </div>
              <div style={fieldWrap}>
                <label style={lbl}>Live margin</label>
                <div style={{
                  padding: '10px 12px', borderRadius: 7,
                  background: marginInfo ? '#f0fdf4' : '#f9fafb',
                  border: `1px solid ${marginInfo ? '#bbf7d0' : '#e5e7eb'}`,
                  fontSize: '0.875rem', minHeight: 38,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  {marginInfo ? (
                    <>
                      <strong style={{ color: '#16a34a', fontVariantNumeric: 'tabular-nums' }}>
                        £{marginInfo.margin.toFixed(2)}
                      </strong>
                      <span style={{ color: '#6b7280', fontSize: '0.8125rem' }}>
                        · {marginInfo.pct.toFixed(0)}% of price
                      </span>
                    </>
                  ) : (
                    <span style={{ color: '#9ca3af', fontSize: '0.8125rem' }}>
                      Set both retail price and unit cost to see the margin.
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Section>

          {/* ── Link / slug ────────────────────────────────────────────── */}
          <Section title="Page link" desc="The product's URL slug.">
            <div style={fieldWrap}>
              <input
                name="slug" required
                value={slug}
                onChange={e => setSlug(e.target.value)}
                style={{ ...inp, fontFamily: 'monospace', fontSize: '0.8125rem' }}
                placeholder="product-url-slug"
              />
              <span style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 4 }}>
                /product/{slug || 'product-slug'}
              </span>
            </div>
          </Section>

          {/* ── Image ──────────────────────────────────────────────────── */}
          <Section title="Product image">
            <ImageUpload name="image_url" currentUrl={product?.image_url} label="" aspect={1} />
          </Section>

          {/* ── Product-page content ───────────────────────────────────── */}
          <Section title="Product-page content" desc="Shown on the customer-facing product page. All optional.">
            <div style={{ ...fieldWrap, marginBottom: 16 }}>
              <label style={lbl}>Description</label>
              <textarea name="description" defaultValue={product?.description ?? ''} rows={3}
                style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }}
                placeholder="Short product description shown on the product page…" />
            </div>

            <div className="adm-form-2col" style={row2}>
              <div style={fieldWrap}>
                <label style={lbl}>How to Use</label>
                <textarea name="how_to_use" defaultValue={product?.how_to_use ?? ''} rows={4}
                  style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }}
                  placeholder="Application instructions…" />
              </div>
              <div style={fieldWrap}>
                <label style={lbl}>Ingredients</label>
                <textarea name="ingredients" defaultValue={product?.ingredients ?? ''} rows={4}
                  style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }}
                  placeholder="Aqua, Glycerin, Niacinamide…" />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Key benefits</label>
              <KeyBenefitsEditor name="key_benefits" initial={product?.key_benefits} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>FAQ</label>
              <FaqEditor name="faq" initial={product?.faq} />
            </div>

            <div style={{ ...row2, marginBottom: 0 }}>
              <div style={fieldWrap}>
                <label style={lbl}>Usage tips</label>
                <textarea name="usage_tips" defaultValue={product?.usage_tips ?? ''} rows={4}
                  style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }}
                  placeholder="Care tips, layering advice, or seasonal notes." />
              </div>
              <div style={fieldWrap}>
                <label style={lbl}>Social proof</label>
                <textarea name="social_proof" defaultValue={product?.social_proof ?? ''} rows={4} maxLength={500}
                  style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }}
                  placeholder={'e.g. "Featured in Vogue UK, July 2025."'} />
              </div>
            </div>
          </Section>

          {/* ── Search & social (SEO) ──────────────────────────────────── */}
          <Section title="Search & social" desc="Leave blank to fall back to auto-generated values.">
            <div className="adm-form-2col" style={row2}>
              <div style={fieldWrap}>
                <label style={lbl}>SEO title</label>
                <input name="seo_title" type="text" defaultValue={product?.seo_title ?? ''} maxLength={120}
                  placeholder='e.g. "CeraVe Hydrating Cleanser — Buy in the UK"' style={inp} />
                <span style={hint}>Auto-default: brand + name. ≤60 chars ideal.</span>
              </div>
              <div style={fieldWrap}>
                <label style={lbl}>OG image URL</label>
                <input name="og_image_url" type="url" defaultValue={product?.og_image_url ?? ''} maxLength={500}
                  placeholder="https://… (defaults to the product image)" style={inp} />
              </div>
            </div>
            <div style={fieldWrap}>
              <label style={lbl}>SEO description</label>
              <textarea name="seo_description" defaultValue={product?.seo_description ?? ''} rows={2} maxLength={220}
                style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }}
                placeholder="One-paragraph pitch with the keyword + UK delivery signal." />
              <span style={hint}>Auto-default: description / generic. ≤160 chars ideal.</span>
            </div>
          </Section>

          {/* Sticky save bar — pins to the bottom of the viewport while the
              admin scrolls long product edits. */}
          <div
            className="adm-sticky-actions"
            style={{
              position: 'sticky', bottom: 0,
              marginTop: 8,
              padding: '12px 16px',
              background: 'rgba(255,255,255,0.94)',
              backdropFilter: 'saturate(140%) blur(8px)',
              WebkitBackdropFilter: 'saturate(140%) blur(8px)',
              borderTop: '1px solid #e5e7eb',
              borderRadius: '0 0 10px 10px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, flexWrap: 'wrap',
              boxShadow: '0 -6px 18px rgba(0,0,0,0.04)',
              zIndex: 5,
            }}
          >
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              {pending
                ? 'Saving…'
                : isEdit
                  ? <>Editing <strong style={{ color: '#111827' }}>{product?.name ?? 'product'}</strong></>
                  : 'Creating a new product'}
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Link href="/admin/products" style={{
                padding: '9px 18px', background: 'white', color: '#374151',
                border: '1px solid #d1d5db', borderRadius: 7,
                fontSize: '0.8125rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
              }}>
                Cancel
              </Link>
              <button type="submit" disabled={pending} style={{
                padding: '10px 24px', background: pending ? '#9ca3af' : '#4A1A6B',
                color: 'white', border: 'none', borderRadius: 7,
                fontSize: '0.8125rem', fontWeight: 600, cursor: pending ? 'not-allowed' : 'pointer',
              }}>
                {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create product'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
