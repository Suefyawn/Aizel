'use client';

// Small client component for any printable page that wants an explicit
// "Print now" button (separate from the AutoPrintOnLoad ?print=1 flow).
// Lives outside the page so the rest of the report can stay a server
// component — keeps the bundle small.
export function PrintNowButton({ label = 'Print now', style }: { label?: string; style?: React.CSSProperties }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      style={style ?? {
        padding: '8px 16px', background: '#4A1A6B', color: 'white',
        border: 'none', borderRadius: 7, fontSize: '0.8125rem', fontWeight: 600,
        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
        minHeight: 36,
      }}
    >
      🖨 {label}
    </button>
  );
}
