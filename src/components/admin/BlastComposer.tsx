'use client';

import { useState, useTransition } from 'react';
import { useToast } from '@/components/admin/Toast';
import { sendBlast, type SegmentSummary, type SegmentKey } from '@/app/admin/marketing/blast/actions';

interface Props {
  segments: SegmentSummary[];
}

// Three-step composer: pick segment → write subject + body → preview + send.
// Test-send and real-send are the same button shape so the operator doesn't
// misclick — both go through a confirm dialog with the recipient count.
export function BlastComposer({ segments }: Props) {
  const [segment, setSegment] = useState<SegmentKey>(segments[0]?.key ?? 'newsletter');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const selected = segments.find(s => s.key === segment);
  const canSend = subject.trim().length > 0 && body.trim().length >= 30 && !pending;

  function doSend(testOnly: boolean) {
    if (!canSend) return;
    const confirmCopy = testOnly
      ? 'Send a test copy to your staff email only?'
      : `Send "${subject}" to ${selected?.count ?? 0} customers in segment "${selected?.label}"? Sends are NOT reversible.`;
    if (!window.confirm(confirmCopy)) return;

    startTransition(async () => {
      const result = await sendBlast({ segment, subject, body, testOnly });
      if (!result.ok) {
        toast(result.error ?? 'Send failed', 'error');
        return;
      }
      toast(testOnly
        ? 'Test email sent — check your inbox'
        : `Sent to ${result.sent} customer${result.sent !== 1 ? 's' : ''}${result.skipped ? ` (${result.skipped} skipped)` : ''}`,
        'success');
      if (!testOnly) {
        // Clear the composer after a real send so a refresh doesn't
        // accidentally re-fire the same blast.
        setSubject('');
        setBody('');
      }
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Segment picker ──────────────────────────────────────────── */}
      <section style={cardStyle}>
        <h2 style={h2Style}>1. Choose a segment</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {segments.map(s => (
            <label
              key={s.key}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '12px 14px', cursor: 'pointer',
                border: '1px solid ' + (segment === s.key ? '#4A1A6B' : '#e5e7eb'),
                background: segment === s.key ? '#F5EFF8' : 'white',
                borderRadius: 8, transition: 'all 150ms',
              }}
            >
              <input
                type="radio" name="segment" value={s.key}
                checked={segment === s.key}
                onChange={() => setSegment(s.key)}
                style={{ marginTop: 3, accentColor: '#4A1A6B' }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827' }}>{s.label}</span>
                  <span style={{
                    fontSize: '0.6875rem', fontWeight: 700, color: '#4A1A6B',
                    background: '#EDE9FE', padding: '2px 8px', borderRadius: 20,
                  }}>
                    {s.count} recipient{s.count !== 1 ? 's' : ''}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>{s.description}</div>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* ── Compose ─────────────────────────────────────────────────── */}
      <section style={cardStyle}>
        <h2 style={h2Style}>2. Compose</h2>
        <label style={lblStyle}>Subject</label>
        <input
          value={subject}
          onChange={e => setSubject(e.target.value)}
          maxLength={120}
          placeholder="What's new at Aizel"
          style={{ ...inputStyle, marginBottom: 12 }}
        />
        <label style={lblStyle}>Body (HTML allowed — &lt;p&gt;, &lt;a&gt;, &lt;strong&gt;)</label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={10}
          placeholder={'<p>This month we added Eco Style Olive Oil Gel and restocked the entire Cantu Curl line.</p>\n<p><a href="https://aizel.co.uk/shop?taxon=hair">Browse what\'s new →</a></p>'}
          style={{ ...inputStyle, fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: '0.8125rem', resize: 'vertical' }}
        />
        <p style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: 6 }}>
          The Aizel branded header + footer + unsubscribe link are added automatically.
        </p>
      </section>

      {/* ── Preview ─────────────────────────────────────────────────── */}
      <section style={cardStyle}>
        <h2 style={h2Style}>3. Preview</h2>
        <div style={{
          padding: '16px 20px', background: '#f9fafb',
          border: '1px solid #e5e7eb', borderRadius: 8,
        }}>
          <div style={{ fontSize: '0.6875rem', color: '#6b7280', marginBottom: 4 }}>SUBJECT</div>
          <div style={{ fontWeight: 600, color: '#111827', marginBottom: 16 }}>
            {subject || <span style={{ color: '#9ca3af' }}>—</span>}
          </div>
          <div style={{ fontSize: '0.6875rem', color: '#6b7280', marginBottom: 4 }}>BODY</div>
          {body
            ? <div dangerouslySetInnerHTML={{ __html: body }} style={{ color: '#374151', lineHeight: 1.5 }} />
            : <span style={{ color: '#9ca3af' }}>—</span>
          }
        </div>
      </section>

      {/* ── Send ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button
          type="button"
          onClick={() => doSend(true)}
          disabled={!canSend}
          style={{
            padding: '10px 18px',
            background: 'transparent', color: canSend ? '#4A1A6B' : '#9ca3af',
            border: '1px solid ' + (canSend ? '#4A1A6B' : '#e5e7eb'),
            borderRadius: 8, fontSize: '0.875rem', fontWeight: 600,
            cursor: canSend ? 'pointer' : 'not-allowed', minHeight: 40,
          }}
        >
          Send test to me
        </button>
        <button
          type="button"
          onClick={() => doSend(false)}
          disabled={!canSend}
          style={{
            padding: '10px 22px',
            background: canSend ? '#dc2626' : '#9ca3af', color: 'white',
            border: 'none', borderRadius: 8,
            fontSize: '0.9375rem', fontWeight: 600,
            cursor: canSend ? 'pointer' : 'not-allowed', minHeight: 40,
          }}
        >
          {pending ? 'Sending…' : `Send to ${selected?.count ?? 0} customer${selected?.count !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: 'white', borderRadius: 10,
  padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};
const h2Style: React.CSSProperties = {
  margin: '0 0 14px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827',
};
const lblStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4,
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  border: '1px solid #d1d5db', borderRadius: 7,
  fontSize: '0.875rem', color: '#111827', background: 'white',
  outline: 'none', boxSizing: 'border-box',
};
