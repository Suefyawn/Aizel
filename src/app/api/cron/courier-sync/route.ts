// ============================================================================
// Vercel Cron: poll courier APIs for status updates on every in-transit
// shipment. Each adapter returns normalised events; we insert them into
// shipment_events and update shipments.status. The shipments_sync_order
// trigger (migration 20260521_040_shipments.sql) then cascades the status
// change to orders.status — which fires the order-status-change emails
// (shipped / delivered).
//
// Scheduled hourly in vercel.json. Safe to run more often; the adapter
// returns events with timestamps and we dedupe on (shipment_id, occurred_at)
// before insert.
//
// Status filter: we only poll shipments that are NOT in a terminal state
// ('delivered', 'returned', 'cancelled', 'failed'). Anything that's been
// terminal more than 7 days ago gets skipped permanently — those rarely
// move and the courier APIs sometimes 404 on aged consignments.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAdapter } from '@/lib/couriers';

interface ShipmentRow {
  id: string;
  order_id: string;
  courier: string;
  tracking_number: string;
  status: string;
}

interface EventRow {
  shipment_id: string;
  status: string;
  description: string;
  occurred_at: string;
  raw_payload: Record<string, unknown> | null;
}

const TERMINAL = new Set(['delivered', 'returned', 'cancelled', 'failed']);
// Cap how many shipments we touch per run. Each one is ~1 API round-trip
// + 1 Supabase write. 200 keeps a Vercel function under the 10 s timeout
// even on a sluggish courier API.
const MAX_PER_RUN = 200;

async function authorize(req: NextRequest): Promise<boolean> {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return req.headers.get('authorization') === `Bearer ${expected}`;
}

export async function GET(req: NextRequest) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // Pull shipments that:
  //   - are in a non-terminal state
  //   - have an actual tracking number (not the empty manual placeholder)
  //   - aren't older than 60 days (cap aged consignments per spec)
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const { data: shipments, error: lookupErr } = await sb
    .from('shipments')
    .select('id, order_id, courier, tracking_number, status')
    .not('status', 'in', `(${Array.from(TERMINAL).map(s => `'${s}'`).join(',')})`)
    .gte('shipped_at', sixtyDaysAgo)
    .neq('tracking_number', '')
    .limit(MAX_PER_RUN);

  if (lookupErr) return NextResponse.json({ error: lookupErr.message }, { status: 500 });

  const rows = (shipments ?? []) as ShipmentRow[];
  // Bucket by courier so we only resolve each adapter once.
  const byCourier = new Map<string, ShipmentRow[]>();
  for (const s of rows) {
    const list = byCourier.get(s.courier) ?? [];
    list.push(s);
    byCourier.set(s.courier, list);
  }

  let polled = 0;
  let updated = 0;
  const noAdapter: string[] = [];
  const errors: Array<{ courier: string; tracking: string; message: string }> = [];

  for (const [courier, courierShipments] of byCourier) {
    const adapter = getAdapter(courier);
    if (!adapter) {
      noAdapter.push(courier);
      continue;
    }
    if (!adapter.capabilities.track) {
      noAdapter.push(`${courier} (no track capability)`);
      continue;
    }
    // Run them in parallel but cap concurrency — a slow courier shouldn't
    // tie up the whole loop. 8 in flight is a safe default for PK
    // couriers that typically return in <500 ms.
    const CONCURRENCY = 8;
    for (let i = 0; i < courierShipments.length; i += CONCURRENCY) {
      const batch = courierShipments.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(async (s) => {
        polled++;
        const r = await adapter.track(s.tracking_number);
        if (!('ok' in r) || !r.ok) {
          errors.push({ courier, tracking: s.tracking_number, message: r.message });
          return;
        }
        if (r.events.length === 0) return;

        // Dedupe vs. existing events: pull the latest event timestamp we
        // already have for this shipment; only insert events newer than it.
        const { data: latest } = await sb
          .from('shipment_events')
          .select('occurred_at')
          .eq('shipment_id', s.id)
          .order('occurred_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        const since = latest?.occurred_at ? new Date(latest.occurred_at as string).getTime() : 0;

        const newEvents: EventRow[] = r.events
          .filter(e => new Date(e.occurredAt).getTime() > since)
          .map(e => ({
            shipment_id: s.id,
            status: e.status,
            description: e.description,
            occurred_at: e.occurredAt,
            raw_payload: null,
          }));

        if (newEvents.length > 0) {
          await sb.from('shipment_events').insert(newEvents);
        }
        // Update shipment status to the latest if it actually changed.
        const newest = r.current ?? r.events[0]?.status;
        if (newest && newest !== s.status) {
          const update: Record<string, unknown> = { status: newest };
          if (newest === 'delivered') update.delivered_at = r.events[0]?.occurredAt ?? new Date().toISOString();
          await sb.from('shipments').update(update).eq('id', s.id);
          updated++;
        }
      }));
    }
  }

  return NextResponse.json({
    ok: true,
    polled,
    updated,
    no_adapter_couriers: Array.from(new Set(noAdapter)),
    errors: errors.slice(0, 10),
    error_count: errors.length,
  });
}
