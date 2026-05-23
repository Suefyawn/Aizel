'use client';

import { useState } from 'react';
import type { BankAccount } from '@/types';

// Add/remove editor for the UK bank accounts customers transfer to for
// "Bank Transfer" orders. Keeps a hidden <input> holding the JSON the
// settings action stores under `pay_bank_accounts` — the owner never writes
// JSON by hand. Each row captures bank name, account title, sort code +
// account number (entered in the `number` field), and IBAN if available.

const inp: React.CSSProperties = {
  padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6,
  fontSize: '0.875rem', color: '#111827', background: 'white',
  outline: 'none', boxSizing: 'border-box', width: '100%',
};
const removeBtn: React.CSSProperties = {
  flexShrink: 0, width: 34, height: 34, borderRadius: 6,
  border: '1px solid #e5e7eb', background: 'white', color: '#9ca3af',
  cursor: 'pointer', fontSize: '0.875rem', lineHeight: 1, alignSelf: 'center',
};
const addBtn: React.CSSProperties = {
  padding: '7px 14px', borderRadius: 6, border: '1px dashed #d1d5db',
  background: '#f9fafb', color: '#374151', fontSize: '0.8125rem',
  fontWeight: 600, cursor: 'pointer',
};

const EMPTY: BankAccount = { label: '', title: '', number: '', iban: '' };

export function BankAccountsEditor({ name, initial }: { name: string; initial?: BankAccount[] | null }) {
  const [rows, setRows] = useState<BankAccount[]>(initial ?? []);

  // A row counts once it has at least a name and an account/mobile number.
  const clean = rows
    .map(r => ({
      label: r.label.trim(),
      title: r.title.trim(),
      number: r.number.trim(),
      iban: (r.iban ?? '').trim(),
    }))
    .filter(r => r.label && r.number);
  const serialised = clean.length ? JSON.stringify(clean) : '';

  const set = (i: number, patch: Partial<BankAccount>) =>
    setRows(r => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  return (
    <div>
      <input type="hidden" name={name} value={serialised} />
      {rows.length === 0 && (
        <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '0 0 8px' }}>
          No accounts yet — add a UK bank account below.
        </p>
      )}
      {rows.map((row, i) => (
        <div key={i} style={{
          display: 'flex', gap: 8, marginBottom: 8, padding: 10,
          border: '1px solid #f3f4f6', borderRadius: 8, background: '#fafafa',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, flex: 1, minWidth: 0 }}>
            <input
              aria-label="Bank or wallet name" value={row.label}
              onChange={e => set(i, { label: e.target.value })}
              placeholder="Bank name — e.g. Barclays, HSBC, Monzo" style={inp}
            />
            <input
              aria-label="Account title" value={row.title}
              onChange={e => set(i, { title: e.target.value })}
              placeholder="Account title — e.g. Aizel Ltd" style={inp}
            />
            <input
              aria-label="Account or mobile number" value={row.number}
              onChange={e => set(i, { number: e.target.value })}
              placeholder="Sort code · account number (e.g. 12-34-56 · 12345678)" style={inp}
            />
            <input
              aria-label="IBAN" value={row.iban ?? ''}
              onChange={e => set(i, { iban: e.target.value })}
              placeholder="IBAN (optional)" style={inp}
            />
          </div>
          <button
            type="button" aria-label="Remove account" style={removeBtn}
            onClick={() => setRows(r => r.filter((_, idx) => idx !== i))}
          >✕</button>
        </div>
      ))}
      <button type="button" onClick={() => setRows(r => [...r, { ...EMPTY }])} style={addBtn}>
        + Add account
      </button>
    </div>
  );
}
