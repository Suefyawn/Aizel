import { readAnalyticsCache, timeAgoShort } from '@/lib/analytics-cache';
import { AdminIcon } from '@/components/ui/AdminIcon';

interface PHData {
  pageviews: number;
  uniqueUsers: number;
  sessions: number;
  trend: { date: string; count: number }[];
}

function MiniSparkline({ trend }: { trend: { date: string; count: number }[] }) {
  if (!trend.length) return null;
  const max = Math.max(...trend.map(d => d.count), 1);
  const w = 160, h = 36;
  const pts = trend.map((d, i) => {
    const x = (i / Math.max(trend.length - 1, 1)) * w;
    const y = h - (d.count / max) * h;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }} role="img" aria-label="Pageviews trend">
      <polyline points={pts} fill="none" stroke="#4A1A6B" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export async function PostHogWidget() {
  const result = await readAnalyticsCache<PHData>('posthog');

  const cardStyle = {
    background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '24px',
  };

  if (!result) {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ color: '#4A1A6B', display: 'inline-flex' }}><AdminIcon name="bar-chart" size={18} /></span>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>PostHog analytics</h2>
        </div>
        <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: 0 }}>No data yet — hit Refresh analytics.</p>
      </div>
    );
  }

  const { data: stats, updatedAt } = result;
  const statItems = [
    { label: 'Pageviews',    value: stats.pageviews,   color: '#4A1A6B' },
    { label: 'Unique users', value: stats.uniqueUsers, color: '#8b5cf6' },
    { label: 'Sessions',     value: stats.sessions,    color: '#3b82f6' },
  ];

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#4A1A6B', display: 'inline-flex' }}><AdminIcon name="bar-chart" size={18} /></span>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>PostHog analytics</h2>
        </div>
        <a
          href="https://us.posthog.com/project/429225"
          target="_blank" rel="noopener noreferrer"
          style={{ fontSize: '0.8125rem', color: '#4A1A6B', textDecoration: 'none' }}
        >
          Open PostHog →
        </a>
      </div>

      <p style={{ margin: '0 0 16px', fontSize: '0.75rem', color: '#9ca3af' }}>
        Last 7 days · refreshed {timeAgoShort(updatedAt)}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {statItems.map(s => (
          <div key={s.label} style={{
            background: s.color + '10', borderRadius: 8, padding: '12px',
            textAlign: 'center', border: `1px solid ${s.color}22`,
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color }}>
              {s.value.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Daily pageviews</span>
        <MiniSparkline trend={stats.trend} />
      </div>
    </div>
  );
}
