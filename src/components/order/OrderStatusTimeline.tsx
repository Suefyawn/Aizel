'use client';

import { ORDER_STATUS_LABELS, ORDER_TIMELINE_STEPS } from '@/types';
import type { OrderStatus } from '@/types';

// Shared horizontal status timeline used on /track and /account/orders.
// One step per forward state (pending → processing → shipped → delivered),
// brand-coloured dots + connector line, and an optional per-step timestamp.
//
// Compact mode shrinks the dots + labels for the embedded /account/orders
// expandable row; the default size is for the standalone /track surface.

const ICONS: Record<OrderStatus, string> = {
  payment_pending: '⏱',
  payment_failed:  '✕',
  pending:         '◯',
  processing:      '✦',
  shipped:         '✈',
  delivered:       '✓',
  cancelled:       '✕',
  returned:        '↩',
  refunded:        '↩',
};

const fmtShort = (iso: string) =>
  new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });

export interface OrderStatusTimelineProps {
  /** Current status. Drives which step is "active" and which are checked. */
  status: OrderStatus;
  /** Optional map of step → timestamp ISO. Renders under the step label. */
  events?: Partial<Record<OrderStatus, string>>;
  /** Compact = smaller dots + label sizes (for embedded list rows). */
  compact?: boolean;
}

export function OrderStatusTimeline({ status, events, compact = false }: OrderStatusTimelineProps) {
  const isTerminal = status === 'cancelled' || status === 'returned' || status === 'refunded';

  // Terminal states (cancelled/returned/refunded) render a single dimmed
  // stamp instead of a 4-step rail — there's no "progress" to show.
  if (isTerminal) {
    return (
      <div style={{
        padding: compact ? '12px 14px' : '16px 18px',
        background: '#f9fafb', borderRadius: 10,
        border: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span aria-hidden="true" style={{
          width: 28, height: 28, borderRadius: '50%',
          background: '#9ca3af', color: 'white',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.875rem', flexShrink: 0,
        }}>{ICONS[status]}</span>
        <div>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink-900)' }}>
            {ORDER_STATUS_LABELS[status]}
          </div>
          {events?.[status] && (
            <div style={{ fontSize: '0.75rem', color: 'var(--ink-500)', marginTop: 2 }}>
              {fmtShort(events[status]!)}
            </div>
          )}
        </div>
      </div>
    );
  }

  // The 4-step rail. payment_pending / payment_failed render as the first
  // dot with their own icon — anything else maps onto ORDER_TIMELINE_STEPS.
  const effectiveStatus: OrderStatus =
    status === 'payment_pending' || status === 'payment_failed' ? 'pending' : status;
  const stepIdx = ORDER_TIMELINE_STEPS.indexOf(effectiveStatus);

  const dotSize = compact ? 22 : 28;
  const labelSize = compact ? '0.625rem' : '0.75rem';
  const dateSize  = compact ? '0.625rem' : '0.6875rem';

  return (
    <div
      role="list"
      aria-label="Order status timeline"
      style={{
        display: 'flex', alignItems: 'flex-start', position: 'relative',
        paddingTop: 4,
      }}
    >
      {ORDER_TIMELINE_STEPS.map((step, i) => {
        const done = i < stepIdx;
        const current = i === stepIdx;
        const accent = done || current ? 'var(--brand-pink)' : '#d1d5db';
        const label = ORDER_STATUS_LABELS[step];
        const ts = events?.[step];
        return (
          <div
            key={step}
            role="listitem"
            aria-current={current ? 'step' : undefined}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              position: 'relative',
            }}
          >
            {/* Connector line to the next step. Sized so it sits BEHIND the
             *  dot (z-index 0) and runs from the centre of this dot to the
             *  centre of the next. */}
            {i < ORDER_TIMELINE_STEPS.length - 1 && (
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: dotSize / 2 - 1,
                  left: '50%', right: '-50%',
                  height: 2,
                  background: done ? 'var(--brand-pink)' : '#e5e7eb',
                  zIndex: 0,
                }}
              />
            )}
            <span
              aria-hidden="true"
              style={{
                width: dotSize, height: dotSize, borderRadius: '50%',
                background: done || current ? 'var(--brand-pink)' : 'white',
                border: `2px solid ${accent}`, zIndex: 1,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 8,
                color: done || current ? 'white' : '#9ca3af',
                fontSize: compact ? '0.625rem' : '0.75rem',
                fontWeight: 700,
                transition: 'all 200ms',
              }}
            >
              {done ? '✓' : current ? ICONS[step] : ''}
            </span>
            <div
              style={{
                fontSize: labelSize,
                color: done || current ? 'var(--ink-900)' : 'var(--ink-500)',
                fontWeight: current ? 700 : 500,
                textAlign: 'center', lineHeight: 1.3,
              }}
            >
              {label}
            </div>
            {ts && (
              <div
                style={{
                  fontSize: dateSize,
                  color: 'var(--ink-500)', marginTop: 2,
                  textAlign: 'center',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fmtShort(ts)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
