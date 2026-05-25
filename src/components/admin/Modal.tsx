'use client';

import { useEffect, useRef } from 'react';

// Shared admin modal primitive — backdrop + centred sheet, body scroll
// lock, Escape-to-close, click-backdrop-to-close, focus trap on the
// dialog. Used everywhere we used to fire `window.prompt` /
// `window.confirm` (bulk price, bulk stock, return-receive, return-
// reject, etc.). Wrapping these flows in a real dialog instead of a
// browser prompt was the audit's biggest "feels amateur" tell.
//
// Pattern:
//
//   const [open, setOpen] = useState(false);
//   {open && (
//     <Modal title="Adjust price for 3 products" onClose={() => setOpen(false)}>
//       <p>…</p>
//       <ModalActions>
//         <ModalSecondaryButton onClick={() => setOpen(false)}>Cancel</ModalSecondaryButton>
//         <ModalPrimaryButton onClick={submit}>Save</ModalPrimaryButton>
//       </ModalActions>
//     </Modal>
//   )}

export function Modal({
  title,
  desc,
  onClose,
  children,
  width = 480,
}: {
  title: string;
  desc?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  /** Max width in px. Defaults to 480 (a comfortable form width). */
  width?: number;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Body scroll lock — restored on unmount even if the parent forgets
  // to clean up state.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Escape closes; Tab is left to native focus handling within the dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Move focus into the dialog so a screen-reader announces the title
  // and Tab cycles through its controls — not the page behind it.
  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    const focusable = node.querySelector<HTMLElement>(
      'input:not([type="hidden"]), select, textarea, button, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
  }, []);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200, padding: 16,
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="adm-modal-title"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: 12,
          width: '100%', maxWidth: width,
          maxHeight: 'calc(100dvh - 32px)',
          overflowY: 'auto',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.25)',
        }}
      >
        <header style={{
          padding: '20px 24px 12px', display: 'flex', alignItems: 'flex-start',
          gap: 12, borderBottom: '1px solid #f3f4f6',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="adm-modal-title" style={{
              margin: 0, fontSize: '1.0625rem', fontWeight: 700,
              color: '#111827', letterSpacing: '-0.01em',
            }}>{title}</h2>
            {desc && (
              <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>
                {desc}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#9ca3af', fontSize: '1.5rem', lineHeight: 1,
              width: 36, height: 36, borderRadius: 6, flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
        </header>
        <div style={{ padding: '16px 24px 24px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Action row helpers ─────────────────────────────────────────────

export function ModalActions({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', gap: 10, justifyContent: 'flex-end',
      marginTop: 20, flexWrap: 'wrap',
    }}>
      {children}
    </div>
  );
}

export function ModalSecondaryButton({
  children, onClick, disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '10px 18px',
        background: 'white', color: '#374151',
        border: '1px solid #d1d5db', borderRadius: 7,
        fontSize: '0.875rem', fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        minHeight: 40,
      }}
    >
      {children}
    </button>
  );
}

export function ModalPrimaryButton({
  children, onClick, disabled, type = 'button', tone = 'primary',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  /** primary = brand purple (default). danger = red. ok = green. */
  tone?: 'primary' | 'danger' | 'ok';
}) {
  const bg =
    tone === 'danger' ? '#dc2626' :
    tone === 'ok'     ? '#10b981' :
                        '#4A1A6B';
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '10px 22px',
        background: disabled ? '#9ca3af' : bg,
        color: 'white', border: 'none', borderRadius: 7,
        fontSize: '0.875rem', fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        minHeight: 40,
      }}
    >
      {children}
    </button>
  );
}

// ─── Form-row helpers (so callers don't re-style inputs) ────────────

export const modalLabel: React.CSSProperties = {
  display: 'block', fontSize: '0.75rem', fontWeight: 600,
  color: '#374151', marginBottom: 5,
};
export const modalInput: React.CSSProperties = {
  width: '100%', padding: '10px 12px',
  border: '1px solid #d1d5db', borderRadius: 7,
  fontSize: '0.9375rem', color: '#111827',
  background: 'white', outline: 'none', boxSizing: 'border-box',
};
export const modalHint: React.CSSProperties = {
  marginTop: 4, fontSize: '0.75rem', color: '#6b7280',
};
export const modalError: React.CSSProperties = {
  marginTop: 10, padding: '8px 12px',
  background: '#fef2f2', color: '#991b1b',
  border: '1px solid #fecaca', borderRadius: 7,
  fontSize: '0.8125rem',
};
