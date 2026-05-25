'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/admin/Toast';
import {
  listSavedViews, saveView, deleteView, type SavedView,
} from '@/app/admin/saved-views-actions';

// Saved-view dropdown. Used next to the OrdersFilter for v1; the
// `surface` prop lets us reuse it on /admin/products + /admin/users
// later without copy-pasting the menu.
//
// Active view detection compares the current URL query string against
// the saved query — so if the operator tweaks the URL after applying a
// view, the active highlight clears. Simpler than tracking "which view
// am I in" in state, and survives back/forward navigation.

interface Props {
  /** Which list page this menu belongs to. Must be a valid value in the
   *  server-side Surface zod enum. */
  surface: 'orders';
  /** The base path to navigate to when applying a view. */
  basePath: string;
}

export function SavedViewsMenu({ surface, basePath }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [views, setViews] = useState<SavedView[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, startSave] = useTransition();
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  // Stripped query — the URL minus the `page` param (otherwise saved
  // views always include the page you were on when you saved, which
  // is rarely what you want).
  const currentQuery = (() => {
    const next = new URLSearchParams(params.toString());
    next.delete('page');
    return next.toString();
  })();

  const activeView = (views ?? []).find(v => v.query === currentQuery);

  // Click-outside to close. Re-binds on every open/close to avoid the
  // listener leaking when the menu is dismissed.
  useEffect(() => {
    if (!open && !savePromptOpen) return;
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setSavePromptOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open, savePromptOpen]);

  async function loadViews() {
    if (views !== null) return; // cached after first open
    setLoading(true);
    try {
      const rows = await listSavedViews(surface);
      setViews(rows);
    } catch {
      toast('Could not load saved views', 'error');
    } finally {
      setLoading(false);
    }
  }

  const applyView = (v: SavedView) => {
    setOpen(false);
    router.push(`${basePath}${v.query ? `?${v.query}` : ''}`);
  };

  const clearFilters = () => {
    setOpen(false);
    router.push(basePath);
  };

  const handleSave = () => {
    const name = draftName.trim();
    if (!name) return;
    startSave(async () => {
      const res = await saveView({ surface, name, query: currentQuery });
      if (!res.ok) { toast(res.error, 'error'); return; }
      // Refresh local cache so the new view appears immediately.
      setViews(prev => {
        if (!prev) return [res.view];
        // Replace if a view with the same name exists (the upsert
        // overwrites it server-side), otherwise prepend.
        const without = prev.filter(v => v.id !== res.view.id);
        return [res.view, ...without];
      });
      setDraftName('');
      setSavePromptOpen(false);
      toast(`Saved view "${name}"`, 'success');
    });
  };

  const handleDelete = (v: SavedView) => {
    if (!window.confirm(`Delete saved view "${v.name}"?`)) return;
    startSave(async () => {
      const res = await deleteView(v.id, surface);
      if (!res.ok) { toast(res.error ?? 'Delete failed', 'error'); return; }
      setViews(prev => (prev ?? []).filter(x => x.id !== v.id));
      toast(`Deleted "${v.name}"`, 'success');
    });
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => { setOpen(o => !o); if (!open) void loadViews(); }}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          padding: '6px 12px', borderRadius: 8,
          border: '1px solid #d1d5db', background: 'white',
          color: '#374151', fontSize: '0.8125rem', fontWeight: 600,
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
          minHeight: 36, whiteSpace: 'nowrap',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" style={{ display: activeView ? 'block' : 'none' }} />
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" style={{ display: activeView ? 'none' : 'block' }} />
        </svg>
        {activeView ? activeView.name : 'Views'}
        <span aria-hidden="true" style={{ fontSize: '0.625rem', color: '#9ca3af' }}>▾</span>
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute', top: '100%', marginTop: 6, right: 0,
            minWidth: 260, maxWidth: 340,
            background: 'white', border: '1px solid #e5e7eb', borderRadius: 10,
            boxShadow: '0 8px 24px rgba(17, 24, 39, 0.12)',
            zIndex: 30, padding: 6, overflow: 'hidden',
          }}
        >
          {loading ? (
            <div style={{ padding: '14px 12px', fontSize: '0.8125rem', color: '#9ca3af', textAlign: 'center' }}>
              Loading…
            </div>
          ) : (
            <>
              {(views ?? []).length === 0 ? (
                <div style={{ padding: '14px 12px', fontSize: '0.8125rem', color: '#6b7280', textAlign: 'center' }}>
                  No saved views yet. Tweak the filter then click <strong>Save current</strong> below.
                </div>
              ) : (
                <div style={{ maxHeight: 280, overflowY: 'auto', marginBottom: 4 }}>
                  {(views ?? []).map(v => {
                    const active = v.id === activeView?.id;
                    return (
                      <div key={v.id} role="menuitem" style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '4px 4px 4px 10px', borderRadius: 6,
                        background: active ? '#F5EFF8' : 'transparent',
                      }}>
                        <button
                          type="button"
                          onClick={() => applyView(v)}
                          style={{
                            flex: 1, textAlign: 'left',
                            padding: '6px 0', border: 'none', background: 'transparent',
                            fontSize: '0.8125rem', fontWeight: active ? 600 : 500,
                            color: active ? '#4A1A6B' : '#374151',
                            cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            minHeight: 32,
                          }}
                        >
                          {v.name}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(v)}
                          aria-label={`Delete saved view ${v.name}`}
                          disabled={saving}
                          style={{
                            width: 24, height: 24, borderRadius: 5,
                            border: 'none', background: 'transparent',
                            color: '#9ca3af', cursor: 'pointer', fontSize: '0.875rem', lineHeight: 1,
                          }}
                        >×</button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Footer actions */}
              <div style={{ borderTop: '1px solid #f3f4f6', padding: '6px 4px 0', marginTop: 4 }}>
                {savePromptOpen ? (
                  <div style={{ padding: '4px 6px' }}>
                    <input
                      autoFocus
                      value={draftName}
                      onChange={e => setDraftName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
                        else if (e.key === 'Escape') { setSavePromptOpen(false); setDraftName(''); }
                      }}
                      placeholder="View name (e.g. Open today)"
                      maxLength={40}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        padding: '7px 10px', fontSize: '0.8125rem',
                        border: '1px solid #d1d5db', borderRadius: 6, outline: 'none',
                      }}
                    />
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <button
                        type="button"
                        onClick={() => { setSavePromptOpen(false); setDraftName(''); }}
                        style={{
                          flex: 1, padding: '6px 10px', borderRadius: 6,
                          border: '1px solid #e5e7eb', background: 'white',
                          color: '#6b7280', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                        }}
                      >Cancel</button>
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || draftName.trim() === ''}
                        style={{
                          flex: 1, padding: '6px 10px', borderRadius: 6,
                          border: 'none', background: '#4A1A6B', color: 'white',
                          fontSize: '0.75rem', fontWeight: 600,
                          cursor: saving || draftName.trim() === '' ? 'not-allowed' : 'pointer',
                          opacity: saving || draftName.trim() === '' ? 0.6 : 1,
                        }}
                      >Save</button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSavePromptOpen(true)}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 6,
                      border: 'none', background: 'transparent',
                      color: '#4A1A6B', fontSize: '0.8125rem', fontWeight: 600,
                      cursor: 'pointer', textAlign: 'left',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    <span style={{ fontSize: '1rem', lineHeight: 1 }}>＋</span>
                    Save current filter as…
                  </button>
                )}
                {currentQuery !== '' && !savePromptOpen && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    style={{
                      width: '100%', padding: '6px 10px', borderRadius: 6,
                      border: 'none', background: 'transparent',
                      color: '#6b7280', fontSize: '0.75rem', fontWeight: 500,
                      cursor: 'pointer', textAlign: 'left',
                    }}
                  >Clear filter</button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
