export function AnnouncementBar({ text, bgColor }: { text: string; bgColor: string }) {
  // Underline any £-amount tokens (e.g. "£15") so the offer stands out
  // from the surrounding copy without needing a separate styled component.
  const parts = text.split(/(£[\d,]+)/);
  return (
    <div style={{
      background: bgColor,
      color: '#fff',
      padding: '10px 0',
      textAlign: 'center',
      fontFamily: 'var(--font-ui)',
      fontSize: '0.75rem',
      fontWeight: 500,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
    }}>
      {parts.map((part, i) =>
        /^£/.test(part) ? (
          // Gold underline → soft white underline. The bar background is
          // already a dark brand surface, so a white-tinted underline keeps
          // the £-amount visually prominent without injecting gold into the
          // header chrome (which read as the YellowPink palette returning).
          <span key={i} style={{ borderBottom: '2px solid rgba(255,255,255,0.55)', paddingBottom: 1 }}>{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </div>
  );
}
