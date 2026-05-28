// aziel crescent — the brand's signature flourish, lifted from the crescent
// that sits over the "i" in the wordmark. Used as a small decorative ornament
// (section dividers, the 404 page) where the full wordmark would be too much.
// Pure single-path crescent so it needs no <mask> / id (safe to render many
// times per page) and recolours via the `color` prop for dark surfaces.
export function LogoMark({ size = 20, color = 'var(--brand-pink)' }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role="img"
      aria-label="aziel"
    >
      <path
        d="M15.6 3.4 A 10 10 0 1 0 15.6 20.6 A 9.2 9.2 0 1 1 15.6 3.4 Z"
        transform="rotate(20 12 12)"
        fill={color}
      />
    </svg>
  );
}
