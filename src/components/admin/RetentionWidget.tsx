import { readAnalyticsCache, timeAgoShort } from '@/lib/analytics-cache';

interface Row { week: string; users: number }
interface Data { items: Row[] }

const fmtWeek = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

export async function RetentionWidget() {
  const result = await readAnalyticsCache<Data>('posthog_retention');

  const cardStyle = {
    background: 'white', borderRadius: 10, padding: '20px 22px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  } as const;

  if (!result || result.data.items.length === 0) {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827', marginBottom: 4 }}>
          Weekly active users
        </div>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#9ca3af' }}>
          No data yet — refresh analytics to populate.
        </p>
      </div>
    );
  }

  const items = result.data.items;
  const max = Math.max(...items.map(i => i.users), 1);
  const w = 240, h = 80, pad = 6;
  const x = (i: number) => pad + (i / Math.max(items.length - 1, 1)) * (w - pad * 2);
  const y = (n: number) => h - pad - (n / max) * (h - pad * 2);
  const pts = items.map((i, idx) => `${x(idx)},${y(i.users)}`).join(' ');

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
          Weekly active users
        </h3>
        <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>
          4-week · {timeAgoShort(result.updatedAt)}
        </span>
      </div>
      <p style={{ margin: '0 0 12px', fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.5 }}>
        Distinct visitors per week (a retention proxy). Up-trend = customers returning.
      </p>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Weekly active users trend" style={{ display: 'block', marginBottom: 8 }}>
        <polyline points={pts} fill="none" stroke="#4A1A6B" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {items.map((it, idx) => (
          <circle key={idx} cx={x(idx)} cy={y(it.users)} r="2.5" fill="#4A1A6B" />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: '#9ca3af' }}>
        {items.map(it => (
          <div key={it.week} style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 600, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
              {it.users.toLocaleString()}
            </div>
            <div>{fmtWeek(it.week)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
