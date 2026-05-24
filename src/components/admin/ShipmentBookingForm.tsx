'use client';

import { useActionState, useState } from 'react';
import { bookShipment, createShipment, cancelShipment } from '@/app/admin/shipment-actions';
import { COURIER_LIST, courierTrackingUrl } from '@/lib/couriers';

interface Props {
  orderId: string;
  /** Couriers we have a configured API adapter for — server passes this in
   *  via the page so the UI can show "Book pickup" vs "Enter manually". */
  apiAdapters: string[];
  /** Existing shipment (if any) — render-cancellation + tracking link. */
  shipment?: {
    id: string;
    courier: string;
    tracking_number: string;
    status: string;
  } | null;
}

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid #d1d5db',
  borderRadius: 8, fontSize: '0.875rem', color: '#111827',
  outline: 'none', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.75rem', fontWeight: 600,
  color: '#374151', marginBottom: 4,
};

export function ShipmentBookingForm({ orderId, apiAdapters, shipment }: Props) {
  const [courier, setCourier] = useState<string>(apiAdapters[0] ?? 'TCS');
  const [mode, setMode] = useState<'auto' | 'manual'>(apiAdapters.length > 0 ? 'auto' : 'manual');
  const [bookState, bookAction, bookPending] = useActionState(bookShipment, null);
  const [manualState, manualAction, manualPending] = useActionState(createShipment, null);
  const [cancelState, cancelAction, cancelPending] = useActionState(cancelShipment, null);

  // ─── Already shipped — show tracking + cancel options ────────────────────
  if (shipment && shipment.status !== 'cancelled') {
    const trackUrl = courierTrackingUrl(shipment.courier, shipment.tracking_number);
    return (
      <div>
        <div style={{ marginBottom: 12 }}>
          <div style={lbl}>Booked with</div>
          <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
            {shipment.courier} · <span style={{ fontFamily: 'monospace' }}>{shipment.tracking_number}</span>
          </div>
          {trackUrl && (
            <a href={trackUrl} target="_blank" rel="noreferrer noopener"
               style={{ fontSize: '0.75rem', color: '#4A1A6B', textDecoration: 'underline' }}>
              Open on {shipment.courier} ↗
            </a>
          )}
        </div>
        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 8 }}>
          Status: <strong>{shipment.status}</strong>
        </div>
        <form action={cancelAction}>
          <input type="hidden" name="shipment_id" value={shipment.id} />
          <button
            type="submit"
            disabled={cancelPending}
            style={{
              padding: '8px 14px', background: 'transparent',
              border: '1px solid #fca5a5', borderRadius: 6, color: '#ef4444',
              fontSize: '0.75rem', fontWeight: 600, cursor: cancelPending ? 'not-allowed' : 'pointer',
            }}
          >
            {cancelPending ? 'Cancelling…' : 'Cancel shipment'}
          </button>
        </form>
        {cancelState?.error && (
          <div role="alert" style={{ marginTop: 8, padding: '6px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#dc2626', fontSize: '0.75rem' }}>
            {cancelState.error}
          </div>
        )}
        {cancelState?.success && (
          <div role="status" style={{ marginTop: 8, padding: '6px 10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, color: '#166534', fontSize: '0.75rem' }}>
            Shipment cancelled.
          </div>
        )}
      </div>
    );
  }

  // ─── Not yet shipped — picker + mode-switcher ────────────────────────────
  const hasApi = apiAdapters.includes(courier);
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <label htmlFor="courier-picker" style={lbl}>Courier</label>
        <select
          id="courier-picker"
          value={courier}
          onChange={e => {
            const next = e.target.value;
            setCourier(next);
            // When the user picks a non-API courier, force manual mode so they
            // don't click "Book" and see an error.
            if (!apiAdapters.includes(next)) setMode('manual');
          }}
          style={inp}
        >
          {COURIER_LIST.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}{apiAdapters.includes(c.id) ? ' (API)' : ''}
            </option>
          ))}
        </select>
        <p style={{ fontSize: '0.6875rem', color: '#6b7280', margin: '4px 0 0' }}>
          {apiAdapters.length > 0
            ? `API-backed: ${apiAdapters.join(', ')}. Others need a tracking number entered manually.`
            : 'No courier API is configured — pick a courier and enter the tracking number manually.'}
        </p>
      </div>

      {hasApi && (
        <div role="tablist" aria-label="Booking mode" style={{ display: 'flex', gap: 4, marginBottom: 12, padding: 2, background: '#f3f4f6', borderRadius: 6 }}>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'auto'}
            onClick={() => setMode('auto')}
            style={{
              flex: 1, padding: '6px 10px', border: 'none', cursor: 'pointer',
              borderRadius: 4, fontSize: '0.75rem', fontWeight: 600,
              background: mode === 'auto' ? 'white' : 'transparent',
              boxShadow: mode === 'auto' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              color: mode === 'auto' ? '#111827' : '#6b7280',
            }}
          >Book via {courier} API</button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'manual'}
            onClick={() => setMode('manual')}
            style={{
              flex: 1, padding: '6px 10px', border: 'none', cursor: 'pointer',
              borderRadius: 4, fontSize: '0.75rem', fontWeight: 600,
              background: mode === 'manual' ? 'white' : 'transparent',
              boxShadow: mode === 'manual' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              color: mode === 'manual' ? '#111827' : '#6b7280',
            }}
          >Manual / third-party</button>
        </div>
      )}

      {mode === 'auto' && hasApi ? (
        <form action={bookAction} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input type="hidden" name="order_id" value={orderId} />
          <input type="hidden" name="courier" value={courier} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label htmlFor="weight-kg" style={lbl}>Weight (kg, optional)</label>
              <input id="weight-kg" name="weight_kg" type="number" step="0.1" min="0.5" placeholder="auto" style={inp} />
            </div>
            <div>
              <label htmlFor="pieces" style={lbl}>Pieces</label>
              <input id="pieces" name="pieces" type="number" min="1" defaultValue="1" style={inp} />
            </div>
          </div>
          <button
            type="submit"
            disabled={bookPending}
            style={{
              padding: '10px 16px', background: bookPending ? '#f9a8d4' : '#4A1A6B',
              color: 'white', border: 'none', borderRadius: 6,
              fontSize: '0.875rem', fontWeight: 600,
              cursor: bookPending ? 'not-allowed' : 'pointer',
            }}
          >
            {bookPending ? `Booking with ${courier}…` : `Book pickup via ${courier}`}
          </button>
          {bookState?.error && (
            <div role="alert" style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#dc2626', fontSize: '0.75rem' }}>
              {bookState.error}
            </div>
          )}
          {bookState?.success && (
            <div role="status" style={{ padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, color: '#166534', fontSize: '0.75rem' }}>
              Booked. Tracking: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{bookState.trackingNumber}</span>
            </div>
          )}
        </form>
      ) : (
        <form action={manualAction} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input type="hidden" name="order_id" value={orderId} />
          <input type="hidden" name="courier" value={courier} />
          <div>
            <label htmlFor="tracking-number" style={lbl}>Tracking number *</label>
            <input
              id="tracking-number"
              name="tracking_number"
              required
              placeholder="e.g. 779412326902"
              style={{ ...inp, fontFamily: 'monospace' }}
            />
          </div>
          <div>
            <label htmlFor="weight-grams" style={lbl}>Weight (grams, optional)</label>
            <input id="weight-grams" name="weight_grams" type="number" min="1" placeholder="e.g. 500" style={inp} />
          </div>
          <button
            type="submit"
            disabled={manualPending}
            style={{
              padding: '10px 16px',
              background: manualPending ? '#9ca3af' : '#111827',
              color: 'white', border: 'none', borderRadius: 6,
              fontSize: '0.875rem', fontWeight: 600,
              cursor: manualPending ? 'not-allowed' : 'pointer',
            }}
          >
            {manualPending ? 'Saving…' : `Save ${courier} tracking number`}
          </button>
          {manualState?.error && (
            <div role="alert" style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#dc2626', fontSize: '0.75rem' }}>
              {manualState.error}
            </div>
          )}
          {manualState?.success && (
            <div role="status" style={{ padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, color: '#166534', fontSize: '0.75rem' }}>
              Tracking saved.
            </div>
          )}
        </form>
      )}
    </div>
  );
}
