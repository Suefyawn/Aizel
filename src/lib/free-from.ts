// ============================================================================
// "Free-from" claims vocabulary + heuristic for the collection filter.
//
// The closed vocabulary lives here (single source of truth — the DB
// migration mirrors it as a CHECK constraint, the storefront filter rail
// mirrors it for its chip labels). Adding a token = update this constant
// + the migration + the UI labels in CollectionPage.
//
// The HEURISTIC is for demo mode + a one-time backfill of an existing
// catalogue. The admin product form should be the long-term source of
// truth once the operator has reviewed each SKU.
// ============================================================================

export const FREE_FROM_TOKENS = [
  'sulphate-free',
  'silicone-free',
  'paraben-free',
  'mineral-oil-free',
  'cruelty-free',
  'vegan',
] as const;
export type FreeFromToken = typeof FREE_FROM_TOKENS[number];

export const FREE_FROM_LABELS: Record<FreeFromToken, string> = {
  'sulphate-free':   'Sulphate-free',
  'silicone-free':   'Silicone-free',
  'paraben-free':    'Paraben-free',
  'mineral-oil-free': 'Mineral oil-free',
  'cruelty-free':    'Cruelty-free',
  'vegan':           'Vegan',
};

/**
 * Heuristic claim-set for a product based on its name + description +
 * ingredients text. Used for demo data and for backfilling an existing
 * Supabase catalogue before the operator reviews each SKU.
 *
 * Two passes:
 *   1. EXPLICIT — pick up "sulphate-free", "no sulphates", "silicone-free",
 *      "no parabens" etc. from the product copy. Highest confidence.
 *   2. BRAND/CATEGORY DEFAULTS — well-known brand reputations (Cantu's
 *      Natural Hair line is mostly sulphate-free; Aphogee Two-Step
 *      contains protein but is paraben-free per Aphogee's own labelling).
 *      Loose but a reasonable demo signal.
 *
 * For unknown products: returns an empty array. The filter chip simply
 * doesn't match — better than a confidently-wrong claim.
 */
export function deriveFreeFromClaims(input: {
  name?: string | null;
  short_description?: string | null;
  description?: string | null;
  ingredients?: string | null;
  brand?: string | null;
  category?: string | null;
}): FreeFromToken[] {
  const text = [
    input.name, input.short_description, input.description, input.ingredients,
  ].filter(Boolean).join(' ').toLowerCase();

  const claims = new Set<FreeFromToken>();

  // Pass 1: explicit "free" / "no X" / "without X" mentions.
  if (/(sulphate|sulfate)[ -]?free|no sulph?ates|without sulph?ates/.test(text)) claims.add('sulphate-free');
  if (/silicone[ -]?free|no silicones?|without silicones?/.test(text)) claims.add('silicone-free');
  if (/paraben[ -]?free|no parabens|without parabens/.test(text)) claims.add('paraben-free');
  if (/mineral[ -]?oil[ -]?free|no mineral oil|without mineral oil/.test(text)) claims.add('mineral-oil-free');
  if (/cruelty[ -]?free|not tested on animals/.test(text)) claims.add('cruelty-free');
  if (/\bvegan\b/.test(text)) claims.add('vegan');

  // Pass 2: brand defaults — best-effort, loose, demo only.
  const brand = (input.brand ?? '').toLowerCase();
  const cat = (input.category ?? '').toLowerCase();

  // Cantu's Natural Hair line markets sulphate-free + mineral-oil-free.
  if (brand === 'cantu' && cat.includes('curl')) {
    claims.add('sulphate-free');
    claims.add('mineral-oil-free');
  }
  // Shea Moisture / As I Am — typically paraben + sulphate free.
  if (brand === 'as i am') {
    claims.add('sulphate-free');
    claims.add('paraben-free');
  }
  // Kuza / Doo Gro — traditional formulations, no claims (leave empty).

  return Array.from(claims);
}
