'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';

// ============================================================================
// Cash drawer / shift management.
//
// Each cashier opens a shift at the start of their session by declaring
// the opening float. Mid-shift cash movements (deposits, withdrawals,
// floats top-up) are logged to pos_cash_events with a kind + reason.
// At end of shift the cashier counts the drawer; the system computes the
// expected total and surfaces any discrepancy.
//
// Only ONE open shift per cashier at a time — the openShift() call
// refuses if there's already an open row for the staff_id.
// ============================================================================

const OpenSchema = z.object({
  opening_float: z.coerce.number().nonnegative().max(10_000),
});
const AdjustSchema = z.object({
  session_id: z.string().uuid(),
  amount:     z.number(),                     // signed — positive=in, negative=out
  kind:       z.enum(['cash_in', 'cash_out']),
  note:       z.string().min(2).max(200),
});
const CloseSchema = z.object({
  session_id:   z.string().uuid(),
  counted_cash: z.coerce.number().nonnegative().max(50_000),
  note:         z.string().max(500).optional(),
});

async function assertPos() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('pos.operate'))) {
    throw new Error('Unauthorized');
  }
  return session;
}

export interface ShiftSummary {
  session_id: string;
  opening_float: number;
  cash_sales: number;
  cash_refunds: number;
  cash_in: number;
  cash_out: number;
  /** opening_float + cash_sales − cash_refunds + cash_in − cash_out. */
  expected_cash: number;
  events_count: number;
}

/** Walk pos_cash_events for a given session and compute the live position. */
async function computeShiftPosition(sessionId: string): Promise<ShiftSummary | null> {
  const admin = supabaseAdmin();
  const [{ data: session }, { data: events }] = await Promise.all([
    admin.from('pos_sessions').select('opening_float').eq('id', sessionId).maybeSingle<{ opening_float: number }>(),
    admin.from('pos_cash_events').select('amount, kind').eq('session_id', sessionId),
  ]);
  if (!session) return null;

  let cash_sales = 0, cash_refunds = 0, cash_in = 0, cash_out = 0;
  for (const e of (events ?? []) as Array<{ amount: number; kind: string }>) {
    switch (e.kind) {
      case 'sale':     cash_sales   += Number(e.amount); break;
      case 'refund':   cash_refunds += Number(e.amount); break;
      case 'cash_in':  cash_in      += Number(e.amount); break;
      case 'cash_out': cash_out     += Number(e.amount); break;
    }
  }
  const opening = Number(session.opening_float);
  const expected_cash = opening + cash_sales + cash_refunds + cash_in + cash_out;
  // Note: refunds, cash_out are stored as NEGATIVE numbers — adding them
  // here is correct (cash_refunds and cash_out values will be ≤ 0).

  return {
    session_id: sessionId,
    opening_float: opening,
    cash_sales,
    cash_refunds: Math.abs(cash_refunds),  // surface as positive for the UI
    cash_in,
    cash_out: Math.abs(cash_out),
    expected_cash,
    events_count: (events ?? []).length,
  };
}

export async function getShiftSummary(sessionId: string): Promise<ShiftSummary | null> {
  await assertPos();
  return computeShiftPosition(sessionId);
}

export async function openShift(input: unknown): Promise<{ ok: boolean; error?: string; session_id?: string }> {
  const session = await assertPos();
  const parsed = OpenSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid float' };

  const admin = supabaseAdmin();

  // Refuse if there's already an open shift for this cashier.
  const { data: existing } = await admin
    .from('pos_sessions')
    .select('id')
    .eq('staff_id', session.id)
    .eq('status', 'open')
    .maybeSingle<{ id: string }>();
  if (existing) {
    return { ok: false, error: 'You already have an open shift. Close it before opening another.' };
  }

  const { data, error } = await admin
    .from('pos_sessions')
    .insert({
      staff_id:      session.id,
      opening_float: parsed.data.opening_float,
      status:        'open',
    })
    .select('id')
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? 'Could not open shift' };

  // Opening-float event so the cash journal balances cleanly.
  await admin.from('pos_cash_events').insert({
    session_id: data.id,
    amount:     parsed.data.opening_float,
    kind:       'opening_float',
    note:       `Float declared by ${session.name}`,
    actor_id:   session.id,
  });

  await logAudit(session, {
    action: 'pos.shift_open',
    entity: 'pos_session',
    entity_id: data.id,
    diff: { opening_float: parsed.data.opening_float },
  });

  revalidatePath('/admin/pos');
  return { ok: true, session_id: data.id };
}

export async function adjustCash(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const session = await assertPos();
  const parsed = AdjustSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  // Sign convention enforcement — cash_in is positive, cash_out is negative.
  const signedAmount =
    parsed.data.kind === 'cash_in' ? Math.abs(parsed.data.amount)
    /* cash_out */                  : -Math.abs(parsed.data.amount);

  if (signedAmount === 0) return { ok: false, error: 'Amount cannot be zero.' };

  await supabaseAdmin().from('pos_cash_events').insert({
    session_id: parsed.data.session_id,
    amount:     signedAmount,
    kind:       parsed.data.kind,
    note:       parsed.data.note,
    actor_id:   session.id,
  });

  await logAudit(session, {
    action: 'pos.cash_adjust',
    entity: 'pos_session',
    entity_id: parsed.data.session_id,
    diff: { kind: parsed.data.kind, amount: signedAmount, note: parsed.data.note },
  });

  revalidatePath('/admin/pos');
  return { ok: true };
}

export async function closeShift(input: unknown): Promise<{
  ok: boolean;
  error?: string;
  summary?: ShiftSummary & { counted_cash: number; discrepancy: number };
}> {
  const session = await assertPos();
  const parsed = CloseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const position = await computeShiftPosition(parsed.data.session_id);
  if (!position) return { ok: false, error: 'Shift not found' };

  const discrepancy = parsed.data.counted_cash - position.expected_cash;

  const admin = supabaseAdmin();
  await admin.from('pos_sessions').update({
    closed_at:     new Date().toISOString(),
    expected_cash: position.expected_cash,
    counted_cash:  parsed.data.counted_cash,
    discrepancy,
    close_note:    parsed.data.note ?? null,
    status:        'closed',
  }).eq('id', parsed.data.session_id);

  // Anchor event so the journal explicitly marks the close-time count.
  await admin.from('pos_cash_events').insert({
    session_id: parsed.data.session_id,
    amount:     0,
    kind:       'closing_count',
    note:       `Counted £${parsed.data.counted_cash.toFixed(2)}, expected £${position.expected_cash.toFixed(2)}, diff £${discrepancy.toFixed(2)}`,
  });

  await logAudit(session, {
    action: 'pos.shift_close',
    entity: 'pos_session',
    entity_id: parsed.data.session_id,
    diff: {
      opening_float: position.opening_float,
      cash_sales:    position.cash_sales,
      expected_cash: position.expected_cash,
      counted_cash:  parsed.data.counted_cash,
      discrepancy,
    },
  });

  revalidatePath('/admin/pos');
  return {
    ok: true,
    summary: { ...position, counted_cash: parsed.data.counted_cash, discrepancy },
  };
}
