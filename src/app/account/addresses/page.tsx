'use client';

import { useActionState, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getBrowserClient } from '@/lib/supabase-browser';
import { Skeleton } from '@/components/ui/Skeleton';
import { createAddress, updateAddress, deleteAddress, setDefaultAddress } from './actions';
import type { Address } from '@/types';

// UK nations + a "Crown Dependencies" catch-all for Channel Islands / IoM
// shoppers (which often need different shipping rules). The DB column is
// still called `province` for backwards-compatibility with existing rows;
// the customer-facing label below reads "County / Region".
const PROVINCES = ['England', 'Scotland', 'Wales', 'Northern Ireland', 'Channel Islands', 'Isle of Man'];

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px',
  border: '1px solid #d1d5db', borderRadius: 8,
  fontSize: '0.875rem', color: '#111827', background: 'white',
  outline: 'none', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 5 };

// Shared create/edit form. `initial` non-null = edit mode (wired to
// updateAddress); null = create mode. Keyed by the parent on the address id
// so switching target gives a fresh useActionState.
function AddressForm({
  initial, onSaved, onCancel,
}: {
  initial: Address | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const boundAction = initial ? updateAddress.bind(null, initial.id) : createAddress;
  const [state, action, pending] = useActionState(boundAction, null);

  useEffect(() => {
    if (state && 'success' in state) onSaved();
  }, [state, onSaved]);

  return (
    <div style={{ background: 'white', borderRadius: 12, padding: 24, border: '1px solid var(--line)' }}>
      <h2 style={{ margin: '0 0 16px', fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 500 }}>
        {initial ? 'Edit address' : 'Add a new address'}
      </h2>
      {state && 'error' in state && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#dc2626', fontSize: '0.875rem' }}>
          {state.error}
        </div>
      )}
      <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label htmlFor="addr-label" style={lbl}>Label (e.g. Home, Office)</label>
          <input id="addr-label" name="label" placeholder="Home" defaultValue={initial?.label ?? ''} style={inp} />
        </div>
        <div className="checkout-name-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label htmlFor="addr-fname" style={lbl}>First Name *</label>
            <input id="addr-fname" name="first_name" autoComplete="given-name" required defaultValue={initial?.first_name ?? ''} style={inp} />
          </div>
          <div>
            <label htmlFor="addr-lname" style={lbl}>Last Name *</label>
            <input id="addr-lname" name="last_name" autoComplete="family-name" required defaultValue={initial?.last_name ?? ''} style={inp} />
          </div>
        </div>
        <div>
          <label htmlFor="addr-phone" style={lbl}>Phone *</label>
          <input id="addr-phone" name="phone" type="tel" autoComplete="tel" required placeholder="07123 456789" defaultValue={initial?.phone ?? ''} style={inp} />
        </div>
        <div>
          <label htmlFor="addr-line1" style={lbl}>Address Line 1 *</label>
          <input id="addr-line1" name="line1" autoComplete="address-line1" required style={inp} placeholder="House/flat name or number, street" defaultValue={initial?.line1 ?? ''} />
        </div>
        <div>
          <label htmlFor="addr-line2" style={lbl}>Address Line 2</label>
          <input id="addr-line2" name="line2" autoComplete="address-line2" style={inp} placeholder="Area, neighbourhood (optional)" defaultValue={initial?.line2 ?? ''} />
        </div>
        <div className="addr-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <label htmlFor="addr-city" style={lbl}>City / Town *</label>
            <input id="addr-city" name="city" autoComplete="address-level2" required defaultValue={initial?.city ?? ''} style={inp} placeholder="London" />
          </div>
          <div>
            <label htmlFor="addr-province" style={lbl}>Country / Region</label>
            <select id="addr-province" name="province" autoComplete="address-level1" defaultValue={initial?.province ?? ''} style={inp}>
              <option value="">Select</option>
              {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="addr-zip" style={lbl}>Postcode *</label>
            {/* `inputMode="text"` (default) — UK postcodes are alphanumeric
                (SW1A 1AA), not pure-digit; the previous `numeric` value
                surfaced the wrong keyboard on phones. */}
            <input id="addr-zip" name="zip" autoComplete="postal-code" required defaultValue={initial?.zip ?? ''} style={inp} placeholder="SW1A 1AA" />
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', color: 'var(--ink-700)' }}>
          <input type="checkbox" name="is_default" defaultChecked={initial?.is_default ?? false} /> Make this my default shipping address
        </label>
        <div style={{ display: 'flex', gap: 12 }}>
          <button type="submit" disabled={pending} style={{
            flex: 1, padding: 12, background: pending ? '#f9a8d4' : 'var(--brand-pink)',
            color: 'white', border: 'none', borderRadius: 8,
            fontSize: '0.9375rem', fontWeight: 600, cursor: pending ? 'not-allowed' : 'pointer',
          }}>
            {pending ? 'Saving…' : initial ? 'Save changes' : 'Save address'}
          </button>
          <button type="button" onClick={onCancel} style={{
            padding: '12px 20px', background: 'transparent', color: 'var(--ink-700)',
            border: '1px solid var(--line)', borderRadius: 8, fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer',
          }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AddressesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  const loadAddresses = useCallback(() => {
    if (!user) return;
    const sb = getBrowserClient();
    sb.from('addresses')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .then(({ data }) => setAddresses((data ?? []) as Address[]));
  }, [user]);

  useEffect(() => { loadAddresses(); }, [loadAddresses]);

  const handleSaved = useCallback(() => {
    setShowForm(false);
    setEditing(null);
    loadAddresses();
  }, [loadAddresses]);

  const handleCancel = useCallback(() => {
    setShowForm(false);
    setEditing(null);
  }, []);

  const startEdit = (addr: Address) => {
    setShowForm(false);
    setEditing(addr);
  };

  if (loading || !user) {
    return (
      <div className="container" style={{ padding: '48px var(--side)' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <Skeleton height={32} width="35%" style={{ marginBottom: 32 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
            {[0, 1].map(i => (
              <div key={i} style={{ background: 'white', borderRadius: 12, padding: 20, border: '1px solid var(--line)' }}>
                <Skeleton height={14} width="40%" style={{ marginBottom: 8 }} />
                <Skeleton height={18} width="60%" style={{ marginBottom: 12 }} />
                <Skeleton height={14} width="80%" style={{ marginBottom: 4 }} />
                <Skeleton height={14} width="70%" style={{ marginBottom: 4 }} />
                <Skeleton height={14} width="50%" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const formOpen = showForm || editing !== null;

  return (
    <div className="container" style={{ padding: '48px var(--side)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <Link href="/account" style={{ color: 'var(--ink-500)', textDecoration: 'none', fontSize: '0.875rem' }}>← Account</Link>
          <span style={{ color: 'var(--line)' }}>/</span>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 500 }}>Addresses</h1>
        </div>

        {addresses == null && <p style={{ color: '#9ca3af' }}>Loading addresses…</p>}

        {addresses && addresses.length === 0 && !formOpen && (
          <div style={{ background: 'white', border: '1px dashed var(--line)', borderRadius: 12, padding: 32, textAlign: 'center' }}>
            <p style={{ color: 'var(--ink-500)', margin: '0 0 16px' }}>No saved addresses yet.</p>
            <button onClick={() => setShowForm(true)} style={{
              padding: '10px 18px', background: 'var(--brand-pink-cta)', color: 'white', border: 'none',
              borderRadius: 8, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
            }}>
              + Add address
            </button>
          </div>
        )}

        {addresses && addresses.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16, marginBottom: 24 }}>
            {addresses.map(addr => (
              <div key={addr.id} style={{
                background: 'white', borderRadius: 12, padding: 20,
                border: editing?.id === addr.id ? '2px solid var(--brand-pink)'
                  : addr.is_default ? '2px solid var(--brand-pink)' : '1px solid var(--line)',
                position: 'relative',
              }}>
                {addr.is_default && (
                  <span style={{
                    position: 'absolute', top: 12, right: 12,
                    background: 'var(--brand-pink-cta)', color: 'white',
                    fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                  }}>DEFAULT</span>
                )}
                <div style={{ fontSize: '0.8125rem', color: 'var(--ink-500)', marginBottom: 4 }}>{addr.label ?? 'Address'}</div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{addr.first_name} {addr.last_name}</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--ink-700)', lineHeight: 1.5 }}>
                  {addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}<br />
                  {addr.city}{addr.province ? `, ${addr.province}` : ''} {addr.zip ?? ''}<br />
                  {addr.phone}
                </div>
                <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => startEdit(addr)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--brand-pink-text)', fontWeight: 600,
                      fontSize: '0.8125rem', padding: 0,
                    }}
                  >
                    Edit
                  </button>
                  {!addr.is_default && (
                    <form action={setDefaultAddress}>
                      <input type="hidden" name="id" value={addr.id} />
                      <button
                        type="submit"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--brand-pink-text)', fontWeight: 600,
                          fontSize: '0.8125rem', padding: 0,
                        }}
                      >
                        Set as default
                      </button>
                    </form>
                  )}
                  <form
                    action={deleteAddress}
                    onSubmit={e => {
                      if (!confirm(`Remove ${addr.label ?? 'this address'}? This can't be undone.`)) {
                        e.preventDefault();
                      }
                    }}
                  >
                    <input type="hidden" name="id" value={addr.id} />
                    <button
                      type="submit"
                      style={{
                        background: 'none', border: 'none', color: '#ef4444',
                        padding: 0, fontSize: '0.8125rem', cursor: 'pointer',
                      }}
                    >
                      Remove
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}

        {addresses && !formOpen && (
          <button onClick={() => setShowForm(true)} style={{
            padding: '10px 18px', background: 'var(--brand-pink)', color: 'white',
            border: 'none', borderRadius: 8, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', marginBottom: 20,
          }}>
            + Add another address
          </button>
        )}

        {formOpen && (
          <AddressForm
            key={editing?.id ?? 'new'}
            initial={editing}
            onSaved={handleSaved}
            onCancel={handleCancel}
          />
        )}
      </div>
    </div>
  );
}
