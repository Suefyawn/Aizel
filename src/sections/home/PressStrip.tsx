// UK-leaning beauty / lifestyle press outlets — placeholder strip until
// the merchant supplies real coverage logos. Editable here without a DB
// change.
const BRANDS = ['ELLE', 'VOGUE', 'STYLIST', 'GLAMOUR', 'COSMOPOLITAN', 'GRAZIA'];

export function PressStrip() {
  return (
    <section style={{ background: 'var(--ink-900)', padding: '24px 0' }}>
      <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 48, flexWrap: 'wrap' }}>
        {BRANDS.map(b => (
          <span key={b} style={{
            fontFamily: 'var(--font-ui)', fontSize: '0.75rem', fontWeight: 600,
            letterSpacing: '0.2em', textTransform: 'uppercase',
            color: 'rgba(250,246,238,0.35)',
          }}>{b}</span>
        ))}
      </div>
    </section>
  );
}
