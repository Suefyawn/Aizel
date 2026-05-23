import { describe, expect, it } from 'vitest';
import { normaliseUKPhone } from './twilio';

describe('normaliseUKPhone', () => {
  describe('accepts valid UK numbers', () => {
    it.each([
      // [input, expected E.164]
      ['07123456789',      '+447123456789'],     // mobile, national
      ['+447123456789',    '+447123456789'],     // mobile, international
      ['447123456789',     '+447123456789'],     // mobile, no plus
      ['00447123456789',   '+447123456789'],     // mobile, 0044 prefix
      ['07123 456 789',    '+447123456789'],     // spaces stripped
      ['07123-456-789',    '+447123456789'],     // dashes stripped
      ['(07123) 456789',   '+447123456789'],     // parens stripped
      ['02079460958',      '+442079460958'],     // London landline (020)
      ['01234567890',      '+441234567890'],     // 01xxx landline
      ['03001234567',      '+443001234567'],     // 03xx non-geographic
      ['+442079460958',    '+442079460958'],     // landline international
    ])('%s → %s', (input, expected) => {
      expect(normaliseUKPhone(input)).toBe(expected);
    });
  });

  describe('rejects shapes we never want to send to Twilio', () => {
    // Note: this is *shape* validation only — `0123456789` would be accepted
    // here because it matches a 10-digit 01x landline shape, even though no
    // real UK number begins with those digits. The Twilio API itself rejects
    // unallocated numbers at send time.
    it.each([
      '',                              // empty
      'notaphone',                     // gibberish
      '12345',                         // too short
      '07123',                         // mobile too short
      '0000000000',                    // 10 zeros — leading 00 isn't a valid UK prefix
      '+15551234567',                  // US number — wrong country code
      '447',                           // only the country code
      '06123456789',                   // 06x isn't an allocated UK prefix range
      '08123456789',                   // 08x freephone — we don't SMS those
      '09123456789',                   // 09x premium — we don't SMS those
    ])('rejects %s', input => {
      expect(normaliseUKPhone(input)).toBeNull();
    });
  });
});
