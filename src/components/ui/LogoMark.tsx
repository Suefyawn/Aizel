// Aizel monogram — a stylised "A" letterform that holds up at any size.
// Fills inherit the brand palette via CSS variables so the mark recolours
// automatically across seasonal themes (see globals.css `:root[data-theme]`).
export function LogoMark({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role="img"
      aria-label="Aizel"
    >
      {/* Purple disk — the brand surface */}
      <circle cx="12" cy="12" r="11" fill="var(--brand-pink)" />
      {/* Gold "A" — apex, two legs, crossbar */}
      <path
        d="M12 5 L17.5 18 H14.7 L13.7 15.5 H10.3 L9.3 18 H6.5 L12 5 Z M11 13.4 H13 L12 10.6 L11 13.4 Z"
        fill="var(--brand-yellow)"
      />
    </svg>
  );
}
