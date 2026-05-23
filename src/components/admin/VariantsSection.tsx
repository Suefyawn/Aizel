'use client';

import { useActionState, useState } from 'react';
import { createVariant, updateVariant, deleteVariant } from '@/app/admin/variant-actions';
import type { ProductAttribute, AttributeValue, ProductVariant } from '@/types';

interface AttributeWithValues extends ProductAttribute {
  values: AttributeValue[];
}

interface VariantWithOptions extends ProductVariant {
  option_value_ids: string[];
}

const inp: React.CSSProperties = {
  width: '100%', padding: '8px 10px',
  border: '1px solid #d1d5db', borderRadius: 6,
  fontSize: '0.8125rem', color: '#111827',
  background: 'white', outline: 'none', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 };

function describeOptions(v: VariantWithOptions, attrs: AttributeWithValues[]): string {
  return attrs
    .map(a => {
      const matchValueId = v.option_value_ids.find(id => a.values.some(av => av.id === id));
      const val = matchValueId ? a.values.find(av => av.id === matchValueId)?.value : null;
      return val ? `${a.name}: ${val}` : null;
    })
    .filter(Boolean)
    .join(' · ') || '(no options)';
}

// ─── Single variant row form (create + edit share this) ────────────────────
function VariantForm({
  productId, attributes, variant, onDone,
}: {
  productId: string;
  attributes: AttributeWithValues[];
  variant?: VariantWithOptions;
  onDone?: () => void;
}) {
  const action = variant ? updateVariant.bind(null, variant.id) : createVariant;
  const [state, formAction, pending] = useActionState(action, null);

  // When state.success flips, collapse this form (parent decides).
  if (state?.success && onDone) {
    setTimeout(onDone, 50);
  }

  return (
    <form action={formAction} style={{
      padding: 16, background: '#f9fafb', border: '1px solid #e5e7eb',
      borderRadius: 8, marginBottom: 12,
    }}>
      <input type="hidden" name="product_id" value={productId} />
      {state?.error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px', marginBottom: 12, color: '#dc2626', fontSize: '0.75rem' }}>
          {state.error}
        </div>
      )}

      {/* Attribute selectors */}
      {attributes.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(attributes.length, 3)}, 1fr)`, gap: 12, marginBottom: 12 }}>
          {attributes.map(a => {
            const current = variant?.option_value_ids.find(id => a.values.some(av => av.id === id)) ?? '';
            return (
              <div key={a.id}>
                <label style={lbl}>{a.name}</label>
                <select name={`option__${a.id}`} defaultValue={current} style={inp}>
                  <option value="">—</option>
                  {a.values.map(v => (
                    <option key={v.id} value={v.id}>{v.value}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      )}

      <div className="adm-form-4col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={lbl}>SKU</label>
          <input name="sku" defaultValue={variant?.sku ?? ''} style={inp} placeholder="SKU-001" />
        </div>
        <div>
          <label style={lbl}>Price (GBP) *</label>
          <input name="price" type="number" min={0} required defaultValue={variant?.price ?? ''} style={inp} placeholder="2400" />
        </div>
        <div>
          <label style={lbl}>Compare at</label>
          <input name="compare_at_price" type="number" min={0} defaultValue={variant?.compare_at_price ?? ''} style={inp} placeholder="3000" />
        </div>
        <div>
          <label style={lbl}>Stock *</label>
          <input name="stock" type="number" min={0} required defaultValue={variant?.stock ?? 0} style={inp} placeholder="0" />
        </div>
      </div>

      <div className="adm-form-3col" style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={lbl}>Image URL</label>
          <input name="image_url" defaultValue={variant?.image_url ?? ''} style={inp} placeholder="https://…" />
        </div>
        <div>
          <label style={lbl}>Sort order</label>
          <input name="sort_order" type="number" min={0} defaultValue={variant?.sort_order ?? 0} style={inp} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', paddingTop: 18 }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', cursor: 'pointer' }}>
            <input name="enabled" type="checkbox" defaultChecked={variant?.enabled ?? true} value="true" />
            Enabled
          </label>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button type="submit" disabled={pending} style={{
          padding: '8px 16px', background: pending ? '#9ca3af' : '#C5286A',
          color: 'white', border: 'none', borderRadius: 6,
          fontSize: '0.8125rem', fontWeight: 600, cursor: pending ? 'not-allowed' : 'pointer',
        }}>
          {pending ? 'Saving…' : variant ? 'Save changes' : 'Create variant'}
        </button>
        {state?.success && <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>✓ Saved</span>}
        {onDone && (
          <button type="button" onClick={onDone} style={{
            padding: '8px 12px', background: 'transparent', color: '#6b7280',
            border: '1px solid #d1d5db', borderRadius: 6,
            fontSize: '0.8125rem', cursor: 'pointer',
          }}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

// ─── Main section ──────────────────────────────────────────────────────────
export function VariantsSection({
  productId, productKind, attributes, variants,
}: {
  productId: string;
  productKind: string;
  attributes: AttributeWithValues[];
  variants: VariantWithOptions[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  if (productKind !== 'variable') {
    return (
      <div style={{ padding: '24px 28px', marginTop: 24, background: 'white', borderRadius: 10, border: '1px solid #e5e7eb' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Variants</h2>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6b7280' }}>
          Change the product type to <strong>Variable</strong> above and save to start adding variants.
        </p>
      </div>
    );
  }

  if (attributes.length === 0) {
    return (
      <div style={{ padding: '24px 28px', marginTop: 24, background: 'white', borderRadius: 10, border: '1px solid #e5e7eb' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Variants</h2>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6b7280', marginBottom: 8 }}>
          No global attributes exist yet. Add them via the WooCommerce importer or directly via SQL in <code>product_attributes</code> + <code>attribute_values</code>.
        </p>
        <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af' }}>
          A dedicated attributes admin UI is on the roadmap.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 28px', marginTop: 24, background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
          Variants ({variants.length})
        </h2>
        {!adding && (
          <button onClick={() => setAdding(true)} style={{
            padding: '8px 14px', background: '#C5286A', color: 'white',
            border: 'none', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
          }}>+ Add variant</button>
        )}
      </div>

      {adding && (
        <VariantForm
          productId={productId}
          attributes={attributes}
          onDone={() => setAdding(false)}
        />
      )}

      {variants.length === 0 && !adding && (
        <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.8125rem' }}>
          No variants yet. Click <strong>+ Add variant</strong> to create one.
        </div>
      )}

      {variants.map(v => (
        <div key={v.id}>
          {editingId === v.id ? (
            <VariantForm
              productId={productId}
              attributes={attributes}
              variant={v}
              onDone={() => setEditingId(null)}
            />
          ) : (
            <div
              className="adm-variant-row"
              style={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto auto',
                alignItems: 'center', gap: 12,
                padding: '12px 14px', border: '1px solid #e5e7eb',
                borderRadius: 8, marginBottom: 8,
                opacity: v.enabled ? 1 : 0.55,
              }}
            >
              <div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{describeOptions(v, attributes)}</div>
                {v.sku && <div style={{ fontSize: '0.6875rem', color: '#9ca3af', fontFamily: 'monospace' }}>{v.sku}</div>}
              </div>
              <div style={{ fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums' }}>
                £{v.price.toLocaleString()}
                {(v.compare_at_price ?? 0) > v.price && (
                  <span style={{ marginLeft: 6, color: '#9ca3af', textDecoration: 'line-through', fontSize: '0.6875rem' }}>
                    {(v.compare_at_price ?? 0).toLocaleString()}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.8125rem' }}>
                Stock: <strong>{v.stock}</strong>
              </div>
              <div style={{ fontSize: '0.6875rem', color: v.enabled ? '#16a34a' : '#9ca3af' }}>
                {v.enabled ? '● enabled' : '○ disabled'}
              </div>
              <button onClick={() => setEditingId(v.id)} style={{
                padding: '6px 12px', background: 'transparent', color: '#374151',
                border: '1px solid #d1d5db', borderRadius: 6,
                fontSize: '0.75rem', cursor: 'pointer',
              }}>
                Edit
              </button>
              <form action={deleteVariant}>
                <input type="hidden" name="id" value={v.id} />
                <input type="hidden" name="product_id" value={productId} />
                <button type="submit" style={{
                  padding: '6px 10px', background: 'transparent', color: '#dc2626',
                  border: '1px solid #fecaca', borderRadius: 6,
                  fontSize: '0.75rem', cursor: 'pointer',
                }}>
                  Delete
                </button>
              </form>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
