import { describe, expect, it } from 'vitest';
import { __test } from './useAbTest';

const { parseSpec, hash } = __test;

describe('useAbTest helpers', () => {
  describe('parseSpec', () => {
    it('returns [] for missing env', () => {
      expect(parseSpec(undefined)).toEqual([]);
      expect(parseSpec('')).toEqual([]);
    });

    it('parses a simple 50/50 split', () => {
      expect(parseSpec('A:50,B:50')).toEqual([
        { variant: 'A', weight: 50 },
        { variant: 'B', weight: 50 },
      ]);
    });

    it('parses uneven weights', () => {
      expect(parseSpec('control:1,treatment:3')).toEqual([
        { variant: 'control', weight: 1 },
        { variant: 'treatment', weight: 3 },
      ]);
    });

    it('drops malformed parts but keeps the rest', () => {
      // Missing weight, NaN weight, zero weight — all dropped; the good
      // entry survives so a partial typo doesn't blank the experiment.
      expect(parseSpec('A:50,B:,C:nope,D:0,E:25')).toEqual([
        { variant: 'A', weight: 50 },
        { variant: 'E', weight: 25 },
      ]);
    });

    it('trims surrounding whitespace on variant names', () => {
      expect(parseSpec(' A : 50 , B : 50 ')).toEqual([
        { variant: 'A', weight: 50 },
        { variant: 'B', weight: 50 },
      ]);
    });
  });

  describe('hash', () => {
    it('is deterministic for the same input', () => {
      expect(hash('hello:HERO_HEADLINE')).toBe(hash('hello:HERO_HEADLINE'));
    });

    it('differs for different inputs', () => {
      expect(hash('a:HERO')).not.toBe(hash('b:HERO'));
      expect(hash('same:A')).not.toBe(hash('same:B'));
    });

    it('returns an unsigned 32-bit integer', () => {
      const h = hash('whatever');
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xFFFFFFFF);
    });

    it('distributes evenly enough for 50/50 bucketing', () => {
      // Sample 5000 random ids and assert the bucket distribution is
      // within ±3% of perfect. djb2 isn't crypto-grade but is well
      // above good enough for visitor bucketing.
      let a = 0;
      for (let i = 0; i < 5000; i++) {
        const id = Math.random().toString(36).slice(2);
        if ((hash(id + ':TEST') % 100) < 50) a++;
      }
      expect(a).toBeGreaterThan(5000 * 0.47);
      expect(a).toBeLessThan(5000 * 0.53);
    });
  });
});
