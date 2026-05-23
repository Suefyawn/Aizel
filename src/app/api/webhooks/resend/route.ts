// Resend webhook receiver. Resend POSTs delivery-lifecycle events here —
// delivered, opened, clicked, bounced, complained — and we stamp the matching
// email_log row (matched on resend_id) so the admin Email log shows what
// happened to each message.
//
// Setup (owner, one-time): in the Resend dashboard add a webhook pointing at
// <site>/api/webhooks/resend, enable open + click tracking, and copy the
// signing secret into the RESEND_WEBHOOK_SECRET env var.
//
// Requests are authenticated with Resend's Svix signature scheme — the
// endpoint refuses anything it can't verify.

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { log } from '@/lib/logger';

const EVENT_COLUMN: Record<string, string> = {
  'email.delivered':  'delivered_at',
  'email.opened':     'opened_at',
  'email.clicked':    'clicked_at',
  'email.bounced':    'bounced_at',
  'email.complained': 'complained_at',
};

// Svix signature verification. The signing secret is `whsec_<base64>`; the
// signed payload is `${id}.${timestamp}.${rawBody}`.
function verifySignature(secret: string, headers: Headers, body: string): boolean {
  const id = headers.get('svix-id');
  const timestamp = headers.get('svix-timestamp');
  const signature = headers.get('svix-signature');
  if (!id || !timestamp || !signature) return false;

  // Reject stale deliveries (replay protection) — 5 minute tolerance.
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');
  const expectedBuf = Buffer.from(expected);

  // The header is a space-separated list of `v1,<sig>` entries.
  return signature.split(' ').some(part => {
    const sig = part.split(',')[1];
    if (!sig) return false;
    const sigBuf = Buffer.from(sig);
    return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf);
  });
}

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    log.warn('resend_webhook.no_secret');
    return NextResponse.json({ error: 'webhook not configured' }, { status: 503 });
  }

  const body = await req.text();
  if (!verifySignature(secret, req.headers, body)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let event: { type?: string; data?: { email_id?: string; created_at?: string } };
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const column = event.type ? EVENT_COLUMN[event.type] : undefined;
  const emailId = event.data?.email_id;
  // Unhandled event type, or an email we never logged — ack and move on.
  if (!column || !emailId) return NextResponse.json({ ok: true });

  const at = event.data?.created_at ?? new Date().toISOString();
  try {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    // First event wins — `.is(column, null)` keeps the original timestamp if a
    // later duplicate event arrives (e.g. a second open).
    await admin
      .from('email_log')
      .update({ [column]: at })
      .eq('resend_id', emailId)
      .is(column, null);
  } catch (err) {
    log.error('resend_webhook.update_failed', { error: (err as Error).message });
    // Tell Resend to retry — the event was valid, our write failed.
    return NextResponse.json({ error: 'update failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
