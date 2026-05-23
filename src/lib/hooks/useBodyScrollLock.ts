'use client';

import { useEffect, type RefObject } from 'react';

// Locks <body> scroll while a modal/drawer is open. Restores the original
// overflow + scroll position on close. Pass `lock=true` to engage.
//
// Implementation notes:
//
// 1. Reference-counted via a body-scoped dataset attribute. Multiple
//    components can call this hook concurrently (e.g. MiniCart + a modal
//    opened from inside it) and the lock is only released when the last
//    consumer unmounts. Previously, two overlapping consumers would race
//    and one's cleanup would either undo the other's lock OR leave the
//    body permanently locked.
//
// 2. The scroll-Y the page was at when the FIRST consumer engaged is
//    stashed on `body.dataset.ypScrollY` so subsequent consumers don't
//    overwrite it with `0` (they read it after the body has already been
//    pinned, where scrollY is meaningless).
//
// 3. Survives Fast Refresh: if a component unmounts dirty (HMR, React
//    error boundary), the inline styles linger but the count goes to
//    zero on next mount. We always clear when count hits zero, regardless
//    of who set what — the values stored in dataset are authoritative.

const COUNT_KEY    = 'ypScrollLockCount';
const SCROLLY_KEY  = 'ypScrollLockY';

function applyLock() {
  if (typeof document === 'undefined') return;
  const body = document.body;
  const html = document.documentElement;
  const dataset = body.dataset;

  const current = Number(dataset[COUNT_KEY] ?? '0');
  dataset[COUNT_KEY] = String(current + 1);

  // Only the first lock writes the freeze styles + records scrollY.
  if (current === 0) {
    dataset[SCROLLY_KEY] = String(window.scrollY);
    body.style.overflow  = 'hidden';
    body.style.position  = 'fixed';
    body.style.top       = `-${window.scrollY}px`;
    body.style.width     = '100%';
    html.style.overflow  = 'hidden';
  }
}

function releaseLock() {
  if (typeof document === 'undefined') return;
  const body = document.body;
  const html = document.documentElement;
  const dataset = body.dataset;

  const current = Number(dataset[COUNT_KEY] ?? '0');
  const next = Math.max(0, current - 1);
  dataset[COUNT_KEY] = String(next);

  if (next === 0) {
    const y = Number(dataset[SCROLLY_KEY] ?? '0');
    delete dataset[SCROLLY_KEY];
    body.style.overflow  = '';
    body.style.position  = '';
    body.style.top       = '';
    body.style.width     = '';
    html.style.overflow  = '';
    window.scrollTo(0, y);
  }
}

export function useBodyScrollLock(lock: boolean): void {
  useEffect(() => {
    if (!lock) return;
    applyLock();
    return releaseLock;
  }, [lock]);
}

/** Convenience hook: fires `onClose` when Escape is pressed while `active`. */
export function useEscapeKey(active: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active, onClose]);
}

/**
 * Keep Tab focus inside `ref.current` while `active`. On open, focus the
 * first focusable element inside the container. On close, restore focus
 * to whatever was focused before opening. Standard modal-dialog pattern.
 */
const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useFocusTrap<T extends HTMLElement>(active: boolean, ref: RefObject<T | null>): void {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return;
    const container = ref.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Defer initial focus a tick so the open transition can start first.
    const initial = setTimeout(() => {
      const first = container.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    }, 50);

    const onKeydown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const list = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter(el => !el.hasAttribute('aria-hidden'));
      if (list.length === 0) return;
      const first = list[0];
      const last  = list[list.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', onKeydown);

    return () => {
      clearTimeout(initial);
      document.removeEventListener('keydown', onKeydown);
      // Restore focus after the panel closes so keyboard users land back
      // where they were (e.g. on the "Filters" pill that opened the rail).
      previouslyFocused?.focus?.();
    };
  }, [active, ref]);
}
