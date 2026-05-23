// HMAC-signed cookie payloads, using Web Crypto so the same helper runs
// in both Node (server actions, getStaffSession) and Edge (middleware /
// proxy.ts).
//
// Payload shape: `<base64url(json)>.<base64url(hmac)>`.
// Verification rejects an expired payload (>maxAgeSec) and any signature
// that fails constant-time compare.

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64urlEncode(bytes: Uint8Array): string {
  // btoa works in both Node 16+ and Edge.
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str: string): Uint8Array {
  const pad = '='.repeat((4 - (str.length % 4)) % 4);
  const b64 = (str + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function timingSafeEq(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export interface SignedPayload {
  /** Subject — what this cookie identifies (e.g. 'owner'). */
  sub: string;
  /** Issued-at, epoch seconds. */
  iat: number;
}

export async function sign(payload: Omit<SignedPayload, 'iat'> & Partial<Pick<SignedPayload, 'iat'>>, secret: string): Promise<string> {
  const full: SignedPayload = { sub: payload.sub, iat: payload.iat ?? Math.floor(Date.now() / 1000) };
  const body = enc.encode(JSON.stringify(full));
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, body as BufferSource));
  return `${b64urlEncode(body)}.${b64urlEncode(sig)}`;
}

export async function verify(token: string, secret: string, maxAgeSec: number): Promise<SignedPayload | null> {
  const dot = token.indexOf('.');
  if (dot < 1) return null;
  const bodyB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);
  let body: Uint8Array, sig: Uint8Array;
  try {
    body = b64urlDecode(bodyB64);
    sig = b64urlDecode(sigB64);
  } catch { return null; }
  const key = await hmacKey(secret);
  const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, body as BufferSource));
  if (!timingSafeEq(expected, sig)) return null;
  let payload: SignedPayload;
  try {
    payload = JSON.parse(dec.decode(body)) as SignedPayload;
  } catch { return null; }
  if (typeof payload.iat !== 'number') return null;
  if (Math.floor(Date.now() / 1000) - payload.iat > maxAgeSec) return null;
  return payload;
}

/** Reused by middleware + server-side session readers. The legacy owner
 *  cookie uses sub='owner' and a 7-day TTL. */
export const OWNER_COOKIE_NAME = 'admin_session';
export const OWNER_COOKIE_TTL_SEC = 60 * 60 * 24 * 7;
