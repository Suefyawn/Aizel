import { isDemo } from '@/lib/supabase';

// Thin yellow strip at the very top of every page when Supabase isn't
// configured. Helps reviewers immediately understand what they're looking at.
export function DemoBanner() {
  if (!isDemo) return null;
  return (
    <div
      role="status"
      style={{
        background: '#D4A437', color: '#111827',
        textAlign: 'center', padding: '6px 16px',
        fontSize: '0.75rem', fontWeight: 700,
        letterSpacing: '0.05em', textTransform: 'uppercase',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
      }}
    >
      Demo mode · stub data · set <code style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>NEXT_PUBLIC_SUPABASE_URL</code> + <code style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> for live data
    </div>
  );
}
