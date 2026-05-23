// ============================================================================
// Tiny RFC 6238 TOTP implementation with no external deps. Used for the
// staff 2FA flow. Compatible with Google Authenticator / Authy / 1Password.
//
// All functions are constant-time-safe (we use timingSafeEqual on the
// digit comparison).
// ============================================================================

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const STEP = 30;       // seconds per code window
const DIGITS = 6;
const WINDOW = 1;      // accept ±1 step to cover clock skew

// RFC 4648 base32 (no padding), uppercase. authenticators expect this.
const B32_ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateSecret(bytes = 20): string {
  return base32Encode(randomBytes(bytes));
}

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of buf) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHA[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += B32_ALPHA[(value << (5 - bits)) & 0x1f];
  }
  return out;
}

function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const c of clean) {
    value = (value << 5) | B32_ALPHA.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  // 64-bit big-endian counter
  for (let i = 7; i >= 0; i--) {
    buf[i] = counter & 0xff;
    counter = Math.floor(counter / 256);
  }
  const hmac = createHmac('sha1', secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binary =
    ((hmac[offset]     & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8)  |
     (hmac[offset + 3] & 0xff);
  const code = binary % 10 ** DIGITS;
  return code.toString().padStart(DIGITS, '0');
}

export function currentTotp(secretB32: string, when: number = Date.now()): string {
  const counter = Math.floor(when / 1000 / STEP);
  return hotp(base32Decode(secretB32), counter);
}

export function verifyTotp(secretB32: string, code: string, when: number = Date.now()): boolean {
  const cleaned = code.replace(/\D/g, '');
  if (cleaned.length !== DIGITS) return false;
  const secret = base32Decode(secretB32);
  const baseCounter = Math.floor(when / 1000 / STEP);
  for (let dt = -WINDOW; dt <= WINDOW; dt++) {
    const candidate = hotp(secret, baseCounter + dt);
    const a = Buffer.from(candidate); const b = Buffer.from(cleaned);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

// otpauth:// URL the authenticator app expects when scanning the QR.
export function otpauthUrl(args: { secret: string; account: string; issuer?: string }): string {
  const issuer = encodeURIComponent(args.issuer ?? 'Aizel');
  const account = encodeURIComponent(args.account);
  return `otpauth://totp/${issuer}:${account}?secret=${args.secret}&issuer=${issuer}&algorithm=SHA1&digits=${DIGITS}&period=${STEP}`;
}
