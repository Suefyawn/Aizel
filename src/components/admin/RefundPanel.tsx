'use client';

import { useState, useTransition } from 'react';
import { useToast } from '@/components/admin/Toast';
import { refundOrder } from '@/app/admin/refund-actions';
import type { RefundSummary } from '@/app/admin/refund-actions';

interface Props {
  orderId: string;
  summary: RefundSummary;
  /** When `false` we render the panel in a clearly disabled state with an
   *  explanatory note — the operator can still see "Refunded £X.XX of
   *  £Y.YY" but can't fire the action. Permission gate. */
  canRefund: boolean;
  /** When `false`, Stripe isn't configured in this deployment — render
   *  a small notice rather than a usable form. */
  stripeConfigured: boolean;
}

// Stripe-standard reasons surfaced in the picker. We deliberately omit
// 'expired_uncaptured_charge' (it's automatic, not staff-initiated).
const REASONS = [
  { value: '',                       label: 'Reason (optional)' },
  { value: 'requested_by_customer',  label: 'Requested by customer' },
  { value: 'duplicate',              label: 'Duplicate order' },
  { value: 'fraudulent',             label: 'Fraudulent' },
] as const;

const moneyGBP = (n: number) =>
  `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function RefundPanel({ orderId, summary, canRefund, stripeConfigured }: Props) {
  // Default to refunding whatever's left — the operator usually wants a
  // full remainder refund and just clicks through; partial refunds are
  // entered manually.
  const [amount, setAmount] = useState<string>(summary.remaining.toFixed(2));
  const [reason, setReason] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const remaining = summary.remaining;
  const hasRefundedSome = summary.refunded > 0;
  const fullyRefunded = remaining <= 0 && summary.paid > 0;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    if (!isFinite(value) || value <= 0) {
      toast('Enter a positive refund amount.', 'error');
      return;
    }
    if (value - remaining > 0.005) {
      toast(`Maximum refundable is ${moneyGBP(remaining)}.`, 'error');
      return;
    }
    const confirmCopy = value >= remaining
      ? `Refund the full remaining ${moneyGBP(value)}? This is reversible only by re-charging the customer.`
      : `Refund ${moneyGBP(value)} now? You can refund the remaining ${moneyGBP(remaining - value)} later if needed.`;
    if (!window.confirm(confirmCopy)) return;

    startTransition(async () => {
      const result = await refundOrder({
        orderId,
        amount: value,
        reason: (reason || undefined) as Parameters<typeof refundOrder>[0]['reason'],
        note: note.trim() || undefined,
      });
      if (!result.ok) {
        toast(result.error ?? 'Refund failed', 'error');
        return;
      }
      toast(`Refunded ${moneyGBP(result.refunded ?? value)} via Stripe`, 'success');
      // The server action revalidates the page — no client-side state
      // reset needed; the new RefundSummary lands on the next paint.
    });
  };

  // ── Shell + header ────────────────────────────────────────────────────
  return (
    <div style={{
      background: 'white', borderRadius: 10,
      padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      marginBottom: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
          Refund
        </h2>
        <div style={{ display: 'flex', gap: 14, fontSize: '0.75rem', color: '#6b7280' }}>
          <span>
            Paid: <strong style={{ color: '#111827' }}>{moneyGBP(summary.paid)}</strong>
          </span>
          {hasRefundedSome && (
            <span>
              Refunded: <strong style={{ color: '#dc2626' }}>{moneyGBP(summary.refunded)}</strong>
            </span>
          )}
          <span>
            Remaining: <strong style={{ color: remaining > 0 ? '#16a34a' : '#9ca3af' }}>{moneyGBP(remaining)}</strong>
          </span>
        </div>
      </div>

      {/* Empty states first — keep the same chrome so the panel doesn't
          jump in/out of the layout depending on rail availability. */}
      {!stripeConfigured ? (
        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6b7280' }}>
          Stripe isn&apos;t configured in this environment, so refunds can&apos;t be issued from here.
          Configure <code style={{ fontFamily: 'monospace' }}>STRIPE_SECRET_KEY</code> +{' '}
          <code style={{ fontFamily: 'monospace' }}>STRIPE_WEBHOOK_SECRET</code> to enable.
        </p>
      ) : summary.gateway !== 'stripe' ? (
        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6b7280' }}>
          This order wasn&apos;t paid by card — refunds for bank transfers or COD are handled
          out-of-band and recorded via the order timeline.
        </p>
      ) : fullyRefunded ? (
        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6b7280' }}>
          Fully refunded ({moneyGBP(summary.refunded)}). Nothing left to return.
        </p>
      ) : !canRefund ? (
        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6b7280' }}>
          You don&apos;t have permission to issue refunds on this store.
        </p>
      ) : (
        // ── The actual form ───────────────────────────────────────────
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(120px,160px) minmax(200px,1fr) auto', alignItems: 'flex-end' }}>
          <div>
            <label htmlFor="refund-amount" style={lbl}>Amount (GBP)</label>
            <input
              id="refund-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              max={remaining}
              required
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={inp}
            />
            <div style={hint}>Up to {moneyGBP(remaining)}.</div>
          </div>
          <div>
            <label htmlFor="refund-reason" style={lbl}>Reason</label>
            <select
              id="refund-reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              style={inp}
            >
              {REASONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="refund-note" style={lbl}>Internal note (optional)</label>
            <input
              id="refund-note"
              type="text"
              maxLength={500}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Surfaces in the Stripe dashboard + the order timeline"
              style={inp}
            />
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={pending}
              style={{
                padding: '10px 22px',
                background: pending ? '#9ca3af' : '#dc2626',
                color: 'white', border: 'none', borderRadius: 7,
                fontSize: '0.875rem', fontWeight: 600,
                cursor: pending ? 'not-allowed' : 'pointer',
                minHeight: 40,
              }}
            >
              {pending ? 'Refunding…' : `Refund ${moneyGBP(Number(amount) || 0)} via Stripe`}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.75rem', fontWeight: 600,
  color: '#374151', marginBottom: 4,
};
const inp: React.CSSProperties = {
  width: '100%', padding: '8px 10px',
  border: '1px solid #d1d5db', borderRadius: 6,
  fontSize: '0.875rem', color: '#111827', background: 'white',
  outline: 'none', boxSizing: 'border-box',
};
const hint: React.CSSProperties = {
  fontSize: '0.6875rem', color: '#9ca3af', marginTop: 4,
};
