'use client';

import { useEffect, useState } from 'react';

// Listens for the browser's `beforeinstallprompt` event and surfaces a
// dismissable banner. Once dismissed it stays dismissed for 30 days
// (localStorage); once the user accepts or installs, it never shows again.
//
// Only fires on browsers that support installable PWAs (Chrome / Edge /
// some Android browsers). Safari users get nothing here — we'd need to
// build a "tap the share icon" hint specifically for iOS.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const STORAGE_KEY = 'yp_pwa_install_dismissed_until';

export function PWAInstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // If they dismissed recently or already installed, do nothing.
    const dismissedUntil = Number(localStorage.getItem(STORAGE_KEY) ?? '0');
    if (Date.now() < dismissedUntil) return;

    const handler = (e: Event) => {
      e.preventDefault();
      const bip = e as BeforeInstallPromptEvent;
      setEvent(bip);
      // Give the user a moment to engage with the page first.
      setTimeout(() => setVisible(true), 4_000);
    };
    window.addEventListener('beforeinstallprompt', handler as EventListener);

    // Once installed, never show again.
    const onInstalled = () => {
      localStorage.setItem(STORAGE_KEY, String(Date.now() + 365 * 24 * 60 * 60 * 1000));
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
    // Snooze for 30 days.
    localStorage.setItem(STORAGE_KEY, String(Date.now() + 30 * 24 * 60 * 60 * 1000));
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
        background: 'linear-gradient(135deg, var(--brand-yellow), var(--brand-pink))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, color: 'var(--ink-900)',
      }}>YP</div>
      <div style={{ flex: 1, fontSize: '0.8125rem', lineHeight: 1.4 }}>
        <strong style={{ display: 'block', marginBottom: 2 }}>Install Aizel</strong>
        <span style={{ color: 'rgba(250,246,238,0.7)' }}>Skip the browser. Tap to add to your home screen.</span>
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
              padding: '6px 10px', background: 'transparent', color: 'rgba(250,246,238,0.6)',
              border: 'none', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer',
            }}
          >Not now</button>
        </div>
      </div>
    </div>
  );
}
