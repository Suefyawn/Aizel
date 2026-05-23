import { LogoMark } from './LogoMark';

export function LogoWordmark({ color = 'var(--ink-900)' }: { color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <LogoMark size={28} />
      <span className="logo-wordmark" style={{
        fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: '1.25rem',
        color, letterSpacing: '-0.02em', whiteSpace: 'nowrap',
      }}>Aizel</span>
    </div>
  );
}
