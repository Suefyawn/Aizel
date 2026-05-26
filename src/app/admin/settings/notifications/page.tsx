export const dynamic = 'force-dynamic';

import { DeleteButton } from '@/components/admin/DeleteButton';
import { SettingsPageHeader, StatusBanner } from '@/components/admin/settings-controls';
import {
  listAllRecipients, fallbackRecipientEmail, NOTIFICATION_EVENTS,
  type NotificationRecipient, type NotificationEvent,
} from '@/lib/notification-recipients';
import { addRecipient, updateRecipient, deleteRecipient } from './actions';

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid #d1d5db',
  borderRadius: 8, fontSize: '0.875rem', color: '#111827',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};

function EventCheckboxes({ namePrefix = 'events', selected }: { namePrefix?: string; selected: NotificationEvent[] }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {NOTIFICATION_EVENTS.map(ev => (
        <label key={ev.key} style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '10px 12px', borderRadius: 8,
          background: '#fafafa', border: '1px solid #f3f4f6',
          cursor: 'pointer',
        }}>
          <input
            type="checkbox"
            name={namePrefix}
            value={ev.key}
            defaultChecked={selected.includes(ev.key)}
            style={{ marginTop: 3, width: 16, height: 16, accentColor: '#6366f1', cursor: 'pointer' }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>{ev.label}</div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2, lineHeight: 1.5 }}>{ev.desc}</div>
          </div>
        </label>
      ))}
    </div>
  );
}

function RecipientRow({ r }: { r: NotificationRecipient }) {
  return (
    <div style={{
      background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      padding: 20, marginBottom: 12,
    }}>
      <form action={updateRecipient.bind(null, r.id)} style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: '#F5EFF8', color: '#4A1A6B',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: '0.875rem', flexShrink: 0,
            }}>
              {r.email.charAt(0).toUpperCase()}
            </div>
            <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.email}
            </div>
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', flexShrink: 0 }}>
            <input type="hidden" name="enabled" value="false" />
            <input type="checkbox" name="enabled" value="true" defaultChecked={r.enabled}
              style={{ width: 16, height: 16, accentColor: '#6366f1', cursor: 'pointer' }} />
            <span style={{ fontSize: '0.8125rem', color: '#374151', fontWeight: 500 }}>
              {r.enabled ? 'Active' : 'Paused'}
            </span>
          </label>
        </div>

        <EventCheckboxes selected={r.events} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <button type="submit" style={{
            padding: '8px 18px', background: '#111827', color: 'white',
            border: 'none', borderRadius: 7, fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer',
          }}>
            Save
          </button>
          <DeleteButton id={r.id} action={deleteRecipient} confirmMsg={`Remove ${r.email} from notifications?`} />
        </div>
      </form>
    </div>
  );
}

export default async function SettingsNotificationsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const [recipients, sp] = await Promise.all([listAllRecipients(), searchParams]);
  const fallback = fallbackRecipientEmail();

  return (
    <>
      <SettingsPageHeader
        title="Notifications"
        subtitle="Who receives the internal alerts the system sends — new orders, low stock. Each recipient picks which events they want."
      />
      <StatusBanner saved={sp.saved === '1'} saveError={sp.error} />

      {/* Fallback explainer */}
      {fallback ? (
        <div style={{
          background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8,
          padding: '12px 16px', marginBottom: 24, color: '#1e40af',
          fontSize: '0.8125rem', lineHeight: 1.6,
        }}>
          <strong>Fallback:</strong> if nobody is configured for an event, the
          alert goes to <code style={{ background: '#dbeafe', padding: '1px 6px', borderRadius: 4 }}>{fallback}</code> (the
          <code style={{ background: '#dbeafe', padding: '1px 6px', borderRadius: 4 }}>OWNER_EMAIL</code> env var). Add a recipient
          below to take over.
        </div>
      ) : (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
          padding: '12px 16px', marginBottom: 24, color: '#991b1b',
          fontSize: '0.8125rem', lineHeight: 1.6,
        }}>
          <strong>No fallback configured.</strong> The
          <code style={{ background: '#fee2e2', padding: '1px 6px', borderRadius: 4, margin: '0 4px' }}>OWNER_EMAIL</code>
          env var is unset, so internal alerts are silently dropped when no
          recipient subscribes to an event. Add a recipient below for every
          event you care about, or set <code style={{ background: '#fee2e2', padding: '1px 6px', borderRadius: 4 }}>OWNER_EMAIL</code> in
          your Vercel project settings.
        </div>
      )}

      {/* Add new recipient */}
      <div style={{
        background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        padding: 24, marginBottom: 24,
      }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
          Add a recipient
        </h2>
        <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: '#6b7280' }}>
          Each staff member gets one row. Pick the events they should receive.
        </p>

        <form action={addRecipient} style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>
              Email
            </label>
            <input
              name="email"
              type="email"
              required
              placeholder="ops@aizel.co.uk"
              style={inp}
            />
          </div>

          <div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 8 }}>
              Subscribe to
            </div>
            <EventCheckboxes selected={[]} />
          </div>

          <div>
            <button type="submit" style={{
              padding: '10px 22px', background: '#4A1A6B', color: 'white',
              border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
            }}>
              Add recipient
            </button>
          </div>
        </form>
      </div>

      {/* List of existing recipients */}
      <h2 style={{ margin: '0 0 12px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
        Recipients ({recipients.length})
      </h2>

      {recipients.length === 0 ? (
        <div style={{
          background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          padding: '40px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem',
        }}>
          {fallback
            ? 'No recipients yet — alerts go to the fallback address above.'
            : 'No recipients yet. With no fallback configured, internal alerts are being dropped — add at least one recipient.'}
        </div>
      ) : (
        recipients.map(r => <RecipientRow key={r.id} r={r} />)
      )}
    </>
  );
}
