'use client';

import { useState, useTransition } from 'react';
import { addReview, updateReview, unapproveReview } from '@/app/admin/reviews/actions';

export interface ProductOption {
  id: string;
  brand: string;
  name: string;
}

const fieldStyle: React.CSSProperties = {
  padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7,
  fontSize: '0.875rem', color: '#111827', background: 'white', outline: 'none',
  fontFamily: 'inherit',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: 4,
};

export function AddReviewToggle({ products }: { products: ProductOption[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 28, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: open ? '1px solid #f3f4f6' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
          {open ? 'Add a review' : 'Seed or migrate a review'}
        </h2>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          style={{
            padding: '7px 14px',
            background: open ? '#f3f4f6' : '#4A1A6B',
            color: open ? '#374151' : 'white',
            border: 'none', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
          }}
        >
          {open ? 'Cancel' : '+ Add review'}
        </button>
      </div>
      {open && (
        <form
          action={(fd) => startTransition(() => { void addReview(fd); })}
          style={{ padding: '20px', display: 'grid', gap: 14 }}
        >
          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <div>
              <label style={labelStyle}>Product</label>
              <select name="product_id" required style={{ ...fieldStyle, width: '100%' }} defaultValue="">
                <option value="" disabled>Select a product…</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.brand} — {p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Author name</label>
              <input name="author_name" required minLength={2} maxLength={80} style={{ ...fieldStyle, width: '100%' }} />
            </div>
            <div>
              <label style={labelStyle}>Rating</label>
              <select name="rating" required style={{ ...fieldStyle, width: '100%' }} defaultValue="5">
                {[5, 4, 3, 2, 1].map(n => (
                  <option key={n} value={n}>{'★'.repeat(n)}{'☆'.repeat(5 - n)} ({n})</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Review body</label>
            <textarea
              name="body" required minLength={3} maxLength={4000} rows={4}
              style={{ ...fieldStyle, width: '100%', resize: 'vertical', minHeight: 96 }}
              placeholder="What did the customer say?"
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', color: '#374151' }}>
            <input type="checkbox" name="verified_purchase" />
            Mark as verified purchase
          </label>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setOpen(false)} style={{ padding: '8px 16px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 6, fontSize: '0.875rem', cursor: 'pointer' }}>Cancel</button>
            <button
              type="submit"
              disabled={pending}
              style={{ padding: '8px 18px', background: '#10b981', color: 'white', border: 'none', borderRadius: 6, fontSize: '0.875rem', fontWeight: 600, cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.6 : 1 }}
            >
              {pending ? 'Saving…' : 'Save review'}
            </button>
          </div>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af' }}>
            Reviews added here are approved automatically and appear on the storefront immediately.
          </p>
        </form>
      )}
    </div>
  );
}

export function EditReviewButton({
  id, authorName, rating, body,
}: {
  id: string; authorName: string; rating: number; body: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(authorName);
  const [rate, setRate] = useState(rating);
  const [text, setText] = useState(body);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ padding: '6px 14px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}
      >
        Edit
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Edit review"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16,
      }}
      onClick={() => !pending && setOpen(false)}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        action={(fd) => startTransition(() => { void updateReview(fd); })}
        style={{ background: 'white', borderRadius: 12, padding: 24, width: '100%', maxWidth: 560, display: 'grid', gap: 14 }}
      >
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Edit review</h3>
        <input type="hidden" name="id" value={id} />
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: '2fr 1fr' }}>
          <div>
            <label style={labelStyle}>Author name</label>
            <input
              name="author_name"
              required
              minLength={2}
              maxLength={80}
              value={name}
              onChange={e => setName(e.target.value)}
              style={{ ...fieldStyle, width: '100%' }}
            />
          </div>
          <div>
            <label style={labelStyle}>Rating</label>
            <select
              name="rating"
              required
              value={rate}
              onChange={e => setRate(Number(e.target.value))}
              style={{ ...fieldStyle, width: '100%' }}
            >
              {[5, 4, 3, 2, 1].map(n => (
                <option key={n} value={n}>{'★'.repeat(n)}{'☆'.repeat(5 - n)} ({n})</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Body</label>
          <textarea
            name="body"
            required
            minLength={3}
            maxLength={4000}
            rows={5}
            value={text}
            onChange={e => setText(e.target.value)}
            style={{ ...fieldStyle, width: '100%', resize: 'vertical', minHeight: 120 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={pending}
            style={{ padding: '8px 16px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 6, fontSize: '0.875rem', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            style={{ padding: '8px 18px', background: '#10b981', color: 'white', border: 'none', borderRadius: 6, fontSize: '0.875rem', fontWeight: 600, cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.6 : 1 }}
          >
            {pending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

export function UnapproveButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <form action={(fd) => startTransition(() => { void unapproveReview(fd); })}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        title="Move back to Pending Approval"
        style={{ padding: '6px 14px', background: '#fff7ed', color: '#9a3412', border: 'none', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, cursor: pending ? 'not-allowed' : 'pointer' }}
      >
        {pending ? '…' : 'Unapprove'}
      </button>
    </form>
  );
}
