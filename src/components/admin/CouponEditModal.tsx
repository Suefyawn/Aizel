'use client';

import { useState, useEffect, useActionState } from 'react';
import { updateCoupon } from '@/app/admin/coupon-actions';
import type { Coupon } from '@/types';

const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: 4,
};
const inp: React.CSSProperties = {
  width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7,
  fontSize: '0.875rem', color: '#111827', background: 'white', outline: 'none', boxSizing: 'border-box',
};

export function CouponEditModal({ coupon }: { coupon: Coupon }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(updateCoupon, null);

  // Close the modal once the server action reports a successful save.
  // setState-in-effect is intentional: the trigger is the action result.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (state?.ok) setOpen(false);
  }, [state]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          padding: '5px 12px', borderRadius: 6, border: '1px solid #e5e7eb',
          background: 'white', color: '#374151', fontSize: '0.75rem', fontWeight: 600,
          cursor: 'pointer', minHeight: 30,
        }}
      >
        Edit
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)',
            zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            padding: '8vh 16px', overflowY: 'auto',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Edit coupon ${coupon.code}`}
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: 12, padding: '24px',
              width: '100%', maxWidth: 440, boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
            }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
              Edit coupon
            </h3>
            <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input type="hidden" name="id" value={coupon.id} />
              <div>
                <label style={lbl}>Code</label>
                <input
                  name="code" required defaultValue={coupon.code}
                  style={{ ...inp, textTransform: 'uppercase', fontFamily: 'monospace' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>Type</label>
                  <select name="type" defaultValue={coupon.type} style={inp}>
                    <option value="percent">Percent %</option>
                    <option value="fixed">Fixed GBP</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Value</label>
                  <input name="value" type="number" required min={1} defaultValue={coupon.value} style={inp} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>Min order (GBP)</label>
                  <input name="min_order" type="number" min={0} defaultValue={coupon.min_order ?? 0} style={inp} />
                </div>
                <div>
                  <label style={lbl}>Max uses</label>
                  <input
                    name="max_uses" type="number" min={1}
                    defaultValue={coupon.max_uses ?? ''} placeholder="Unlimited" style={inp}
                  />
                </div>
              </div>
              <div>
                <label style={lbl}>Expires</label>
                <input
                  name="expires_at" type="date"
                  defaultValue={coupon.expires_at ? coupon.expires_at.slice(0, 10) : ''}
                  style={inp}
                />
              </div>

              {state?.error && (
                <p role="alert" style={{ margin: 0, fontSize: '0.8125rem', color: '#dc2626' }}>
                  {state.error}
                </p>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  style={{
                    padding: '8px 16px', borderRadius: 7, border: '1px solid #e5e7eb',
                    background: 'white', color: '#374151', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  style={{
                    padding: '8px 20px', borderRadius: 7, border: 'none',
                    background: pending ? '#9ca3af' : '#C5286A', color: 'white',
                    fontSize: '0.875rem', fontWeight: 600, cursor: pending ? 'not-allowed' : 'pointer',
                  }}
                >
                  {pending ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
