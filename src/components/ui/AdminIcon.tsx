// ============================================================================
// Branded inline-SVG icon set for admin-only surfaces (NotificationsBell,
// PostHogWidget, SentryWidget, NoAccess, etc.). Same shape as BenefitIcon —
// 24-unit viewBox, currentColor stroke, no external dependencies. The
// admin set covers utility icons (bell, lock, bar-chart, bug) the
// storefront benefit icons don't need.
// ============================================================================

import type { CSSProperties, ReactElement } from 'react';

export type AdminIconName =
  | 'bell'
  | 'lock'
  | 'bug'
  | 'bar-chart'
  | 'document'
  | 'cart'
  | 'trend-up'
  | 'trend-down'
  | 'bolt'
  | 'package';

const ICONS: Record<AdminIconName, ReactElement> = {
  bell: (
    <>
      <path d="M6 17h12a1 1 0 00.8-1.6L17 13V9a5 5 0 10-10 0v4l-1.8 2.4A1 1 0 006 17z" />
      <path d="M10 20a2 2 0 004 0" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </>
  ),
  bug: (
    <>
      <path d="M8 11V8a4 4 0 018 0v3" />
      <rect x="6" y="11" width="12" height="9" rx="4" />
      <path d="M3 13h3M18 13h3M3 17h3M18 17h3M3 9l3 2M18 11l3-2" />
    </>
  ),
  'bar-chart': (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  document: (
    <>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5" />
      <path d="M10 13h7M10 17h5" />
    </>
  ),
  cart: (
    <>
      <path d="M3 4h2l2 12h11l2-9H6" />
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="17" cy="20" r="1.5" />
    </>
  ),
  'trend-up': (
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M14 7h7v7" />
    </>
  ),
  'trend-down': (
    <>
      <path d="M3 7l6 6 4-4 8 8" />
      <path d="M14 17h7v-7" />
    </>
  ),
  bolt: (
    <path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z" />
  ),
  package: (
    <>
      <path d="M3 7l9-4 9 4v10l-9 4-9-4V7z" />
      <path d="M3 7l9 4 9-4M12 11v10" />
    </>
  ),
};

interface Props {
  name: AdminIconName;
  size?: number;
  style?: CSSProperties;
  className?: string;
}

export function AdminIcon({ name, size = 18, style, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={style}
      className={className}
    >
      {ICONS[name]}
    </svg>
  );
}
