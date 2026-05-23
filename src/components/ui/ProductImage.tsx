'use client';

import { useState } from 'react';
import Image from 'next/image';

interface Props {
  src?: string | null;
  alt: string;
  style?: React.CSSProperties;
  className?: string;
  /** Override the default 600w sizes hint (tile size). */
  sizes?: string;
  /** Set true for above-the-fold images to pre-load. */
  priority?: boolean;
  /** Optional label (brand / initial) used in the gradient placeholder. */
  label?: string | null;
  /** Fixed-size mode: when both are set, render `<Image width height>`
   *  instead of `<Image fill>`. Use for thumbnails so Next's image
   *  optimizer only generates srcSet candidates near the requested size
   *  (the default `fill` mode emits all deviceSizes up to 1920w, which
   *  is wasted bandwidth for an 80px-wide thumb). */
  width?: number;
  height?: number;
}

const DEFAULT_SIZES = '(max-width: 600px) 50vw, (max-width: 1024px) 33vw, 320px';

// Stable hash → soft pastel gradient. Two products with the same label always
// get the same gradient (so the catalog feels intentional, not random noise).
function gradientFor(label: string): string {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) | 0;
  const h1 = Math.abs(h) % 360;
  const h2 = (h1 + 40) % 360;
  return `radial-gradient(at 25% 25%, hsl(${h1}, 70%, 90%), transparent 60%), radial-gradient(at 75% 75%, hsl(${h2}, 70%, 88%), transparent 60%), linear-gradient(135deg, hsl(${h1}, 50%, 95%), hsl(${h2}, 50%, 92%))`;
}

function initialsOf(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return '◇';
  const words = trimmed.split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function ProductImage({ src, alt, style, className, sizes = DEFAULT_SIZES, priority = false, label, width, height }: Props) {
  const [errored, setErrored] = useState(false);

  if (src && !errored) {
    // Fixed-size mode for thumbnails — Next emits a tight srcSet around
    // the requested dimensions instead of the full deviceSizes ladder.
    if (width && height) {
      return (
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          style={{ objectFit: 'cover', width: '100%', height: '100%', ...style }}
          className={className}
          onError={() => setErrored(true)}
          unoptimized={src.startsWith('data:')}
        />
      );
    }
    return (
      <span style={{ position: 'relative', display: 'block', width: '100%', height: '100%', ...style }} className={className}>
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          style={{ objectFit: 'cover' }}
          onError={() => setErrored(true)}
          unoptimized={src.startsWith('data:')}
        />
      </span>
    );
  }

  // Gradient placeholder. `label` (brand / product name) drives the colour
  // hash + initials so different products in the same view look distinct.
  const placeholderLabel = label ?? alt ?? '';
  return (
    <div
      className={`${className ?? ''}`}
      role="presentation"
      style={{
        width: '100%', height: '100%',
        background: gradientFor(placeholderLabel || 'YP'),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'rgba(17,24,39,0.45)',
        fontFamily: 'var(--font-display, Georgia, serif)',
        fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
        fontWeight: 500,
        letterSpacing: '0.05em',
        userSelect: 'none',
        ...style,
      }}
    >
      {initialsOf(placeholderLabel || 'YP')}
    </div>
  );
}
