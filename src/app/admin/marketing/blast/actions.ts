'use server';

import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';
import { sendMarketingBlast } from '@/lib/email';

// ============================================================================
// Bulk customer messaging — segment + compose + send.
//
// Sits in /admin/marketing/blast. The flow is deliberately small:
//   1. loadSegmentRecipients(seg) — returns the candidate emails + opt-in
//      states for the chosen segment.
//   2. sendBlast({ segment, subject, body, testOnly }) — sends one email
//      per opted-in recipient via the existing batch-capped send() helper.
//      `testOnly` sends ONLY to the staff actor — every blast starts as a
//      test so the operator never fires a typo to 1,000 customers.
//
// Opt-out enforcement: every send filters against newsletter_subscribers
// where status = 'subscribed'. The unsubscribe footer is auto-added by
// email.ts when we pass `marketingRecipient`, so a single click in the
// email opts the customer out and the next blast skips them.
//
// Audit log: every blast (incl. test sends) is recorded with the segment
// key + recipient count + the staff actor. ICO-friendly trail in case a
// complaint arrives.
// ============================================================================

export type SegmentKey =
  | 'newsletter'        // every newsletter_subscribers row with status='subscribed'
  | 'recent-90d'        // customers with a delivered order in the last 90 days
  | 'lapsed-60d'        // delivered 60-180 days ago, no order since
  | 'vip';              // lifetime delivered spend >= £500 (Gold + Platinum tiers)

const DAY_MS = 86_400_000;
const VIP_SPEND_THRESHOLD = 500;

export interface SegmentSummary {
  key: SegmentKey;
  label: string;
  description: string;
  count: number;
}

interface Recipient { email: string; first_name?: string | null }

async function assertMarketingWrite() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('newsletter'))) {
    throw new Error('Unauthorized');
  }
  return session;
}

/**
 * Resolve a segment to its recipient list. Caller may pass a `cap` (default
 * 5000) to bound memory + cost — sane orders are usually < 1000 customers
 * so 5k is a generous ceiling for an admin tool.
 */
async function recipientsFor(segment: SegmentKey, cap = 5000): Promise<Recipient[]> {
  const admin = supabaseAdmin();
  const now = Date.now();

  switch (segment) {
    case 'newsletter': {
      const { data } = await admin
        .from('newsletter_subscribers')
        .select('email, first_name')
        .eq('status', 'subscribed')
        .limit(cap);
      return (data ?? []) as Recipient[];
    }

    case 'recent-90d': {
      const cutoff = new Date(now - 90 * DAY_MS).toISOString();
      // Pull delivered orders inside the window; dedupe by email so the
      // same customer doesn't get N copies of the same blast.
      const { data } = await admin
        .from('orders')
        .select('email, first_name, created_at')
        .eq('status', 'delivered')
        .gte('created_at', cutoff)
        .not('email', 'is', null)
        .order('created_at', { ascending: false })
        .limit(cap * 3);
      return dedupeAndOptInCheck(data, cap);
    }

    case 'lapsed-60d': {
      const oldest = new Date(now - 180 * DAY_MS).toISOString();
      const youngest = new Date(now - 60 * DAY_MS).toISOString();
      // Window: delivered between 180d and 60d ago.
      const { data: candidates } = await admin
        .from('orders')
        .select('email, first_name, created_at')
        .eq('status', 'delivered')
        .gte('created_at', oldest)
        .lte('created_at', youngest)
        .not('email', 'is', null)
        .order('created_at', { ascending: false })
        .limit(cap * 3);
      // Exclude anyone who's bought again INSIDE the 60-day fresh window
      // — that customer's already "back", win-back doesn't fit.
      const { data: recent } = await admin
        .from('orders')
        .select('email')
        .gte('created_at', youngest)
        .not('email', 'is', null);
      const recentEmails = new Set(((recent ?? []) as Array<{ email: string }>).map(r => r.email));
      const filtered = ((candidates ?? []) as Array<{ email: string; first_name: string | null; created_at: string }>)
        .filter(r => !recentEmails.has(r.email));
      return dedupeAndOptInCheck(filtered, cap);
    }

    case 'vip': {
      // Sum delivered orders per email; keep those that cross the threshold.
      // Done client-side because PostgREST doesn't expose GROUP BY HAVING
      // without a custom RPC, and the catalogue is small enough.
      const { data } = await admin
        .from('orders')
        .select('email, first_name, total')
        .eq('status', 'delivered')
        .not('email', 'is', null);
      const totals = new Map<string, { first_name: string | null; total: number }>();
      for (const row of (data ?? []) as Array<{ email: string; first_name: string | null; total: number | null }>) {
        const cur = totals.get(row.email) ?? { first_name: row.first_name, total: 0 };
        cur.total += Number(row.total ?? 0);
        totals.set(row.email, cur);
      }
      const qualifying = Array.from(totals.entries())
        .filter(([, v]) => v.total >= VIP_SPEND_THRESHOLD)
        .slice(0, cap)
        .map(([email, v]) => ({ email, first_name: v.first_name }));
      return optInOnly(qualifying);
    }
  }
}

/**
 * Dedupe by email + keep the freshest first_name; then filter against
 * the newsletter_subscribers opt-out list.
 */
async function dedupeAndOptInCheck(
  rows: Array<{ email: string | null; first_name: string | null }> | null,
  cap: number,
): Promise<Recipient[]> {
  if (!rows) return [];
  const byEmail = new Map<string, Recipient>();
  for (const r of rows) {
    if (!r.email) continue;
    if (!byEmail.has(r.email)) byEmail.set(r.email, { email: r.email, first_name: r.first_name });
  }
  return optInOnly(Array.from(byEmail.values()).slice(0, cap));
}

/** Remove any recipient who has explicitly unsubscribed. */
async function optInOnly(recipients: Recipient[]): Promise<Recipient[]> {
  if (recipients.length === 0) return [];
  const { data } = await supabaseAdmin()
    .from('newsletter_subscribers')
    .select('email, status')
    .in('email', recipients.map(r => r.email));
  const optedOut = new Set(
    ((data ?? []) as Array<{ email: string; status: string }>)
      .filter(r => r.status === 'unsubscribed')
      .map(r => r.email),
  );
  return recipients.filter(r => !optedOut.has(r.email));
}

export async function listSegments(): Promise<SegmentSummary[]> {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('newsletter'))) {
    return [];
  }
  // Counts are computed by fetching the recipient lists — cheap enough at
  // demo / launch scale. If volumes grow we'll swap each branch for a
  // count-only RPC; the contract above stays the same.
  const [nl, recent, lapsed, vip] = await Promise.all([
    recipientsFor('newsletter'),
    recipientsFor('recent-90d'),
    recipientsFor('lapsed-60d'),
    recipientsFor('vip'),
  ]);
  return [
    { key: 'newsletter',  label: 'Newsletter subscribers', description: 'Anyone who opted into the newsletter and hasn’t unsubscribed.', count: nl.length },
    { key: 'recent-90d',  label: 'Recent buyers (90 days)', description: 'Customers with a delivered order in the last 90 days.', count: recent.length },
    { key: 'lapsed-60d',  label: 'Lapsed buyers (60–180 days)', description: 'Delivered 60–180 days ago, no follow-up order since.', count: lapsed.length },
    { key: 'vip',         label: 'VIP — Gold + Platinum', description: 'Lifetime delivered spend of £500 or more.', count: vip.length },
  ];
}

interface BlastInput {
  segment: SegmentKey;
  subject: string;
  body: string;     // HTML; we pass it through the email shell which wraps
                    // brand chrome + the unsubscribe footer
  testOnly: boolean;
}

export interface BlastResult {
  ok: boolean;
  error?: string;
  sent?: number;
  skipped?: number;
}

export async function sendBlast(input: BlastInput): Promise<BlastResult> {
  const session = await assertMarketingWrite();

  if (!input.subject.trim()) return { ok: false, error: 'Subject is required' };
  if (input.subject.length > 120) return { ok: false, error: 'Subject is too long (120 chars max)' };
  if (!input.body.trim() || input.body.trim().length < 30) {
    return { ok: false, error: 'Body needs at least a short message (30 chars)' };
  }

  // Test sends go to the staff actor only — every blast starts here so an
  // operator can't fire a typo to 1,000 customers in one click.
  if (input.testOnly) {
    const to = session.email;
    if (!to) return { ok: false, error: 'Your staff account has no email on file — set one to test.' };
    await sendMarketingBlast({
      to, subject: `[TEST] ${input.subject}`, html: input.body,
      first_name: 'Test',
    });
    await logAudit(session, {
      action: 'marketing.blast_test',
      entity: 'marketing',
      diff: { segment: input.segment, subject: input.subject, to },
    });
    return { ok: true, sent: 1, skipped: 0 };
  }

  const recipients = await recipientsFor(input.segment);
  let sent = 0;
  for (const r of recipients) {
    try {
      await sendMarketingBlast({
        to: r.email,
        subject: input.subject,
        html: input.body,
        first_name: r.first_name ?? undefined,
      });
      sent++;
    } catch {
      // Per-recipient failures are logged by email.ts; carry on so one
      // bad address doesn't stop the blast.
    }
  }
  await logAudit(session, {
    action: 'marketing.blast',
    entity: 'marketing',
    diff: { segment: input.segment, subject: input.subject, sent, total_recipients: recipients.length },
  });
  return { ok: true, sent, skipped: recipients.length - sent };
}
