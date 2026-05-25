'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getRecentActivity, type ActivityItem,
} from '@/app/admin/activity-feed-actions';
import { RelativeTime } from '@/components/admin/RelativeTime';

// Dashboard activity feed. Polls every 30 seconds while the tab is
// visible — pauses when hidden so a forgotten tab doesn't hammer the
// audit_log table. New rows fade in subtly to signal "this is live."
//
// We could have used Supabase realtime, but a 30-second poll over
// `audit_log` is cheap (single index on created_at desc) and avoids
// the WebSocket reconnect / channel-subscription complexity for what
// is essentially a glanceable widget.

interface Props {
  /** Server-side first page so the widget paints instantly without an
   *  empty state on first render. */
  initial: ActivityItem[];
}

// Map action codes to a short human verb + an icon glyph + a colour
// tag. Anything not listed falls through to a generic "did <action>"
// rendering so a new event type can ship without code changes here.
const ACTION_META: Record<string, { label: string; icon: string; color: string }> = {
  'order.placed':         { label: 'placed',                icon: '◎', color: '#10b981' },
  'order.status_changed': { label: 'updated status of',     icon: '↻', color: '#3b82f6' },
  'order.refunded':       { label: 'refunded',              icon: '↩', color: '#0891b2' },
  'order.cancelled':      { label: 'cancelled',             icon: '✕', color: '#ef4444' },
  'customer.signup':      { label: 'signed up',             icon: '◉', color: '#6366f1' },
  'customer.extras_updated': { label: 'updated notes/tags for', icon: '🏷', color: '#8b5cf6' },
  'product.create':       { label: 'created',               icon: '＋', color: '#10b981' },
  'product.update':       { label: 'edited',                icon: '✎', color: '#6b7280' },
  'product.delete':       { label: 'deleted',               icon: '✕', color: '#ef4444' },
  'product.archive':      { label: 'archived',              icon: '⧉', color: '#9ca3af' },
  'review.submitted':     { label: 'left a review on',      icon: '★', color: '#f59e0b' },
  'review.approved':      { label: 'approved a review on',  icon: '✓', color: '#10b981' },
  'subscription.created': { label: 'subscribed to',         icon: '🔁', color: '#8b5cf6' },
  'newsletter.signup':    { label: 'joined the newsletter', icon: '✉', color: '#3b82f6' },
};

function meta(action: string) {
  return ACTION_META[action] ?? { label: action.replace(/[._]/g, ' '), icon: '·', color: '#6b7280' };
}

// Connection mode powers the "Live / Polling" pill in the header.
// 'sse' = server-pushing updates within seconds. 'poll' = fallback when
// EventSource fails (older browser, dropped websocket, blocked by a
// corporate proxy). Either way the feed stays fresh.
type ConnMode = 'sse' | 'poll';

export function ActivityFeedWidget({ initial }: Props) {
  const [items, setItems] = useState<ActivityItem[]>(initial);
  const [refreshedAt, setRefreshedAt] = useState<string>(new Date().toISOString());
  const [connMode, setConnMode] = useState<ConnMode>('poll');
  // Track which item IDs are new (vs. the initial server render) so we
  // can give them a tiny entrance flash without re-flashing on every poll.
  const [seenIds] = useState<Set<string>>(() => new Set(initial.map(i => i.id)));

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let es: EventSource | null = null;

    // Refresh the hydrated feed from the server action. Shared by SSE
    // ("something changed, go fetch") and the polling fallback.
    async function refresh() {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        const next = await getRecentActivity(20);
        if (!cancelled) {
          setItems(next);
          setRefreshedAt(new Date().toISOString());
        }
      } catch {
        // Soft-fail: keep current items.
      }
    }

    // ─── Polling fallback ───────────────────────────────────────────
    function schedulePoll() {
      if (pollTimer) clearTimeout(pollTimer);
      pollTimer = setTimeout(async () => {
        await refresh();
        if (!cancelled) schedulePoll();
      }, 30_000);
    }

    // ─── Server-Sent Events (primary) ───────────────────────────────
    // EventSource is supported everywhere except very old IE — but the
    // typeof guard means we degrade gracefully in any environment that
    // lacks it (test runners, old polyfilled bundles).
    if (typeof window !== 'undefined' && typeof window.EventSource !== 'undefined') {
      try {
        es = new window.EventSource(`/api/admin/activity/stream?since=${encodeURIComponent(new Date().toISOString())}`);
        es.addEventListener('hello', () => {
          if (!cancelled) setConnMode('sse');
        });
        es.addEventListener('activity', () => {
          // Server pushed "new rows since cursor" — refetch the
          // hydrated feed (carries the entity-name lookups).
          void refresh();
        });
        es.addEventListener('error', () => {
          // EventSource auto-reconnects on transient errors. If it
          // never recovers, flip the indicator to amber so the user
          // knows the live channel is down — polling still keeps the
          // data fresh.
          if (!cancelled) setConnMode('poll');
        });
      } catch {
        // Constructor failure (CSP, etc.) — fall through to polling.
        es = null;
      }
    }

    // Polling always runs as a backstop. It's a no-op when the tab is
    // hidden, and at 30s it's cheap even when SSE is also delivering.
    schedulePoll();

    function onVisibility() {
      if (!document.hidden) void refresh();
    }
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
      if (es) es.close();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <div style={{
      background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes aizel-activity-flash {
          0%   { background: #F5EFF8; }
          100% { background: transparent; }
        }
      `}</style>
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid #f3f4f6',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      }}>
        <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Activity</h2>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          title={connMode === 'sse'
            ? 'Server-pushed updates over a live stream.'
            : 'Live stream unavailable — polling every 30 seconds as a backstop.'}
        >
          <span aria-hidden="true" style={{
            width: 6, height: 6, borderRadius: '50%',
            background: connMode === 'sse' ? '#10b981' : '#d97706',
            boxShadow: connMode === 'sse'
              ? '0 0 0 3px rgba(16, 185, 129, 0.18)'
              : '0 0 0 3px rgba(217, 119, 6, 0.18)',
          }} />
          <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>
            {connMode === 'sse' ? 'Live' : 'Polling'} · refreshed <RelativeTime iso={refreshedAt} />
          </span>
        </div>
      </div>

      {items.length === 0 ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
          No activity yet. As orders + signups roll in, they&apos;ll show up here.
        </div>
      ) : (
        <div style={{ maxHeight: 380, overflowY: 'auto' }}>
          {items.map((it, i) => {
            const m = meta(it.action);
            const isNew = !seenIds.has(it.id);
            // Mark seen on render so subsequent polls don't keep
            // re-flashing the same row.
            if (isNew) seenIds.add(it.id);
            return (
              <div
                key={it.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '12px 20px',
                  borderTop: i > 0 ? '1px solid #f9fafb' : 'none',
                  animation: isNew ? 'aizel-activity-flash 1.6s ease-out' : undefined,
                }}
              >
                <span style={{
                  width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                  background: m.color + '18', color: m.color,
                  fontSize: '0.875rem',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>{m.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8125rem', color: '#374151', lineHeight: 1.4 }}>
                    <strong style={{ color: '#111827', fontWeight: 600 }}>{it.actor_label}</strong>
                    {' '}<span>{m.label}</span>{' '}
                    {it.href ? (
                      <Link href={it.href} style={{ color: '#4A1A6B', textDecoration: 'none', fontWeight: 600 }}>
                        {it.entity_label}
                      </Link>
                    ) : (
                      <span style={{ color: '#111827', fontWeight: 600 }}>{it.entity_label}</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: 2 }}>
                    <RelativeTime iso={it.created_at} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
