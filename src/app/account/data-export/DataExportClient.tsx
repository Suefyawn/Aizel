'use client';

import { useState, useTransition } from 'react';
import { exportMyData } from './actions';

// Client wrapper for the self-serve export button. Calls the server
// action, builds a Blob from the JSON, and triggers a browser download
// — keeps the server stateless (no file storage, no per-user token).
export function DataExportClient() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const handleDownload = () => {
    setError(null);
    setCompleted(false);
    startTransition(async () => {
      const result = await exportMyData();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const json = JSON.stringify(result.data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // ISO-dated filename so a customer with multiple exports doesn't
      // overwrite the previous one — and so they can prove WHEN the
      // copy was generated if they later challenge the contents.
      const date = new Date().toISOString().slice(0, 10);
      a.download = `aizel-my-data-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setCompleted(true);
    });
  };

  return (
    <div aria-live="polite" aria-atomic="true">
      {error && (
        <div role="alert" style={{
          background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: 8, padding: '10px 14px', marginBottom: 16,
          color: '#dc2626', fontSize: '0.875rem',
        }}>
          {error}
        </div>
      )}
      {completed && (
        <div role="status" style={{
          background: '#f0fdf4', border: '1px solid #bbf7d0',
          borderRadius: 8, padding: '10px 14px', marginBottom: 16,
          color: '#16a34a', fontSize: '0.875rem',
        }}>
          ✓ Download started. Check your downloads folder for{' '}
          <code style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>aizel-my-data-…json</code>.
        </div>
      )}
      <button
        type="button"
        onClick={handleDownload}
        disabled={pending}
        className="btn-primary"
        style={{ fontSize: '0.875rem', minHeight: 44 }}
      >
        {pending ? 'Building your export…' : 'Download my data (JSON)'}
      </button>
    </div>
  );
}
