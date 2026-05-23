// ============================================================================
// Generic courier-webhook ingestion. Each PK courier has a different
// signature scheme; for now this endpoint accepts a shared secret in the
// `Authorization: Bearer <COURIER_WEBHOOK_SECRET>` header so unauthenticated
// callers can't spoof status updates.
//
// Expected JSON body (flexible — couriers vary):
//   {
//     "courier": "TCS",
//     "tracking_number": "1234567",
//     "status": "Out for Delivery",     // any string; normaliseCourierStatus maps it
//     "description": "Optional human-readable note",
//     "occurred_at": "2026-05-21T12:00:00Z"   // optional
//   }
//
// We look up the matching shipment by (courier, tracking_number), append a
// shipment_event row, and update the shipment status. The triggers from
// 20260521_040_shipments.sql cascade the change to orders.status if
// applicable.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normaliseCourierStatus } from '@/lib/couriers';

interface Payload {
  courier?: string;
  tracking_number?: string;
  status?: string;
  description?: string;
  occurred_at?: string;
}

function authorize(req: NextRequest): boolean {
  // P1: fail closed if COURIER_WEBHOOK_SECRET isn't set. Unauthenticated
  // delivery events would otherwise let anyone trip the loyalty-points
  // trigger that pays out on first 'delivered' status.
  const expected = process.env.COURIER_WEBHOOK_SECRET;
  if (!expected) return false;
  return req.headers.get('authorization') === `Bearer ${expected}`;
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  if (!body.courier || !body.tracking_number || !body.status) {
    return NextResponse.json({ error: 'courier, tracking_number, status required' }, { status: 400 });
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: shipment, error: lookupErr } = await sb
    .from('shipments')
    .select('id')
    .eq('courier', body.courier)
    .eq('tracking_number', body.tracking_number)
    .maybeSingle();

  if (lookupErr) return NextResponse.json({ error: lookupErr.message }, { status: 500 });
  if (!shipment) return NextResponse.json({ error: 'shipment not found' }, { status: 404 });

  const normalised = normaliseCourierStatus(body.status);

  await sb.from('shipment_events').insert({
    shipment_id: shipment.id,
    status: normalised,
    description: body.description ?? body.status,
    occurred_at: body.occurred_at ?? new Date().toISOString(),
    raw_payload: body as unknown as Record<string, unknown>,
  });

  const updates: Record<string, unknown> = { status: normalised };
  if (normalised === 'delivered') updates.delivered_at = body.occurred_at ?? new Date().toISOString();

  const { error: updErr } = await sb.from('shipments').update(updates).eq('id', shipment.id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, status: normalised });
}
