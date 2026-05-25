import { NextRequest } from 'next/server';
import { getStaffSession } from '@/lib/staff-auth';
import { can } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';

// Server-Sent Events stream for the dashboard activity feed.
//
// Why SSE rather than Supabase Realtime: audit_log RLS blocks anon
// SELECT and Aizel uses HMAC-signed staff cookies (not Supabase Auth),
// so the browser client can't subscribe to Postgres Changes here. The
// service-role client CAN read audit_log; this route uses it to poll
// every 5 seconds server-side and pushes only newly-inserted rows to
// the connected admin. Latency drops from "next 30s client tick" to
// "≤5s + push", and the bandwidth bill is a single long-lived stream
// per tab instead of repeated full-list polls.
//
// The widget keeps its 30s client poll as a backstop — if the SSE
// connection drops and EventSource's auto-reconnect can't recover,
// the user still sees fresh data within 30s.

// Force-dynamic so Next.js doesn't try to statically prerender this
// route — it's a long-lived stream, not a cacheable response.
export const dynamic = 'force-dynamic';
// We need the Node runtime (not Edge) because we use the server-role
// Supabase client which reads the SUPABASE_SERVICE_ROLE_KEY env var.
export const runtime = 'nodejs';

// How often we ask Postgres for new rows. 5s is the right floor: any
// faster and we're polling the DB harder than the page warrants; any
// slower and we lose the "feels live" payoff over the existing client
// poll. Each poll only fetches rows with id > cursor, so the query
// shape stays cheap (PK index + bounded LIMIT).
const POLL_INTERVAL_MS = 5_000;
// Heartbeat comment every 25s to keep proxies / load balancers from
// reaping the connection. SSE-spec: lines starting with `:` are
// ignored by the client.
const HEARTBEAT_MS = 25_000;

interface AuditRow {
  id: string;
  created_at: string;
}

export async function GET(req: NextRequest) {
  const session = await getStaffSession();
  // Same gate as the polling action (getRecentActivity) — analytics
  // is the lowest perm any staffer who lands on the dashboard holds.
  if (!session || !can(session, 'analytics')) {
    return new Response('Unauthorized', { status: 401 });
  }

  const admin = supabaseAdmin();
  // Optional `?since=<iso>` lets the client tell us the timestamp of
  // the newest row it already has, so we don't re-push old rows on
  // reconnect. Defaults to "now" — first connect won't backfill, the
  // server-rendered first page already covered that.
  const sinceParam = req.nextUrl.searchParams.get('since');
  let lastSeen = sinceParam && !Number.isNaN(Date.parse(sinceParam))
    ? new Date(sinceParam).toISOString()
    : new Date().toISOString();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // SSE framing helper. Each event is a `data:` line followed by
      // a blank line; an optional `event:` line names the channel
      // (the client listens with `addEventListener('activity', ...)`).
      function send(event: string, payload: unknown) {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
        } catch {
          // Stream's already torn down; cleanup runs in the cancel handler.
        }
      }
      function ping() {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch { /* see above */ }
      }

      // Greet the client so EventSource fires `onopen` quickly. The
      // server-rendered widget already shows the latest 20 items;
      // this just confirms we're live.
      send('hello', { ok: true, since: lastSeen });

      const heartbeat = setInterval(ping, HEARTBEAT_MS);
      const poll = setInterval(async () => {
        try {
          const { data, error } = await admin
            .from('audit_log')
            .select('id, created_at')
            .gt('created_at', lastSeen)
            .order('created_at', { ascending: true })
            .limit(50);
          if (error) return;
          const rows = (data ?? []) as AuditRow[];
          if (rows.length === 0) return;
          // Advance the cursor so the next tick only fetches newer rows.
          lastSeen = rows[rows.length - 1].created_at;
          // The client just needs a "something changed" signal — it
          // refetches the hydrated feed via the existing server action,
          // which carries the entity-name lookups. Pushing only IDs
          // here means we don't duplicate the hydration code in two
          // places, and the SSE payload stays tiny.
          send('activity', { count: rows.length, latest_at: lastSeen });
        } catch {
          // Soft-fail — next tick tries again. We don't tear down
          // because transient DB hiccups happen.
        }
      }, POLL_INTERVAL_MS);

      // Cleanup when the client disconnects (tab close, nav away,
      // EventSource.close()).
      const onAbort = () => {
        clearInterval(heartbeat);
        clearInterval(poll);
        try { controller.close(); } catch { /* already closed */ }
      };
      req.signal.addEventListener('abort', onAbort);
    },
    cancel() {
      // ReadableStream's own cancel — also fires on client disconnect
      // depending on the runtime. The interval handles above are
      // captured by closure, but the abort listener wires them up.
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      // Disable Nginx buffering, otherwise events queue up until the
      // buffer flushes (typically 4KB) instead of streaming.
      'X-Accel-Buffering': 'no',
    },
  });
}
