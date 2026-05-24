'use client';

import { useEffect, useRef } from 'react';
import { NAV_SHORTCUTS, GLOBAL_SHORTCUTS } from '@/lib/hooks/useAdminHotkeys';

interface Props {
  open: boolean;
  onClose: () => void;
}

// Modal cheat sheet listing every admin keyboard shortcut. Opened by `?`
// (handled by useAdminHotkeys), closed by clicking outside, by Escape, or
// by the explicit close button. Renders nothing until opened so the rest
// of the admin shell pays nothing in render cost.
export function KeyboardShortcutsCheatSheet({ open, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Move focus to the dialog when it opens so the next Tab cycles inside
  // it, then restore focus to the previously-focused element on close.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => previouslyFocused?.focus?.();
  }, [open]);

  if (!open) return null;

  return (
    <div
      // Backdrop — click anywhere outside the panel to dismiss.
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.55)',
        zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-shortcuts-title"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: 12, maxWidth: 540, width: '100%',
          maxHeight: '80vh', overflowY: 'auto',
          padding: '28px 32px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
          outline: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h2 id="admin-shortcuts-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>
            Keyboard shortcuts
          </h2>
          <button
            type="button" onClick={onClose} aria-label="Close shortcuts"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '1.25rem', color: '#6b7280', padding: 4, lineHeight: 1,
            }}
          >×</button>
        </div>
        <p style={{ margin: '0 0 20px', fontSize: '0.8125rem', color: '#6b7280' }}>
          Press <Kbd>?</Kbd> any time to reopen this list. Shortcuts are
          ignored while you&apos;re typing in a form.
        </p>

        <Section title="Navigate">
          {NAV_SHORTCUTS.map(s => (
            <Row
              key={s.key}
              keys={['g', s.key]}
              label={`Jump to ${s.label}`}
            />
          ))}
        </Section>

        <Section title="Global">
          {GLOBAL_SHORTCUTS.map(s => (
            <Row key={s.key} keys={[s.key]} label={s.label} />
          ))}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
      }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  );
}

function Row({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <span style={{ fontSize: '0.875rem', color: '#374151' }}>{label}</span>
      <span style={{ display: 'inline-flex', gap: 4, flexShrink: 0 }}>
        {keys.map((k, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
            {i > 0 && <span style={{ color: '#9ca3af', margin: '0 4px', fontSize: '0.75rem' }}>then</span>}
            <Kbd>{k}</Kbd>
          </span>
        ))}
      </span>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd style={{
      display: 'inline-block', minWidth: 22, textAlign: 'center',
      padding: '3px 7px', fontSize: '0.75rem', fontFamily: 'ui-monospace, SFMono-Regular, monospace',
      background: '#f3f4f6', color: '#111827',
      border: '1px solid #e5e7eb', borderBottomWidth: 2, borderRadius: 5,
      lineHeight: 1.1,
    }}>{children}</kbd>
  );
}
