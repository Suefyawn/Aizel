// ============================================================================
// Loyalty tier ladder — derived purely from lifetime spend on delivered
// orders. No schema change: the tier is computed at read-time so it
// stays correct as orders flow without any back-fill job.
//
// Thresholds tuned for UK Afro/Black hair-care: most customers cycle a
// £20–£40 basket every 6-8 weeks, so:
//   • Bronze    — £0       (any signed-in customer who's placed 1 order)
//   • Silver    — £150     (3-4 orders of average size)
//   • Gold      — £500     (a year of regular reorders)
//   • Platinum  — £1,500   (a "we'd notice if they left" customer)
//
// Tunable in one place; CATEGORY pages + admin user-detail + emails all
// read the same source.
// ============================================================================

export type TierKey = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum';

export interface Tier {
  key: TierKey;
  label: string;
  /** Lifetime spend (GBP) the customer must reach to enter this tier. */
  minSpend: number;
  /** Hex chip background, lighter than the brand accents so the badge
   *  doesn't compete with primary CTAs. */
  bg: string;
  /** Chip text colour — paired with `bg` to clear WCAG AA at the 11px
   *  uppercase tier-chip size. */
  fg: string;
  /** Short customer-facing tagline shown next to the badge. */
  tagline: string;
}

// Order matters — `tierFor` walks high→low and returns the first one
// whose threshold the customer has crossed.
export const TIERS: Tier[] = [
  {
    key: 'platinum', label: 'Platinum', minSpend: 1500,
    bg: '#E5E4E2', fg: '#3D3B3A',
    tagline: 'Top-tier shopper · early access to drops',
  },
  {
    key: 'gold', label: 'Gold', minSpend: 500,
    bg: '#FBF2D9', fg: '#7A5810',
    tagline: 'Free UK delivery on every order',
  },
  {
    key: 'silver', label: 'Silver', minSpend: 150,
    bg: '#EDEDED', fg: '#525252',
    tagline: 'Subscriber-only previews + 5% birthday treat',
  },
  {
    key: 'bronze', label: 'Bronze', minSpend: 0.01,
    bg: '#F5EFE6', fg: '#7C5A35',
    tagline: 'Welcome — every order earns points',
  },
];

const NO_TIER: Tier = {
  key: 'none', label: '—', minSpend: 0,
  bg: 'transparent', fg: 'var(--ink-500)',
  tagline: 'Place your first order to unlock Bronze',
};

/**
 * Compute the tier a customer is in, given their lifetime delivered
 * spend in GBP. Returns the synthetic NO_TIER for £0 spenders so the
 * UI can show a friendly "place your first order" prompt without a
 * type-narrowing dance.
 */
export function tierFor(lifetimeSpend: number): Tier {
  if (!isFinite(lifetimeSpend) || lifetimeSpend < TIERS[TIERS.length - 1].minSpend) {
    return NO_TIER;
  }
  for (const t of TIERS) {
    if (lifetimeSpend >= t.minSpend) return t;
  }
  return NO_TIER;
}

/**
 * Distance to next tier — returns the next tier + GBP remaining, or
 * null when the customer is already at the top. Used by /account to
 * surface "£X to reach Gold" progress UI.
 */
export function nextTier(lifetimeSpend: number): { next: Tier; gbpRemaining: number } | null {
  // Iterate low→high to find the FIRST threshold the customer hasn't crossed.
  for (const t of [...TIERS].reverse()) {
    if (lifetimeSpend < t.minSpend) {
      return { next: t, gbpRemaining: t.minSpend - lifetimeSpend };
    }
  }
  return null;
}
