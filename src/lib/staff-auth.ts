import { randomBytes, createHmac, scryptSync, timingSafeEqual, createHash } from 'crypto';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { supabaseAdmin } from './supabase';
import { expandLegacyPermissions, type StaffSession } from './permissions';

import { STAFF_SESSION_SECRET } from './session-secret';

const STAFF_COOKIE = 'staff_session';
const SECRET = STAFF_SESSION_SECRET();
const SESSION_TTL_MS = 10 * 60 * 60 * 1000; // 10h

// ─── Password hashing ────────────────────────────────────────────────────────
// New hashes are scrypt-derived and stored in password_hash as
// "scrypt$N$r$p$saltHex$keyHex". password_salt is left empty for scrypt rows.
//
// Legacy SHA-256 hashes (existing rows) are still accepted; on successful
// login we transparently upgrade to scrypt — see verifyPassword().

const SCRYPT_N = 2 ** 15;    // 32 768 — ~50ms on a modest server
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;
const SCRYPT_SALT_BYTES = 16;
// Node's default scrypt maxmem is 32 MB; our N×r needs ~33 MB. Bump to 64 MB
// so we don't hit OpenSSL's "memory limit exceeded".
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

export function generateSalt(): string {
  return randomBytes(SCRYPT_SALT_BYTES).toString('hex');
}

export function generateTempPassword(): string {
  return randomBytes(6).toString('hex'); // 12-char hex string
}

// Returns a scrypt hash string. The signature stays compatible with the
// legacy `hashPassword(password, salt)` so existing actions still compile,
// but the `salt` arg is now optional — when omitted a fresh salt is generated.
export function hashPassword(password: string, salt?: string): string {
  const useSalt = salt ?? generateSalt();
  const key = scryptSync(password, useSalt, SCRYPT_KEYLEN, {
    N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: SCRYPT_MAXMEM,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${useSalt}$${key.toString('hex')}`;
}

// Legacy hash for backward compatibility during upgrade.
function legacySha256(password: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${password}:${SECRET}`).digest('hex');
}

interface VerifyResult {
  ok: boolean;
  upgraded?: { newHash: string };
}

// Returns { ok: true } on match. If the stored hash is in the legacy
// SHA-256 format, also returns `upgraded.newHash` — the caller should write
// it back to swap in the stronger scrypt hash.
export function verifyPassword(
  password: string,
  storedHash: string,
  legacySalt: string | null
): VerifyResult {
  if (storedHash.startsWith('scrypt$')) {
    const [, nStr, rStr, pStr, saltHex, keyHex] = storedHash.split('$');
    const N = Number(nStr), r = Number(rStr), p = Number(pStr);
    if (!N || !r || !p || !saltHex || !keyHex) return { ok: false };
    const expected = Buffer.from(keyHex, 'hex');
    const computed = scryptSync(password, saltHex, expected.length, { N, r, p, maxmem: SCRYPT_MAXMEM });
    if (computed.length !== expected.length) return { ok: false };
    return { ok: timingSafeEqual(computed, expected) };
  }

  // Legacy SHA-256 — verify, then upgrade.
  if (!legacySalt) return { ok: false };
  const legacyHash = legacySha256(password, legacySalt);
  const a = Buffer.from(legacyHash, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return { ok: false };
  if (!timingSafeEqual(a, b)) return { ok: false };
  return { ok: true, upgraded: { newHash: hashPassword(password) } };
}

// ─── Token ───────────────────────────────────────────────────────────────────

function signToken(staffId: string): string {
  const payload = `${staffId}|${Date.now()}`;
  const sig = createHmac('sha256', SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}|${sig}`).toString('base64url');
}

function verifyToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString();
    const lastPipe = decoded.lastIndexOf('|');
    if (lastPipe === -1) return null;
    const payload = decoded.slice(0, lastPipe);
    const sig = decoded.slice(lastPipe + 1);
    const expected = createHmac('sha256', SECRET).update(payload).digest('hex');
    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const [staffId, ts] = payload.split('|');
    if (Date.now() - Number(ts) > SESSION_TTL_MS) return null;
    return staffId;
  } catch {
    return null;
  }
}

// ─── Cookie ──────────────────────────────────────────────────────────────────

export async function setStaffCookie(staffId: string): Promise<void> {
  const store = await cookies();
  store.set(STAFF_COOKIE, signToken(staffId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_MS / 1000,
    path: '/',
    sameSite: 'lax',
  });
}

export async function clearStaffCookie(): Promise<void> {
  const store = await cookies();
  store.delete(STAFF_COOKIE);
}

// ─── Session ─────────────────────────────────────────────────────────────────
// Wrapped in React.cache so that an admin render — layout + page + child
// server components + every server-action permission check — dedupes onto a
// single cookie verify + staff_members lookup per request. A typical admin
// page hit fans this out 4-6× without the cache.

export const getStaffSession = cache(async (): Promise<StaffSession | null> => {
  const store = await cookies();

  // Owner session (legacy single-password auth — kept until full migration to
  // staff_members). The owner password is checked in actions.ts:loginAdmin,
  // which writes an HMAC-signed cookie via signed-cookie.ts. We just verify.
  const adminCookie = store.get('admin_session')?.value;
  const adminPass = process.env.ADMIN_PASSWORD;
  if (adminPass && adminCookie) {
    const { verify, OWNER_COOKIE_TTL_SEC } = await import('./signed-cookie');
    const payload = await verify(adminCookie, SECRET, OWNER_COOKIE_TTL_SEC);
    if (payload?.sub === 'owner') {
      // OWNER_EMAIL is the only identifying knob for the legacy single-password
      // owner account (no real Auth user / email is collected at login). Using
      // it for both id and email gives the audit log a meaningful actor instead
      // of the literal string 'owner'. Falls back to 'owner' if the env var
      // isn't set so a fresh deploy without OWNER_EMAIL still works.
      const ownerEmail = process.env.OWNER_EMAIL?.trim() || 'owner';
      return { id: ownerEmail, email: ownerEmail, name: 'Owner', permissions: [], isOwner: true, roleId: null, roleName: null };
    }
  }

  // Staff session
  const token = store.get(STAFF_COOKIE)?.value;
  if (!token) return null;
  const staffId = verifyToken(token);
  if (!staffId) return null;

  const { data } = await supabaseAdmin()
    .from('staff_members')
    .select('id, email, name, permissions, is_active, role_id, roles(name, permissions)')
    .eq('id', staffId)
    .eq('is_active', true)
    .single();

  if (!data) return null;
  // A staff member with an assigned role inherits that role's permission set,
  // so editing the role updates everyone who holds it. A "Custom" staff member
  // (role_id NULL) runs on its own permissions column instead.
  const role = (Array.isArray(data.roles) ? data.roles[0] : data.roles) as
    { name: string; permissions: string[] } | null | undefined;
  return {
    id: data.id,
    email: data.email,
    name: data.name,
    permissions: expandLegacyPermissions((role ? role.permissions : data.permissions) ?? []),
    isOwner: false,
    roleId: (data.role_id as string | null) ?? null,
    roleName: role?.name ?? null,
  };
});

// ─── Helpers used by login flow to upgrade SHA-256 → scrypt on first login ──
export async function upgradeStaffHash(staffId: string, newHash: string): Promise<void> {
  await supabaseAdmin()
    .from('staff_members')
    .update({ password_hash: newHash, password_salt: '' })
    .eq('id', staffId);
}
