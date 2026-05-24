'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// ============================================================================
// Lightweight global hotkeys for the admin shell.
//
// Supports two patterns:
//   • Single-key shortcuts (?, Escape).
//   • `g <letter>` two-key sequences — press `g`, then within 700ms press
//     a navigation letter (o → orders, p → products, etc.). Vim / GitHub
//     pattern; UK operators familiar with Linear / Notion expect this.
//
// Deliberately small — no third-party hotkey lib, no per-key registration
// API. Adding a new shortcut = edit the maps in this file. Cheat sheet
// pulls from the same maps so it stays in lock-step.
//
// All shortcuts are SILENTLY IGNORED when the user is typing into an input
// / textarea / contenteditable so they never collide with form entry.
// ============================================================================

export interface NavShortcut {
  key: string;           // the letter after `g`
  label: string;         // human label for the cheat sheet
  href: string;
}

export const NAV_SHORTCUTS: NavShortcut[] = [
  { key: 'd', label: 'Dashboard',  href: '/admin/dashboard' },
  { key: 'o', label: 'Orders',     href: '/admin/orders'    },
  { key: 'p', label: 'Products',   href: '/admin/products'  },
  { key: 'i', label: 'Inventory',  href: '/admin/inventory' },
  { key: 'c', label: 'Customers',  href: '/admin/users'     },
  { key: 'r', label: 'Reviews',    href: '/admin/reviews'   },
  { key: 's', label: 'Settings',   href: '/admin/settings'  },
];

export const GLOBAL_SHORTCUTS = [
  { key: '?', label: 'Show this cheat sheet' },
  { key: 'g', label: 'Then a letter to navigate (e.g. g o → Orders)' },
  { key: 'Esc', label: 'Close any open dialog or sheet' },
];

const SEQUENCE_WINDOW_MS = 700;

function isTypingInForm(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

/**
 * Mount this hook once at the top of the admin shell. Returns a tuple of
 *   • isCheatSheetOpen — bind to the cheat-sheet modal's open state
 *   • closeCheatSheet  — wire to the cheat-sheet's close handler
 * The cheat sheet itself lives in a separate component so this hook stays
 * UI-agnostic (it could equally drive a toast or a side-panel later).
 */
export function useAdminHotkeys(): {
  isCheatSheetOpen: boolean;
  closeCheatSheet: () => void;
} {
  const router = useRouter();
  const [isCheatSheetOpen, setCheatSheetOpen] = useState(false);

  useEffect(() => {
    // `g` was pressed within the sequence window; the next keystroke
    // completes the shortcut (e.g. `g`→`o` = navigate to orders). Stored
    // outside of React state because we want sub-frame responsiveness +
    // no re-renders.
    let gPressedAt = 0;

    function onKeyDown(e: KeyboardEvent) {
      // Modifier keys make this someone else's shortcut (browser save,
      // copy, etc.). Bail before they get clobbered.
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // Don't hijack keys while the operator is in a form field.
      if (isTypingInForm(e.target)) return;

      // `?` — opens the cheat sheet. Shift+/ produces `?` on UK + US
      // layouts so we don't need to check shift state separately.
      if (e.key === '?') {
        e.preventDefault();
        setCheatSheetOpen(prev => !prev);
        return;
      }

      // `Escape` — close the cheat sheet if it's open. Other dialogs
      // (drawer, modals) already wire their own Escape via useEscapeKey
      // so this branch only matters for our cheat sheet.
      if (e.key === 'Escape' && isCheatSheetOpen) {
        e.preventDefault();
        setCheatSheetOpen(false);
        return;
      }

      // `g` — arm the navigation-sequence state, then wait for the second key.
      if (e.key === 'g') {
        gPressedAt = Date.now();
        return;
      }

      // Second key of a `g <x>` sequence — only counts if `g` was pressed
      // recently enough for it to feel like a single intentional combo.
      if (gPressedAt && (Date.now() - gPressedAt) < SEQUENCE_WINDOW_MS) {
        const match = NAV_SHORTCUTS.find(s => s.key === e.key.toLowerCase());
        gPressedAt = 0; // consume the `g` regardless of match
        if (match) {
          e.preventDefault();
          router.push(match.href);
        }
        return;
      }

      // Stray key — clear the sequence state so a stale `g` from 5 seconds
      // ago doesn't fire on the next innocuous keystroke.
      gPressedAt = 0;
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [router, isCheatSheetOpen]);

  return {
    isCheatSheetOpen,
    closeCheatSheet: () => setCheatSheetOpen(false),
  };
}
