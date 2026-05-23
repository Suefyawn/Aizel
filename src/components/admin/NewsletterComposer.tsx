'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/admin/Toast';
import { sendNewsletterCampaign } from '@/app/admin/newsletter/actions';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid #d1d5db', fontSize: '0.875rem', fontFamily: 'inherit',
  color: '#111827', outline: 'none', boxSizing: 'border-box',
};

export function NewsletterComposer({ activeCount }: { activeCount: number }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const handleSend = () => {
    if (pending) return;
    if (!subject.trim() || !body.trim()) {
      toast('Add a subject and a body first.', 'error');
      return;
    }
    if (activeCount === 0) {
      toast('There are no active subscribers to send to.', 'error');
      return;
    }
    if (!window.confirm(
      `Send "${subject.trim()}" to ${activeCount} subscriber${activeCount === 1 ? '' : 's'}?\n\nThis sends real emails and can't be undone.`,
    )) return;

    startTransition(async () => {
      const res = await sendNewsletterCampaign(subject.trim(), body.trim());
      if (!res.ok) {
        toast(res.error, 'error');
        return;
      }
      if (res.sentCount === 0) {
        toast('Sent to 0 subscribers — check the email (Resend) setup.', 'error');
      } else {
        toast(`Newsletter sent to ${res.sentCount} of ${res.recipientCount} subscriber${res.recipientCount === 1 ? '' : 's'}.`, 'success');
        setSubject('');
        setBody('');
      }
      router.refresh();
    });
  };

  return (
    <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '20px 24px', marginBottom: 28 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Compose newsletter</h2>
      <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: '#6b7280' }}>
        Goes to all {activeCount} active subscriber{activeCount === 1 ? '' : 's'}. Leave a blank line
        between paragraphs; web links (https://…) become clickable automatically. Aizel branding
        and an unsubscribe link are added for you.
      </p>

      <label style={{ display: 'block', marginBottom: 14 }}>
        <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Subject</span>
        <input
          type="text"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          maxLength={200}
          placeholder="e.g. New arrivals + a little something for you"
          style={inputStyle}
        />
      </label>

      <label style={{ display: 'block', marginBottom: 16 }}>
        <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Body</span>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          maxLength={20000}
          rows={12}
          placeholder={'Hi there,\n\nHere’s what’s new this fortnight…\n\nShop the latest: https://aizel.co.uk/shop'}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
        />
      </label>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={handleSend}
          disabled={pending || activeCount === 0}
          style={{
            padding: '10px 20px', borderRadius: 8, border: 'none',
            background: pending || activeCount === 0 ? '#9ca3af' : '#C5286A',
            color: 'white', fontSize: '0.875rem', fontWeight: 600,
            cursor: pending || activeCount === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          {pending ? 'Sending…' : `Send to ${activeCount} subscriber${activeCount === 1 ? '' : 's'}`}
        </button>
        {pending && (
          <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>Sending emails — this can take a few seconds.</span>
        )}
      </div>
    </div>
  );
}
