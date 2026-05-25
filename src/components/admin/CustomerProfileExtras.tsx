'use client';

import { useState, useTransition, type KeyboardEvent } from 'react';
import { useToast } from '@/components/admin/Toast';
import {
  setCustomerNotes, setCustomerTags,
} from '@/app/admin/users/[id]/profile-extras-actions';

// Notes + tags editor on the customer detail page. Notes is a textarea
// that auto-saves on blur (no Save button). Tags is a chip editor —
// type / press Enter or comma to commit, click × to drop. Both go
// through the customers.edit-gated server actions; the parent renders
// `disabled` when the staff member is view-only.

interface Props {
  userId: string;
  initialNotes: string;
  initialTags: string[];
  /** When false, the editor renders read-only — every input is disabled
   *  and the description copy explains why. */
  canEdit: boolean;
}

const PRESET_TAGS = ['VIP', 'Wholesale', 'Influencer', 'Trade', 'Repeat buyer', 'Has allergy'];

export function CustomerProfileExtras({ userId, initialNotes, initialTags, canEdit }: Props) {
  const [notes, setNotes] = useState(initialNotes);
  const [committedNotes, setCommittedNotes] = useState(initialNotes);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [tagDraft, setTagDraft] = useState('');
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const persistNotes = () => {
    if (!canEdit || notes === committedNotes) return;
    const snapshot = notes;
    startTransition(async () => {
      const res = await setCustomerNotes(userId, snapshot);
      if (res.ok) {
        setCommittedNotes(snapshot);
        toast('Note saved', 'success');
      } else {
        toast(res.error, 'error');
      }
    });
  };

  const persistTags = (next: string[]) => {
    if (!canEdit) return;
    const previous = tags;
    setTags(next); // optimistic
    startTransition(async () => {
      const res = await setCustomerTags(userId, next);
      if (!res.ok) {
        setTags(previous);
        toast(res.error, 'error');
      }
    });
  };

  const addTag = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    // Case-insensitive dedupe — keep what's already there.
    if (tags.some(t => t.toLowerCase() === value.toLowerCase())) {
      setTagDraft('');
      return;
    }
    persistTags([...tags, value]);
    setTagDraft('');
  };

  const removeTag = (idx: number) => {
    persistTags(tags.filter((_, i) => i !== idx));
  };

  const onTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagDraft);
    } else if (e.key === 'Backspace' && tagDraft === '' && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  const presetSuggestions = PRESET_TAGS.filter(
    t => !tags.some(existing => existing.toLowerCase() === t.toLowerCase()),
  );

  return (
    <div style={{
      background: 'white', borderRadius: 10,
      padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      marginBottom: 20,
    }}>
      <h2 style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 700, color: '#111827' }}>
        Staff notes &amp; tags
      </h2>
      <p style={{ margin: '0 0 14px', fontSize: '0.75rem', color: '#6b7280' }}>
        {canEdit
          ? 'Internal only — never shown to the customer. The cashier sees these at the till when this customer is attached to a sale.'
          : 'Internal only. You need the customers.edit permission to change them.'}
      </p>

      {/* Tags */}
      <div style={{ marginBottom: 18 }}>
        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
          Tags
        </label>
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 6,
          padding: '8px 10px',
          border: '1px solid #d1d5db', borderRadius: 8,
          background: canEdit ? 'white' : '#f9fafb',
          minHeight: 44,
        }}>
          {tags.map((t, i) => (
            <span key={`${t}-${i}`} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 4px 4px 10px', borderRadius: 14,
              background: '#F5EFF8', color: '#4A1A6B',
              fontSize: '0.75rem', fontWeight: 600,
            }}>
              {t}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => removeTag(i)}
                  aria-label={`Remove tag ${t}`}
                  style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: 'transparent', border: 'none', color: '#4A1A6B',
                    cursor: 'pointer', fontSize: '0.875rem', lineHeight: 1,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >×</button>
              )}
            </span>
          ))}
          {canEdit && (
            <input
              type="text"
              value={tagDraft}
              onChange={e => setTagDraft(e.target.value)}
              onKeyDown={onTagKey}
              onBlur={() => addTag(tagDraft)}
              placeholder={tags.length === 0 ? 'Add a tag and press Enter…' : ''}
              disabled={pending}
              style={{
                flex: '1 1 140px', minWidth: 100,
                border: 'none', outline: 'none', background: 'transparent',
                fontSize: '0.8125rem', color: '#111827',
                padding: '4px 2px',
              }}
            />
          )}
        </div>
        {canEdit && presetSuggestions.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            <span style={{ fontSize: '0.6875rem', color: '#9ca3af', alignSelf: 'center' }}>
              Suggestions:
            </span>
            {presetSuggestions.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => addTag(s)}
                disabled={pending}
                style={{
                  padding: '3px 10px', borderRadius: 12,
                  background: 'white', border: '1px dashed #d1d5db',
                  color: '#6b7280', fontSize: '0.6875rem', fontWeight: 600,
                  cursor: 'pointer',
                }}
              >+ {s}</button>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <label htmlFor={`extras-notes-${userId}`} style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
          Notes
        </label>
        <textarea
          id={`extras-notes-${userId}`}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onBlur={persistNotes}
          disabled={!canEdit || pending}
          maxLength={4000}
          rows={4}
          placeholder={canEdit ? 'e.g. "Always asks for fragrance-free", "Prefers Saturday afternoon pickup"…' : ''}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '10px 12px', fontSize: '0.875rem', lineHeight: 1.5,
            border: '1px solid #d1d5db', borderRadius: 8,
            background: canEdit ? 'white' : '#f9fafb',
            color: '#111827', resize: 'vertical',
            fontFamily: 'inherit',
          }}
        />
        {canEdit && (
          <div style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: 4 }}>
            Saves automatically when you click away.
            {notes !== committedNotes && <strong style={{ marginLeft: 6, color: '#d97706' }}>· Unsaved</strong>}
          </div>
        )}
      </div>
    </div>
  );
}
