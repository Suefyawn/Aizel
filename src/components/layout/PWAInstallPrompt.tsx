'use client';

import { useEffect, useState } from 'react';

// Listens for the browser's `beforeinstallprompt` event and surfaces a
// dismissable banner. Snooze rules, in order of strength:
//   • Once accepted / installed → never shows again (1 year + appinstalled).
//   • Once explicitly dismissed → 30 days.
//   • Once the prompt has merely BEEN SHOWN (regardless of outcome) → 7
//     days. Without this the prompt fired on every page load if the user
//     closed the tab without clicking either button — the original
//     complaint from the user audit.
//   • Per-tab session guard → never shows twice in the same browser tab,
//     even if the user navigates between several pages.
//
// Only fires on browsers that support installable PWAs (Chrome / Edge /
// some Android browsers). Safari users get nothing here — we'd need to
// build a "tap the share icon" hint specifically for iOS.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const STORAGE_KEY = 'aizel_pwa_install_dismissed_until';
const SESSION_KEY = 'aizel_pwa_install_shown_this_session';
// Seven days as the "merely shown" snooze — long enough that the prompt
// doesn't feel naggy, short enough that a forgetful user gets reminded.
const SHOWN_SNOOZE_MS  = 7 * 24 * 60 * 60 * 1000;
const DISMISS_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;
const INSTALLED_SNOOZE_MS = 365 * 24 * 60 * 60 * 1000;

export function PWAInstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Already shown in THIS tab — don't surface again until the user
    // closes and reopens the tab. Stops the prompt re-appearing as the
    // user navigates between pages.
    if (sessionStorage.getItem(SESSION_KEY)) return;

    // If they dismissed recently, were already shown the prompt within
    // the snooze window, or already installed, do nothing.
    const dismissedUntil = Number(localStorage.getItem(STORAGE_KEY) ?? '0');
    if (Date.now() < dismissedUntil) return;

    const handler = (e: Event) => {
      e.preventDefault();
      const bip = e as BeforeInstallPromptEvent;
      setEvent(bip);
      // Give the user a moment to engage with the page first.
      setTimeout(() => {
        setVisible(true);
        // Mark "shown this session" the moment the banner appears, so
        // navigation away + back doesn't replay it.
        sessionStorage.setItem(SESSION_KEY, '1');
        // Auto-snooze: even if the user ignores the banner and closes
        // the tab, we won't re-prompt for 7 days. The user complained
        // the prompt was nagging on every page load — this is the fix.
        const shownSnooze = Date.now() + SHOWN_SNOOZE_MS;
        const current = Number(localStorage.getItem(STORAGE_KEY) ?? '0');
        if (current < shownSnooze) {
          localStorage.setItem(STORAGE_KEY, String(shownSnooze));
        }
      }, 4_000);
    };
    window.addEventListener('beforeinstallprompt', handler as EventListener);

    // Once installed, never show again.
    const onInstalled = () => {
      localStorage.setItem(STORAGE_KEY, String(Date.now() + INSTALLED_SNOOZE_MS));
      setVisible(false);
    };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler as EventListener);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!visible || !event) return null;

  const dismiss = () => {
    // Promote the 7-day "shown" snooze to a full 30 days when the user
    // explicitly says no.
    localStorage.setItem(STORAGE_KEY, String(Date.now() + DISMISS_SNOOZE_MS));
    setVisible(false);
  };

  const install = async () => {
    try {
      await event.prompt();
      const choice = await event.userChoice;
      if (choice.outcome === 'accepted') setVisible(false);
      else dismiss();
    } catch {
      dismiss();
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Install Aizel"
      style={{
        // Sit above body content but BELOW any open modal (search z=300,
        // mini-cart z=201, newsletter z=351, consent z=400, mobile menu z=960).
        // Previously z=1500 floated over those, blocking interaction.
        position: 'fixed', bottom: 16, right: 16, zIndex: 180,
        background: 'var(--ink-900)', color: 'var(--paper)',
        borderRadius: 12, padding: '14px 16px', maxWidth: 320,
        boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
        display: 'flex', gap: 12, alignItems: 'flex-start',
        fontFamily: 'var(--font-ui)',
      }}
    >
      <div style={{
        flexShrink: 0, width: 36, height: 36, borderRadius: 8,
        // On-brand purple block instead of the old yellow-pink gradient.
        background: 'var(--brand-pink, #6B2C91)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, color: 'white', fontSize: '1rem',
      }}>A</div>
      <div style={{ flex: 1, fontSize: '0.8125rem', lineHeight: 1.4 }}>
        <strong style={{ display: 'block', marginBottom: 2 }}>Install Aizel</strong>
        <span style={{ color: 'rgba(255, 255, 255,0.7)' }}>Skip the browser. Tap to add to your home screen.</span>
        <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
          <button
            onClick={install}
            style={{
              padding: '6px 12px', background: 'var(--brand-pink-cta)', color: 'white',
              border: 'none', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
            }}
          >Install</button>
          <button
            onClick={dismiss}
            style={{
              padding: '6px 10px', background: 'transparent', color: 'rgba(255, 255, 255,0.6)',
              border: 'none', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer',
            }}
          >Not now</button>
        </div>
      </div>
    </div>
  );
}
