import { readAnalyticsCache, timeAgoShort } from '@/lib/analytics-cache';
import { AdminIcon } from '@/components/ui/AdminIcon';

interface EventRow { event: string; count: number; uniques: number; }
interface ReferrerRow { source: string; visitors: number; }
interface EventsData { items: EventRow[] }
interface ReferrersData { items: ReferrerRow[] }

// Two-pane card: top events + top referrers side-by-side. Both rendered in
// the same component so the dashboard layout doesn't need an extra grid cell.

export async function TopEventsWidget() {
  const [events, referrers] = await Promise.all([
    readAnalyticsCache<EventsData>('posthog_top_events'),
    readAnalyticsCache<ReferrersData>('posthog_top_referrers'),
  ]);

  const cardStyle = {
    background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '24px',
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#C5286A', display: 'inline-flex' }}><AdminIcon name="bolt" size={16} /></span>
            Top events &amp; sources
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
            Last 7 days{events ? ` · refreshed ${timeAgoShort(events.updatedAt)}` : ''}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }} className="adm-analytics-grid">
        <Column
          heading="Events"
          empty="No event data yet."
          items={events?.data.items.map(e => ({ label: e.event, count: e.count, sub: `${e.uniques} unique` })) ?? []}
          accent="#6366f1"
        />
        <Column
          heading="Sources"
          empty="No referrer data yet."
          items={referrers?.data.items.map(r => ({ label: r.source, count: r.visitors, sub: 'visitors' })) ?? []}
          accent="#10b981"
        />
      </div>
    </div>
  );
}

interface RowItem { label: string; count: number; sub: string }

function Column({ heading, items, empty, accent }: { heading: string; items: RowItem[]; empty: string; accent: string }) {
  const max = Math.max(...items.map(i => i.count), 1);
  return (
    <div>
      <div style={{
        fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280',
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
      }}>{heading}</div>
      {items.length === 0 ? (
        <p style={{ color: '#9ca3af', fontSize: '0.8125rem', margin: 0 }}>{empty}</p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map(item => {
            const pct = (item.count / max) * 100;
            return (
              <li key={item.label} style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute', inset: 0, width: `${pct}%`,
                  background: `${accent}15`, borderRadius: 6, zIndex: 0,
                }} />
                <div style={{
                  position: 'relative', zIndex: 1,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '6px 10px', gap: 8,
                }}>
                  <span style={{
                    fontSize: '0.8125rem', color: '#111827',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    flex: 1, minWidth: 0,
                  }} title={item.label}>
                    {item.label}
                  </span>
                  <span style={{ fontSize: '0.75rem', flexShrink: 0 }}>
                    <span style={{ fontWeight: 700, color: '#111827' }}>{item.count.toLocaleString()}</span>
                    <span style={{ color: '#9ca3af', marginLeft: 6 }}>{item.sub}</span>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
