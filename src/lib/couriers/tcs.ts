// ============================================================================
// TCS Courier (Pakistan) — COD-API adapter.
//
// Spec: envio.tcscourier.com/COD-API-UserManual.pdf (copy in
// .audit/tcs-cod-api-spec.txt). Two-tier auth: the bearer-token endpoint
// (/auth/api/auth) uses clientId+clientSecret; the per-call ecom endpoints
// then carry that bearer in the `accesstoken` field of the request body.
//
// Production:  https://ociconnect.tcscourier.com
// Sandbox/UAT: https://devconnect.tcscourier.com
//
// Required env vars (set in Vercel + .env.local):
//   TCS_BASE_URL          — pick prod or dev
//
// Auth (one of these two modes is required):
//   A) Pre-issued bearer token mode (recommended; what TCS Envio's
//      "Bearer Token for API Access" email gives you):
//        TCS_BEARER_TOKEN  — the long-lived JWT TCS issued for your account
//      The token carries `clientid` + `services` claims and expires after
//      ~3 years. The adapter uses it directly and skips /auth/api/auth.
//
//   B) Legacy OAuth mode (only if your TCS contact gave you a client
//      id + secret pair instead of a pre-issued token):
//        TCS_CLIENT_ID
//        TCS_CLIENT_SECRET
//      The adapter hits /auth/api/auth on first call and caches the
//      resulting short-lived token.
//
//   TCS_TCS_ACCOUNT       — your TCS account number (the "tcsaccount" field
//                           in every booking; sometimes called "shipper account")
//   TCS_COST_CENTER_CODE  — assigned by TCS, required on every booking
//   TCS_SHIPPER_NAME      — your company name (printed on the label)
//   TCS_SHIPPER_ADDRESS   — pickup address line 1
//   TCS_SHIPPER_CITY_CODE — TCS city code (e.g. 'KHI'). Use /setup/areacode
//                           to look up if unsure.
//   TCS_SHIPPER_CITY_NAME — human-readable city name (printed on the label)
//   TCS_SHIPPER_MOBILE    — your contact phone (03xxxxxxxxx)
//   TCS_SERVICE_CODE      — e.g. 'O' for Overnight. Optional, defaults to 'O'.
//
// If any of the required vars are missing, `isConfigured()` returns false
// and the booking UI falls back to manual tracking-number entry. We never
// throw — `book` / `cancel` / `track` always resolve with `Result<…>`.
// ============================================================================

import type {
  CourierAdapter,
  BookingInput,
  BookingResult,
  CancelResult,
  TrackEvent,
  TrackResult,
  Result,
} from './types';
import { normaliseCourierStatus } from './status-mapper';

// Non-auth fields required regardless of which auth mode is in use.
const REQUIRED_NON_AUTH_VARS = [
  'TCS_BASE_URL',
  'TCS_TCS_ACCOUNT',
  'TCS_COST_CENTER_CODE',
  'TCS_SHIPPER_NAME',
  'TCS_SHIPPER_ADDRESS',
  'TCS_SHIPPER_CITY_CODE',
  'TCS_SHIPPER_CITY_NAME',
  'TCS_SHIPPER_MOBILE',
] as const;

function env(key: string): string | undefined {
  return process.env[key];
}

function hasPreIssuedToken(): boolean {
  return Boolean(env('TCS_BEARER_TOKEN'));
}

function hasOauthCredentials(): boolean {
  return Boolean(env('TCS_CLIENT_ID') && env('TCS_CLIENT_SECRET'));
}

function isConfigured(): boolean {
  if (!REQUIRED_NON_AUTH_VARS.every(k => Boolean(env(k)))) return false;
  return hasPreIssuedToken() || hasOauthCredentials();
}

// ─── Bearer-token cache ────────────────────────────────────────────────────
// TCS auth tokens expire (the response includes an `expiry` timestamp). Cache
// per process so we don't auth on every booking. Lambda cold-starts get a
// fresh token; warm invocations reuse until ~60s before expiry.
let cachedToken: { value: string; expiresAt: number } | null = null;
const TOKEN_GRACE_SEC = 60;

async function getBearerToken(): Promise<Result<string>> {
  // Mode A — pre-issued token. Skip the auth round-trip; TCS gives us
  // a JWT good for ~3 years on the account's services list. We don't
  // try to decode the `exp` claim here — if TCS rejects an expired
  // token, the per-call endpoints surface the 401 in their own
  // Result<…> error path.
  const preIssued = env('TCS_BEARER_TOKEN');
  if (preIssued) return preIssued;

  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + TOKEN_GRACE_SEC) {
    return cachedToken.value;
  }

  const baseUrl = env('TCS_BASE_URL')!;
  try {
    const r = await fetch(`${baseUrl.replace(/\/$/, '')}/auth/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientid: env('TCS_CLIENT_ID'),
        clientsecret: env('TCS_CLIENT_SECRET'),
      }),
    });
    const body = await r.json().catch(() => null) as null | {
      result?: { accessToken?: string; expiry?: string };
      status?: boolean;
      code?: string;
    };
    if (!r.ok || !body?.result?.accessToken) {
      return {
        ok: false,
        message: `TCS auth failed (HTTP ${r.status})`,
        code: body?.code ?? r.status,
        raw: body,
      };
    }
    // expiry comes back as ISO like "2027-01-04T05:08:47Z" — convert to epoch.
    const expiresAt = body.result.expiry
      ? Math.floor(new Date(body.result.expiry).getTime() / 1000)
      : now + 60 * 60; // fallback: trust for 1 hour
    cachedToken = { value: body.result.accessToken, expiresAt };
    return body.result.accessToken;
  } catch (err) {
    return {
      ok: false,
      message: 'TCS auth network error — check TCS_BASE_URL + connectivity',
      code: 'network',
      raw: (err as Error).message,
    };
  }
}

// Helper: type-narrow a Result<X>.
function isErr<T>(r: Result<T>): r is Extract<Result<T>, { ok: false }> {
  return typeof r === 'object' && r !== null && (r as { ok?: boolean }).ok === false;
}

// ─── Booking creation ──────────────────────────────────────────────────────
async function book(input: BookingInput): Promise<Result<BookingResult>> {
  if (!isConfigured()) {
    return { ok: false, message: 'TCS adapter is not configured — set TCS_* env vars.', code: 'not_configured' };
  }
  const tokenOrErr = await getBearerToken();
  if (isErr(tokenOrErr)) return tokenOrErr;
  const token = tokenOrErr;
  const baseUrl = env('TCS_BASE_URL')!;

  // TCS schema: "shipmentdate" is DD-MM-YYYY (the example in the spec mixes
  // formats but the doc lists DD-MM-YYYY in the constraints column).
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yyyy = String(today.getFullYear());
  const shipmentDate = `${dd}-${mm}-${yyyy}`;

  // TCS requires at least one SKU; build a synthetic one if input.items is empty.
  const skus = (input.items.length ? input.items : [{
    description: `Order ${input.orderNumber}`,
    quantity: 1,
    weightKg: input.weightKg,
    unitPrice: Math.max(1, Math.round(input.codAmount)),
  }]).map(it => ({
    description: it.description.slice(0, 200),
    quantity: Math.max(1, Math.floor(it.quantity)),
    weight: Math.max(0.5, it.weightKg),
    uom: 'KG',
    unitprice: Math.max(0, Math.round(it.unitPrice)),
  }));

  const body = {
    accesstoken: token,
    // We let TCS assign the consignment number — pass empty per the spec example.
    consignmentno: '',
    shipperinfo: {
      tcsaccount:  env('TCS_TCS_ACCOUNT'),
      shippername: env('TCS_SHIPPER_NAME'),
      address1:    env('TCS_SHIPPER_ADDRESS'),
      countrycode: 'PK',
      countryname: 'Pakistan',
      citycode:    env('TCS_SHIPPER_CITY_CODE'),
      cityname:    env('TCS_SHIPPER_CITY_NAME'),
      mobile:      env('TCS_SHIPPER_MOBILE'),
    },
    consigneeinfo: {
      firstname: input.consignee.firstName.slice(0, 50) || 'Customer',
      middlename: '',
      lastname:  (input.consignee.lastName ?? '').slice(0, 50),
      address1:  input.consignee.address1.slice(0, 120),
      address2:  (input.consignee.address2 ?? '').slice(0, 120),
      zip:       (input.consignee.zip ?? '').slice(0, 6),
      countrycode: input.consignee.countryCode ?? 'PK',
      countryname: 'Pakistan',
      cityname:  input.consignee.city.slice(0, 50),
      email:     input.consignee.email ?? '',
      mobile:    sanitisePkMobile(input.consignee.phone),
    },
    shipmentinfo: {
      costcentercode: env('TCS_COST_CENTER_CODE'),
      referenceno:    input.orderNumber,
      contentdesc:    `Order ${input.orderNumber}`,
      servicecode:    env('TCS_SERVICE_CODE') || 'O',
      shipmentdate:   shipmentDate,
      currency:       input.currency ?? 'GBP',
      codamount:      Math.max(0, Math.round(input.codAmount)),
      weightinkg:     Math.max(0.5, input.weightKg),
      pieces:         Math.max(1, input.pieces ?? 1),
      fragile:        false,
      remarks:        (input.remarks ?? `YP order ${input.orderNumber}`).slice(0, 500),
      skus,
    },
  };

  try {
    const r = await fetch(`${baseUrl.replace(/\/$/, '')}/ecom/api/booking/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const out = await r.json().catch(() => null) as null | {
      response?: string;
      consignmentNo?: string;
      status?: boolean;
      code?: string;
      message?: string;
      error?: Array<{ errorname: string }>;
    };
    if (!r.ok || out?.status === false || !out?.consignmentNo) {
      const errSummary = out?.error?.map(e => e.errorname).filter(Boolean).join('; ');
      return {
        ok: false,
        message: errSummary || out?.message || `TCS booking failed (HTTP ${r.status})`,
        code: out?.code ?? r.status,
        raw: out,
      };
    }
    return { ok: true, trackingNumber: String(out.consignmentNo), raw: out };
  } catch (err) {
    return {
      ok: false,
      message: 'TCS booking network error',
      code: 'network',
      raw: (err as Error).message,
    };
  }
}

// ─── Cancel ────────────────────────────────────────────────────────────────
async function cancel(trackingNumber: string): Promise<Result<CancelResult>> {
  if (!isConfigured()) {
    return { ok: false, message: 'TCS adapter is not configured.', code: 'not_configured' };
  }
  const tokenOrErr = await getBearerToken();
  if (isErr(tokenOrErr)) return tokenOrErr;
  const baseUrl = env('TCS_BASE_URL')!;
  try {
    const r = await fetch(`${baseUrl.replace(/\/$/, '')}/ecom/api/booking/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accesstoken: tokenOrErr, consignmentNumber: trackingNumber }),
    });
    const out = await r.json().catch(() => null) as null | { message?: string };
    if (!r.ok || !out?.message || /failure/i.test(out.message)) {
      return {
        ok: false,
        message: out?.message ?? `TCS cancel failed (HTTP ${r.status})`,
        code: r.status,
        raw: out,
      };
    }
    return { ok: true, raw: out };
  } catch (err) {
    return { ok: false, message: 'TCS cancel network error', code: 'network', raw: (err as Error).message };
  }
}

// ─── Tracking ──────────────────────────────────────────────────────────────
async function track(trackingNumber: string): Promise<Result<TrackResult>> {
  if (!isConfigured()) {
    return { ok: false, message: 'TCS adapter is not configured.', code: 'not_configured' };
  }
  const tokenOrErr = await getBearerToken();
  if (isErr(tokenOrErr)) return tokenOrErr;
  const baseUrl = env('TCS_BASE_URL')!;
  try {
    // The spec shows `consignee` as the param name and an array body for GET — but a
    // GET with a JSON body is not standard. Real-world TCS implementations call it
    // as a POST with the JSON in body. Try POST first, fall back to GET.
    const url = `${baseUrl.replace(/\/$/, '')}/tracking/api/Tracking/GetDynamicTrackDetail`;
    let r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenOrErr}` },
      body: JSON.stringify({ consignee: [trackingNumber] }),
    });
    if (r.status === 404 || r.status === 405) {
      r = await fetch(`${url}?consignee=${encodeURIComponent(trackingNumber)}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${tokenOrErr}` },
      });
    }
    const out = await r.json().catch(() => null) as null | {
      deliveryinfo?: Array<{ status?: string; code?: string; datetime?: string }>;
      checkpoints?: Array<{ status?: string; datetime?: string }>;
    };
    if (!r.ok || !out) {
      return { ok: false, message: `TCS tracking failed (HTTP ${r.status})`, code: r.status, raw: out };
    }
    const events: TrackEvent[] = (out.deliveryinfo ?? []).map(e => ({
      status: normaliseCourierStatus(e.status ?? e.code ?? ''),
      description: e.status ?? e.code ?? 'In transit',
      occurredAt: parseTcsDate(e.datetime) ?? new Date().toISOString(),
    }));
    // Sort newest first so events[0] is the latest.
    events.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
    return { ok: true, events, current: events[0]?.status, raw: out };
  } catch (err) {
    return { ok: false, message: 'TCS tracking network error', code: 'network', raw: (err as Error).message };
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function sanitisePkMobile(raw: string): string {
  // TCS expects 11 digits starting with 03 (e.g. 07123456789). Strip + and
  // 92 country code variations.
  let n = raw.replace(/\D/g, '');
  if (n.startsWith('92') && n.length === 12) n = '0' + n.slice(2);
  if (n.startsWith('00')) n = n.slice(1);
  return n.slice(0, 11);
}

function parseTcsDate(s: string | undefined | null): string | null {
  if (!s) return null;
  // TCS returns "Thursday Oct 17, 2024 12:58" — Date can parse most variants.
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export const tcs: CourierAdapter = {
  id: 'TCS',
  capabilities: { book: true, cancel: true, track: true },
  isConfigured,
  book,
  cancel,
  track,
};
