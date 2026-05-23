// Compact star-rating display. Renders five star glyphs with a partial
// gold fill clipped to the rating, plus an optional "4.8 (12)" label.
// Presentational only — no hooks, safe in server or client components.
//
// `rating` may arrive as a string: Postgres `numeric` columns come back
// from supabase-js as strings, so coerce defensively.

interface StarRatingProps {
  rating: number | string | null | undefined;
  count?: number | null;
  /** Star glyph size in px. */
  size?: number;
  /** Show the "4.8 (12)" text after the stars. Default true. */
  showCount?: boolean;
}

export function StarRating({ rating, count, size = 13, showCount = true }: StarRatingProps) {
  const value = Math.max(0, Math.min(5, Number(rating) || 0));
  const reviews = count ?? 0;
  const pct = (value / 5) * 100;
  const label = reviews > 0
    ? `Rated ${value.toFixed(1)} out of 5 from ${reviews} review${reviews === 1 ? '' : 's'}`
    : `Rated ${value.toFixed(1)} out of 5`;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} role="img" aria-label={label}>
      <span
        aria-hidden="true"
        style={{ position: 'relative', display: 'inline-block', fontSize: size, lineHeight: 1, letterSpacing: '1px' }}
      >
        <span style={{ color: '#e5e7eb' }}>★★★★★</span>
        <span style={{
          position: 'absolute', top: 0, left: 0,
          width: `${pct}%`, overflow: 'hidden', whiteSpace: 'nowrap',
          color: '#F7C948',
        }}>★★★★★</span>
      </span>
      {showCount && (
        <span style={{ fontSize: '0.75rem', color: 'var(--ink-500)', fontFamily: 'var(--font-ui)', whiteSpace: 'nowrap' }}>
          {value.toFixed(1)} ({reviews})
        </span>
      )}
    </span>
  );
}
