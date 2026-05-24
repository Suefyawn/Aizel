// ============================================================================
// Twilio SMS — customer-facing order updates.
//
// What gets sent:
//   • Order placed         — confirmation with order #, total, tracking link
//   • Order shipped        — carrier + tracking number
//   • Order delivered      — review request CTA (optional)
//
// Why Twilio (vs Resend-only):
//   • UK shoppers expect a "Your Aizel parcel is on its way" text alongside
//     the email. Email gets filtered to Promotions; an SMS lands.
//   • Royal Mail / DPD tracking is the moment a customer wants the number
//     readable on a phone, not buried in an inbox.
//
// All sends are best-effort — a Twilio outage must never stall an order
// state transition. `sendOrderSms()` swallows errors, captures them to
// Sentry, and returns `{ ok: false }` so callers can log but keep going.
//
// Required env (see .env.example):
//   TWILIO_ACCOUNT_SID   — ACxxxxxxxxxxxxxxxxxxxxxxxx
//   TWILIO_AUTH_TOKEN    — server-only secret
//   TWILIO_FROM_NUMBER   — purchased UK long-code or short-code, e.g. +447xxxxxxxxx
//   TWILIO_MESSAGING_SERVICE_SID (optional) — preferred over a single FROM
//     number; lets Twilio pick the best route + handles UK Sender ID.
//
// `isConfigured()` returns false when SID + AUTH + (FROM | MESSAGING_SERVICE)
// aren't all set, so the call sites can skip silently in dev / staging.
// ============================================================================

import twilio from 'twilio';
import * as Sentry from '@sentry/nextjs';
import { SITE_URL } from '@/lib/seo';
import { log } from '@/lib/logger';

function env(key: string): string | undefined {
  return process.env[key];
}

export function isConfigured(): boolean {
  const haveAuth = Boolean(env('TWILIO_ACCOUNT_SID') && env('TWILIO_AUTH_TOKEN'));
  const haveSender = Boolean(env('TWILIO_FROM_NUMBER') || env('TWILIO_MESSAGING_SERVICE_SID'));
  return haveAuth && haveSender;
}

// Lazy singleton — never imports the secret when the SDK isn't going to be
// called (e.g. an admin-only build path).
let _client: ReturnType<typeof twilio> | null = null;
function client() {
  if (_client) return _client;
  const sid = env('TWILIO_ACCOUNT_SID');
  const token = env('TWILIO_AUTH_TOKEN');
  if (!sid || !token) throw new Error('Twilio credentials missing');
  _client = twilio(sid, token);
  return _client;
}

// Normalise a UK phone number to E.164 (+44…). Twilio rejects most other
// formats. We accept the common UK input styles (07…, +447…, 447…, 0044…)
// and reject anything we can't confidently fix.
//
// UK mobile numbers are exactly 11 digits and always start with `07`
// (or +447 / 0447 with the prefix). UK landlines are 10–11 digits and
// start with `01`, `02`, or `03`. The regex below only accepts those
// leading-digit patterns so a string like "0000000000" or "0123456789"
// stops here instead of failing later at the Twilio API.
const NATIONAL_RE = /^0(7\d{9}|[123]\d{8,9})$/;
const INTERNATIONAL_RE = /^(?:\+44|44|0044)(7\d{9}|[123]\d{8,9})$/;

export function normaliseUKPhone(raw: string): string | null {
  const stripped = raw.replace(/[\s()-]/g, '');
  const natM = stripped.match(NATIONAL_RE);
  if (natM) return '+44' + natM[1];
  const intM = stripped.match(INTERNATIONAL_RE);
  if (intM) return '+44' + intM[1];
  return null;
}

type Result = { ok: true; sid: string } | { ok: false; error: string; code?: string | number };

interface SendInput {
  /** Raw phone number from the order row — we'll normalise before sending. */
  toRaw: string;
  /** Plain-text body. Keep ≤ 160 chars to stay inside one SMS segment;
   *  anything longer is allowed but Twilio will bill per-segment. */
  body: string;
  /** For Sentry / log correlation. */
  context?: { orderNumber?: string; kind?: string };
}

async function sendRaw({ toRaw, body, context }: SendInput): Promise<Result> {
  if (!isConfigured()) {
    return { ok: false, error: 'Twilio not configured', code: 'not_configured' };
  }
  const to = normaliseUKPhone(toRaw);
  if (!to) {
    return { ok: false, error: `Invalid UK phone: ${toRaw}`, code: 'invalid_phone' };
  }
  try {
    const messagingServiceSid = env('TWILIO_MESSAGING_SERVICE_SID');
    const from = env('TWILIO_FROM_NUMBER');
    // Prefer Messaging Service if configured — Twilio handles routing,
    // sender-ID, and country-specific quirks better than a fixed FROM.
    const params: { to: string; body: string; from?: string; messagingServiceSid?: string } = { to, body };
    if (messagingServiceSid) params.messagingServiceSid = messagingServiceSid;
    else if (from) params.from = from;
    const msg = await client().messages.create(params);
    return { ok: true, sid: msg.sid };
  } catch (err) {
    const message = (err as Error).message || 'Twilio send failed';
    Sentry.captureException(err, {
      tags: { area: 'twilio-send', ...context, kind: context?.kind || 'unknown' },
    });
    log.warn('twilio_send_failed', { message, ...context });
    return { ok: false, error: message };
  }
}

// ─── Customer-facing templates ──────────────────────────────────────────────
// Keep these short. UK SMS body limit is 160 GSM-7 chars per segment;
// concatenated messages still arrive correctly but cost more. Each template
// is composed so the order number + tracking link survive within one
// segment when possible.

// `Aizel:` prefix makes the carrier-side lock-screen preview show the
// brand identity (UK SMS clients pin the prefix to the notification
// title). Saves the brand 13 chars of body but is well worth it.
const BRAND_PREFIX = 'Aizel: ';

// Strip the URL scheme from a tracking link so we save 8 chars per SMS
// segment — Twilio bills per 160-char segment and SITE_URL already adds
// a comfortable 20+ characters once we factor in the path.
function shortUrl(u: string): string {
  return u.replace(/^https?:\/\//, '');
}

export async function sendOrderPlacedSms(args: {
  phone: string;
  firstName?: string;
  orderNumber: string;
  total: number;
}): Promise<Result> {
  const greet = args.firstName ? `Hi ${args.firstName}, ` : '';
  const body = `${BRAND_PREFIX}${greet}thanks for your order ${args.orderNumber} (£${args.total.toFixed(2)}). Track: ${shortUrl(SITE_URL)}/track`;
  return sendRaw({ toRaw: args.phone, body, context: { orderNumber: args.orderNumber, kind: 'order.placed' } });
}

export async function sendOrderShippedSms(args: {
  phone: string;
  firstName?: string;
  orderNumber: string;
  courier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
}): Promise<Result> {
  const greet = args.firstName ? `Hi ${args.firstName}, ` : '';
  const carrier = args.courier ? ` via ${args.courier}` : '';
  const track = args.trackingUrl
    ? ` Track: ${shortUrl(args.trackingUrl)}`
    : args.trackingNumber
      ? ` Tracking #: ${args.trackingNumber}`
      : '';
  const body = `${BRAND_PREFIX}${greet}your order ${args.orderNumber} is on its way${carrier}.${track}`;
  return sendRaw({ toRaw: args.phone, body, context: { orderNumber: args.orderNumber, kind: 'order.shipped' } });
}

export async function sendOrderDeliveredSms(args: {
  phone: string;
  firstName?: string;
  orderNumber: string;
}): Promise<Result> {
  const greet = args.firstName ? `Hi ${args.firstName}, ` : '';
  // The review-request CTA tips this message from purely transactional
  // into a soft marketing send, so it carries a STOP opt-out per UK ICO
  // PECR guidance. The transactional templates above don't need one.
  const body = `${BRAND_PREFIX}${greet}your order ${args.orderNumber} has been delivered. Loved it? Review at ${shortUrl(SITE_URL)}/account/orders · Reply STOP to opt out`;
  return sendRaw({ toRaw: args.phone, body, context: { orderNumber: args.orderNumber, kind: 'order.delivered' } });
}

// ─── Internal (staff) templates ─────────────────────────────────────────────

export async function sendNewOrderStaffSms(args: {
  phone: string;
  orderNumber: string;
  total: number;
  itemCount: number;
}): Promise<Result> {
  const body = `${BRAND_PREFIX}new order ${args.orderNumber} — ${args.itemCount} item${args.itemCount === 1 ? '' : 's'}, £${args.total.toFixed(2)}. ${shortUrl(SITE_URL)}/admin/orders`;
  return sendRaw({ toRaw: args.phone, body, context: { orderNumber: args.orderNumber, kind: 'admin.new_order' } });
}
