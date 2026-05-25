'use client';
import { useEffect, useRef, useState } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { AdminBottomNav } from './AdminBottomNav';
import { NotificationsBell } from './NotificationsBell';
import { KeyboardShortcutsCheatSheet } from './KeyboardShortcutsCheatSheet';
import { CommandPalette } from './CommandPalette';
import { useBodyScrollLock, useEscapeKey, useFocusTrap } from '@/lib/hooks/useBodyScrollLock';
import { useAdminHotkeys } from '@/lib/hooks/useAdminHotkeys';
import type { StaffSession } from '@/lib/permissions';

interface Notification {
  id: string; kind: string; title: string; body: string | null;
  link: string | null; read: boolean; created_at: string;
}

export function AdminShell({
  children, session, pendingOrderCount = 0, notifications = [],
}: {
  children: React.ReactNode;
  session: StaffSession;
  pendingOrderCount?: number;
  notifications?: Notification[];
}) {
  const [open, setOpen] = useState(false);
  // `isMobile` is read after mount via matchMedia. We start at `false` so
  // SSR + the first client render agree (the inline `aria-hidden` previously
  // referenced `window` directly, producing a hydration mismatch on every
  // mobile load). The next effect tick flips it correctly.
  const [isMobile, setIsMobile] = useState(false);
  const drawerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // Drawer behaves as a modal sheet on mobile only — body scroll lock +
  // focus trap kick in alongside the slide-in. Desktop ignores them.
  useBodyScrollLock(open);
  useEscapeKey(open, () => setOpen(false));
  useFocusTrap(open, drawerRef);

  // Global admin shortcuts: `g <letter>` jumps between sections, `?`
  // opens the cheat sheet. The hook ignores keystrokes while the
  // operator is typing in a form so it can't collide with field entry.
  const { isCheatSheetOpen, closeCheatSheet } = useAdminHotkeys();

  // Auto-close the drawer when crossing to desktop so a stuck-open drawer
  // doesn't leave the body scroll-locked when the viewport widens.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = (e: MediaQueryListEvent) => { if (e.matches) setOpen(false); };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return (
    <>
      <style>{`
        .adm-sidebar { position: fixed; left: 0; top: 0; bottom: 0; z-index: 50; transition: transform 0.25s ease; }
        /* Hide the per-sidebar close (X) button on desktop — the sidebar is
         * always-mounted at >= 768 px so there's nothing to close. The
         * AdminSidebar component still renders it (the JSX is shared with
         * the mobile drawer), we just hide it visually here. !important
         * is required because the inline button style hard-codes
         * display:inline-flex. */
        .adm-sidebar button[aria-label="Close admin menu"] { display: none !important; }
        .adm-main { margin-left: 240px; min-height: 100vh; background: #f3f4f6; }
        .adm-topbar { display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: white; border-bottom: 1px solid #e5e7eb; position: sticky; top: 0; z-index: 30; }
        .adm-topbar .menu-btn { display: none; }
        .adm-overlay { display: none; }
        .adm-bottom-nav { display: none; }
        .adm-fab { display: none; }
        .adm-orders-cards { display: none; }
        .adm-table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        /* Products list: desktop shows the table, the mobile card
         * stack is hidden. The @media block below flips this for phones. */
        .adm-products-cards { display: none; }

        /* ─ Responsive table → card-stack utility ─
         * Put .adm-table-cards on a <table>, add data-label="…" on each <td>,
         * and below 768 px the table reflows into one stacked card per row
         * with the label inline. Avoids horizontal scroll on phones. */
        @media (max-width: 767px) {
          .adm-table-cards thead { display: none; }
          .adm-table-cards, .adm-table-cards tbody { display: block; width: 100%; }
          .adm-table-cards tr {
            display: block; background: white; border-radius: 12px;
            padding: 6px 16px 10px; margin-bottom: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.06);
            border: 1px solid #eef0f2;
          }
          .adm-table-cards td {
            display: flex; align-items: center; justify-content: space-between; gap: 12px;
            padding: 9px 0 !important;
            border: none !important;
            font-size: 0.8125rem !important;
            text-align: right;
          }
          .adm-table-cards td + td {
            border-top: 1px dashed #f3f4f6 !important;
          }
          .adm-table-cards td::before {
            content: attr(data-label);
            font-weight: 600; color: #9ca3af; font-size: 0.6875rem;
            text-transform: uppercase; letter-spacing: 0.05em;
            text-align: left; flex-shrink: 0;
          }
          /* Cells without a data-label (usually the actions column) stay full-width. */
          .adm-table-cards td:not([data-label]) {
            justify-content: flex-end;
          }
          .adm-table-cards td:not([data-label])::before {
            content: none;
          }
          /* ── Card hierarchy: lead with the headline fact ──
           * The first identifying cell (order number / product name) becomes a
           * full-width headline block at the top of the card, larger and with
           * its label dropped — the rest stay compact label/value rows. */
          .adm-table-cards td[data-label="Order #"],
          .adm-table-cards td[data-label="Brand / Name"] {
            display: block; text-align: left;
            padding: 4px 0 11px !important;
            margin-bottom: 3px;
            border-top: none !important;
            border-bottom: 1px solid #eef0f2 !important;
          }
          .adm-table-cards td[data-label="Order #"]::before,
          .adm-table-cards td[data-label="Brand / Name"]::before {
            content: none;
          }
          .adm-table-cards td[data-label="Order #"] a {
            font-size: 1rem !important;
          }
          .adm-table-cards td[data-label="Brand / Name"] > div:nth-child(2) {
            font-size: 0.9375rem !important;
            white-space: normal !important;
          }
          /* ── Bigger touch targets on the per-card actions ── */
          .adm-table-cards td a,
          .adm-table-cards td button {
            min-height: 40px;
          }
          .adm-table-cards td[data-label] a,
          .adm-table-cards td[data-label] button {
            min-height: 0;
          }
          .adm-table-cards td:not([data-label]) {
            gap: 10px; padding-top: 12px !important;
          }
          .adm-table-cards td:not([data-label]) a,
          .adm-table-cards td:not([data-label]) button {
            display: inline-flex; align-items: center; justify-content: center;
            min-height: 40px; padding-left: 16px; padding-right: 16px;
          }
        }

        @media (max-width: 1023px) {
          .adm-stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .adm-analytics-grid { grid-template-columns: 1fr !important; }
        }

        @media (max-width: 767px) {
          .adm-sidebar { transform: translateX(-100%); width: min(280px, 86vw) !important; }
          .adm-sidebar.open { transform: translateX(0); box-shadow: 8px 0 32px rgba(0,0,0,0.18); }
          /* Re-show the close (X) button on mobile so the drawer is
           * dismissible. (The desktop rule above hides it.) */
          .adm-sidebar button[aria-label="Close admin menu"] { display: inline-flex !important; }
          /* !important defends against any stray desktop rule that tried to
           * pin margin-left at the (now-hidden) sidebar's width. */
          .adm-main { margin-left: 0 !important; }
          .adm-topbar { background: white; padding: 10px 14px; }
          .adm-topbar .menu-btn { display: inline-flex; }
          .adm-overlay {
            display: block; position: fixed; inset: 0;
            background: rgba(0,0,0,0.5); z-index: 49;
            opacity: 0; pointer-events: none;
            transition: opacity 220ms ease-out;
          }
          .adm-overlay.open { opacity: 1; pointer-events: auto; }
          .adm-page { padding: 14px 12px !important; }
          .adm-stat-grid { gap: 10px !important; }
          .adm-form-2col { grid-template-columns: 1fr !important; }
          .adm-form-3col { grid-template-columns: 1fr 1fr !important; }
          .adm-form-4col { grid-template-columns: 1fr 1fr !important; }
          .adm-form-brand { grid-template-columns: 1fr !important; }

          /* Variant rows on the PDP/admin product edit page were 6 columns wide
           * — they overflowed on phones. Collapse to a card stack: option +
           * SKU on top, price/stock/status flow underneath, Edit/Delete pinned
           * to the right side. */
          .adm-variant-row {
            grid-template-columns: 1fr auto !important;
            grid-template-areas: "summary actions" "price actions" "stock actions" "enabled actions" !important;
            row-gap: 6px !important;
          }
          .adm-variant-row > :nth-child(1) { grid-area: summary; }
          .adm-variant-row > :nth-child(2) { grid-area: price; font-weight: 600; }
          .adm-variant-row > :nth-child(3) { grid-area: stock; }
          .adm-variant-row > :nth-child(4) { grid-area: enabled; }
          .adm-variant-row > :nth-child(5),
          .adm-variant-row > :nth-child(6) { grid-area: actions; align-self: start; }

          /* Modals (team/edit-staff, etc.) on phones */
          .adm-modal { max-width: calc(100vw - 16px) !important; max-height: calc(100vh - 32px); overflow-y: auto; padding: 16px !important; }
          .adm-modal-grid { grid-template-columns: 1fr !important; }

          /* Header brand on a phone should keep "Aizel" visible without
           * spilling under the bell. */
          .adm-topbar h1, .adm-topbar > span { font-size: 0.875rem !important; }
          .adm-cmdk-hint .adm-cmdk-label { display: none; }
          .adm-cmdk-hint kbd { display: none; }

          /* Per-page header rows (h1 + side action button) often use
           * justifyContent space-between on desktop — let them stack on phones. */
          .adm-page-header { flex-wrap: wrap !important; gap: 12px !important; }
          .adm-page-header > * { flex: 1 1 auto; }

          /* Sticky bulk-action bars need to hug the screen edge on phones,
           * not the (now-zero) page padding — and sit clear of the bottom nav. */
          .adm-bulk-bar { margin: 12px -12px 0 !important; border-radius: 0 !important; flex-direction: column; align-items: stretch !important; gap: 8px !important; bottom: 56px !important; }
          /* Sticky save bars (settings, product edit) lift above the nav too. */
          .adm-sticky-actions { bottom: 56px !important; }

          /* Filter pill rows — one horizontally-scrollable strip instead of
           * wrapping to 2-3 stacked rows that eat vertical space. Bleeds to
           * the screen edge so the last pill cues scrollability. */
          .adm-filter-pills {
            flex: 1 1 100% !important;
            min-width: 0;
            flex-wrap: nowrap !important;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            margin-left: -12px; margin-right: -12px;
            padding: 2px 12px;
          }
          .adm-filter-pills::-webkit-scrollbar { display: none; }
          .adm-filter-pills > * { flex: 0 0 auto; }

          /* ─ Bottom navigation bar (mobile only) ─ */
          .adm-main { padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px)); }
          .adm-bottom-nav {
            display: flex; position: fixed; left: 0; right: 0; bottom: 0; z-index: 45;
            background: #111827; border-top: 1px solid #1f2937;
            padding-bottom: env(safe-area-inset-bottom, 0px);
          }
          .adm-bottom-nav-item {
            flex: 1; display: flex; flex-direction: column;
            align-items: center; justify-content: center; gap: 3px;
            min-height: 56px; padding: 7px 2px;
            background: none; border: none; cursor: pointer; font-family: inherit;
            color: #9ca3af; font-size: 0.625rem; font-weight: 600;
            text-decoration: none; letter-spacing: 0.01em;
          }
          .adm-bottom-nav-item.active { color: #f9a8d4; }
          .adm-bottom-nav-icon { position: relative; font-size: 1.125rem; line-height: 1; }
          .adm-bottom-nav-badge {
            position: absolute; top: -7px; right: -11px;
            min-width: 16px; height: 16px; padding: 0 3px; border-radius: 8px;
            background: #ef4444; color: #fff; font-size: 0.5625rem; font-weight: 700;
            display: flex; align-items: center; justify-content: center;
          }

          /* Floating action button — primary "create" action, clear of the
           * bottom nav. */
          .adm-fab {
            display: flex; align-items: center; justify-content: center;
            position: fixed; right: 16px;
            bottom: calc(72px + env(safe-area-inset-bottom, 0px));
            width: 52px; height: 52px; border-radius: 50%;
            background: #4A1A6B; color: #fff; text-decoration: none;
            box-shadow: 0 6px 20px rgba(197, 40, 106, 0.42);
            z-index: 44;
          }
          .adm-fab:active { transform: scale(0.94); }

          /* ── Swipeable order cards ──
           * The desktop table is hidden; orders render as cards. Each card is
           * a native horizontal scroll-snap track — swiping left reveals a
           * quick status-action panel. Native scroll, so it never fights
           * vertical page scrolling. */
          .adm-orders-table { display: none; }
          .adm-orders-cards { display: block; }
          .ord-swipe {
            display: flex; overflow-x: auto;
            scroll-snap-type: x mandatory;
            -webkit-overflow-scrolling: touch; scrollbar-width: none;
            border: 1px solid #eef0f2; border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.06);
            margin-bottom: 12px;
          }
          .ord-swipe::-webkit-scrollbar { display: none; }
          .ord-swipe-face {
            flex: 0 0 100%; scroll-snap-align: start;
            padding: 13px 16px;
          }
          .ord-swipe-actions {
            flex: 0 0 138px; scroll-snap-align: end;
            display: flex; flex-direction: column;
          }
          .ord-swipe-actions button + button { border-top: 1px solid rgba(255,255,255,0.25); }

          /* -- Products list: headline-led cards (mobile only) --
           * The desktop table is hidden; each product renders as a card
           * that leads with the product name, with price / stock / status
           * as smaller secondary text. */
          .adm-products-table { display: none; }
          .adm-products-cards { display: block; }
          .adm-product-card {
            padding: 13px 14px; margin-bottom: 10px;
            border: 1px solid #f3f4f6; border-radius: 10px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.06);
          }
        }
      `}</style>

      <div
        className={`adm-overlay${open ? ' open' : ''}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <div
        ref={drawerRef}
        className={`adm-sidebar${open ? ' open' : ''}`}
        role={open ? 'dialog' : undefined}
        aria-modal={open ? 'true' : undefined}
        aria-label="Admin navigation"
        aria-hidden={isMobile && !open ? 'true' : undefined}
      >
        <AdminSidebar session={session} onClose={() => setOpen(false)} pendingOrderCount={pendingOrderCount} />
      </div>

      {/* `<main>` instead of `<div>` so screen-reader landmark navigation
       *  and the skip-link target actually reach the admin content. The
       *  .adm-main class still drives the desktop margin-left offset for
       *  the permanent sidebar. */}
      <main className="adm-main" id="admin-main">
        <div className="adm-topbar">
          <button
            className="menu-btn"
            onClick={() => setOpen(true)}
            aria-label="Open admin menu"
            aria-expanded={open}
            aria-controls="admin-sidebar"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              width: 40, height: 40, borderRadius: 8, padding: 0,
              alignItems: 'center', justifyContent: 'center',
              color: '#111827',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="3" y1="6"  x2="21" y2="6"  />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span style={{ flex: 1, fontWeight: 700, fontSize: '0.9375rem', color: '#111827' }}>
            <span style={{ color: '#4A1A6B' }}>Aizel</span>
            <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: '0.75rem', marginLeft: 8 }}>Admin</span>
          </span>
          {/* ⌘K palette opener — clickable for trackpad / mouse users
              + serves as a discoverability hint for the keyboard shortcut.
              Owns no state of its own; the CommandPalette listens for
              the same Ctrl/Cmd+K on the window. */}
          <button
            type="button"
            onClick={() => {
              // Dispatch a synthetic Ctrl+K so the palette's existing
              // window listener picks it up. Avoids passing a ref or
              // hoisting open-state out of CommandPalette.
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
            }}
            aria-label="Open command palette"
            className="adm-cmdk-hint"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7,
              padding: '6px 10px', cursor: 'pointer', color: '#6b7280',
              fontSize: '0.75rem', fontWeight: 500, minHeight: 32,
            }}
          >
            <span aria-hidden="true">🔍</span>
            <span className="adm-cmdk-label">Search…</span>
            <kbd style={{
              padding: '1px 6px', background: 'white', border: '1px solid #e5e7eb',
              borderRadius: 4, fontSize: '0.625rem', fontWeight: 600,
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            }}>⌘K</kbd>
          </button>
          <NotificationsBell notifications={notifications} />
        </div>
        {children}
      </main>

      <AdminBottomNav
        session={session}
        pendingOrderCount={pendingOrderCount}
        onMore={() => setOpen(true)}
      />

      {/* Admin keyboard-shortcut cheat sheet — toggled by `?`. Lives at
          the root of the shell so it overlays any page. Renders nothing
          until opened, so the rest of the admin pays no render cost. */}
      <KeyboardShortcutsCheatSheet open={isCheatSheetOpen} onClose={closeCheatSheet} />

      {/* ⌘K command palette — universal navigate + search. Owns its own
          open state via a global keybind listener; renders nothing until
          opened. Mounted here so every admin page gets it for free. */}
      <CommandPalette session={session} />
    </>
  );
}
