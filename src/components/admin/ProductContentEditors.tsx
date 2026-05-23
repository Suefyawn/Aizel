'use client';

import { useState } from 'react';
import type { ProductKeyBenefit, ProductFaqItem } from '@/types';

// Friendly add/remove row editors for the product's Key benefits and FAQ.
// Each keeps a hidden <input> holding the JSON the server action already
// expects — so the owner never hand-writes JSON, but the schema is unchanged.

const BENEFIT_ICONS = [
  'shield', 'leaf', 'sparkle', 'droplet', 'pulse', 'flower', 'bottle',
  'heart', 'bolt', 'sun', 'moon', 'dna', 'flame',
];

const inp: React.CSSProperties = {
  padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6,
  fontSize: '0.875rem', color: '#111827', background: 'white',
  outline: 'none', boxSizing: 'border-box',
};
const removeBtn: React.CSSProperties = {
  flexShrink: 0, width: 34, height: 34, borderRadius: 6,
  border: '1px solid #e5e7eb', background: 'white', color: '#9ca3af',
  cursor: 'pointer', fontSize: '0.875rem', lineHeight: 1,
};
const addBtn: React.CSSProperties = {
  padding: '7px 14px', borderRadius: 6, border: '1px dashed #d1d5db',
  background: '#f9fafb', color: '#374151', fontSize: '0.8125rem',
  fontWeight: 600, cursor: 'pointer',
};
const emptyNote: React.CSSProperties = { fontSize: '0.75rem', color: '#9ca3af', margin: '0 0 8px' };

export function KeyBenefitsEditor({ name, initial }: { name: string; initial?: ProductKeyBenefit[] | null }) {
  const [rows, setRows] = useState<ProductKeyBenefit[]>(initial ?? []);
  const clean = rows.filter(r => r.text.trim());
  const serialised = clean.length ? JSON.stringify(clean) : '';

  return (
    <div>
      <input type="hidden" name={name} value={serialised} />
      {rows.length === 0 && <p style={emptyNote}>No benefits yet — these show as the badge bar at the top of the product page.</p>}
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <select
            aria-label="Benefit icon"
            value={row.icon ?? BENEFIT_ICONS[0]}
            onChange={e => setRows(r => r.map((x, idx) => idx === i ? { ...x, icon: e.target.value } : x))}
            style={{ ...inp, width: 120, flexShrink: 0 }}
          >
            {BENEFIT_ICONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
          </select>
          <input
            aria-label="Benefit text"
            value={row.text}
            onChange={e => setRows(r => r.map((x, idx) => idx === i ? { ...x, text: e.target.value } : x))}
            placeholder="e.g. Brightens dull skin in 7 days"
            style={{ ...inp, flex: 1, minWidth: 0 }}
          />
          <button type="button" aria-label="Remove benefit" onClick={() => setRows(r => r.filter((_, idx) => idx !== i))} style={removeBtn}>✕</button>
        </div>
      ))}
      <button type="button" onClick={() => setRows(r => [...r, { icon: BENEFIT_ICONS[0], text: '' }])} style={addBtn}>
        + Add benefit
      </button>
    </div>
  );
}

export function FaqEditor({ name, initial }: { name: string; initial?: ProductFaqItem[] | null }) {
  const [rows, setRows] = useState<ProductFaqItem[]>(initial ?? []);
  const clean = rows.filter(r => r.q.trim() && r.a.trim());
  const serialised = clean.length ? JSON.stringify(clean) : '';

  return (
    <div>
      <input type="hidden" name={name} value={serialised} />
      {rows.length === 0 && <p style={emptyNote}>No questions yet — these power the FAQ section on the product page.</p>}
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input
              aria-label="Question"
              value={row.q}
              onChange={e => setRows(r => r.map((x, idx) => idx === i ? { ...x, q: e.target.value } : x))}
              placeholder="Question — e.g. Is it suitable for oily skin?"
              style={{ ...inp, width: '100%' }}
            />
            <textarea
              aria-label="Answer"
              value={row.a}
              onChange={e => setRows(r => r.map((x, idx) => idx === i ? { ...x, a: e.target.value } : x))}
              placeholder="Answer"
              rows={2}
              style={{ ...inp, width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>
          <button type="button" aria-label="Remove question" onClick={() => setRows(r => r.filter((_, idx) => idx !== i))} style={removeBtn}>✕</button>
        </div>
      ))}
      <button type="button" onClick={() => setRows(r => [...r, { q: '', a: '' }])} style={addBtn}>
        + Add question
      </button>
    </div>
  );
}
