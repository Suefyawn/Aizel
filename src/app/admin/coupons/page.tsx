export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase';
import { DeleteButton } from '@/components/admin/DeleteButton';
import { ConfirmButton } from '@/components/admin/ConfirmButton';
import { CouponEditModal } from '@/components/admin/CouponEditModal';
import { createCoupon, deleteCoupon, toggleCoupon } from '@/app/admin/coupon-actions';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import type { Coupon } from '@/types';

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function getCouponState(c: Coupon): 'expired' | 'maxed' | 'active' | 'inactive' {
  if (c.expires_at && new Date(c.expires_at) < new Date()) return 'expired';
  if (c.max_uses && c.used_count >= c.max_uses) return 'maxed';
  if (!c.active) return 'inactive';
  return 'active';
}

const stateStyle: Record<string, React.CSSProperties> = {
  expired:  { background: '#fef2f2' },
  maxed:    { background: '#fff7ed' },
  active:   {},
  inactive: { background: '#f9fafb' },
};

export default async function CouponsPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; created?: string }>;
}) {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('coupons')) {
    return <NoAccess section="Coupons" />;
  }
  const sp = (await searchParams) ?? {};
  const feedbackError = sp.error;
  const feedbackCreated = sp.created;
  // coupons RLS (migration 070) drops anon SELECT — admin reads need
  // the service role.
  const admin = supabaseAdmin();
  const [{ data }, { data: orderRows }] = await Promise.all([
    admin.from('coupons').select('*').order('created_at', { ascending: false }),
    admin.from('orders').select('coupon_code, discount_amount').not('coupon_code', 'is', null).neq('status', 'cancelled'),
  ]);
  const coupons = (data ?? []) as Coupon[];

  // Real redemption impact, aggregated from orders (ground truth) and keyed
  // by uppercased code so casing differences collapse together.
  const impact = new Map<string, { orders: number; discount: number }>();
  for (const row of (orderRows ?? []) as Array<{ coupon_code: string | null; discount_amount: number | null }>) {
    if (!row.coupon_code) continue;
    const key = row.coupon_code.toUpperCase();
    const cur = impact.get(key) ?? { orders: 0, discount: 0 };
    cur.orders += 1;
    cur.discount += row.discount_amount ?? 0;
    impact.set(key, cur);
  }
  const totalDiscount = [...impact.values()].reduce((s, v) => s + v.discount, 0);

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 7,
    fontSize: '0.875rem', color: '#111827', background: 'white', outline: 'none', boxSizing: 'border-box',
  };
  const lblWide: React.CSSProperties = {
    display: 'block', fontSize: '0.75rem', fontWeight: 600,
    color: '#374151', marginBottom: 5,
  };

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div className="adm-page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Coupons</h1>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
            {coupons.length} coupon{coupons.length !== 1 ? 's' : ''}
            {totalDiscount > 0 && ` · £${totalDiscount.toLocaleString()} given in discounts`}
          </p>
        </div>
      </div>

      {(feedbackError || feedbackCreated) && (
        <div
          role="status"
          style={{
            marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: '0.875rem',
            background: feedbackError ? '#fef2f2' : '#f0fdf4',
            color: feedbackError ? '#991b1b' : '#166534',
            border: `1px solid ${feedbackError ? '#fecaca' : '#bbf7d0'}`,
          }}
        >
          {feedbackError ?? `Coupon "${feedbackCreated}" created.`}
        </div>
      )}

      {/* Create coupon form — 3-col grid that collapses to 2 then 1
          via .adm-form-3col so it stops overflowing on tablets. */}
      <div style={{ background: 'white', borderRadius: 10, padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Create coupon</h2>
        <p style={{ margin: '0 0 16px', fontSize: '0.75rem', color: '#6b7280' }}>
          Code is uppercased on save. Leave Max uses / Expires blank for unlimited.
        </p>
        <form action={createCoupon}>
          <div className="adm-form-3col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label htmlFor="cp-code" style={lblWide}>Code</label>
              <input id="cp-code" name="code" required placeholder="SAVE10" style={{ ...inp, textTransform: 'uppercase', fontFamily: 'monospace' }} />
            </div>
            <div>
              <label htmlFor="cp-type" style={lblWide}>Type</label>
              <select id="cp-type" name="type" style={inp}>
                <option value="percent">Percent (%)</option>
                <option value="fixed">Fixed (£)</option>
              </select>
            </div>
            <div>
              <label htmlFor="cp-value" style={lblWide}>Value</label>
              <input id="cp-value" name="value" type="number" required min={1} placeholder="10" style={inp} />
            </div>
          </div>
          <div className="adm-form-3col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 18 }}>
            <div>
              <label htmlFor="cp-min" style={lblWide}>Min order (£)</label>
              <input id="cp-min" name="min_order" type="number" min={0} defaultValue={0} placeholder="0" style={inp} />
            </div>
            <div>
              <label htmlFor="cp-max" style={lblWide}>Max uses</label>
              <input id="cp-max" name="max_uses" type="number" min={1} placeholder="Unlimited" style={inp} />
            </div>
            <div>
              <label htmlFor="cp-exp" style={lblWide}>Expires</label>
              <input id="cp-exp" name="expires_at" type="date" style={inp} />
            </div>
          </div>
          <button type="submit" style={{
            padding: '10px 22px', background: '#4A1A6B', color: 'white',
            border: 'none', borderRadius: 7, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
            minHeight: 40,
          }}>
            + Create coupon
          </button>
        </form>
      </div>

      {/* Coupons table */}
      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {coupons.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>No coupons yet</div>
        ) : (
          <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Code', 'Discount', 'Min Order', 'Used', 'Discount given', 'Expires', 'Status', ''].map(h => (
                  <th scope="col" key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coupons.map((c, i) => {
                const state = getCouponState(c);
                const isMaxed = state === 'maxed';
                const isExpired = state === 'expired';
                return (
                  <tr key={c.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none', ...stateStyle[state] }}>
                    <td data-label="Code" style={{ padding: '12px 16px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.875rem', color: '#111827' }}>{c.code}</span>
                      {isExpired && <span style={{ marginLeft: 8, fontSize: '0.7rem', fontWeight: 600, color: '#dc2626', background: '#fef2f2', padding: '1px 6px', borderRadius: 10 }}>EXPIRED</span>}
                      {isMaxed && <span style={{ marginLeft: 8, fontSize: '0.7rem', fontWeight: 600, color: '#ea580c', background: '#fff7ed', padding: '1px 6px', borderRadius: 10 }}>MAXED</span>}
                    </td>
                    <td data-label="Discount" style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#374151' }}>
                      {c.type === 'percent' ? `${c.value}%` : `£${c.value.toLocaleString()}`}
                    </td>
                    <td data-label="Min order" style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#374151' }}>
                      {c.min_order ? `£${c.min_order.toLocaleString()}` : '—'}
                    </td>
                    <td data-label="Used" style={{ padding: '12px 16px', fontSize: '0.875rem', color: isMaxed ? '#ea580c' : '#6b7280', fontWeight: isMaxed ? 600 : 400 }}>
                      {c.used_count}
                      {c.max_uses ? <span style={{ color: '#9ca3af' }}> / {c.max_uses}</span> : ''}
                    </td>
                    <td data-label="Discount given" style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#374151' }}>
                      {(() => {
                        const imp = impact.get(c.code.toUpperCase());
                        return imp && imp.discount > 0
                          ? <span><strong>£{imp.discount.toLocaleString()}</strong><span style={{ color: '#9ca3af' }}> · {imp.orders} order{imp.orders !== 1 ? 's' : ''}</span></span>
                          : <span style={{ color: '#9ca3af' }}>—</span>;
                      })()}
                    </td>
                    <td data-label="Expires" style={{ padding: '12px 16px', fontSize: '0.8125rem', color: isExpired ? '#dc2626' : '#6b7280', fontWeight: isExpired ? 600 : 400 }}>
                      {c.expires_at ? fmtDate(c.expires_at) : '—'}
                    </td>
                    <td data-label="Status" style={{ padding: '12px 16px' }}>
                      <form action={toggleCoupon.bind(null, c.id, !c.active)}>
                        {/* Confirm before deactivating a LIVE coupon so an
                            accidental click mid-promo doesn't silently
                            switch it off. Re-activating is a one-click op. */}
                        {c.active && !isExpired && !isMaxed ? (
                          <ConfirmButton
                            message={`Pause "${c.code}"? Customers won't be able to use it until you switch it back on.`}
                            style={{
                              padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                              fontSize: '0.75rem', fontWeight: 600,
                              background: '#f0fdf4', color: '#15803d', minHeight: 30,
                            }}
                          >
                            Active
                          </ConfirmButton>
                        ) : (
                          <button type="submit" style={{
                            padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                            background: '#f3f4f6',
                            color: '#9ca3af',
                            minHeight: 30,
                          }}>
                            Inactive
                          </button>
                        )}
                      </form>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <CouponEditModal coupon={c} />
                        <DeleteButton id={c.id} action={deleteCoupon} confirmMsg={`Delete coupon "${c.code}"?`} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
