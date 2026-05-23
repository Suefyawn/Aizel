import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

describe('whatsappUrlForCustomer', () => {
  let whatsappUrlForCustomer: typeof import('./whatsapp').whatsappUrlForCustomer;

  beforeEach(async () => {
    vi.resetModules();
    ({ whatsappUrlForCustomer } = await import('./whatsapp'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    // [input phone, expected wa.me number]
    ['07123456789',     '447123456789'],
    ['+447123456789',   '447123456789'],
    ['447123456789',    '447123456789'],
    ['00447123456789',  '447123456789'],
    ['07123 456 789',   '447123456789'],
    ['07123-456-789',   '447123456789'],
    ['(07123) 456789',  '447123456789'],
    ['02079460958',     '442079460958'],
  ])('routes UK %s to wa.me/%s', (phone, expectedDigits) => {
    const url = whatsappUrlForCustomer(phone);
    expect(url).toBe(`https://wa.me/${expectedDigits}`);
  });

  it('encodes the message when present', () => {
    const url = whatsappUrlForCustomer('07123456789', "Hi! It's Aizel.");
    expect(url).toMatch(/^https:\/\/wa\.me\/447123456789\?text=/);
    expect(url).toContain('Hi!%20It');
  });

  it('returns null for empty input', () => {
    expect(whatsappUrlForCustomer('')).toBeNull();
    expect(whatsappUrlForCustomer(null)).toBeNull();
    expect(whatsappUrlForCustomer(undefined)).toBeNull();
  });

  it('regression: never routes UK numbers to +92 (Pakistan)', () => {
    // The earlier version prepended "92" to numbers starting with "0",
    // silently routing UK customers to Pakistan WhatsApp. This test
    // exists so that regression never returns.
    const url = whatsappUrlForCustomer('07123456789');
    expect(url).not.toContain('/927');
    expect(url).toContain('/4471');
  });
});
