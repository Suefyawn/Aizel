'use client';

import { useState, useTransition } from 'react';
import { lookupPostcode, type AddressSuggestion } from '@/app/checkout/postcode-actions';

interface Props {
  /** Current postcode value (lives on the parent form). */
  value: string;
  onPostcodeChange: (next: string) => void;
  /** Fires when the operator picks an address — parent fills line1/city/etc. */
  onSelect: (address: AddressSuggestion['address']) => void;
  /** Style hooks so the lookup integrates with the parent's input system. */
  inputStyle: React.CSSProperties;
  inputId?: string;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
}

// UK postcode → address lookup. When LOQATE_API_KEY is configured on the
// server, the operator presses "Find address", picks from a dropdown, and
// the parent form fills line1 / line2 / city. When the key isn't set, the
// component renders a plain postcode input with no extra affordance — no
// fake matches, no misleading "Find address" button that errors.
//
// The probe (an initial empty-string lookup on focus) determines whether
// the feature is configured server-side without leaking the env to the
// client bundle.
export function PostcodeLookup({
  value, onPostcodeChange, onSelect, inputStyle, inputId = 'co-zip',
  ariaInvalid, ariaDescribedBy,
}: Props) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // Probe once on first focus — saves the round-trip on page load for
  // the visitors who don't get as far as the address section.
  function probeIfNeeded() {
    if (configured !== null) return;
    startTransition(async () => {
      const result = await lookupPostcode('SW1A 1AA'); // any-postcode probe
      setConfigured(result.configured);
    });
  }

  function runLookup() {
    if (!value.trim()) {
      setError('Enter your postcode first');
      return;
    }
    startTransition(async () => {
      const result = await lookupPostcode(value);
      setConfigured(result.configured);
      if (!result.ok) {
        setError(result.configured ? result.error : null);
        setSuggestions([]);
        setOpen(false);
        return;
      }
      setError(null);
      setSuggestions(result.suggestions);
      setOpen(true);
    });
  }

  function pick(s: AddressSuggestion) {
    onSelect(s.address);
    setOpen(false);
    setSuggestions([]);
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
        <input
          id={inputId}
          autoComplete="postal-code"
          // UK postcodes are alphanumeric (SW1A 1AA) — `text` keyboard, not
          // `numeric`. Uppercase autocapitalize matches what shoppers type.
          inputMode="text"
          autoCapitalize="characters"
          value={value}
          onChange={e => { onPostcodeChange(e.target.value); setError(null); }}
          onFocus={probeIfNeeded}
          onKeyDown={e => { if (e.key === 'Enter' && configured) { e.preventDefault(); runLookup(); } }}
          placeholder="SW1A 1AA"
          style={inputStyle}
          aria-invalid={ariaInvalid || !!error}
          aria-describedby={[ariaDescribedBy, error ? `${inputId}-lookup-error` : null].filter(Boolean).join(' ') || undefined}
        />
        {configured && (
          <button
            type="button"
            onClick={runLookup}
            disabled={pending}
            style={{
              padding: '0 14px', flexShrink: 0,
              border: '1px solid var(--ink-900)',
              background: pending ? 'var(--ink-500)' : 'var(--ink-900)',
              color: 'var(--paper)',
              borderRadius: 'var(--radius-card)',
              fontSize: '0.75rem', fontWeight: 600,
              cursor: pending ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {pending ? '…' : 'Find address'}
          </button>
        )}
      </div>
      {error && (
        <span id={`${inputId}-lookup-error`} style={{ fontSize: '0.75rem', color: 'var(--error)', display: 'block', marginTop: 4 }}>
          {error}
        </span>
      )}

      {/* Dropdown — anchored under the input. Click-outside dismiss + Escape
          are intentionally NOT wired here; the dropdown is short-lived
          (the operator picks an address or starts typing again), and any
          additional handlers would risk colliding with the form's own
          keyboard handling. */}
      {open && suggestions.length === 0 && configured && !pending && (
        <div style={dropdownStyle} role="status">
          <div style={{ padding: '10px 14px', color: 'var(--ink-500)', fontSize: '0.8125rem' }}>
            No addresses found for &ldquo;{value}&rdquo;. Try the full postcode.
          </div>
        </div>
      )}
      {open && suggestions.length > 0 && (
        <ul style={{ ...dropdownStyle, listStyle: 'none', padding: 0, margin: 0 }} role="listbox" aria-label="Address suggestions">
          {suggestions.map(s => (
            <li key={s.id}>
              <button
                type="button"
                role="option"
                aria-selected="false"
                onClick={() => pick(s)}
                style={{
                  width: '100%', textAlign: 'left',
                  padding: '10px 14px', background: 'transparent',
                  border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-ui)', fontSize: '0.8125rem',
                  color: 'var(--ink-900)',
                  borderBottom: '1px solid var(--line)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ fontWeight: 500 }}>{s.primary}</div>
                <div style={{ color: 'var(--ink-500)', fontSize: '0.75rem', marginTop: 2 }}>{s.secondary}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const dropdownStyle: React.CSSProperties = {
  position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
  background: 'var(--paper)', border: '1px solid var(--line)',
  borderRadius: 'var(--radius-card)', boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
  zIndex: 50, maxHeight: 280, overflowY: 'auto',
};
