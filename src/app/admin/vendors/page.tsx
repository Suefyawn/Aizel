export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { DeleteButton } from '@/components/admin/DeleteButton';
import { createVendor, deleteVendor, updateVendor, markSettlementSettled } from '@/app/admin/vendor-actions';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import type { Vendor, VendorSettlement } from '@/types';

const fmt = (n: number) => `£${Math.round(n).toLocaleString()}`;

const inp: React.CSSProperties = {
  padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7,
  fontSize: '0.875rem', color: '#111827', background: 'white', outline: 'none',
};
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: 4,
};
const th: React.CSSProperties = {
  padding: '11px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600,
  color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em',
};
const card: React.CSSProperties = {
  background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden',
};

export default async function VendorsPage() {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('orders.view')) {
    return <NoAccess section="Vendors" />;
  }

  const admin = supabaseAdmin();
  // vendors / vendor_settlements RLS has no policy — admin reads need service role.
  const [{ data: vendorData }, { data: settlementData }] = await Promise.all([
    admin.from('vendors').select('*').order('created_at', { ascending: false }),
    admin.from('vendor_settlements').select('*').order('created_at', { ascending: false }).limit(200),
  ]);
  const vendors = (vendorData ?? []) as Vendor[];
  const settlements = (settlementData ?? []) as VendorSettlement[];

  const orderIds = Array.from(new Set(settlements.map(s => s.order_id)));
  const { data: orderData } = orderIds.length
    ? await admin.from('orders').select('id, order_number').in('id', orderIds)
    : { data: [] };
  const orderMap = new Map(((orderData ?? []) as { id: string; order_number: string }[]).map(o => [o.id, o.order_number]));
  const vendorMap = new Map(vendors.map(v => [v.id, v]));

  // Per-vendor outstanding (pending) total. A vendor's settlement_direction is
  // fixed, so every pending row for a vendor is owed in the same direction.
  const pendingByVendor = new Map<string, number>();
  for (const s of settlements) {
    if (s.status !== 'pending') continue;
    pendingByVendor.set(s.vendor_id, (pendingByVendor.get(s.vendor_id) ?? 0) + Number(s.amount_due));
  }

  const pending = settlements.filter(s => s.status === 'pending');
  const settled = settlements.filter(s => s.status === 'settled');

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Vendors</h1>
      <p style={{ margin: '0 0 24px', fontSize: '0.875rem', color: '#6b7280' }}>
        Suppliers you forward confirmed orders to. Set each vendor&apos;s commission and who
        collects payment; dispatching an order records the margin and payout.
      </p>

      {/* ── Add vendor ──────────────────────────────────────────────────── */}
      <div style={{ background: 'white', borderRadius: 10, padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Add Vendor</h2>
        <form action={createVendor} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <label style={lbl}>Name</label>
            <input name="name" required placeholder="NB Sons" style={{ ...inp, width: 180 }} />
          </div>
          <div>
            <label style={lbl}>WhatsApp number</label>
            <input name="phone" required placeholder="+92 300 1234567" style={{ ...inp, width: 170 }} />
          </div>
          <div>
            <label style={lbl}>Commission % we keep</label>
            <input name="commission_pct" type="number" min={0} max={100} step="0.01" placeholder="35" style={{ ...inp, width: 130 }} />
          </div>
          <div>
            <label style={lbl}>Who collects payment</label>
            <select name="settlement_direction" defaultValue="we_collect" style={{ ...inp, width: 200 }}>
              <option value="we_collect">We collect — we pay the vendor</option>
              <option value="vendor_collects">Vendor collects — they pay us</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={lbl}>Notes (optional)</label>
            <input name="notes" placeholder="What they supply" style={{ ...inp, width: '100%' }} />
          </div>
          <button type="submit" style={{
            padding: '8px 20px', background: '#4A1A6B', color: 'white',
            border: 'none', borderRadius: 7, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
          }}>
            + Add
          </button>
        </form>
      </div>

      {/* ── Vendor list ─────────────────────────────────────────────────── */}
      <div style={{ ...card, marginBottom: 32 }}>
        {vendors.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            No vendors yet — add your first supplier above.
          </div>
        ) : (
          <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Name', 'WhatsApp', 'Settlement terms', 'Outstanding', ''].map(h => (
                  <th scope="col" key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vendors.map((v, i) => {
                const outstanding = pendingByVendor.get(v.id) ?? 0;
                const owedToUs = v.settlement_direction === 'vendor_collects';
                return (
                  <tr key={v.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                    <td data-label="Name" style={{ padding: '12px 16px', fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
                      {v.name}
                      {v.notes && <div style={{ fontSize: '0.75rem', fontWeight: 400, color: '#9ca3af' }}>{v.notes}</div>}
                    </td>
                    <td data-label="WhatsApp" style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#374151', fontFamily: 'monospace' }}>{v.phone}</td>
                    <td data-label="Settlement terms" style={{ padding: '12px 16px' }}>
                      <form action={updateVendor} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <input type="hidden" name="id" value={v.id} />
                        <input
                          name="commission_pct" type="number" min={0} max={100} step="0.01"
                          defaultValue={v.commission_pct ?? ''} placeholder="—"
                          aria-label={`${v.name} commission %`}
                          style={{ ...inp, width: 72, padding: '6px 8px' }}
                        />
                        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>% kept</span>
                        <select
                          name="settlement_direction" defaultValue={v.settlement_direction ?? 'we_collect'}
                          aria-label={`${v.name} settlement direction`}
                          style={{ ...inp, padding: '6px 8px', fontSize: '0.8125rem' }}
                        >
                          <option value="we_collect">We collect</option>
                          <option value="vendor_collects">Vendor collects</option>
                        </select>
                        <button type="submit" style={{
                          padding: '6px 12px', background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb',
                          borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                        }}>Save</button>
                      </form>
                    </td>
                    <td data-label="Outstanding" style={{ padding: '12px 16px', fontSize: '0.875rem' }}>
                      {outstanding > 0 ? (
                        <span style={{ fontWeight: 700, color: owedToUs ? '#16a34a' : '#dc2626' }}>
                          {fmt(outstanding)}
                          <span style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 600, color: '#9ca3af' }}>
                            {owedToUs ? 'owed to you' : 'you owe'}
                          </span>
                        </span>
                      ) : <span style={{ color: '#9ca3af' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <DeleteButton id={v.id} action={deleteVendor} confirmMsg={`Delete vendor "${v.name}"?`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Payouts ─────────────────────────────────────────────────────── */}
      <h2 style={{ margin: '0 0 4px', fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>Payouts</h2>
      <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: '#6b7280' }}>
        One row per order dispatched to a vendor — the margin earned and the amount still to settle.
      </p>
      {settlements.length === 0 ? (
        <div style={{ ...card, padding: '48px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
          No payouts yet. Dispatch a confirmed order to a vendor from its order page to record one.
        </div>
      ) : (
        <div style={card}>
          <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Order', 'Vendor', 'Gross', 'Our margin', 'To settle', 'Status', ''].map(h => (
                  <th scope="col" key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...pending, ...settled].map((s, i) => {
                const vendor = vendorMap.get(s.vendor_id);
                const owedToUs = s.due_to === 'us';
                return (
                  <tr key={s.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                    <td data-label="Order" style={{ padding: '12px 16px', fontSize: '0.8125rem' }}>
                      <Link href={`/admin/orders/${s.order_id}`} style={{ color: '#4A1A6B', textDecoration: 'none', fontFamily: 'monospace' }}>
                        {orderMap.get(s.order_id) ?? s.order_id.slice(0, 8)}
                      </Link>
                    </td>
                    <td data-label="Vendor" style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#111827' }}>{vendor?.name ?? '—'}</td>
                    <td data-label="Gross" style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#374151' }}>{fmt(s.gross_amount)}</td>
                    <td data-label="Our margin" style={{ padding: '12px 16px', fontSize: '0.875rem', fontWeight: 600, color: '#16a34a' }}>{fmt(s.our_margin)}</td>
                    <td data-label="To settle" style={{ padding: '12px 16px', fontSize: '0.875rem' }}>
                      <span style={{ fontWeight: 700, color: owedToUs ? '#16a34a' : '#dc2626' }}>{fmt(s.amount_due)}</span>
                      <span style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 600, color: '#9ca3af' }}>
                        {owedToUs ? 'vendor pays you' : 'you pay vendor'}
                      </span>
                    </td>
                    <td data-label="Status" style={{ padding: '12px 16px' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                        background: s.status === 'settled' ? '#f0fdf4' : '#fffbeb',
                        color: s.status === 'settled' ? '#16a34a' : '#d97706',
                      }}>
                        {s.status === 'settled' ? 'Settled' : 'Pending'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <form action={markSettlementSettled}>
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="settle" value={s.status === 'settled' ? 'false' : 'true'} />
                        <button type="submit" style={{
                          padding: '6px 12px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                          border: '1px solid #e5e7eb',
                          background: s.status === 'settled' ? 'transparent' : '#16a34a',
                          color: s.status === 'settled' ? '#6b7280' : 'white',
                        }}>
                          {s.status === 'settled' ? 'Reopen' : 'Mark settled'}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
