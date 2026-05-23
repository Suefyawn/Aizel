// Shared admin loading-skeleton primitives. Composed by every admin
// `loading.tsx` so routes show a structured placeholder (instead of flashing
// blank/partial) while their async server component fetches data.
//
// Visual style matches the admin shell: grey placeholders (#e5e7eb / #f3f4f6),
// white cards, the `adm-page` padding wrapper. The shimmer is pure CSS — see
// the `.adm-skeleton` rule and `adm-skeleton-shimmer` keyframes in
// src/styles/globals.css. No JS animation, no client component needed.

import type { CSSProperties, ReactNode } from 'react';

/** A single shimmering grey placeholder block. */
export function SkeletonBlock({
  width,
  height = '1em',
  radius = 6,
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      className="adm-skeleton"
      style={{
        display: 'block',
        width: width ?? '100%',
        height,
        borderRadius: radius,
        ...style,
      }}
    />
  );
}

/** A short text-line placeholder. */
export function SkeletonText({
  width = '100%',
  height = 13,
  style,
}: {
  width?: number | string;
  height?: number | string;
  style?: CSSProperties;
}) {
  return <SkeletonBlock width={width} height={height} radius={4} style={style} />;
}

/** The `adm-page` padding wrapper plus a page-header placeholder (title +
 *  optional subtitle), so each loading.tsx opens like the real page. */
export function SkeletonPage({
  title = 170,
  subtitle,
  children,
}: {
  /** Width of the h1 placeholder. */
  title?: number | string;
  /** Width of the subtitle placeholder, or omit for no subtitle. */
  subtitle?: number | string;
  children: ReactNode;
}) {
  return (
    <div
      className="adm-page"
      style={{ padding: '32px 36px' }}
      aria-busy="true"
      aria-label="Loading"
    >
      <SkeletonText width={title} height={26} style={{ marginBottom: subtitle ? 10 : 24 }} />
      {subtitle !== undefined && (
        <SkeletonText width={subtitle} height={13} style={{ marginBottom: 28 }} />
      )}
      {children}
    </div>
  );
}

/** A row of stat-card placeholders, matching the admin `.adm-stat-grid`. */
export function SkeletonStatGrid({
  count = 4,
  columns,
  cardHeight = 94,
}: {
  count?: number;
  columns?: number;
  cardHeight?: number;
}) {
  return (
    <div
      className="adm-stat-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns ?? count}, 1fr)`,
        gap: 16,
        marginBottom: 24,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} style={{ height: cardHeight, padding: 0 }} />
      ))}
    </div>
  );
}

/** A white admin card container — drop placeholder content inside. */
export function SkeletonCard({
  children,
  style,
}: {
  children?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden="true"
      style={{
        background: 'white',
        borderRadius: 10,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        padding: 24,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** A white card holding N list/table rows — stands in for an admin table. */
export function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <SkeletonCard style={{ padding: 0, overflow: 'hidden' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '16px 20px',
            borderTop: i > 0 ? '1px solid #f3f4f6' : 'none',
          }}
        >
          <SkeletonBlock width={40} height={40} radius={8} />
          <SkeletonText width="34%" />
          <SkeletonText width="18%" style={{ marginLeft: 'auto' }} />
          <SkeletonBlock width={64} height={24} radius={20} />
        </div>
      ))}
    </SkeletonCard>
  );
}
