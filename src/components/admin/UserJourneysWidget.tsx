import { readAnalyticsCache, timeAgoShort } from '@/lib/analytics-cache';

interface Journey { journey: string; sessions: number }
interface Data { items: Journey[] }

// Top user journeys widget. Each row is a 4-step sequence of pathnames a
// session visited in order, with the count of distinct sessions that took
// that path. Fed by the posthog_journeys cache key written by
// refreshPostHog in dashboard/actions.ts.

export async function UserJourneysWidget() {
  const result = await readAnalyticsCache<Data>('posthog_journeys');

  const cardStyle = {
    background: 'white', borderRadius: 10, padding: '20px 22px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  } as const;

  if (!result || result.data.items.length === 0) {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827', marginBottom: 4 }}>
          Top user journeys
        </div>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#9ca3af' }}>
          No journey data yet — refresh analytics from the dashboard to populate.
        </p>
      </div>
    );
  }

  const items = result.data.items;
  const max = Math.max(...items.map(i => i.sessions), 1);

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
          Top user journeys
        </h3>
        <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>
          7-day · {timeAgoShort(result.updatedAt)}
        </span>
      </div>
      <p style={{ margin: '0 0 16px', fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.5 }}>
        First 4 pages visited per session, grouped by sequence. Shows where customers actually go on the site.
      </p>
      <div style={{ display: 'grid', gap: 6 }}>
        {items.map(i => (
          <div key={i.journey} style={{ display: 'grid', gridTemplateColumns: '1fr 60px', gap: 12, alignItems: 'center' }}>
            <div style={{
              position: 'relative', borderRadius: 6,
              background: '#f9fafb', overflow: 'hidden',
              padding: '8px 10px', fontSize: '0.75rem', color: '#374151',
              wordBreak: 'break-all', lineHeight: 1.5,
            }}>
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(197, 40, 106, 0.08)',
                width: `${(i.sessions / max) * 100}%`,
                transition: 'width 0.3s',
              }} aria-hidden />
              <span style={{ position: 'relative' }}>{i.journey || '(no path)'}</span>
            </div>
            <div style={{ fontSize: '0.8125rem', color: '#111827', fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {i.sessions.toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
