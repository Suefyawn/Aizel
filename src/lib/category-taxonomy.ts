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

export type TaxonKey = 'hair' | 'skincare' | 'body' | 'styling' | 'grooming';

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
    // Reading-order: cleanse → condition → combo packs → leave-in →
    // styling (oils/creams/edges/mousse) → chemistry (relaxers, colour).
    // Mirrors the DB taxonomy after migration 147 split the old
    // "Shampoo & Conditioner" junk-drawer leaf into single-purpose leaves.
    categories: [
      'Shampoo',
      'Conditioner',
      'Shampoo & Conditioner',
      'Leave-In Conditioner',
      'Hair Oils & Serums',
      'Curl & Styling Creams',
      'Edge Control & Gels',
      'Hair Treatments & Masks',
      'Mousse & Hairspray',
      'Relaxers & Kits',
      'Hair Colour',
    ],
  },
  {
    key: 'skincare',
    label: 'Skincare',
    tagline: 'Cleanse, moisturise, treat',
    // Split out of the old single "Skincare" catch-all leaf (migration
    // 154) so the mega-menu shows a real category list instead of one
    // redundant self-link.
    categories: [
      'Cleansers & Face Wash',
      'Moisturisers',
      'Serums & Treatments',
      'Face Masks',
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
    tagline: 'Wig care, lace, accessories, tools',
    categories: [
      'Wig & Lace Adhesives',
      'Bonding Glue',
      'Combs & Brushes',
      'Durags & Bonnets',
      'Wigs & Extensions',
      'Hair Tools',
    ],
  },
  {
    key: 'grooming',
    label: 'Grooming',
    tagline: 'Shaving, beard, fragrance',
    categories: [
      'Shaving',
      'Beard Care',
      'Bump Treatments',
      'Fragrance',
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

/**
 * Best-effort department for a product, used to pick department-appropriate
 * marketing copy (e.g. the PDP "Why Aizel" block). Unlike `taxonForCategory`
 * — which only matches a product tagged with an exact leaf category — this
 * also resolves the higher-level labels products carry post-import
 * ("Hair Care", "Body Care", "Beauty & Skincare", …) via conservative
 * keyword matching on the category/subcategory.
 *
 * Returns null when it can't classify confidently, so callers fall back to
 * generic copy rather than guess. Deliberately conservative: it never infers
 * "hair" for an item whose category doesn't actually mention hair, which is
 * the whole point — no "type 3 & 4 curls" on an aloe vera or a supplement.
 */
export function departmentForProduct(
  p: { category?: string | null; subcategory?: string | null },
): TaxonKey | null {
  const leaf = taxonForCategory(p.category);
  if (leaf) return leaf.key;
  const hay = `${p.category ?? ''} ${p.subcategory ?? ''}`.toLowerCase();
  if (!hay.trim()) return null;
  // Order matters: the most brand-specific signal (hair) is tested first and
  // the broadest (skincare) last, so e.g. "Hair Treatments & Masks" reads as
  // hair rather than skincare on the word "mask".
  if (/hair|curl|coil|shampoo|condition|leave.?in|\bedge|relax|texturi|\bwig|weave|braid|durag|bonnet|scalp|\blocs?\b|dread/.test(hay)) return 'hair';
  if (/beard|shav|after.?shave|cologne|fragrance|groom|\bbump/.test(hay)) return 'grooming';
  if (/comb|brush|clipper|trimmer|dryer|adhesive|bonding|\blace\b|\btool/.test(hay)) return 'styling';
  if (/body|shea|cocoa|butter|lotion|petroleum|vaseline|jelly/.test(hay)) return 'body';
  if (/skin|\bface|cleanser|serum|moistur|\bmask|toner|exfoliat/.test(hay)) return 'skincare';
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
  'Skincare': 'Face wash, moisturisers, serums and masks for melanin-rich skin — from Neutrogena, Aloe Pura and more.',
  'Body Care': 'Cocoa and shea butter, body oils, lotions and petroleum jelly — deeply moisturising body essentials.',
  'Styling & Tools': 'Wig and lace adhesives, bonding glues, durags and the accessories that finish the look.',
  'Grooming': 'Shaving sets, beard oils, fragrance and bump treatments built for sensitive skin.',

  // ── Hair Care leaves ──
  'Shampoo': 'Sulphate-free cleansers, clarifying shampoos and moisturising washes for every curl pattern.',
  'Conditioner': 'Rinse-out conditioners — daily, weekly and deep treatments to detangle, soften and seal.',
  'Shampoo & Conditioner': 'Matched shampoo + conditioner sets and duos — the easiest way to keep a routine consistent.',
  'Leave-In Conditioner': 'Leave-in conditioners, detangling sprays and pre-styling moisturisers — the foundation of every wash-day routine.',
  'Hair Oils & Serums': 'Castor oil, Amla, argan and Jamaican Black Castor Oil — strengthen and nourish from root to tip.',
  'Curl & Styling Creams': 'Curl-defining creams and leave-ins for soft, springy hold without crunch.',
  'Edge Control & Gels': 'Long-lasting edge control, sleeking gels and styling pomades.',
  'Hair Treatments & Masks': 'Protein treatments, deep conditioners and bond-repair masks for hair that\'s been through it.',
  'Mousse & Hairspray': 'Setting mousses, hairsprays and finishing products to lock the look in.',
  'Relaxers & Kits': 'Relaxer and texturiser kits — at-home application made simple.',
  'Hair Colour': 'Permanent and semi-permanent hair colour from Bigen, Crazy Color, Creme of Nature and more — full coverage and fade-resistant tones.',

  // ── Skincare leaves ──
  'Cleansers & Face Wash': 'Face washes, cleansing balms, astringents and exfoliating scrubs for melanin-rich skin.',
  'Moisturisers': 'Daily creams and intensive moisturisers — lightweight hydration to rich nourishing formulas.',
  'Serums & Treatments': 'Targeted serums, facial oils, aloe gels and dark-spot / even-tone treatments.',
  'Face Masks': 'Clay, healing and soothing face masks for a weekly deep-clean or calm-down.',

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
  'Wigs & Extensions': 'Human and synthetic wigs, bundles, weaves and braiding hair — the protective-style essentials.',
  'Hair Tools': 'Hair dryers, straighteners, clippers and applicators from Wahl, Remington and Babyliss — the tools that finish the routine.',

  // ── Grooming leaves ──
  'Shaving': 'Magic Shaving Powder, razors and shave creams for a smooth, irritation-free shave.',
  'Beard Care': 'Beard oils, balms and conditioners — soft, sharp and well-kept.',
  'Bump Treatments': 'After-shave bump and razor-bump treatments for sensitive skin.',
  'Fragrance': 'Cologne, aftershave and traditional fragrances — Brut, Florida Water and more.',
};

/** Every fine-grained leaf category, flattened across all taxons. */
export const ALL_CATEGORIES: readonly string[] = TAXONS.flatMap(t => t.categories);

// ── Nav-only structure ────────────────────────────────────────────────────
// The header nav is curated separately from the data taxonomy: 4 raw taxons
// would crowd the bar, so Styling & Tools + Grooming collapse into one
// "Styling" mega-menu with two sub-columns. The mega-menu still links each
// sub-heading to its underlying taxon page so /shop?taxon=grooming keeps
// working — only the top-of-header surface changes.

export interface NavMegaColumn {
  /** Sub-heading shown above the column (e.g. "Styling & Tools"). */
  heading: string;
  /** Taxon URL the heading links to (e.g. /shop?taxon=styling). */
  href: string;
  /** Leaf categories displayed under the heading. */
  categories: readonly string[];
}

export interface NavSection {
  /** Primary nav label shown in the header (e.g. "Hair Care", "Styling"). */
  label: string;
  /** Primary anchor href — what clicking the top-level label navigates to. */
  href: string;
  /** Stable key for React + state. */
  key: string;
  /** Taxon keys whose URLs (?taxon=…) should also light this nav item as
   *  active. A "Styling" mega-menu covers BOTH styling and grooming taxons. */
  activeTaxonKeys: readonly string[];
  /** Mega-menu sub-columns. Most sections have one column (= one taxon);
   *  the consolidated "Styling" section has two so the IA stays legible. */
  columns: readonly NavMegaColumn[];
}

/**
 * Industry-standard primary nav for the storefront. Five mega-menu items
 * mirrors what Cult Beauty / LookFantastic / Beauty Bay surface, instead of
 * dumping every taxon flat across the bar.
 */
export const NAV_SECTIONS: readonly NavSection[] = (() => {
  const hair     = TAXONS.find(t => t.key === 'hair')!;
  const skincare = TAXONS.find(t => t.key === 'skincare')!;
  const body     = TAXONS.find(t => t.key === 'body')!;
  const styling  = TAXONS.find(t => t.key === 'styling')!;
  const groom    = TAXONS.find(t => t.key === 'grooming')!;
  return [
    {
      key: 'hair', label: hair.label, href: `/shop?taxon=${hair.key}`,
      activeTaxonKeys: [hair.key],
      columns: [{ heading: hair.label, href: `/shop?taxon=${hair.key}`, categories: hair.categories }],
    },
    {
      key: 'skincare', label: skincare.label, href: `/shop?taxon=${skincare.key}`,
      activeTaxonKeys: [skincare.key],
      columns: [{ heading: skincare.label, href: `/shop?taxon=${skincare.key}`, categories: skincare.categories }],
    },
    {
      key: 'body', label: body.label, href: `/shop?taxon=${body.key}`,
      activeTaxonKeys: [body.key],
      columns: [{ heading: body.label, href: `/shop?taxon=${body.key}`, categories: body.categories }],
    },
    {
      // "Styling" is a curated grouping — clicking the top label drops the
      // shopper on the Styling & Tools landing; the mega-menu surfaces both.
      key: 'styling', label: 'Styling', href: `/shop?taxon=${styling.key}`,
      activeTaxonKeys: [styling.key, groom.key],
      columns: [
        { heading: styling.label, href: `/shop?taxon=${styling.key}`, categories: styling.categories },
        { heading: groom.label,   href: `/shop?taxon=${groom.key}`,   categories: groom.categories },
      ],
    },
  ];
})();

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

// ── Dynamic loader ────────────────────────────────────────────────────────
// The `TAXONS` / `CATEGORY_DESCRIPTIONS` / `NAV_SECTIONS` constants above are
// the BUILD-TIME SEED — they're what the storefront ships if the DB is
// unreachable, what the dev env serves before its first DB query, and what
// the migration `20260526_143_categories_cms.sql` mirrors into the DB on
// initial install. Once an operator edits anything in the admin Categories
// CMS the DB becomes the source of truth, and consumers call
// `loadTaxonomy()` to get the live shape.
//
// The loader is `unstable_cache`'d with the `taxonomy` tag, so admin
// mutations call `revalidateTag('taxonomy')` to invalidate cached HTML
// across the whole app in one shot — no per-page revalidatePath storm.

export interface TaxonomyView {
  taxons: Taxon[];
  navSections: NavSection[];
  /** Lookup table mirroring CATEGORY_DESCRIPTIONS but built from DB rows. */
  categoryDescriptions: Record<string, string>;
  /** Every leaf category label, flattened. */
  allCategories: string[];
  /** Slug → canonical label lookup. */
  categoryByKey: Record<string, string>;
}

/** Build the same view we used to ship from constants, but from DB rows. */
function buildView(
  taxonRows: Array<{ key: string; label: string; tagline: string | null; description: string | null; sort_order: number }>,
  catRows:   Array<{ slug: string; label: string; description: string | null; taxon_key: string; sort_order: number }>,
): TaxonomyView {
  const taxons: Taxon[] = taxonRows.map(t => ({
    key:     t.key as TaxonKey,
    label:   t.label,
    tagline: t.tagline ?? '',
    categories: catRows.filter(c => c.taxon_key === t.key).map(c => c.label),
  }));

  // Nav sections — same curated shape the build-time constant has: every
  // taxon gets its own mega-menu EXCEPT grooming, which folds into the
  // styling mega-menu as a second column so the top bar stays uncluttered
  // (matches Cult Beauty / LookFantastic). The top-level label for that
  // section is the short "Styling" rather than the full "Styling & Tools"
  // taxon label. Any taxon the DB carries beyond the well-known five
  // (hair/skincare/body/styling/grooming) still gets its own mega-menu —
  // operators get the dynamic-taxon win without losing the curated merge.
  const grooming = taxons.find(t => t.key === 'grooming');
  const navSections: NavSection[] = taxons
    .filter(t => t.key !== 'grooming')
    .map(t => {
      if (t.key === 'styling' && grooming) {
        return {
          key:             t.key,
          label:           'Styling',
          href:            `/shop?taxon=${t.key}`,
          activeTaxonKeys: [t.key, grooming.key],
          columns: [
            { heading: t.label,        href: `/shop?taxon=${t.key}`,        categories: t.categories },
            { heading: grooming.label, href: `/shop?taxon=${grooming.key}`, categories: grooming.categories },
          ],
        };
      }
      return {
        key:             t.key,
        label:           t.label,
        href:            `/shop?taxon=${t.key}`,
        activeTaxonKeys: [t.key],
        columns: [{ heading: t.label, href: `/shop?taxon=${t.key}`, categories: t.categories }],
      };
    });

  const categoryDescriptions: Record<string, string> = {
    All: CATEGORY_DESCRIPTIONS.All,
  };
  for (const t of taxonRows) {
    if (t.description) categoryDescriptions[t.label] = t.description;
  }
  for (const c of catRows) {
    if (c.description) categoryDescriptions[c.label] = c.description;
  }

  const allCategories = catRows.map(c => c.label);
  const categoryByKey: Record<string, string> = {};
  for (const c of catRows) {
    categoryByKey[c.slug] = c.label;
    categoryByKey[c.label.toLowerCase()] = c.label;
  }
  return { taxons, navSections, categoryDescriptions, allCategories, categoryByKey };
}

/** Read taxons + categories from Supabase and assemble a TaxonomyView. */
async function fetchTaxonomyFromDb(): Promise<TaxonomyView> {
  // Lazy-import so this file stays importable from the client build path
  // (the constants above don't depend on supabase-js).
  const { supabase } = await import('./supabase');
  const [taxResult, catResult] = await Promise.all([
    supabase.from('taxons').select('key, label, tagline, description, sort_order').order('sort_order'),
    supabase.from('categories').select('slug, label, description, sort_order, taxons(key)').order('sort_order'),
  ]);
  type CatRow = { slug: string; label: string; description: string | null; sort_order: number; taxons: { key: string } | { key: string }[] | null };
  const cats = ((catResult.data ?? []) as CatRow[]).map(c => {
    const t = Array.isArray(c.taxons) ? c.taxons[0] : c.taxons;
    return { slug: c.slug, label: c.label, description: c.description, sort_order: c.sort_order, taxon_key: t?.key ?? '' };
  }).filter(c => c.taxon_key);
  const taxs = (taxResult.data ?? []) as Array<{ key: string; label: string; tagline: string | null; description: string | null; sort_order: number }>;
  if (taxs.length === 0) {
    // DB empty or unreachable — return the build-time seed so the store
    // doesn't render an empty nav.
    return buildFromConstants();
  }
  return buildView(taxs, cats);
}

/** Build the same view from the build-time constants — used as the
 *  ultimate fallback when the DB is unreachable. */
function buildFromConstants(): TaxonomyView {
  const taxonRows = TAXONS.map((t, i) => ({
    key: t.key, label: t.label, tagline: t.tagline, description: CATEGORY_DESCRIPTIONS[t.label] ?? null, sort_order: i,
  }));
  const catRows = TAXONS.flatMap((t, ti) =>
    t.categories.map((c, ci) => ({
      slug: c.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
      label: c, description: CATEGORY_DESCRIPTIONS[c] ?? null,
      taxon_key: t.key, sort_order: ti * 100 + ci,
    })),
  );
  return buildView(taxonRows, catRows);
}

let _cachedLoader: (() => Promise<TaxonomyView>) | null = null;

/** Load the live taxonomy from DB (cached). Used by every server entry
 *  point that needs taxon/category data — homepage, shop, layout, sitemap.
 *  Admin mutations call `revalidateTag('taxonomy')` to invalidate. */
export async function loadTaxonomy(): Promise<TaxonomyView> {
  if (_cachedLoader === null) {
    // `unstable_cache` is the Next.js primitive for memoising async work
    // across requests with a tag that admin actions can invalidate. We
    // resolve the import lazily so this file remains safe to import from
    // bundler contexts that don't have next/cache (tests, etc.).
    const { unstable_cache } = await import('next/cache');
    _cachedLoader = unstable_cache(
      fetchTaxonomyFromDb,
      ['taxonomy-v1'],
      { tags: ['taxonomy'], revalidate: 300 },
    );
  }
  try {
    return await _cachedLoader();
  } catch {
    return buildFromConstants();
  }
}
