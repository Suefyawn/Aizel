import { readAnalyticsCache, timeAgoShort } from '@/lib/analytics-cache';

interface Rec {
  id: string;
  startTime: string;
  durationSeconds: number;
  viewerUrl: string;
}
interface Data { items: Rec[] }

const fmtDuration = (s: number) => {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0 ? `${m}m` : `${m}m ${r}s`;
};

const fmtWhen = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('en-PK', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

export async function SessionRecordingsWidget() {
  const result = await readAnalyticsCache<Data>('posthog_recordings');

  const cardStyle = {
    background: 'white', borderRadius: 10, padding: '20px 22px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  } as const;

  if (!result || result.data.items.length === 0) {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827', marginBottom: 4 }}>
          Latest session recordings
        </div>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#9ca3af' }}>
          No recordings yet — refresh analytics or verify session-recording is enabled in PostHog.
        </p>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
          Latest session recordings
        </h3>
        <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>
          {timeAgoShort(result.updatedAt)}
        </span>
      </div>
      <p style={{ margin: '0 0 12px', fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.5 }}>
        Click any session to open it in PostHog and watch the real user&apos;s screen recording.
      </p>
      <div style={{ display: 'grid', gap: 6 }}>
        {result.data.items.map(r => (
          <a
            key={r.id}
            href={r.viewerUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              padding: '10px 12px', borderRadius: 7,
              background: '#f9fafb', border: '1px solid #f3f4f6',
              textDecoration: 'none', color: '#111827',
              fontSize: '0.8125rem',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{fmtWhen(r.startTime)}</div>
              <div style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: 2 }}>
                {fmtDuration(r.durationSeconds)} · session {r.id.slice(0, 8)}
              </div>
            </div>
            <span style={{ color: '#C5286A', fontWeight: 600, fontSize: '0.75rem' }}>Watch →</span>
          </a>
        ))}
      </div>
    </div>
  );
}
