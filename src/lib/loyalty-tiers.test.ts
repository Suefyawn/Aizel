import { describe, expect, it } from 'vitest';
import { tierFor, nextTier, TIERS } from './loyalty-tiers';

describe('loyalty tiers', () => {
  describe('tierFor', () => {
    it('returns NO_TIER for £0 spend so the UI can render a friendly prompt', () => {
      expect(tierFor(0).key).toBe('none');
      expect(tierFor(0).tagline).toContain('first order');
    });

    it('lands on bronze at any positive spend below silver', () => {
      expect(tierFor(0.01).key).toBe('bronze');
      expect(tierFor(149.99).key).toBe('bronze');
    });

    it('promotes at the exact threshold', () => {
      expect(tierFor(150).key).toBe('silver');
      expect(tierFor(500).key).toBe('gold');
      expect(tierFor(1500).key).toBe('platinum');
    });

    it('stays platinum forever above the top threshold', () => {
      expect(tierFor(10_000).key).toBe('platinum');
    });

    it('survives NaN / Infinity without crashing', () => {
      expect(tierFor(NaN).key).toBe('none');
      expect(tierFor(Infinity).key).toBe('none');
    });
  });

  describe('nextTier', () => {
    it('returns the next threshold + remainder for a mid-bronze customer', () => {
      const r = nextTier(80);
      expect(r?.next.key).toBe('silver');
      expect(r?.gbpRemaining).toBeCloseTo(70);
    });

    it('returns gold for someone in silver', () => {
      const r = nextTier(200);
      expect(r?.next.key).toBe('gold');
      expect(r?.gbpRemaining).toBeCloseTo(300);
    });

    it('returns null for a platinum customer (no higher tier)', () => {
      expect(nextTier(1500)).toBeNull();
      expect(nextTier(5000)).toBeNull();
    });

    it('returns bronze for a £0 spender (the very first goal)', () => {
      // Pre-bronze customers — the next milestone is bronze itself.
      expect(nextTier(0)?.next.key).toBe('bronze');
    });
  });

  it('TIERS is ordered high → low — tierFor depends on this', () => {
    for (let i = 1; i < TIERS.length; i++) {
      expect(TIERS[i].minSpend).toBeLessThan(TIERS[i - 1].minSpend);
    }
  });
});
