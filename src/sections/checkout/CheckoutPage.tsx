'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Overline } from '@/components/ui/Overline';
import { ProductImage } from '@/components/ui/ProductImage';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { getBrowserClient } from '@/lib/supabase-browser';
import { notifyNewOrder, calculateShipping, checkoutRateGate } from '@/app/checkout/actions';
import { captureAbandonedCart } from '@/app/checkout/abandoned-cart-actions';
import { postOrderDestination } from '@/lib/checkout-routing';
import { brandPlusName } from '@/lib/product-display';
import { track } from '@/lib/analytics';
import { BankAccountsList } from '@/components/checkout/BankAccountsList';
import type { Coupon, PayMethod, LoyaltyAccount, BankAccount } from '@/types';

// UK regions used in the checkout address dropdown. Order roughly mirrors
// shipping volume; admin can hide any of these via shipping_zones.
const PROVINCES = ['England', 'Scotland', 'Wales', 'Northern Ireland'];

const PAY_METHODS: ReadonlyArray<[PayMethod, string, string]> = [
  ['card', 'Credit / Debit Card', 'Visa, Mastercard, American Express'],
  ['bank', 'Bank Transfer',       'Direct bank deposit'],
  ['cod',  'Cash on Delivery',    'Pay when your order arrives'],
];

function makeOrderNumber() {
  // Add a 2-byte random suffix so two near-simultaneous clicks can't collide.
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return 'AZ-' + Date.now().toString(36).slice(-5).toUpperCase() + rand;
}

// Server-resolved props from /checkout/page.tsx — which payment methods
// the merchant has enabled in admin settings, plus the bank-transfer
// instructions to show on the thank-you page.
interface CheckoutPageProps {
  enabledMethods?: PayMethod[];
  bankAccounts?: BankAccount[];
  bankNotes?: string;
}

export function CheckoutPage({ enabledMethods, bankAccounts = [], bankNotes }: CheckoutPageProps = {}) {
  const { cartItems, clearCart, appliedCoupon: cartCoupon, setAppliedCoupon } = useCart();
  const { user } = useAuth();
  const router = useRouter();

  // Filter the hard-coded PAY_METHODS by what's actually enabled in admin
  // settings. If `enabledMethods` is undefined (server didn't pass one, e.g.
  // demo mode), default to all on — same as before this prop existed.
  const visiblePayMethods = enabledMethods && enabledMethods.length > 0
    ? PAY_METHODS.filter(([m]) => enabledMethods.includes(m))
    : PAY_METHODS;

  // Default to the first enabled method so we never auto-select a hidden one.
  const defaultMethod: PayMethod = visiblePayMethods[0]?.[0] ?? 'cod';
  const [payMethod, setPayMethod] = useState<PayMethod>(defaultMethod);
  const [formData, setFormData] = useState({ email: '', firstName: '', lastName: '', phone: '', address: '', city: '', province: '', zip: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  // The applied coupon lives in CartProvider (persisted to localStorage), so a
  // coupon added on /cart survives the trip to checkout — including a refresh
  // or full page load. `couponCode` is just the local text-input value.
  const [couponCode, setCouponCode] = useState(cartCoupon?.code ?? '');
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  // Optimistic first render from the default free-shipping threshold (£15),
  // so a qualifying cart shows FREE immediately instead of flashing "£4"
  // before calculateShipping resolves. The effect below corrects it against
  // the real zone/rate config (and the customer's region).
  const [shippingInfo, setShippingInfo] = useState<{ rate: number; free: boolean; label: string }>(() => {
    const sub = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
    return sub >= 15
      ? { rate: 0, free: true, label: 'Standard' }
      : { rate: 4, free: false, label: 'Standard' };
  });

  // ─── Rewards: loyalty points ────────────────────────────────────────────
  // Gift-card and referral redemption are hidden from checkout until those
  // programmes have a customer-facing way to obtain a code — the server
  // actions remain in place for when they do.
  const [loyalty, setLoyalty]               = useState<LoyaltyAccount | null>(null);
  const [pointsRedeemInput, setPointsRedeemInput] = useState<number | ''>('');
  const [pointsRedeem, setPointsRedeem]     = useState(0);

  // Pull loyalty balance for signed-in users — the Supabase query is an
  // external system, so syncing the result into React state is the
  // documented exception to the no-setState-in-effect rule.
  useEffect(() => {
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoyalty(null);
      return;
    }
    const sb = getBrowserClient();
    sb.from('loyalty_accounts').select('*').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setLoyalty(data as LoyaltyAccount | null));
  }, [user]);

  const subtotal = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  const couponDiscount = cartCoupon
    ? cartCoupon.type === 'percent'
      ? Math.round(subtotal * cartCoupon.value / 100)
      : cartCoupon.value
    : 0;
  const discount = couponDiscount;
  const lineTotal = Math.max(0, subtotal - discount);
  const shipping = shippingInfo.rate;
  const beforeRewards = lineTotal + shipping;

  // Loyalty points redemption — capped at the payable amount.
  const pointsCovers = Math.min(pointsRedeem, beforeRewards);
  const total        = Math.max(0, beforeRewards - pointsCovers);

  // Recompute shipping whenever subtotal or province changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (lineTotal === 0) return;
      const res = await calculateShipping({ province: formData.province || undefined, subtotal: lineTotal });
      if (!cancelled) setShippingInfo(res);
    })();
    return () => { cancelled = true; };
  }, [lineTotal, formData.province]);

  // Capture abandoned-cart snapshot when the user supplies an email AND the
  // cart is non-empty. Debounced 1.2 s so we don't fire per keystroke.
  useEffect(() => {
    if (cartItems.length === 0) return;
    const email = formData.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    const t = setTimeout(() => {
      void captureAbandonedCart({
        email,
        items: cartItems,
        subtotal,
        user_id: user?.id ?? null,
      });
    }, 1200);
    return () => clearTimeout(t);
  }, [formData.email, cartItems, subtotal, user?.id]);

  const update = (key: string, val: string) => {
    setFormData(p => ({ ...p, [key]: val }));
    if (errors[key]) setErrors(p => { const n = { ...p }; delete n[key]; return n; });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formData.firstName.trim()) e.firstName = 'Required';
    if (!formData.lastName.trim()) e.lastName = 'Required';
    const phone = formData.phone.trim().replace(/\s/g, '');
    if (!phone) {
      e.phone = 'Required';
    // UK mobile (11 digits starting 07…, or +44 7…) or UK landline (01/02/03).
    // Pattern mirrors normaliseUKPhone() in src/lib/notifications/twilio.ts so
    // anything we let through validation will also serialise cleanly for SMS.
    } else if (!/^(?:\+?44|0044|0)(7\d{9}|[123]\d{8,9})$/.test(phone)) {
      e.phone = 'Enter a valid UK phone number (e.g. 07123 456789 or +44 7123 456789)';
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      e.email = 'Enter a valid email address';
    }
    if (!formData.address.trim()) e.address = 'Required';
    if (!formData.city.trim()) e.city = 'Required';
    // Card payments require an email so we can send payment confirmations.
    if (payMethod === 'card' && !formData.email) {
      e.email = 'Required for online payment confirmation';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponError('');
    setCouponLoading(true);
    const sb = getBrowserClient();
    // coupons has RLS with no anon SELECT (migration 070) — go through the
    // SECURITY DEFINER lookup_coupon RPC instead of reading the table.
    const { data, error } = await sb.rpc('lookup_coupon' as never, { p_code: couponCode.trim() } as never);

    if (error) {
      setCouponLoading(false);
      setCouponError('Could not validate coupon. Try again.');
      return;
    }
    const rows = (data ?? []) as Coupon[];
    if (rows.length === 0) { setCouponLoading(false); setCouponError('Invalid or expired coupon code'); return; }
    const c = rows[0];

    // Per-user usage cap — pull prior redemption count when we know the user.
    let perUserUsedCount: number | undefined;
    if (formData.email && typeof c.usage_limit_per_user === 'number' && c.usage_limit_per_user > 0) {
      const { count } = await sb.from('coupon_redemptions')
        .select('id', { count: 'exact', head: true })
        .eq('coupon_id', c.id).eq('email', formData.email);
      perUserUsedCount = count ?? 0;
    }

    setCouponLoading(false);

    const { validateCoupon } = await import('@/lib/coupon-validation');
    const verdict = validateCoupon({
      coupon: c, cartItems, subtotal,
      email: formData.email ?? null,
      perUserUsedCount,
    });
    if (!verdict.ok) { setCouponError(verdict.error); return; }
    setAppliedCoupon(c);
    setCouponCode(c.code);
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const rate = await checkoutRateGate();
    if (!rate.ok) {
      setSubmitError('Too many checkout attempts. Please wait a minute and try again.');
      return;
    }

    track({
      name: 'begin_checkout',
      payload: {
        value: total, currency: 'GBP',
        items: cartItems.map(i => ({
          product_id: i.id, product_name: i.name, brand: i.brand ?? undefined,
          category: i.category, variant: i.variant_label ?? i.variant,
          price: i.price, qty: i.qty, currency: 'GBP',
        })),
      },
    });

    setSubmitting(true);
    setSubmitError('');
    try {
      const orderNumber = makeOrderNumber();
      const sb = getBrowserClient();
      const { data, error } = await sb.rpc('place_order' as never, {
        order_data: {
          order_number: orderNumber,
          email: formData.email || '',
          first_name: formData.firstName,
          last_name: formData.lastName,
          phone: formData.phone.trim(),
          address: formData.address,
          city: formData.city,
          province: formData.province || '',
          zip: formData.zip || '',
          pay_method: payMethod,
          subtotal,
          shipping,
          total: beforeRewards,                  // pre-rewards order total — points decrement separately
          items: cartItems,
          // Card orders sit in payment_pending until Stripe's webhook confirms.
          // COD / bank / gift_card start directly in `pending` (the staff queue).
          status: payMethod === 'card' ? 'payment_pending' : 'pending',
          user_id: user?.id || '',
          coupon_code: cartCoupon?.code || '',
          discount_amount: discount,
        },
        gift_card_code:   null,
        points_redeem:    pointsCovers > 0 ? pointsCovers : null,
        referred_by_code: null,
      } as never);
      if (error) throw new Error(error.message);
      void data;

      const dest = postOrderDestination(payMethod, orderNumber);

      if (dest.kind === 'gateway_post') {
        // Build a form and submit to the gateway initiator route.
        // The route handler returns an HTML auto-submit form that POSTs to the
        // real gateway. We POST as a form so the response can be a top-level
        // navigation (the browser shows the gateway's hosted page).
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = dest.url;
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'order_number';
        input.value = orderNumber;
        form.appendChild(input);
        document.body.appendChild(form);
        clearCart();
        form.submit();
        return;
      }

      // COD / bank / gift_card path — fire customer + owner emails, then thank-you.
      void notifyNewOrder({
        order_number: orderNumber,
        email: formData.email || undefined,
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone: formData.phone.trim(),
        city: formData.city,
        province: formData.province || undefined,
        total,
        items: cartItems.map(i => ({
          name: i.name, qty: i.qty, price: i.price, brand: i.brand ?? undefined, variant: i.variant,
        })),
        pay_method: payMethod,
      });
      track({
        name: 'purchase',
        payload: {
          transaction_id: orderNumber,
          value: total, currency: 'GBP',
          items: cartItems.map(i => ({
            product_id: i.id, product_name: i.name, brand: i.brand ?? undefined,
            category: i.category, variant: i.variant_label ?? i.variant,
            price: i.price, qty: i.qty, currency: 'GBP',
          })),
        },
      });
      clearCart();
      router.push(dest.url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setSubmitError(msg);
      setSubmitting(false);
    }
  };

  const inputStyle = (key: string): React.CSSProperties => ({
    width: '100%', padding: '10px 12px',
    border: `1px solid ${errors[key] ? 'var(--error)' : 'var(--line)'}`,
    borderRadius: 'var(--radius-card)', fontFamily: 'var(--font-ui)',
    fontSize: '0.875rem', color: 'var(--ink-900)', background: 'var(--paper)',
    outline: 'none',
  });
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: 6 };

  return (
    <div>
      <section style={{ padding: '48px 0 0', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <Overline style={{ display: 'block', marginBottom: 8, color: 'var(--ink-500)' }}>Checkout</Overline>
          <h1 className="display-l" style={{ fontSize: '2rem', marginBottom: 32 }}>Complete Your Order</h1>
        </div>
      </section>

      <section style={{ padding: '40px 0 var(--section-gap)' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 48 }} className="checkout-grid">
            <div>
              <Overline style={{ display: 'block', marginBottom: 16 }}>Contact</Overline>
              <div style={{ marginBottom: 24 }}>
                <label htmlFor="co-email" style={labelStyle}>Email {payMethod === 'card' ? '*' : '(optional)'}</label>
                <input id="co-email" type="email" autoComplete="email" value={formData.email} onChange={e => update('email', e.target.value)} placeholder="For order updates and payment receipts" style={inputStyle('email')} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'co-email-error' : undefined} />
                {errors.email && <span id="co-email-error" style={{ fontSize: '0.75rem', color: 'var(--error)' }}>{errors.email}</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }} className="checkout-name-grid">
                <div>
                  <label htmlFor="co-phone" style={labelStyle}>Phone *</label>
                  <input id="co-phone" type="tel" autoComplete="tel" value={formData.phone} onChange={e => update('phone', e.target.value)} placeholder="07123 456789" style={inputStyle('phone')} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? 'co-phone-error' : undefined} />
                  {errors.phone && <span id="co-phone-error" style={{ fontSize: '0.75rem', color: 'var(--error)' }}>{errors.phone}</span>}
                </div>
              </div>

              <hr className="hairline" style={{ margin: '32px 0' }} />
              <Overline style={{ display: 'block', marginBottom: 16 }}>Shipping Address</Overline>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label htmlFor="co-fname" style={labelStyle}>First Name *</label>
                  <input id="co-fname" autoComplete="given-name" value={formData.firstName} onChange={e => update('firstName', e.target.value)} style={inputStyle('firstName')} aria-invalid={!!errors.firstName} aria-describedby={errors.firstName ? 'co-fname-error' : undefined} />
                  {errors.firstName && <span id="co-fname-error" style={{ fontSize: '0.75rem', color: 'var(--error)' }}>{errors.firstName}</span>}
                </div>
                <div>
                  <label htmlFor="co-lname" style={labelStyle}>Last Name *</label>
                  <input id="co-lname" autoComplete="family-name" value={formData.lastName} onChange={e => update('lastName', e.target.value)} style={inputStyle('lastName')} aria-invalid={!!errors.lastName} aria-describedby={errors.lastName ? 'co-lname-error' : undefined} />
                  {errors.lastName && <span id="co-lname-error" style={{ fontSize: '0.75rem', color: 'var(--error)' }}>{errors.lastName}</span>}
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label htmlFor="co-address" style={labelStyle}>Address *</label>
                <input id="co-address" autoComplete="street-address" value={formData.address} onChange={e => update('address', e.target.value)} placeholder="House/flat, street, area" style={inputStyle('address')} aria-invalid={!!errors.address} aria-describedby={errors.address ? 'co-address-error' : undefined} />
                {errors.address && <span id="co-address-error" style={{ fontSize: '0.75rem', color: 'var(--error)' }}>{errors.address}</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }} className="addr-grid-3">
                <div>
                  <label htmlFor="co-city" style={labelStyle}>City *</label>
                  <input id="co-city" autoComplete="address-level2" value={formData.city} onChange={e => update('city', e.target.value)} style={inputStyle('city')} aria-invalid={!!errors.city} aria-describedby={errors.city ? 'co-city-error' : undefined} />
                  {errors.city && <span id="co-city-error" style={{ fontSize: '0.75rem', color: 'var(--error)' }}>{errors.city}</span>}
                </div>
                <div>
                  <label htmlFor="co-province" style={labelStyle}>Province</label>
                  <select id="co-province" autoComplete="address-level1" value={formData.province} onChange={e => update('province', e.target.value)} style={{ ...inputStyle('province'), cursor: 'pointer' }}>
                    <option value="">Select</option>
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="co-zip" style={labelStyle}>Postal Code</label>
                  <input id="co-zip" autoComplete="postal-code" inputMode="numeric" value={formData.zip} onChange={e => update('zip', e.target.value)} style={inputStyle('zip')} />
                </div>
              </div>

              <hr className="hairline" style={{ margin: '32px 0' }} />
              <Overline style={{ display: 'block', marginBottom: 16 }}>Payment Method</Overline>
              {visiblePayMethods.map(([key, label, desc]) => (
                <label key={key} onClick={() => setPayMethod(key)} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px',
                  border: '1px solid ' + (payMethod === key ? 'var(--ink-900)' : 'var(--line)'),
                  borderRadius: 'var(--radius-card)', cursor: 'pointer',
                  marginBottom: -1, background: payMethod === key ? 'var(--paper2)' : 'transparent',
                  transition: 'all 150ms',
                }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 1, border: payMethod === key ? '5px solid var(--ink-900)' : '2px solid var(--line)', transition: 'border 150ms' }} />
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{label}</div>
                    <div className="small-text">{desc}</div>
                  </div>
                </label>
              ))}
              {payMethod === 'bank' && bankAccounts.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <BankAccountsList accounts={bankAccounts} notes={bankNotes} />
                </div>
              )}
            </div>

            <div style={{ background: 'var(--paper2)', borderRadius: 'var(--radius-card)', padding: 28, border: '1px solid var(--line)', alignSelf: 'start', position: 'sticky', top: 100 }}>
              <Overline style={{ display: 'block', marginBottom: 16, color: 'var(--ink-500)' }}>Your Order</Overline>
              {cartItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-card)', flexShrink: 0, overflow: 'hidden', background: 'var(--paper2)', position: 'relative' }}>
                    <ProductImage src={item.image_url} alt={brandPlusName(item.brand, item.name)} width={48} height={48} />
                    <span style={{ position: 'absolute', top: -6, right: -6, background: 'var(--ink-900)', color: 'var(--paper)', width: 18, height: 18, borderRadius: '50%', fontSize: '0.625rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{item.qty}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{item.name}</div>
                    {(item.variant_label ?? item.variant) && (
                      <div className="small-text" style={{ fontSize: '0.6875rem' }}>{item.variant_label ?? item.variant}</div>
                    )}
                  </div>
                  <span className="tabular-nums" style={{ fontSize: '0.8125rem', fontWeight: 500, flexShrink: 0 }}>£{(item.price * item.qty).toLocaleString()}</span>
                </div>
              ))}
              <hr className="hairline" style={{ margin: '16px 0' }} />

              {!cartCoupon ? (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      aria-label="Coupon code"
                      value={couponCode}
                      onChange={e => { setCouponCode(e.target.value); setCouponError(''); }}
                      placeholder="Coupon code"
                      style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 6, fontSize: '0.8125rem', outline: 'none', background: 'white', fontFamily: 'monospace', textTransform: 'uppercase' }}
                    />
                    <button onClick={applyCoupon} disabled={couponLoading} style={{
                      padding: '8px 14px', background: '#111827', color: 'white', border: 'none',
                      borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, cursor: couponLoading ? 'not-allowed' : 'pointer',
                    }}>
                      {couponLoading ? '…' : 'Apply'}
                    </button>
                  </div>
                  {couponError && <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--error)' }}>{couponError}</p>}
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '8px 10px', background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0' }}>
                  <span style={{ fontSize: '0.8125rem', color: '#15803d', fontWeight: 600 }}>
                    ✓ {cartCoupon.code} {cartCoupon.type === 'percent' ? `(${cartCoupon.value}% off)` : `(£${cartCoupon.value} off)`}
                  </span>
                  <button type="button" aria-label="Remove coupon" onClick={() => { setCouponCode(''); setAppliedCoupon(null); }} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '1rem', width: 36, height: 36, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
                </div>
              )}

              {/* Loyalty points redemption (only when signed in with balance) */}
              {loyalty && loyalty.points_balance > 0 && (
                <div style={{ marginBottom: 12, padding: '8px 10px', background: '#fffbeb', borderRadius: 6, border: '1px solid #fde68a' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: '0.75rem', color: '#92400e', fontWeight: 600 }}>★ {loyalty.points_balance.toLocaleString()} points available</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        aria-label="Points to redeem"
                        type="number" min={0} max={Math.min(loyalty.points_balance, beforeRewards)}
                        value={pointsRedeemInput}
                        onChange={e => {
                          const n = e.target.value === '' ? '' : Math.max(0, Math.min(loyalty.points_balance, Number(e.target.value)));
                          setPointsRedeemInput(n);
                          setPointsRedeem(typeof n === 'number' ? n : 0);
                        }}
                        placeholder="0"
                        style={{ width: 70, padding: '4px 6px', fontSize: '0.75rem', border: '1px solid #fde68a', borderRadius: 4, outline: 'none', background: 'white', fontFamily: 'monospace' }}
                      />
                      <button onClick={() => {
                        const max = Math.min(loyalty.points_balance, beforeRewards);
                        setPointsRedeemInput(max);
                        setPointsRedeem(max);
                      }} style={{ background: 'none', border: 'none', color: '#92400e', cursor: 'pointer', fontSize: '0.6875rem', fontWeight: 600 }}>Use max</button>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="small-text">Subtotal</span>
                <span className="small-text tabular-nums" style={{ fontWeight: 500 }}>£{subtotal.toLocaleString()}</span>
              </div>
              {discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="small-text" style={{ color: '#15803d' }}>Discount</span>
                  <span className="small-text tabular-nums" style={{ fontWeight: 500, color: '#15803d' }}>− £{discount.toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="small-text">Shipping{shippingInfo.label ? ` (${shippingInfo.label})` : ''}</span>
                <span className="small-text tabular-nums" style={{ fontWeight: 500, color: shipping === 0 ? 'var(--success)' : 'inherit' }}>{shipping === 0 ? 'FREE' : `£${shipping}`}</span>
              </div>
              {pointsCovers > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="small-text" style={{ color: '#92400e' }}>Loyalty points</span>
                  <span className="small-text tabular-nums" style={{ fontWeight: 500, color: '#92400e' }}>− £{pointsCovers.toLocaleString()}</span>
                </div>
              )}
              <hr className="hairline" style={{ margin: '16px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                <span className="h3">Due now</span>
                <span className="h3 tabular-nums">£{total.toLocaleString()}</span>
              </div>
              {submitError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#dc2626', fontSize: '0.8125rem' }}>
                  {submitError}
                </div>
              )}
              <button className="btn-primary" style={{ width: '100%' }} onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Placing Order…' : 'Place Order'}
              </button>
              <p className="small-text" style={{ textAlign: 'center', marginTop: 12, color: 'var(--ink-500)' }}>Secure checkout · UK delivery</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
