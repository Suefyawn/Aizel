export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { OrderStatusForm } from '@/components/admin/OrderStatusForm';
import { PrintInvoiceButton } from '@/components/admin/PrintInvoiceButton';
import { ShipmentBookingForm } from '@/components/admin/ShipmentBookingForm';
import { setOrderConfirmed } from '@/app/admin/order-confirmation-actions';
import { whatsappUrlForCustomer as waUrlForCustomer } from '@/lib/whatsapp';
import { brandPlusName } from '@/lib/product-display';
import { configuredAdapterIds } from '@/lib/couriers';
import { ORDER_STATUS_LABELS } from '@/types';
import type { Order, CartItem, OrderStatus } from '@/types';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { RefundPanel } from '@/components/admin/RefundPanel';
import { loadRefundSummary } from '@/app/admin/refund-actions';
import { isConfigured as stripeIsConfigured } from '@/lib/payments/stripe';

interface OrderEventRow {
  id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  note: string | null;
  actor_kind: string | null;
  created_at: string;
}

function statusLabel(s: OrderStatus | null): string {
  return s ? (ORDER_STATUS_LABELS[s] ?? s) : '';
}

const fmt = (n: number) => `£${n.toLocaleString()}`;
const fmtDate = (s: string) =>
  new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const payLabel: Record<string, string> = { cod: 'Cash on Delivery', card: 'Card Payment', bank: 'Bank Transfer' };

const statusColors: Record<string, string> = {
  pending: '#f59e0b', processing: '#3b82f6', shipped: '#8b5cf6', delivered: '#10b981', cancelled: '#ef4444',
};

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('orders.view')) {
    return <NoAccess section="Orders" />;
  }
  // orders.edit gates the mutating widgets below (confirmation toggle,
  // shipment booking, status update). A view-only staffer still sees the
  // full read-only order detail.
  const canEdit = !session || session.isOwner || session.permissions.includes('orders.edit');
  const { id } = await params;
  const { data: order } = await supabaseAdmin().from('orders').select('*').eq('id', id).single();
  if (!order) notFound();

  const o = order as Order;
  const items = (o.items ?? []) as CartItem[];
  const currentStatus = (o.status ?? 'pending') as OrderStatus;

  // Pull the most-recent shipment for this order so the booking form can
  // toggle into its "already shipped" state. Cheap query — one row max for
  // most orders. Couriers with a configured API adapter (env vars set) get
  // a "Book pickup" button; everything else falls back to manual entry.
  const { data: shipmentRow } = await supabaseAdmin()
    .from('shipments')
    .select('id, courier, tracking_number, status')
    .eq('order_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const apiAdapters = configuredAdapterIds();

  // Status history — every transition this order went through, oldest first.
  const { data: eventRows } = await supabaseAdmin()
    .from('order_events')
    .select('id, from_status, to_status, note, actor_kind, created_at')
    .eq('order_id', id)
    .order('created_at', { ascending: true });
  const events = (eventRows ?? []) as OrderEventRow[];

  // Refund summary — what's been paid + refunded so far + what's left.
  // Used by the RefundPanel to render the live remaining balance.
  const refundSummary = await loadRefundSummary(o.id!);
  const stripeReady = stripeIsConfigured();

  // Customer history block — lifetime orders + total spend for the same
  // (user_id OR phone OR email). Cheap query — admin-only view, no caching
  // needed. Excludes the current order from "previous" + "ltv" so the
  // merchant sees "this is their 3rd order" rather than counting the one
  // they're already looking at.
  const orFilters = [
    o.user_id ? `user_id.eq.${o.user_id}` : null,
    o.email ? `email.eq.${o.email}` : null,
    o.phone ? `phone.eq.${o.phone}` : null,
  ].filter(Boolean).join(',');
  let customerStats: { count: number; total: number; first: string | null } | null = null;
  if (orFilters) {
    const { data: history } = await supabaseAdmin()
      .from('orders')
      .select('id, total, status, created_at')
      .or(orFilters)
      .neq('status', 'cancelled');
    const rows = (history ?? []) as Array<{ id: string; total: number; status: string; created_at: string }>;
    const orderCount = rows.length;
    const total = rows.reduce((s, r) => s + (r.total ?? 0), 0);
    const first = rows.length > 0
      ? rows.reduce((min, r) => (r.created_at < min ? r.created_at : min), rows[0].created_at)
      : null;
    customerStats = { count: orderCount, total, first };
  }

  const section: React.CSSProperties = {
    background: 'white', borderRadius: 10,
    padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  };
  const dl: React.CSSProperties = { display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px 16px', margin: 0 };
  const dt: React.CSSProperties = { fontSize: '0.8125rem', color: '#6b7280', fontWeight: 500 };
  const dd: React.CSSProperties = { fontSize: '0.875rem', color: '#111827', margin: 0 };

  return (
    <div id="order-detail-page" className="adm-page" style={{ padding: '32px 36px' }}>
      {/* Print styles — printing this page outputs ONLY the invoice card.
          Every other block is a direct child of #order-detail-page, so one
          rule hides them all (and stays correct as sections are added). */}
      <style>{`
        @media print {
          .adm-sidebar, .adm-topbar, .adm-overlay, .no-print { display: none !important; }
          .adm-main { margin-left: 0 !important; background: white !important; }
          #order-detail-page { padding: 0 !important; }
          #order-detail-page > :not(#print-invoice) { display: none !important; }
          #print-invoice { display: block !important; }
        }
        #print-invoice { display: none; }
      `}</style>

      <div className="no-print print-hide" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
        <Link href="/admin/orders" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem' }}>← Orders</Link>
        <span style={{ color: '#d1d5db' }}>/</span>
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#111827', fontFamily: 'monospace' }}>
          {o.order_number}
        </h1>
        <span style={{
          padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
          background: (statusColors[currentStatus] ?? '#6b7280') + '20',
          color: statusColors[currentStatus] ?? '#6b7280',
        }}>
          {statusLabel(currentStatus)}
        </span>
        {o.created_at && (
          <span style={{ fontSize: '0.8125rem', color: '#9ca3af', marginLeft: 4 }}>{fmtDate(o.created_at)}</span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* WhatsApp the customer — uses their phone, prefills the order
              number. One-tap support reply from the order page. */}
          {(() => {
            const href = waUrlForCustomer(o.phone, `Hi ${o.first_name ?? ''}, this is Aizel about order ${o.order_number}. `.trim());
            if (!href) return null;
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: '#25D366', color: '#fff', textDecoration: 'none',
                  padding: '7px 12px', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp
              </a>
            );
          })()}
          <PrintInvoiceButton />
        </div>
      </div>

      {/* Printable invoice */}
      <div id="print-invoice" style={{ fontFamily: 'sans-serif', color: '#111827', maxWidth: 700, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, borderBottom: '2px solid #111827', paddingBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.5rem', letterSpacing: '-0.02em', color: '#6B2C91' }}>
              Aizel
            </div>
            <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 4 }}>aizel.co.uk</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1.125rem' }}>{o.order_number}</div>
            <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 4 }}>{o.created_at ? fmtDate(o.created_at) : ''}</div>
            <div style={{ marginTop: 6, padding: '2px 10px', display: 'inline-block', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, background: (statusColors[currentStatus] ?? '#6b7280') + '25', color: statusColors[currentStatus] ?? '#6b7280' }}>
              {statusLabel(currentStatus)}
            </div>
          </div>
        </div>
        {/* One clear recipient block — billing and shipping are the same
            person here, and a courier reading the parcel wants name +
            address + phone together and prominent. */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6b7280', marginBottom: 8 }}>Deliver To</div>
          <div style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#111827' }}>{o.first_name} {o.last_name}</div>
          <div style={{ fontSize: '0.9375rem', color: '#374151', marginTop: 4 }}>{o.address}</div>
          <div style={{ fontSize: '0.9375rem', color: '#374151' }}>{o.city}{o.province ? `, ${o.province}` : ''}{o.zip ? ` ${o.zip}` : ''}</div>
          <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#111827', marginTop: 6 }}>{o.phone}</div>
          {o.email && <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{o.email}</div>}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              {['Item', 'Price', 'Qty', 'Total'].map(h => (
                <th scope="col" key={h} style={{ padding: '8px 0', textAlign: h === 'Price' || h === 'Qty' || h === 'Total' ? 'right' : 'left', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 0', fontSize: '0.875rem' }}>{brandPlusName(item.brand, item.name)}{(item.variant_label ?? item.variant) ? ` — ${item.variant_label ?? item.variant}` : ''}</td>
                <td style={{ padding: '10px 0', fontSize: '0.875rem', textAlign: 'right' }}>{fmt(item.price)}</td>
                <td style={{ padding: '10px 0', fontSize: '0.875rem', textAlign: 'right' }}>{item.qty}</td>
                <td style={{ padding: '10px 0', fontSize: '0.875rem', fontWeight: 600, textAlign: 'right' }}>{fmt(item.price * item.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginLeft: 'auto', maxWidth: 240 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: 6 }}>
            <span style={{ color: '#6b7280' }}>Subtotal</span><span>{fmt(o.subtotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: o.discount_amount && o.discount_amount > 0 ? 6 : 10 }}>
            <span style={{ color: '#6b7280' }}>Shipping</span><span>{o.shipping === 0 ? 'Free' : fmt(o.shipping)}</span>
          </div>
          {o.discount_amount != null && o.discount_amount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: 10 }}>
              <span style={{ color: '#15803d' }}>Discount{o.coupon_code ? ` (${o.coupon_code})` : ''}</span>
              <span style={{ color: '#15803d' }}>− {fmt(o.discount_amount)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem', borderTop: '2px solid #111827', paddingTop: 10 }}>
            <span>Total</span><span>{fmt(o.total)}</span>
          </div>
          <div style={{ marginTop: 8, fontSize: '0.8125rem', color: '#6b7280' }}>
            Payment: <strong style={{ color: '#374151' }}>{payLabel[o.pay_method] ?? o.pay_method}</strong>
          </div>
        </div>
      </div>

      {/* Customer confirmation — edit-gated */}
      {canEdit && (
      <div style={{ ...section, marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Customer confirmation</h2>
        <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: '#6b7280' }}>
          For phone or WhatsApp orders, confirm details with the customer first, then mark it confirmed here before picking and packing.
        </p>
        {o.confirmed_at ? (
          <div>
            <span style={{
              display: 'inline-block', padding: '4px 10px', borderRadius: 6,
              background: '#f0fdf4', color: '#16a34a', fontSize: '0.8125rem', fontWeight: 600,
            }}>
              ✓ Confirmed {fmtDate(o.confirmed_at)}
            </span>
            <form action={setOrderConfirmed.bind(null, o.id!, false)} style={{ marginTop: 8 }}>
              <button type="submit" style={{
                padding: '6px 12px', background: 'transparent', border: '1px solid #d1d5db',
                borderRadius: 6, color: '#6b7280', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
              }}>
                Mark unconfirmed
              </button>
            </form>
          </div>
        ) : (
          <form action={setOrderConfirmed.bind(null, o.id!, true)}>
            <button type="submit" style={{
              padding: '9px 16px', background: '#4A1A6B', color: 'white', border: 'none',
              borderRadius: 7, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
            }}>
              Mark customer-confirmed
            </button>
          </form>
        )}
      </div>
      )}

      {/* Refund panel — only useful when there's a card payment to refund;
          the component self-renders "nothing to refund" copy when the
          gateway is COD/bank or when Stripe isn't configured, so safe
          to mount unconditionally rather than tangling the parent
          render in conditionals. */}
      {(refundSummary.paid > 0 || refundSummary.refunded > 0) && (
        <RefundPanel
          orderId={o.id!}
          summary={refundSummary}
          canRefund={canEdit}
          stripeConfigured={stripeReady}
        />
      )}

      <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Customer */}
        <div style={section}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Customer</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {customerStats && customerStats.count > 1 && (
                <span
                  title={customerStats.first ? `First ordered ${new Date(customerStats.first).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : undefined}
                  style={{
                    fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    padding: '3px 9px', borderRadius: 20,
                    background: '#F5EFF8', color: '#4A1A6B', border: '1px solid #E3D2EF',
                  }}
                >
                  Repeat · {customerStats.count} orders
                </span>
              )}
              {o.user_id && (
                <Link href={`/admin/users/${o.user_id}`} style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#4A1A6B', textDecoration: 'none' }}>
                  View profile →
                </Link>
              )}
            </div>
          </div>
          <dl style={dl}>
            <dt style={dt}>Name</dt>
            <dd style={dd}>{o.first_name} {o.last_name}</dd>
            <dt style={dt}>Phone</dt>
            <dd style={dd}>{o.phone}</dd>
            {o.email && <><dt style={dt}>Email</dt><dd style={dd}>{o.email}</dd></>}
            {customerStats && (
              <>
                <dt style={dt}>Lifetime spend</dt>
                <dd style={dd}>
                  <strong style={{ color: '#16a34a' }}>{fmt(customerStats.total)}</strong>
                  <span style={{ color: '#9ca3af', marginLeft: 6, fontSize: '0.75rem' }}>across {customerStats.count} order{customerStats.count !== 1 ? 's' : ''}</span>
                </dd>
              </>
            )}
          </dl>
        </div>

        {/* Shipping */}
        <div style={section}>
          <h2 style={{ margin: '0 0 16px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Shipping address</h2>
          <dl style={dl}>
            <dt style={dt}>Address</dt>
            <dd style={dd}>{o.address}</dd>
            <dt style={dt}>City</dt>
            <dd style={dd}>{o.city}{o.province ? `, ${o.province}` : ''}</dd>
            {o.zip && <><dt style={dt}>Postcode</dt><dd style={dd}>{o.zip}</dd></>}
          </dl>
        </div>
      </div>

      {/* Order Items */}
      <div style={{ ...section, marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Order items</h2>
        <div className="adm-table-scroll">
        <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
              {['Product', 'Brand', 'Variant', 'Price', 'Qty', 'Subtotal'].map(h => (
                <th scope="col" key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f9fafb' }}>
                <td data-label="Product" style={{ padding: '10px 12px', fontSize: '0.875rem', fontWeight: 500, color: '#111827' }}>{item.name}</td>
                <td data-label="Brand" style={{ padding: '10px 12px', fontSize: '0.8125rem', color: '#6b7280' }}>{item.brand}</td>
                <td data-label="Variant" style={{ padding: '10px 12px', fontSize: '0.8125rem', color: '#6b7280' }}>{item.variant_label ?? item.variant ?? '—'}</td>
                <td data-label="Price" style={{ padding: '10px 12px', fontSize: '0.875rem', color: '#374151' }}>{fmt(item.price)}</td>
                <td data-label="Qty" style={{ padding: '10px 12px', fontSize: '0.875rem', color: '#374151' }}>{item.qty}</td>
                <td data-label="Subtotal" style={{ padding: '10px 12px', fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>{fmt(item.price * item.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Shipment booking — edit-gated. Sits above the status update because
          most merchant workflows book a courier first, then mark shipped. */}
      {canEdit && (
      <div style={{ ...section, marginTop: 12 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Shipment</h2>
        <ShipmentBookingForm
          orderId={o.id!}
          apiAdapters={apiAdapters}
          shipment={shipmentRow ? {
            id: shipmentRow.id as string,
            courier: shipmentRow.courier as string,
            tracking_number: shipmentRow.tracking_number as string,
            status: shipmentRow.status as string,
          } : null}
        />
      </div>
      )}

      {/* Order timeline — full status history from order_events */}
      <div style={{ ...section, marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Order timeline</h2>
        {events.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            No status history recorded yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {events.map((e, i) => (
              <div key={e.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColors[e.to_status] ?? '#6b7280', marginTop: 6, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.875rem', color: '#111827', fontWeight: 500 }}>
                    {e.from_status
                      ? `${statusLabel(e.from_status)} → ${statusLabel(e.to_status)}`
                      : `Order created — ${statusLabel(e.to_status)}`}
                  </div>
                  {e.note && <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 1 }}>{e.note}</div>}
                </div>
                {e.actor_kind && (
                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', alignSelf: 'flex-start', marginTop: 2 }}>
                    {e.actor_kind}
                  </span>
                )}
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>{fmtDate(e.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
        {/* Order Status Management — edit-gated */}
        {canEdit && (
        <div style={section}>
          <h2 style={{ margin: '0 0 20px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Update Order</h2>
          <OrderStatusForm
            orderId={o.id!}
            currentStatus={currentStatus}
          />
        </div>
        )}

        {/* Payment Summary */}
        <div style={section}>
          <h2 style={{ margin: '0 0 16px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Payment</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: '#6b7280' }}>Subtotal</span>
              <span>{fmt(o.subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: '#6b7280' }}>Shipping</span>
              <span>{o.shipping === 0 ? 'Free' : fmt(o.shipping)}</span>
            </div>
            {o.discount_amount != null && o.discount_amount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span style={{ color: '#15803d' }}>
                  Discount{o.coupon_code ? ` (${o.coupon_code})` : ''}
                </span>
                <span style={{ color: '#15803d' }}>− {fmt(o.discount_amount)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 700, borderTop: '1px solid #e5e7eb', paddingTop: 10 }}>
              <span>Total</span>
              <span style={{ color: '#4A1A6B' }}>{fmt(o.total)}</span>
            </div>
            <div style={{ marginTop: 4, fontSize: '0.8125rem', color: '#6b7280' }}>
              Method: <strong style={{ color: '#374151' }}>{payLabel[o.pay_method] ?? o.pay_method}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
