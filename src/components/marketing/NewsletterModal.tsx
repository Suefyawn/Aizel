'use client';

import { useEffect, useRef, useState } from 'react';
import { NewsletterSignup } from './NewsletterSignup';
import { useBodyScrollLock, useEscapeKey, useFocusTrap } from '@/lib/hooks/useBodyScrollLock';
import { readConsent } from '@/lib/consent';

// Newsletter modal — appears on either:
//   1. Exit-intent (desktop only): mouse exits the top edge of the viewport
//   2. Timed fallback: 60s on page with no interaction
//
// Dismissal is remembered for 30 days in localStorage so we don't pester
// visitors. We also suppress if the visitor:
//   • Already subscribed (yp_newsletter_signed_up)
//   • Has explicitly rejected marketing cookies
//   • Is on an admin / checkout page (mounted elsewhere)
//   • Is on a small screen — phones rely on the footer + post-purchase opt-in
//
// Mounted once in src/app/layout.tsx so it's available globally; component
// no-ops if any suppression rule triggers.

const DISMISS_KEY     = 'yp_newsletter_dismissed_at';
const SIGNED_UP_KEY   = 'yp_newsletter_signed_up';
const DISMISS_WINDOW  = 30 * 24 * 60 * 60 * 1000; // 30 days
const TIMED_FALLBACK_MS = 60_000;
const MOBILE_BREAKPOINT = 720;

function shouldSuppress(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    if (window.localStorage.getItem(SIGNED_UP_KEY)) return true;
    const dismissed = Number(window.localStorage.getItem(DISMISS_KEY) ?? 0);
    if (dismissed && Date.now() - dismissed < DISMISS_WINDOW) return true;
  } catch {}
  // Don't pop on phones — too disruptive on small screens.
  if (window.innerWidth < MOBILE_BREAKPOINT) return true;
  // Don't pop until the visitor has decided on cookies — stacking modals is rude.
  if (!readConsent()) return true;
  // Don't pop on these high-intent flows (signup/login/checkout).
  const p = window.location.pathname;
  if (p.startsWith('/checkout') || p.startsWith('/admin') || p.startsWith('/login') || p.startsWith('/forgot-password') || p.startsWith('/reset-password') || p === '/thank-you') return true;
  return false;
}

export function NewsletterModal() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const close = () => {
    try { window.localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    setOpen(false);
  };

  useBodyScrollLock(open);
  useEscapeKey(open, close);
  useFocusTrap(open, panelRef);

  // Arm exit-intent + the timed fallback once on mount.
  useEffect(() => {
    if (shouldSuppress()) return;

    let armed = true;
    const onLeave = (e: MouseEvent) => {
      // Exit-intent only fires when the cursor leaves through the top edge —
      // distinguishes "switching tabs" from "moving down the page".
      if (!armed) return;
      if (e.clientY <= 0) {
        armed = false;
        setOpen(true);
      }
    };
    const t = window.setTimeout(() => {
      if (armed) {
        armed = false;
        setOpen(true);
      }
    }, TIMED_FALLBACK_MS);
    document.addEventListener('mouseleave', onLeave);

    return () => {
      window.clearTimeout(t);
      document.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  // When the embedded form succeeds, the inline NewsletterSignup swaps in a
  // success message; we close the modal a beat later and mark "signed up"
  // so we never show this visitor the modal again.
  useEffect(() => {
    if (!open || !panelRef.current) return;
    const panel = panelRef.current;
    const watcher = new MutationObserver(() => {
      const ok = panel.querySelector('[role="status"]');
      if (ok) {
        try { window.localStorage.setItem(SIGNED_UP_KEY, '1'); } catch {}
        setTimeout(() => setOpen(false), 1500);
      }
    });
    watcher.observe(panel, { childList: true, subtree: true });
    return () => watcher.disconnect();
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div
        onClick={close}
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.55)',
          opacity: 1, transition: 'opacity 200ms ease-out', zIndex: 350,
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="newsletter-modal-heading"
        style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(440px, calc(100vw - 32px))',
          background: 'var(--paper)', borderRadius: 'var(--radius-card)',
          padding: 32, boxShadow: '0 32px 64px rgba(0,0,0,0.28)',
          zIndex: 351,
        }}
      >
        <button
          onClick={close}
          aria-label="Close newsletter signup"
          style={{
            position: 'absolute', top: 8, right: 8,
            width: 40, height: 40, borderRadius: 8,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--ink-500)', fontSize: '1.25rem', lineHeight: 1,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}
        >×</button>

        <div style={{ marginBottom: 16, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--brand-pink-text)' }}>
          Inside Aizel
        </div>
        <h2
          id="newsletter-modal-heading"
          className="display-l"
          style={{ fontSize: '1.75rem', margin: '0 0 10px', lineHeight: 1.15 }}
        >
          10% off your first order
        </h2>
        <p className="body-text" style={{ color: 'var(--ink-700)', marginBottom: 20, fontSize: '0.9375rem' }}>
          Sign up and we&apos;ll send a welcome code, plus one thoughtful email a fortnight — new arrivals, restocks, and UK-specific routine tips.
        </p>
        <NewsletterSignup source="modal" variant="light" ctaLabel="Sign up" />
        <p style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--ink-500)' }}>
          Unsubscribe any time. We never share your email.
        </p>
      </div>
    </>
  );
}
