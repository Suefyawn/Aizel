// ============================================================================
// Top-level nav taxonomy.
//
// The flat `category` column on `products` carries fine-grained values like
// "Lip & Cheek Tints", "Highlighters", "Human Health", "Bone Health" — too
// many to surface as primary nav items. The TAXONS below group them into
// the 4 top-level sections that drive the storefront header and the
// CategoryTiles section on the homepage.
//
// The taxonomy is data: editors can re-shuffle categories between taxons
// without a code change to consumers (Header + Shop page expand the taxon
// to its category set via `categoriesForTaxon`).
// ============================================================================

export type TaxonKey = 'hair' | 'body' | 'styling' | 'grooming';

export interface Taxon {
  key: TaxonKey;
  /** Display label used in nav + filter chips. */
  label: string;
  /** Marketing tagline shown on the CategoryTiles homepage section. */
  tagline: string;
  /** Exact category values (post-HTML-decode) that belong to this taxon. */
  categories: readonly string[];
}

export const TAXONS: readonly Taxon[] = [
  {
    key: 'hair',
    label: 'Hair Care',
    tagline: 'Shampoo, oils, curl & styling',
    categories: [
      'Shampoo & Conditioner',
      'Hair Oils & Serums',
      'Curl & Styling Creams',
      'Edge Control & Gels',
      'Hair Treatments & Masks',
      'Mousse & Hairspray',
      'Relaxers & Kits',
    ],
  },
  {
    key: 'body',
    label: 'Body Care',
    tagline: 'Butters, oils & lotions',
    categories: [
      'Cocoa & Shea Butter',
      'Body Oils',
      'Body Lotions',
      'Body Wash',
      'Petroleum Jelly',
    ],
  },
  {
    key: 'styling',
    label: 'Styling & Tools',
    tagline: 'Wig care, lace, accessories',
    categories: [
      'Wig & Lace Adhesives',
      'Bonding Glue',
      'Combs & Brushes',
      'Durags & Bonnets',
    ],
  },
  {
    key: 'grooming',
    label: 'Grooming',
    tagline: 'Shaving & beard care',
    categories: [
      'Shaving',
      'Beard Care',
      'Bump Treatments',
    ],
  },
];

const TAXON_BY_KEY: Record<TaxonKey, Taxon> =
  Object.fromEntries(TAXONS.map(t => [t.key, t])) as Record<TaxonKey, Taxon>;

const TAXON_BY_LABEL: Record<string, Taxon> =
  Object.fromEntries(TAXONS.map(t => [t.label.toLowerCase(), t]));

/** Lookup a taxon by key OR label (case-insensitive). Returns null on miss. */
export function findTaxon(slug: string | null | undefined): Taxon | null {
  if (!slug) return null;
  const s = slug.toLowerCase();
  return TAXON_BY_KEY[s as TaxonKey] ?? TAXON_BY_LABEL[s] ?? null;
}

/** All category values that belong to the taxon — used by the Shop page
 *  to expand a `?category=Makeup` URL into a multi-category filter. */
export function categoriesForTaxon(slug: string | null | undefined): readonly string[] | null {
  return findTaxon(slug)?.categories ?? null;
}

/** Reverse lookup: which taxon does a given fine-grained category belong to?
 *  Used by breadcrumbs and "shop more like this" CTAs on PDP. */
export function taxonForCategory(category: string | null | undefined): Taxon | null {
  if (!category) return null;
  for (const t of TAXONS) {
    if (t.categories.includes(category)) return t;
  }
  return null;
}

// ── Category landing-page copy ──────────────────────────────────────────────
// Intro copy shown on each Shop category/taxon page AND reused as that page's
// meta description, so every category landing page has unique, indexable text
// instead of all sharing one generic line. Keyed by taxon labels and by the
// fine-grained leaf categories.
export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  All: 'Authentic Afro/Black hair and body care brands — Cantu, ORS, Palmer\'s, Kuza, Mane \'n Tail and more, delivered across the UK.',

  // ── Taxons ──
  'Hair Care': 'Shampoo, conditioner, oils, curl creams, edge control and treatments from the brands UK natural-hair fans actually buy.',
  'Body Care': 'Cocoa and shea butter, body oils, lotions and petroleum jelly — deeply moisturising body essentials.',
  'Styling & Tools': 'Wig and lace adhesives, bonding glues, durags and the accessories that finish the look.',
  'Grooming': 'Shaving sets, beard oils and bump treatments built for sensitive skin.',

  // ── Hair Care leaves ──
  'Shampoo & Conditioner': 'Sulphate-free and moisturising shampoos and conditioners for every curl pattern — from Cantu, ApHogee, Kera Care and more.',
  'Hair Oils & Serums': 'Castor oil, Amla, argan and Jamaican Black Castor Oil — strengthen and nourish from root to tip.',
  'Curl & Styling Creams': 'Curl-defining creams and leave-ins for soft, springy hold without crunch.',
  'Edge Control & Gels': 'Long-lasting edge control, sleeking gels and styling pomades.',
  'Hair Treatments & Masks': 'Protein treatments, deep conditioners and bond-repair masks for hair that\'s been through it.',
  'Mousse & Hairspray': 'Setting mousses, hairsprays and finishing products to lock the look in.',
  'Relaxers & Kits': 'Relaxer and texturiser kits — at-home application made simple.',

  // ── Body Care leaves ──
  'Cocoa & Shea Butter': 'Pure cocoa and shea butter from Palmer\'s, Ghana\'s Best and more — deeply nourishing for dry skin.',
  'Body Oils': 'Glow-finish body oils that hydrate without the heavy feel.',
  'Body Lotions': 'Daily body lotions for soft, comfortable skin all day long.',
  'Body Wash': 'Moisturising shower gels and body washes that don\'t strip the skin.',
  'Petroleum Jelly': 'Vaseline and pure petroleum jelly — the multi-use moisture lock.',

  // ── Styling & Tools leaves ──
  'Wig & Lace Adhesives': 'Ebin Wonder Lace Bond and other strong-hold adhesives for wig install that lasts.',
  'Bonding Glue': 'Salon-grade bonding glues for hair extensions and quick-weave styles.',
  'Combs & Brushes': 'Wide-tooth combs, detangling brushes and styling tools.',
  'Durags & Bonnets': 'Silk and satin durags and bonnets — protect your style overnight.',

  // ── Grooming leaves ──
  'Shaving': 'Magic Shaving Powder, razors and shave creams for a smooth, irritation-free shave.',
  'Beard Care': 'Beard oils, balms and conditioners — soft, sharp and well-kept.',
  'Bump Treatments': 'After-shave bump and razor-bump treatments for sensitive skin.',
};

/** Every fine-grained leaf category, flattened across all taxons. */
export const ALL_CATEGORIES: readonly string[] = TAXONS.flatMap(t => t.categories);

const slugifyCategory = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Leaf category lookup keyed by both the lower-cased label and its slug
// ("combo-packs"), so either URL form resolves to the canonical label.
const CATEGORY_BY_KEY: Record<string, string> = Object.fromEntries(
  ALL_CATEGORIES.flatMap(c => [
    [c.toLowerCase(), c] as [string, string],
    [slugifyCategory(c), c] as [string, string],
  ]),
);

/**
 * Resolve a `?category=` value — a canonical label ("Combo Packs"), a slug
 * ("combo-packs"), or a taxon ("makeup" / "Makeup") — to its canonical display
 * label. Returns null for "All" / unknown values. Collapsing the label-vs-slug
 * variants onto one label keeps the Shop page's title + canonical URL stable,
 * so the same category is not indexed under two competing URLs.
 */
export function canonicalCategory(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v || v.toLowerCase() === 'all') return null;
  const taxon = findTaxon(v);
  if (taxon) return taxon.label;
  return CATEGORY_BY_KEY[v.toLowerCase()] ?? null;
}
