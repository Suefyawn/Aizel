'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { importProductsFromCsv, type ImportResult } from './actions';

export function ImportProductsClient() {
  const [csv, setCsv] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setCsv(typeof reader.result === 'string' ? reader.result : '');
    reader.readAsText(file);
  }

  function runImport() {
    if (!csv.trim()) return;
    startTransition(async () => {
      const r = await importProductsFromCsv(csv);
      setResult(r);
    });
  }

  // Preview the first 5 parsed rows (best-effort, client-side).
  const previewLines = csv.split('\n').slice(0, 6);

  return (
    <div style={{ padding: '32px 36px', maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link href="/admin/products" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem' }}>← Products</Link>
        <span style={{ color: '#d1d5db' }}>/</span>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Import products from CSV</h1>
      </div>

      <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', padding: 24, marginBottom: 24 }}>
        <p style={{ margin: '0 0 12px', fontSize: '0.875rem', color: '#374151' }}>
          Upload a WooCommerce or generic CSV. Headers we recognise: <code>brand</code>, <code>name</code>, <code>slug</code>,
          <code>category</code>, <code>subcategory</code>, <code>price</code>, <code>original_price</code>,
          <code>stock</code>, <code>image_url</code> / <code>Images</code>, <code>description</code>,
          <code>short_description</code>, <code>tag</code>, <code>how_to_use</code>, <code>ingredients</code>, <code>kind</code>.
          Rows are upserted by <code>slug</code>.
        </p>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <label style={{
            display: 'inline-flex', alignItems: 'center', padding: '8px 14px',
            background: '#111827', color: 'white', borderRadius: 6,
            fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
          }}>
            Choose .csv file
            <input
              type="file" accept=".csv,text/csv"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              style={{ display: 'none' }}
            />
          </label>
          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>or paste below</span>
          {csv && <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{csv.split('\n').length - 1} rows loaded</span>}
        </div>

        <textarea
          value={csv}
          onChange={e => setCsv(e.target.value)}
          placeholder="brand,name,slug,category,price,stock,image_url&#10;CeraVe,Moisturising Cream,cerave-cream,Skincare,2400,50,https://…"
          rows={10}
          style={{
            width: '100%', padding: '10px 12px',
            border: '1px solid #d1d5db', borderRadius: 6,
            fontFamily: 'monospace', fontSize: '0.75rem',
            outline: 'none', boxSizing: 'border-box', resize: 'vertical',
          }}
        />

        {previewLines.length > 1 && (
          <div style={{ marginTop: 16, padding: 12, background: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb', fontFamily: 'monospace', fontSize: '0.6875rem', color: '#374151', maxHeight: 180, overflow: 'auto' }}>
            <div style={{ fontWeight: 700, color: '#111827', marginBottom: 6 }}>Preview (first 5 rows)</div>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{previewLines.join('\n')}</pre>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 20 }}>
          <button
            onClick={runImport}
            disabled={!csv.trim() || pending}
            style={{
              padding: '10px 20px', background: pending ? '#9ca3af' : '#4A1A6B',
              color: 'white', border: 'none', borderRadius: 8,
              fontSize: '0.875rem', fontWeight: 600,
              cursor: pending || !csv.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {pending ? 'Importing…' : 'Import'}
          </button>
          <button
            onClick={() => { setCsv(''); setResult(null); }}
            style={{
              padding: '10px 16px', background: 'transparent',
              color: '#6b7280', border: '1px solid #d1d5db', borderRadius: 8,
              fontSize: '0.875rem', cursor: 'pointer',
            }}
          >
            Clear
          </button>
        </div>
      </div>

      {result && (
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', padding: 24 }}>
          <h2 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Import result</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <Stat label="Parsed"    value={result.parsed}   color="#374151" />
            <Stat label="Imported"  value={result.imported} color="#16a34a" />
            <Stat label="Skipped"   value={result.skipped}  color="#d97706" />
          </div>
          {result.errors.length > 0 && (
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>
                Errors ({result.errors.length})
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.75rem', color: '#374151' }}>
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ padding: 14, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
      <div style={{ fontSize: '0.6875rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}
