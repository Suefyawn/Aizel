// ============================================================================
// Branded inline-SVG icons for the PDP key-benefits bar.
//
// Replaces the emoji glyphs that were stored in products.key_benefits[].icon.
// All icons use a single 24-unit viewBox, currentColor stroke, and 1.6px
// stroke-width — they read as a cohesive set on a beauty PDP and
// inherit the surrounding text colour (brand-pink-text on paper2).
//
// To add a new icon: drop a <path>/<circle> into ICONS and add the
// corresponding entry in `iconNames` in migration-085 so the emoji →
// name mapping stays in sync. The renderer falls back to a neutral dot
// when given an unknown name so PDPs never break on a stale data row.
// ============================================================================

import type { CSSProperties, ReactElement } from 'react';

export type IconName =
  | 'shield'
  | 'leaf'
  | 'sparkle'
  | 'droplet'
  | 'pulse'
  | 'flower'
  | 'bottle'
  | 'heart'
  | 'bolt'
  | 'sun'
  | 'moon'
  | 'dna'
  | 'flame';

const ICONS: Record<IconName, ReactElement> = {
  shield: (
    <path d="M12 3l7 3v6c0 4.4-2.8 8.2-7 9-4.2-.8-7-4.6-7-9V6l7-3z" />
  ),
  leaf: (
    <>
      <path d="M5 19c1.5-7 6-12 14-13-.5 8-5.5 12.5-12 14" />
      <path d="M5 19l7-7" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
      <path d="M6.5 6.5l3 3M14.5 14.5l3 3M6.5 17.5l3-3M14.5 9.5l3-3" />
    </>
  ),
  droplet: (
    <path d="M12 3.5l5.5 7.5a6.5 6.5 0 11-11 0L12 3.5z" />
  ),
  pulse: (
    <path d="M3 12h4l2-5 4 10 2-5h6" />
  ),
  flower: (
    <>
      <circle cx="12" cy="12" r="2.4" />
      <path d="M12 3a3.5 3.5 0 010 7M12 14a3.5 3.5 0 010 7M3 12a3.5 3.5 0 017 0M14 12a3.5 3.5 0 017 0" />
    </>
  ),
  bottle: (
    <>
      <path d="M9 3h6v2l1 3v12a2 2 0 01-2 2h-4a2 2 0 01-2-2V8l1-3V3z" />
      <path d="M9 11h6" />
    </>
  ),
  heart: (
    <path d="M12 20s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.5-7 10-7 10z" />
  ),
  bolt: (
    <path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z" />
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
    </>
  ),
  moon: (
    <path d="M20 14.5A8 8 0 119.5 4a7 7 0 0010.5 10.5z" />
  ),
  dna: (
    <>
      <path d="M7 3c0 6 10 12 10 18M17 3c0 6-10 12-10 18" />
      <path d="M8 6h8M8 18h8M9 9h6M9 15h6" />
    </>
  ),
  flame: (
    <path d="M12 3c1 3 4 4 4 8a4 4 0 11-8 0c0-2 1-3 2-4-1 2 1 3 2 3 0-3-1-4 0-7z" />
  ),
};

/** Resolves any input (icon name, emoji glyph, or unknown string) to an
 *  IconName. Emoji glyphs were the pre-migration-085 storage format; this
 *  bridge keeps PDPs rendering even if a stale row still has one. */
const EMOJI_TO_ICON: Record<string, IconName> = {
  '🛡️': 'shield', '🛡': 'shield',
  '🌿': 'leaf',
  '✨': 'sparkle',
  '💧': 'droplet',
  '💪': 'pulse',
  '🌸': 'flower',
  '🧴': 'bottle',
  '💛': 'heart', '💜': 'heart',
  '⚡': 'bolt',
  '☀️': 'sun', '☀': 'sun',
  '🌙': 'moon',
  '🧬': 'dna',
  '🔥': 'flame',
};

function resolve(input: string | null | undefined): IconName {
  if (!input) return 'sparkle';
  if (input in ICONS) return input as IconName;
  if (input in EMOJI_TO_ICON) return EMOJI_TO_ICON[input];
  return 'sparkle';
}

interface Props {
  name: string | null | undefined;
  size?: number;
  style?: CSSProperties;
  className?: string;
}

export function BenefitIcon({ name, size = 18, style, className }: Props) {
  const icon = ICONS[resolve(name)];
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
      {icon}
    </svg>
  );
}
