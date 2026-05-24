'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  addSubscriber,
  updateSubscriber,
  setSubscriberUnsubscribed,
} from '@/app/admin/newsletter/actions';

export interface Subscriber {
  id: string;
  email: string;
  source: string;
  unsubscribed_at: string | null;
  created_at: string;
}

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// Source values stored by the signup flows ('footer', 'modal', 'checkout', …) —
// shown as a friendlier label where one is known.
const SOURCE_LABEL: Record<string, string> = {
  footer: 'Footer form',
  modal: 'Popup',
  checkout: 'Checkout',
  admin: 'Added manually',
};

type StatusFilter = 'all' | 'active' | 'unsubscribed';

export function SubscriberList({ subscribers }: { subscribers: Subscriber[] }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const activeTotal = useMemo(
    () => subscribers.filter(s => !s.unsubscribed_at).length,
    [subscribers],
  );
  const unsubTotal = subscribers.length - activeTotal;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return subscribers.filter(s => {
      if (status === 'active' && s.unsubscribed_at) return false;
      if (status === 'unsubscribed' && !s.unsubscribed_at) return false;
      if (needle && !s.email.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [subscribers, q, status]);

  const chip = (key: StatusFilter): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600,
    cursor: 'pointer', border: '1px solid',
    borderColor: status === key ? '#4A1A6B' : '#e5e7eb',
    background: status === key ? '#F5EFF8' : 'white',
    color: status === key ? '#4A1A6B' : '#6b7280',
  });

  const runAction = (label: string, fn: () => Promise<{ ok: boolean; error?: string }>, onSuccess?: () => void) => {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        setFeedback({ kind: 'ok', text: `${label} successful.` });
        onSuccess?.();
      } else {
        setFeedback({ kind: 'err', text: res.error ?? `${label} failed.` });
      }
    });
  };

  return (
    <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: 28 }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Subscribers</h2>
        <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
          <strong style={{ color: '#111827' }}>{activeTotal}</strong> active
          {unsubTotal > 0 && <> · {unsubTotal} unsubscribed</>}
        </span>
      </div>

      <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <input
          type="search"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search by email…"
          style={{
            flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 8,
            border: '1px solid #d1d5db', fontSize: '0.875rem', color: '#111827',
            outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
          }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" style={chip('all')} onClick={() => setStatus('all')}>All</button>
          <button type="button" style={chip('active')} onClick={() => setStatus('active')}>Active</button>
          <button type="button" style={chip('unsubscribed')} onClick={() => setStatus('unsubscribed')}>Unsubscribed</button>
        </div>
        <button
          type="button"
          onClick={() => { setShowAdd(v => !v); setFeedback(null); }}
          style={{
            padding: '7px 14px', background: showAdd ? '#f3f4f6' : '#4A1A6B',
            color: showAdd ? '#374151' : 'white',
            border: 'none', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
          }}
        >
          {showAdd ? 'Cancel' : '+ Add subscriber'}
        </button>
      </div>

      {showAdd && (
        <AddSubscriberRow
          pending={pending}
          onSubmit={(email, source) =>
            runAction('Add', () => addSubscriber(email, source), () => setShowAdd(false))
          }
        />
      )}

      {feedback && (
        <div
          role="status"
          style={{
            padding: '10px 20px', fontSize: '0.8125rem',
            background: feedback.kind === 'ok' ? '#f0fdf4' : '#fef2f2',
            color: feedback.kind === 'ok' ? '#166534' : '#991b1b',
            borderBottom: '1px solid #f3f4f6',
          }}
        >
          {feedback.text}
        </div>
      )}

      {subscribers.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
          No subscribers yet — sign-ups from the footer, popup, and checkout will appear here.
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
          No subscribers match this search.
        </div>
      ) : (
        <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {['Email', 'Source', 'Status', 'Subscribed', ''].map((h, i) => (
                <th key={i} scope="col" style={{ padding: '11px 20px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => {
              const active = !s.unsubscribed_at;
              const isEditing = editingId === s.id;
              return isEditing ? (
                <EditRow
                  key={s.id}
                  subscriber={s}
                  pending={pending}
                  borderTop={i > 0}
                  onSave={(email, source) =>
                    runAction('Update', () => updateSubscriber(s.id, email, source), () => setEditingId(null))
                  }
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <tr key={s.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                  <td data-label="Email" style={{ padding: '12px 20px', fontSize: '0.875rem', fontWeight: 500, color: '#111827', wordBreak: 'break-all' }}>
                    {s.email}
                  </td>
                  <td data-label="Source" style={{ padding: '12px 20px', fontSize: '0.8125rem', color: '#6b7280' }}>
                    {SOURCE_LABEL[s.source] ?? s.source}
                  </td>
                  <td data-label="Status" style={{ padding: '12px 20px' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 9px', borderRadius: 999,
                      fontSize: '0.6875rem', fontWeight: 700,
                      background: active ? '#dcfce7' : '#f3f4f6',
                      color: active ? '#166534' : '#6b7280',
                    }}>
                      {active ? 'Subscribed' : 'Unsubscribed'}
                    </span>
                  </td>
                  <td data-label="Subscribed" style={{ padding: '12px 20px', fontSize: '0.8125rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                    {fmtDate(s.created_at)}
                  </td>
                  <td data-label="Actions" style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={() => { setEditingId(s.id); setFeedback(null); }}
                        disabled={pending}
                        style={{
                          padding: '5px 12px', background: '#f3f4f6', color: '#374151',
                          border: 'none', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 500,
                          cursor: pending ? 'not-allowed' : 'pointer',
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          runAction(
                            active ? 'Unsubscribe' : 'Resubscribe',
                            () => setSubscriberUnsubscribed(s.id, active),
                          )
                        }
                        disabled={pending}
                        style={{
                          padding: '5px 12px',
                          background: active ? '#fef2f2' : '#f0fdf4',
                          color: active ? '#dc2626' : '#166534',
                          border: 'none', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 500,
                          cursor: pending ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {active ? 'Unsubscribe' : 'Resubscribe'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function AddSubscriberRow({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (email: string, source: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [source, setSource] = useState('admin');
  return (
    <form
      onSubmit={e => { e.preventDefault(); onSubmit(email, source); }}
      style={{
        padding: '14px 20px', borderBottom: '1px solid #f3f4f6',
        background: '#fafafa', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
      }}
    >
      <input
        type="email"
        required
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="customer@example.com"
        autoFocus
        style={{
          flex: 2, minWidth: 220, padding: '8px 12px', borderRadius: 8,
          border: '1px solid #d1d5db', fontSize: '0.875rem', color: '#111827',
          outline: 'none', fontFamily: 'inherit',
        }}
      />
      <select
        value={source}
        onChange={e => setSource(e.target.value)}
        style={{
          minWidth: 140, padding: '8px 12px', borderRadius: 8,
          border: '1px solid #d1d5db', fontSize: '0.875rem', color: '#111827',
          background: 'white', fontFamily: 'inherit',
        }}
      >
        <option value="admin">Added manually</option>
        <option value="footer">Footer form</option>
        <option value="modal">Popup</option>
        <option value="checkout">Checkout</option>
      </select>
      <button
        type="submit"
        disabled={pending || !email.trim()}
        style={{
          padding: '8px 16px', background: '#4A1A6B', color: 'white',
          border: 'none', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600,
          cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.6 : 1,
        }}
      >
        {pending ? 'Adding…' : 'Add'}
      </button>
    </form>
  );
}

function EditRow({
  subscriber,
  pending,
  borderTop,
  onSave,
  onCancel,
}: {
  subscriber: Subscriber;
  pending: boolean;
  borderTop: boolean;
  onSave: (email: string, source: string) => void;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState(subscriber.email);
  const [source, setSource] = useState(subscriber.source || 'admin');
  return (
    <tr style={{ borderTop: borderTop ? '1px solid #f3f4f6' : 'none', background: '#fafafa' }}>
      <td colSpan={5} style={{ padding: '14px 20px' }}>
        <form
          onSubmit={e => { e.preventDefault(); onSave(email, source); }}
          style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}
        >
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoFocus
            style={{
              flex: 2, minWidth: 220, padding: '8px 12px', borderRadius: 8,
              border: '1px solid #d1d5db', fontSize: '0.875rem', color: '#111827',
              outline: 'none', fontFamily: 'inherit',
            }}
          />
          <select
            value={source}
            onChange={e => setSource(e.target.value)}
            style={{
              minWidth: 140, padding: '8px 12px', borderRadius: 8,
              border: '1px solid #d1d5db', fontSize: '0.875rem', color: '#111827',
              background: 'white', fontFamily: 'inherit',
            }}
          >
            <option value="admin">Added manually</option>
            <option value="footer">Footer form</option>
            <option value="modal">Popup</option>
            <option value="checkout">Checkout</option>
          </select>
          <button
            type="submit"
            disabled={pending}
            style={{
              padding: '8px 16px', background: '#10b981', color: 'white',
              border: 'none', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600,
              cursor: pending ? 'not-allowed' : 'pointer',
            }}
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            style={{
              padding: '8px 16px', background: '#f3f4f6', color: '#374151',
              border: 'none', borderRadius: 6, fontSize: '0.8125rem', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </form>
      </td>
    </tr>
  );
}
