'use client';

// Simple shimmer/skeleton primitives. Use anywhere we render placeholders
// while async data loads. Pure CSS — no JS animation.

import type { CSSProperties } from 'react';

export function Skeleton({ style, width, height, radius = 6 }: {
  style?: CSSProperties;
  width?: number | string;
  height?: number | string;
  radius?: number | string;
}) {
  return (
    <span
      aria-hidden="true"
      className="skeleton"
      style={{
        display: 'block',
        width: width ?? '100%',
        height: height ?? '1em',
        borderRadius: radius,
        ...style,
      }}
    />
  );
}

/** Single product-tile skeleton — matches ProductTile dimensions. */
export function ProductTileSkeleton() {
  return (
    <div aria-hidden="true">
      <div style={{ width: '100%', aspectRatio: '1', borderRadius: 'var(--radius-card)', marginBottom: 12, overflow: 'hidden' }}>
        <Skeleton height="100%" radius="var(--radius-card)" />
      </div>
      <Skeleton height={10} width="40%" style={{ marginBottom: 6 }} />
      <Skeleton height={16} width="80%" style={{ marginBottom: 6 }} />
      <Skeleton height={14} width="30%" />
    </div>
  );
}

/** A grid of N tile skeletons — drop in while a product list is fetching. */
export function ProductGridSkeleton({ count = 8, columns = 4 }: { count?: number; columns?: number }) {
  return (
    <div
      aria-hidden="true"
      className="product-grid"
      style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 'var(--gutter)' }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <ProductTileSkeleton key={i} />
      ))}
    </div>
  );
}
