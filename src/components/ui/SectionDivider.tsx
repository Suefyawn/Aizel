import { LogoMark } from './LogoMark';

export function SectionDivider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ flex: 1, maxWidth: 120, height: 1, background: 'var(--line)' }} />
      <LogoMark size={14} />
      <div style={{ flex: 1, maxWidth: 120, height: 1, background: 'var(--line)' }} />
    </div>
  );
}
