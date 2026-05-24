import { readAnalyticsCache, timeAgoShort } from '@/lib/analytics-cache';
import { AdminIcon } from '@/components/ui/AdminIcon';

interface PageRow { path: string; views: number; uniques: number; }
interface Data { items: PageRow[]; }

export async function TopPagesWidget() {
  const result = await readAnalyticsCache<Data>('posthog_top_pages');

  const cardStyle = {
    background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '24px',
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#4A1A6B', display: 'inline-flex' }}><AdminIcon name="document" size={16} /></span>
            Top pages
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
            Last 7 days{result ? ` · refreshed ${timeAgoShort(result.updatedAt)}` : ''}
          </p>
        </div>
      </div>

      {!result || !result.data.items?.length ? (
        <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: 0 }}>
          No page-view data yet.
        </p>
      ) : (
        <Rows items={result.data.items} />
      )}
    </div>
  );
}

function Rows({ items }: { items: PageRow[] }) {
  const max = Math.max(...items.map(i => i.views), 1);
  return (
    <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map(row => {
        const pct = (row.views / max) * 100;
        return (
          <li key={row.path} style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute', inset: 0, width: `${pct}%`,
              background: '#F5EFF8', borderRadius: 6,
              zIndex: 0,
            }} />
            <div style={{
              position: 'relative', zIndex: 1,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 10px', gap: 12,
            }}>
              <span
                style={{
                  fontSize: '0.8125rem', color: '#111827',
                  fontFamily: 'monospace',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  flex: 1, minWidth: 0,
                }}
                title={row.path}
              >
                {row.path}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#6b7280', flexShrink: 0 }}>
                <span style={{ fontWeight: 700, color: '#111827' }}>{row.views.toLocaleString()}</span>
                <span style={{ color: '#9ca3af', marginLeft: 6 }}>· {row.uniques}u</span>
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
