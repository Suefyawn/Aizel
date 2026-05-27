import { describe, expect, it } from 'vitest';
import { scoreAnswers, QUESTIONS } from './quiz';

describe('scoreAnswers', () => {
  it('returns a stable top category for the canonical "type 4 dry" persona', () => {
    // A shopper with tight coils, high porosity, dry hair, moisture goal,
    // long wash days — the recommendation should be a high-moisture lead
    // (Treatments & Masks) rather than a styling category.
    const result = scoreAnswers({
      curl: 'type-4',
      porosity: 'high',
      feels: 'dry',
      goal: 'moisture',
      time: 'long',
    });
    expect(result.topCategory).toBe('Hair Treatments & Masks');
    expect(result.alsoConsider).toContain('Cocoa & Shea Butter');
    expect(result.summary).toContain('tight coils');
    expect(result.summary).toContain('high-porosity');
    expect(result.summary).toContain('moisture');
  });

  it('routes "type 3 definition" personas to curl creams', () => {
    const result = scoreAnswers({
      curl: 'type-3',
      porosity: 'mid',
      feels: 'frizzy',
      goal: 'definition',
      time: 'mid',
    });
    expect(result.topCategory).toBe('Curl & Styling Creams');
  });

  it('tolerates missing answers without crashing', () => {
    // Partial completion — a shopper who closed the tab mid-quiz. The
    // engine should still return a deterministic recommendation rather
    // than throwing.
    const result = scoreAnswers({ curl: 'type-3' });
    expect(result.topCategory).toBe('Curl & Styling Creams');
    expect(result.selections).toHaveLength(1);
  });

  it('every answer maps to at least one real category leaf', () => {
    // Regression guard: a typo in an answer's `picks` key would silently
    // route shoppers into a 0-product result page. Compare to the leaf
    // categories enumerated in src/lib/category-taxonomy.ts.
    const knownLeaves = new Set([
      // hair (post-migration 147 split: Shampoo & Conditioner is now the
      // combo-pack leaf; single-purpose Shampoo / Conditioner / Leave-In
      // sit alongside it).
      'Shampoo', 'Conditioner', 'Shampoo & Conditioner', 'Leave-In Conditioner',
      'Hair Oils & Serums', 'Curl & Styling Creams', 'Edge Control & Gels',
      'Hair Treatments & Masks', 'Mousse & Hairspray', 'Relaxers & Kits',
      'Hair Colour',
      // body (the moisture-seeking answers cross over)
      'Cocoa & Shea Butter', 'Body Oils', 'Body Lotions', 'Body Wash',
      'Petroleum Jelly',
    ]);
    for (const q of QUESTIONS) {
      for (const a of q.answers) {
        const keys = Object.keys(a.picks);
        expect(keys.length, `${q.id}/${a.id} has no picks`).toBeGreaterThan(0);
        for (const k of keys) {
          expect(knownLeaves.has(k), `${q.id}/${a.id} routes to unknown category "${k}"`).toBe(true);
        }
      }
    }
  });
});
