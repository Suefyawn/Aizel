export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { DeleteButton } from '@/components/admin/DeleteButton';
import { createPromo, updatePromo, togglePromo, deletePromo } from '@/app/admin/promo-actions';
import type { Promo } from '@/lib/promos';

// Lightweight CMS for the top-bar + hero-strip promos. Authors a row in
// `promos`; the storefront's getActivePromos() picks the best fit per slot
// per request. Schedule + audience are optional — leave both blank and
// the row is treated as always-live + everyone-targeted.

const fmtDateTime = (s: string | null) =>
  s ? new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

const inp: React.CSSProperties = {
  padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7,
  fontSize: '0.875rem', color: '#111827', background: 'white', outline: 'none',
};

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={wide ? { gridColumn: '1 / -1' } : undefined}>
      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

// Shared field set for the create + edit forms. `promo` non-null = edit mode.
// datetime-local needs a `YYYY-MM-DDTHH:mm` value, so stored ISO timestamps
// are sliced to 16 chars for the default.
function PromoFields({ promo }: { promo?: Promo }) {
  return (
    <>
      <Field label="Slot">
        <select name="position" style={inp} defaultValue={promo?.position ?? 'top_bar'} required>
          <option value="top_bar">Top bar (thin)</option>
          <option value="hero_strip">Hero strip (card)</option>
        </select>
      </Field>
      <Field label="Kind">
        <select name="kind" style={inp} defaultValue={promo?.kind ?? 'announcement'} required>
          <option value="announcement">Announcement</option>
          <option value="promo">Promo</option>
        </select>
      </Field>
      <Field label="Label (pill)">
        <input name="label" placeholder="NEW" defaultValue={promo?.label ?? ''} style={inp} />
      </Field>
      <Field label="Headline" wide>
        <input name="headline" required placeholder="Free UK delivery over £15 · Cantu, ORS, Palmer's & more" defaultValue={promo?.headline ?? ''} style={inp} />
      </Field>
      <Field label="Subline" wide>
        <input name="subline" placeholder="(optional)" defaultValue={promo?.subline ?? ''} style={inp} />
      </Field>
      <Field label="CTA text">
        <input name="cta_text" placeholder="Shop now" defaultValue={promo?.cta_text ?? ''} style={inp} />
      </Field>
      <Field label="CTA URL">
        <input name="cta_url" placeholder="/shop" defaultValue={promo?.cta_url ?? ''} style={inp} />
      </Field>
      <Field label="Background">
        <input name="bg_color" type="color" defaultValue={promo?.bg_color ?? '#111827'} style={{ ...inp, padding: 4, height: 36 }} />
      </Field>
      <Field label="Text colour">
        <input name="text_color" type="color" defaultValue={promo?.text_color ?? '#ffffff'} style={{ ...inp, padding: 4, height: 36 }} />
      </Field>
      <Field label="Start at">
        <input name="start_at" type="datetime-local" defaultValue={promo?.start_at ? promo.start_at.slice(0, 16) : ''} style={inp} />
      </Field>
      <Field label="End at">
        <input name="end_at" type="datetime-local" defaultValue={promo?.end_at ? promo.end_at.slice(0, 16) : ''} style={inp} />
      </Field>
      <Field label="Audience">
        <select name="audience" style={inp} defaultValue={promo?.audience ?? ''}>
          <option value="">Everyone</option>
          <option value="guest">Guests (not logged in)</option>
          <option value="logged_in">Logged-in customers</option>
          <option value="first_time">First-time (no orders yet)</option>
          <option value="returning">Returning (≥1 order)</option>
        </select>
      </Field>
      <Field label="Priority (higher wins)">
        <input name="priority" type="number" min={0} max={1000} defaultValue={promo?.priority ?? 0} style={inp} />
      </Field>
      <Field label="Countdown timer">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem' }}>
          <input type="checkbox" name="show_countdown" value="true" defaultChecked={promo?.show_countdown ?? false} /> Show on hero strip
        </label>
      </Field>
      <Field label="Enabled">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem' }}>
          <input type="checkbox" name="enabled" value="true" defaultChecked={promo ? promo.enabled : true} /> Active
        </label>
      </Field>
    </>
  );
}

export default async function AdminPromosPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('promos')) {
    return <NoAccess section="Promos" />;
  }

  const { data } = await supabase
    .from('promos')
    .select('*')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });

  const rows = (data ?? []) as Promo[];
  const { edit } = await searchParams;
  const editingPromo = edit ? rows.find(p => p.id === edit) ?? null : null;

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div className="adm-page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Promos</h1>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
            {rows.length} promo{rows.length !== 1 ? 's' : ''} · Scheduled, audience-targeted announcement &amp; hero-strip CMS
          </p>
        </div>
      </div>

      {editingPromo ? (
        /* Edit form */
        <div style={{ background: 'white', borderRadius: 10, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Edit promo</h2>
            <Link href="/admin/promos" style={{ fontSize: '0.8125rem', color: '#6b7280', textDecoration: 'none' }}>Cancel</Link>
          </div>
          <form
            action={updatePromo.bind(null, editingPromo.id)}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}
          >
            <PromoFields promo={editingPromo} />
            <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
              <button type="submit" style={{
                padding: '10px 24px', background: '#4A1A6B', color: 'white',
                border: 'none', borderRadius: 7, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
              }}>Save changes</button>
            </div>
          </form>
        </div>
      ) : (
        /* Create form */
        <details
          style={{ background: 'white', borderRadius: 10, padding: '12px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 24 }}
          open={rows.length === 0}
        >
          <summary style={{ cursor: 'pointer', fontSize: '0.9375rem', fontWeight: 600, color: '#111827', padding: '8px 0' }}>
            + New promo
          </summary>
          <form
            action={createPromo}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginTop: 16 }}
          >
            <PromoFields />
            <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
              <button type="submit" style={{
                padding: '10px 24px', background: '#4A1A6B', color: 'white',
                border: 'none', borderRadius: 7, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
              }}>Create promo</button>
            </div>
          </form>
        </details>
      )}

      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {rows.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            No promos yet — the storefront falls back to the legacy site-settings bars until you create one.
          </div>
        ) : (
          <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Slot', 'Headline', 'Audience', 'Window', 'Priority', 'Status', ''].map(h => (
                  <th scope="col" key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => {
                const live = p.enabled
                  && (!p.start_at || new Date(p.start_at) <= new Date())
                  && (!p.end_at   || new Date(p.end_at)   >  new Date());
                return (
                  <tr key={p.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none', background: editingPromo?.id === p.id ? '#fdf2f8' : live ? '' : '#f9fafb' }}>
                    <td data-label="Slot" style={{ padding: '12px 16px', fontSize: '0.8125rem', color: '#374151', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 600 }}>{p.position === 'top_bar' ? 'Top bar' : 'Hero strip'}</div>
                      <div style={{ fontSize: '0.6875rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{p.kind}</div>
                    </td>
                    <td data-label="Headline" style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#111827', maxWidth: 360 }}>
                      <div style={{ fontWeight: 600 }}>{p.headline}</div>
                      {p.subline && <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 2 }}>{p.subline}</div>}
                    </td>
                    <td data-label="Audience" style={{ padding: '12px 16px', fontSize: '0.8125rem', color: '#374151' }}>
                      {p.audience ?? 'Everyone'}
                    </td>
                    <td data-label="Window" style={{ padding: '12px 16px', fontSize: '0.75rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                      <div>From: {fmtDateTime(p.start_at)}</div>
                      <div>Until: {fmtDateTime(p.end_at)}</div>
                    </td>
                    <td data-label="Priority" style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#374151', textAlign: 'center' }}>
                      {p.priority}
                    </td>
                    <td data-label="Status" style={{ padding: '12px 16px' }}>
                      <form action={togglePromo.bind(null, p.id, !p.enabled)}>
                        <button type="submit" style={{
                          padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                          background: live ? '#f0fdf4' : '#f3f4f6',
                          color: live ? '#15803d' : '#9ca3af',
                          minHeight: 30,
                        }}>
                          {p.enabled ? (live ? 'Live' : 'Scheduled') : 'Paused'}
                        </button>
                      </form>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'flex-end' }}>
                        <Link href={`/admin/promos?edit=${p.id}`} style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#4A1A6B', textDecoration: 'none' }}>
                          Edit
                        </Link>
                        <DeleteButton id={p.id} action={deletePromo} confirmMsg={`Delete "${p.headline.slice(0, 40)}…"?`} />
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
