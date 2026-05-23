import { describe, expect, it } from 'vitest';
import { currentTotp, generateSecret, otpauthUrl, verifyTotp } from './totp';

describe('TOTP', () => {
  it('round-trips: generate → currentTotp → verifyTotp', () => {
    const secret = generateSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    const now = 1735689600_000; // arbitrary
    const code = currentTotp(secret, now);
    expect(code).toMatch(/^\d{6}$/);
    expect(verifyTotp(secret, code, now)).toBe(true);
  });

  it('accepts the adjacent step within the skew window', () => {
    const secret = generateSecret();
    // Anchor to a step boundary so we control which counter we're on.
    const STEP_MS = 30_000;
    const now = Math.floor(1735689600_000 / STEP_MS) * STEP_MS;
    const code = currentTotp(secret, now);
    expect(verifyTotp(secret, code, now + 25_000)).toBe(true);     // same step
    expect(verifyTotp(secret, code, now + STEP_MS + 5_000)).toBe(true); // next step, accepted via -1 skew
    expect(verifyTotp(secret, code, now + 2 * STEP_MS)).toBe(false);    // two steps forward — out of window
  });

  it('rejects wrong codes', () => {
    const secret = generateSecret();
    expect(verifyTotp(secret, '000000')).toBe(false);
    expect(verifyTotp(secret, '12')).toBe(false);
    expect(verifyTotp(secret, 'abcdef')).toBe(false);
  });

  it('builds an otpauth:// URL the right shape', () => {
    const url = otpauthUrl({ secret: 'JBSWY3DPEHPK3PXP', account: 'me@example.com' });
    expect(url.startsWith('otpauth://totp/')).toBe(true);
    expect(url).toMatch(/secret=JBSWY3DPEHPK3PXP/);
    expect(url).toMatch(/issuer=Aizel/);
  });
});
