import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { hashPassword, verifyPassword } from './staff-auth';

describe('staff password hashing', () => {
  it('hashes and verifies a password with scrypt', () => {
    const hash = hashPassword('correct horse battery staple');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(verifyPassword('correct horse battery staple', hash, null).ok).toBe(true);
    expect(verifyPassword('wrong password', hash, null).ok).toBe(false);
  });

  it('returns a new hash when verifying a legacy SHA-256 hash', () => {
    // Mirror the legacy hash construction in staff-auth.ts:legacySha256.
    // (Salt + password + secret, SHA-256, hex.)
    const salt = 'abc123';
    const password = 'legacy-pass';
    const legacyHash = createHash('sha256')
      .update(`${salt}:${password}:${process.env.STAFF_SESSION_SECRET}`)
      .digest('hex');

    const result = verifyPassword(password, legacyHash, salt);
    expect(result.ok).toBe(true);
    expect(result.upgraded?.newHash?.startsWith('scrypt$')).toBe(true);
  });
});
