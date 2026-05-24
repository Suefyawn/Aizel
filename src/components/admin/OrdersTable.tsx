'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { bulkUpdateOrderStatus } from '@/app/admin/actions';
import { useToast } from '@/components/admin/Toast';
import { ORDER_STATUS_LABELS } from '@/types';
import type { Order, OrderStatus } from '@/types';

const fmt = (n: number) => `£${n.toLocaleString()}`;
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const payBadge: Record<string, { bg: string; color: string; label: string }> = {
  cod:  { bg: '#fef3c7', color: '#92400e', label: 'COD' },
  card: { bg: '#ede9fe', color: '#5b21b6', label: 'Card' },
  bank: { bg: '#dbeafe', color: '#1e40af', label: 'Bank' },
};

const statusColors: Record<string, string> = {
  pending: '#f59e0b', processing: '#3b82f6', shipped: '#8b5cf6',
  delivered: '#10b981', cancelled: '#ef4444',
};

// Labels come from ORDER_STATUS_LABELS so the bulk-action and swipe buttons
// stay in lock-step with every other status surface (header badge, timeline,
// filter pills, invoice). Defining a label here would let the two drift.
const BULK_STATUSES: { value: OrderStatus; color: string }[] = [
  { value: 'processing', color: '#3b82f6' },
  { value: 'shipped',    color: '#8b5cf6' },
  { value: 'delivered',  color: '#10b981' },
  { value: 'cancelled',  color: '#ef4444' },
];

// Statuses offered in the per-card swipe panel — the forward fulfilment
// progression. Cancellation stays on the order detail page (destructive).
const QUICK_STATUSES: { value: OrderStatus; color: string }[] =
  BULK_STATUSES.filter(s => s.value !== 'cancelled');

function StatusBadge({ status }: { status: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 20,
      fontSize: '0.75rem', fontWeight: 600,
      background: (statusColors[status] ?? '#6b7280') + '20',
      color: statusColors[status] ?? '#6b7280',
    }}>
      {ORDER_STATUS_LABELS[status as OrderStatus] ?? status}
    </span>
  );
}

function PayBadge({ method }: { method: string }) {
  const badge = payBadge[method] ?? { bg: '#f3f4f6', color: '#374151', label: method };
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', background: badge.bg, color: badge.color, borderRadius: 20, fontSize: '0.75rem', fontWeight: 600 }}>
      {badge.label}
    </span>
  );
}

export function OrdersTable({ orders }: { orders: Order[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) { next.delete(id); } else { next.add(id); }
    return next;
  });

  const toggleAll = () => setSelected(
    selected.size === orders.length ? new Set() : new Set(orders.map(o => o.id!))
  );

  const bulk = (status: OrderStatus) => {
    if (selected.size === 0) return;
    const count = selected.size;
    // Cancel is irreversible — refunds don't happen here and the customer
    // gets a "your order was cancelled" email. Guard against accidental
    // multi-select cancels of (potentially) hundreds of orders.
    if (status === 'cancelled') {
      const ok = window.confirm(
        count === 1
          ? `Cancel this order? The customer will be emailed automatically.`
          : `Cancel ${count} orders? Each customer will be emailed automatically. This cannot be undone.`,
      );
      if (!ok) return;
    }
    startTransition(async () => {
      const result = await bulkUpdateOrderStatus(Array.from(selected), status);
      if (result.error) {
        toast(`Couldn't update orders: ${result.error}`, 'error');
        return;
      }
      setSelected(new Set());
      toast(`${count} order${count !== 1 ? 's' : ''} marked as ${ORDER_STATUS_LABELS[status]}`, 'success');
    });
  };

  // Per-card quick status change from the swipe panel. Closes the revealed
  // panel by scrolling its card back to the start.
  const quickStatus = (e: React.MouseEvent<HTMLButtonElement>, id: string, status: OrderStatus) => {
    const card = e.currentTarget.closest('.ord-swipe');
    card?.scrollTo({ left: 0, behavior: 'smooth' });
    startTransition(async () => {
      const result = await bulkUpdateOrderStatus([id], status);
      if (result.error) {
        toast(`Couldn't update order: ${result.error}`, 'error');
        return;
      }
      toast(`Order marked as ${ORDER_STATUS_LABELS[status]}`, 'success');
    });
  };

  if (orders.length === 0) {
    return (
      <div style={{ padding: '60px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
        No orders found
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* ── Desktop: table ── */}
      <table className="adm-orders-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
            <th scope="col" style={{ padding: '11px 12px', width: 40, textAlign: 'center' }}>
              <input
                type="checkbox"
                checked={selected.size === orders.length && orders.length > 0}
                onChange={toggleAll}
                title="Select all"
                style={{ cursor: 'pointer', accentColor: '#4A1A6B' }}
              />
            </th>
            {['Order #', 'Customer', 'Total', 'Status', 'Payment', 'Date'].map(h => (
              <th scope="col" key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map((o, i) => {
            const st = o.status ?? 'pending';
            const isSelected = selected.has(o.id!);
            return (
              <tr key={o.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none', background: isSelected ? '#F5EFF8' : 'transparent' }}>
                <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(o.id!)}
                    aria-label={`Select order ${o.order_number}`}
                    style={{ cursor: 'pointer', accentColor: '#4A1A6B' }}
                  />
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <Link href={`/admin/orders/${o.id}`} style={{ fontWeight: 700, fontSize: '0.875rem', color: '#4A1A6B', textDecoration: 'none', fontFamily: 'monospace' }}>
                    {o.order_number}
                  </Link>
                </td>
                <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#374151' }}>
                  {o.first_name} {o.last_name}
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: '0.875rem', color: '#111827', whiteSpace: 'nowrap' }}>
                  {fmt(o.total)}
                </td>
                <td style={{ padding: '12px 16px' }}><StatusBadge status={st} /></td>
                <td style={{ padding: '12px 16px' }}><PayBadge method={o.pay_method} /></td>
                <td style={{ padding: '12px 16px', fontSize: '0.8125rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                  {o.created_at ? fmtDate(o.created_at) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ── Mobile: swipe cards. Swipe a card left to reveal quick status
           actions; the card itself still links to the order detail. ── */}
      <div className="adm-orders-cards">
        {orders.map(o => {
          const st = o.status ?? 'pending';
          const isSelected = selected.has(o.id!);
          return (
            <div key={o.id} className="ord-swipe">
              <div className="ord-swipe-face" style={{ background: isSelected ? '#F5EFF8' : 'white' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(o.id!)}
                    aria-label={`Select order ${o.order_number}`}
                    style={{ cursor: 'pointer', accentColor: '#4A1A6B', width: 18, height: 18, flexShrink: 0 }}
                  />
                  <Link href={`/admin/orders/${o.id}`} style={{ fontWeight: 700, fontSize: '1rem', color: '#4A1A6B', textDecoration: 'none', fontFamily: 'monospace' }}>
                    {o.order_number}
                  </Link>
                  <span style={{ marginLeft: 'auto' }}><StatusBadge status={st} /></span>
                </div>
                <div style={{ fontSize: '0.875rem', color: '#374151', marginBottom: 6 }}>
                  {o.first_name} {o.last_name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#111827' }}>{fmt(o.total)}</span>
                  <PayBadge method={o.pay_method} />
                  <span style={{ fontSize: '0.8125rem', color: '#9ca3af', marginLeft: 'auto' }}>
                    {o.created_at ? fmtDate(o.created_at) : '—'}
                  </span>
                </div>
              </div>
              <div className="ord-swipe-actions" aria-label="Quick status update">
                {QUICK_STATUSES.map(s => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={e => quickStatus(e, o.id!, s.value)}
                    disabled={pending || st === s.value}
                    style={{
                      flex: 1, border: 'none', cursor: pending ? 'not-allowed' : 'pointer',
                      background: s.color, color: '#fff',
                      fontSize: '0.75rem', fontWeight: 700, lineHeight: 1.1,
                      opacity: st === s.value ? 0.45 : 1,
                    }}
                  >
                    {ORDER_STATUS_LABELS[s.value]}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selected.size > 0 && (
        <div className="adm-bulk-bar" style={{
          position: 'sticky', bottom: 16, zIndex: 20,
          background: '#111827', borderRadius: 10,
          padding: '12px 20px', margin: '12px 0 0',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        }}>
          <span style={{ color: '#f9fafb', fontSize: '0.875rem', fontWeight: 600 }}>
            {selected.size} selected
          </span>
          <span style={{ color: '#6b7280', fontSize: '0.8125rem' }}>Mark as:</span>
          {BULK_STATUSES.map(s => (
            <button key={s.value} onClick={() => bulk(s.value)} disabled={pending} style={{
              padding: '5px 14px', borderRadius: 20, border: 'none', cursor: pending ? 'not-allowed' : 'pointer',
              background: s.color + '30', color: s.color,
              fontSize: '0.8125rem', fontWeight: 600, opacity: pending ? 0.6 : 1,
            }}>
              {pending ? '…' : ORDER_STATUS_LABELS[s.value]}
            </button>
          ))}
          <button onClick={() => setSelected(new Set())} style={{
            marginLeft: 'auto', padding: '5px 12px', borderRadius: 6,
            border: '1px solid #374151', background: 'transparent', color: '#9ca3af',
            fontSize: '0.8125rem', cursor: 'pointer',
          }}>
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
