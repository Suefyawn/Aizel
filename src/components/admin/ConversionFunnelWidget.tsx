import { readAnalyticsCache, timeAgoShort } from '@/lib/analytics-cache';
import { AdminIcon } from '@/components/ui/AdminIcon';

interface FunnelStep {
  label: string;
  event: string;
  count: number;
}
interface FunnelData {
  steps: FunnelStep[];
}

// 5-step horizontal funnel: home → product → cart → checkout → purchase.
// Each bar is sized as % of the top-of-funnel step so drop-off is visible
// at a glance. Conversion % between consecutive steps shown below the labels.

export async function ConversionFunnelWidget() {
  const result = await readAnalyticsCache<FunnelData>('posthog_funnel');

  const cardStyle = {
    background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    padding: '24px',
  };

  if (!result || !result.data?.steps?.length) {
    return (
      <div style={cardStyle}>
        <Header updatedAt={null} />
        <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: 0 }}>
          No funnel data yet. Run the analytics refresh after some traffic has flowed.
        </p>
      </div>
    );
  }

  const { steps } = result.data;
  const top = steps[0]?.count ?? 0;

  // Per-step conversion (this step / previous step). First step is always
  // 100% (it's the funnel mouth).
  const conversions = steps.map((s, i) => {
    if (i === 0) return 100;
    const prev = steps[i - 1].count;
    return prev > 0 ? Math.round((s.count / prev) * 100) : 0;
  });

  const COLOURS = ['#6366f1', '#8b5cf6', '#C5286A', '#f59e0b', '#10b981'];

  return (
    <div style={cardStyle}>
      <Header updatedAt={result.updatedAt} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {steps.map((s, i) => {
          const widthPct = top > 0 ? Math.max((s.count / top) * 100, 2) : 0;
          const conv = conversions[i];
          return (
            <div key={s.event}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: '0.8125rem', color: '#111827', fontWeight: 600 }}>
                  {i + 1}. {s.label}
                </span>
                <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                  {s.count.toLocaleString()} {i > 0 && (
                    <span style={{
                      marginLeft: 8, fontWeight: 600,
                      color: conv >= 50 ? '#10b981' : conv >= 25 ? '#f59e0b' : '#ef4444',
                    }}>
                      {conv}% →
                    </span>
                  )}
                </span>
              </div>
              <div style={{ height: 12, background: '#f3f4f6', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${widthPct}%`,
                  background: COLOURS[i] ?? '#6366f1',
                  borderRadius: 6, transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Header({ updatedAt }: { updatedAt: string | null }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#C5286A', display: 'inline-flex' }}><AdminIcon name="cart" size={16} /></span>
          Conversion funnel
        </h2>
        <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
          Last 7 days{updatedAt ? ` · refreshed ${timeAgoShort(updatedAt)}` : ''}
        </p>
      </div>
    </div>
  );
}
