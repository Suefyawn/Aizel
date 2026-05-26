// Aizel monogram — a stroke-only "A" letterform sitting inside a purple
// roundel. The earlier mark stacked a filled gold serif "A" on a purple
// disc; that read as the old previous-brand + serif-y aesthetic. This version
// is single-stroke geometric and reads modern at any size (16px favicon
// through 64px hero usage), with no second colour to compete with the
// rebrand palette.
//
// Variables: the disc inherits `--brand-pink` so seasonal themes recolour
// the mark automatically (see :root[data-theme] in globals.css).
export function LogoMark({ size = 20 }: { size?: number }) {
  // Stroke scales with the icon — keeps the letterform legible at favicon
  // size (16-20px) without going chunky at 48px+ hero usage.
  const stroke = Math.max(1.4, size / 14);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role="img"
      aria-label="Aizel"
    >
      {/* Purple disc — the brand surface. */}
      <circle cx="12" cy="12" r="11" fill="var(--brand-pink)" />
      {/* Geometric "A" — apex top-centre, two legs to the baseline, a
          shorter crossbar at ~⅔ height. Rounded line joins keep the
          letterform soft enough to feel hand-shaped at large sizes. */}
      <path
        d="M8.4 17 L12 7 L15.6 17 M9.7 13.6 L14.3 13.6"
        stroke="#FFFFFF"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
