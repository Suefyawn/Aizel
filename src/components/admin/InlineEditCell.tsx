'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useToast } from '@/components/admin/Toast';

// Click-to-edit table cell. Used in /admin/products for price and stock.
// Pattern lifted from Linear / Airtable — a static value swaps to an input
// on click, commits on Enter or blur, cancels on Escape. The optimistic
// state means the new value paints before the server confirms, so the
// table doesn't twitch when you tab to the next row.
//
// We intentionally keep this dumb about the column — the parent passes a
// `commit` callback that owns the typed server action call.

export type CommitResult = { ok: true } | { ok: false; error: string };

interface Props {
  /** Initial value as a number. Re-syncs if the parent re-renders with a
   *  fresh server value (after revalidatePath). */
  value: number;
  /** "price" → 2dp currency; "integer" → whole-number stock count. */
  kind: 'price' | 'integer';
  /** Optional pre-formatted display when not editing. Falls back to a
   *  default formatter for the given `kind`. */
  display?: React.ReactNode;
  /** Aria label for the input — usually "Price for {product name}". */
  label: string;
  /** Receives the parsed number; should call the server action and
   *  return { ok } / { ok: false, error }. */
  commit: (next: number) => Promise<CommitResult>;
  /** When true, render the value as plain read-only text without the
   *  hover affordance — used for products with stock tracking off. */
  readOnly?: boolean;
  /** Read-only tooltip / helper text. */
  readOnlyHint?: string;
}

const fmtGBP = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtInt = (n: number) => n.toLocaleString('en-GB');

export function InlineEditCell({ value, kind, display, label, commit, readOnly, readOnlyHint }: Props) {
  const [editing, setEditing] = useState(false);
  // `draft` is the text in the input while editing. It's seeded fresh on
  // every entry to edit mode below, so we don't sync it from `value` in
  // an effect (which React 19 rightly complains about).
  const [draft, setDraft] = useState('');
  // optimistic = the value we render while the server round-trip is in
  // flight. We revert if the action errors.
  const [optimistic, setOptimistic] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  if (readOnly) {
    return (
      <span title={readOnlyHint} style={{ color: '#9ca3af', fontStyle: 'italic' }}>
        {display ?? (kind === 'price' ? fmtGBP(value) : fmtInt(value))}
      </span>
    );
  }

  const rendered = optimistic ?? value;

  function attemptCommit() {
    const trimmed = draft.trim();
    if (trimmed === '') { setEditing(false); setDraft(String(value)); return; }
    const parsed = kind === 'price' ? Number(trimmed) : Math.round(Number(trimmed));
    if (!isFinite(parsed) || parsed < 0) {
      toast(`Invalid ${kind === 'price' ? 'price' : 'stock'}`, 'error');
      setDraft(String(value));
      setEditing(false);
      return;
    }
    // No-op? Just exit edit mode silently.
    if (parsed === value) { setEditing(false); return; }
    setEditing(false);
    setOptimistic(parsed);
    startTransition(async () => {
      const res = await commit(parsed);
      if (!res.ok) {
        toast(res.error || 'Update failed', 'error');
        setOptimistic(null);
        setDraft(String(value));
      } else {
        toast('Saved', 'success');
        // Hold the optimistic value until revalidatePath re-flows fresh
        // props — the effect above will then clear it.
        setOptimistic(null);
      }
    });
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        step={kind === 'price' ? '0.01' : '1'}
        min="0"
        inputMode={kind === 'price' ? 'decimal' : 'numeric'}
        value={draft}
        aria-label={label}
        onChange={e => setDraft(e.target.value)}
        onBlur={attemptCommit}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); attemptCommit(); }
          else if (e.key === 'Escape') { setDraft(String(value)); setEditing(false); }
        }}
        style={{
          width: kind === 'price' ? 90 : 70,
          padding: '5px 8px',
          border: '1px solid #4A1A6B',
          borderRadius: 5,
          fontSize: '0.875rem',
          fontWeight: 600,
          background: 'white',
          color: '#111827',
          outline: 'none',
          boxShadow: '0 0 0 3px rgba(74, 26, 107, 0.15)',
          fontVariantNumeric: 'tabular-nums',
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => { setDraft(String(rendered)); setEditing(true); }}
      title="Click to edit"
      style={{
        background: 'transparent',
        border: '1px dashed transparent',
        borderRadius: 5,
        padding: '4px 8px',
        margin: '-4px -8px',
        font: 'inherit',
        color: 'inherit',
        cursor: 'text',
        textAlign: 'left',
        opacity: pending ? 0.55 : 1,
        transition: 'background 120ms, border-color 120ms',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = '#F5EFF8';
        e.currentTarget.style.borderColor = '#d4c4e0';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.borderColor = 'transparent';
      }}
    >
      {display ?? (kind === 'price' ? fmtGBP(rendered) : fmtInt(rendered))}
    </button>
  );
}
