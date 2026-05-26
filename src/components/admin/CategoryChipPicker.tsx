'use client';

import { useState } from 'react';

// Multi-select chip picker for category slugs. Operator sees friendly
// labels arranged as toggleable pills; the form submits a comma-
// separated string of slugs via a hidden input under the picker's name.
//
// Designed for the admin Homepage page: each banner_card row optionally
// references one category (for image fallback); each category_row needs
// 3-6 slugs. The same picker handles both — caller specifies `max` to
// hint the cap and `intent` to render the right helper text.

interface Category {
  slug:  string;
  label: string;
  taxon_label: string;
}

interface Props {
  /** Hidden input name. The form action reads it as a comma-separated
   *  string and splits into an array. */
  name: string;
  /** All selectable categories — grouped under their parent taxon for
   *  readability. Operator scans by section. */
  categories: Category[];
  /** Currently-selected slugs (defaults from DB row on edit). */
  initial?: string[];
  /** Cap on selection. 1 for banner_card (single image source),
   *  typically 4-6 for category_row. */
  max?: number;
}

export function CategoryChipPicker({ name, categories, initial = [], max }: Props) {
  const [selected, setSelected] = useState<string[]>(initial);

  const toggle = (slug: string) => {
    setSelected(prev => {
      if (prev.includes(slug)) return prev.filter(s => s !== slug);
      if (max && prev.length >= max) return prev; // at cap — no-op
      return [...prev, slug];
    });
  };

  // Group by parent taxon for legibility.
  const grouped: Record<string, Category[]> = {};
  for (const c of categories) {
    (grouped[c.taxon_label] ??= []).push(c);
  }

  return (
    <div>
      <input type="hidden" name={name} value={selected.join(',')} />
      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 8 }}>
        {selected.length === 0
          ? 'Click categories below to add them.'
          : `${selected.length}${max ? ` of ${max}` : ''} selected — order matches click order.`}
      </div>

      {/* Selected order shown as numbered tags so the operator sees what
          will land on the storefront left-to-right. */}
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12, padding: 8, background: '#f9fafb', borderRadius: 6 }}>
          {selected.map((slug, i) => {
            const cat = categories.find(c => c.slug === slug);
            return (
              <span key={slug} style={selectedChip}>
                <span style={{ color: '#6b7280', fontWeight: 600 }}>{i + 1}.</span>
                {cat?.label ?? slug}
                <button type="button" onClick={() => toggle(slug)}
                  style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 0, fontSize: '0.9rem', lineHeight: 1 }}
                  aria-label={`Remove ${cat?.label ?? slug}`}>✕</button>
              </span>
            );
          })}
        </div>
      )}

      {Object.entries(grouped).map(([taxon, cats]) => (
        <div key={taxon} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6b7280', marginBottom: 6 }}>{taxon}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {cats.map(c => {
              const on = selected.includes(c.slug);
              const disabled = !on && max != null && selected.length >= max;
              return (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => toggle(c.slug)}
                  disabled={disabled}
                  style={{
                    ...chip,
                    background: on ? 'var(--brand-pink-cta, #6B2C91)' : disabled ? '#f3f4f6' : 'white',
                    color:      on ? 'white' : disabled ? '#9ca3af' : '#374151',
                    borderColor: on ? 'transparent' : '#d1d5db',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  {on && <span style={{ marginRight: 4 }}>✓</span>}
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

const chip: React.CSSProperties = {
  padding: '5px 11px',
  borderRadius: 999,
  border: '1px solid #d1d5db',
  fontSize: '0.8125rem',
  fontWeight: 500,
  transition: 'background 120ms, color 120ms',
};

const selectedChip: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 10px',
  borderRadius: 999,
  background: 'white',
  border: '1px solid #d1d5db',
  fontSize: '0.8125rem',
  fontWeight: 500,
  color: '#111827',
};
