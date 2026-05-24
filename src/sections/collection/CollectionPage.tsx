'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Overline } from '@/components/ui/Overline';
import { ProductTile } from '@/components/ui/ProductTile';
import { useBodyScrollLock, useEscapeKey, useFocusTrap } from '@/lib/hooks/useBodyScrollLock';
import { TAXONS, findTaxon, taxonForCategory, canonicalCategory, CATEGORY_DESCRIPTIONS } from '@/lib/category-taxonomy';
import { FREE_FROM_TOKENS, FREE_FROM_LABELS, type FreeFromToken } from '@/lib/free-from';
import type { Product, ProductAttribute, AttributeValue } from '@/types';

interface AttributeWithValues extends ProductAttribute {
  values: AttributeValue[];
}

const PAGE_SIZE = 48;

// Top-level shop tabs are the 4 taxons, with "All" first. The sub-category
// chips below are the active taxon's leaf categories — filtered down to the
// ones that actually have products (see `subcats`) so the row can never
// surface an empty category.
const TOP_CATEGORY_NAMES = ['All', ...TAXONS.map(t => t.label)];

type SortKey = 'featured' | 'newest' | 'bestsellers' | 'price-low' | 'price-high' | 'name';

// Industry-standard sort menu order, matching what UK beauty retailers
// (Cult Beauty, LookFantastic, Beauty Bay) present. The order is deliberate:
// merchandised picks first, then recency / popularity, then price, then A-Z.
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'featured',    label: 'Featured' },
  { value: 'newest',      label: 'Newest first' },
  { value: 'bestsellers', label: 'Bestsellers first' },
  { value: 'price-low',   label: 'Price: Low → High' },
  { value: 'price-high',  label: 'Price: High → Low' },
  { value: 'name',        label: 'Name A–Z' },
];

interface Props {
  products: Product[];
  attributes?: AttributeWithValues[];
  /** Map of product_id → list of attribute_value_ids that the product's variants cover. */
  productValueMap?: Record<string, string[]>;
  /** Initial top tab — a taxon label ("Makeup") or "All". */
  initialCategory?: string;
  /** Initial leaf-category chip (one of the 18 product categories). */
  initialSubcategory?: string | null;
  /** Optional pre-applied "on sale" filter, set by `?on_sale=1`. */
  initialOnSaleOnly?: boolean;
}

export function CollectionPage({
  products,
  attributes = [],
  productValueMap = {},
  initialCategory = 'All',
  initialSubcategory = null,
  initialOnSaleOnly = false,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // ─── URL-state hydration ────────────────────────────────────────────────
  // Parse once on mount from the search params; subsequent updates are
  // pushed via router.replace below.
  const readInitial = () => {
    const sp = searchParams;
    // The proxy 301s ?cat=→?category= and ?sub=→?subcategory= so by the time
    // we read here, the canonical names are in place. We still fall through
    // to the short forms as a belt-and-braces safety net (e.g. if someone
    // disables middleware during local dev).
    //
    // Resolve whatever the URL carries — ?taxon=, ?category= (which may be a
    // taxon OR a leaf), ?subcategory= — into a (top tab, leaf chip) pair.
    // The top tab is always a taxon label; the chip is always a leaf.
    const { cat, sub } = (() => {
      const taxonParam = sp.get('taxon');
      const catParam = sp.get('category') ?? sp.get('cat')
        ?? (initialCategory !== 'All' ? initialCategory : null);
      const subParam = sp.get('subcategory') ?? sp.get('sub') ?? initialSubcategory ?? null;
      let topLabel = 'All';
      let leaf: string | null = null;
      const taxon = findTaxon(taxonParam) ?? findTaxon(catParam);
      if (taxon) {
        topLabel = taxon.label;
      } else if (catParam) {
        // catParam is a leaf category — normalise the slug/label form to its
        // canonical label, then map it back to its owning taxon. Without the
        // canonicalCategory() step a slug URL (?category=combo-packs) would
        // never match a taxon's category list and the chip + product filter
        // would silently come up empty.
        const leafCat = canonicalCategory(catParam);
        const owner = taxonForCategory(leafCat);
        if (owner && leafCat) { topLabel = owner.label; leaf = leafCat; }
      }
      if (subParam) {
        // Same canonicalisation for ?subcategory= — both URL forms collapse
        // onto the one canonical leaf label.
        const leafSub = canonicalCategory(subParam);
        if (leafSub) {
          leaf = leafSub;
          const owner = taxonForCategory(leafSub);
          if (owner) topLabel = owner.label;
        }
      }
      return { cat: topLabel, sub: leaf };
    })();
    const sort = (sp.get('sort') as SortKey | null) ?? 'featured';
    const pageNum = Math.max(1, Number(sp.get('page') ?? '1'));
    const brands = sp.get('brand')?.split(',').filter(Boolean) ?? [];
    const attrs  = sp.get('attr')?.split(',').filter(Boolean) ?? [];
    // Validate each ?free_from= token against the closed vocabulary — a
    // typo'd URL token would otherwise sit in state forever and never match.
    const freeFromTokens = (sp.get('free_from')?.split(',').filter(Boolean) ?? [])
      .filter((t): t is FreeFromToken => (FREE_FROM_TOKENS as readonly string[]).includes(t));
    const min = sp.get('min'); const max = sp.get('max');
    return {
      cat, sub, sort, pageNum,
      // Free-text search term — populated when the user comes in from the
      // search overlay (`/shop?q=cerave`) or from a WP-style `/?s=foo`
      // redirect (see proxy.ts).
      q: sp.get('q') ?? '',
      brands: new Set(brands),
      attrs:  new Set(attrs),
      freeFrom: new Set<FreeFromToken>(freeFromTokens),
      min: min ? Number(min) : ('' as number | ''),
      max: max ? Number(max) : ('' as number | ''),
      stock: sp.get('stock') === '1',
      // ?on_sale=1 (canonical) and ?sale=1 (legacy chip state) both seed
      // the on-sale filter. initialOnSaleOnly comes from the server when
      // the URL had ?on_sale=1, so it wins regardless of chip state.
      sale:  sp.get('sale') === '1' || sp.get('on_sale') === '1' || initialOnSaleOnly,
    };
  };
  // Mount-time only — useState initialiser runs once on mount. Subsequent
  // navigations are handled by re-rendering the page server-side, so this is
  // correct. Storing the URL-hydrated snapshot in state (not a ref) is
  // important: it satisfies the React Compiler's "no refs in render" rule.
  const [initialState] = useState(readInitial);

  const [activeCategory, setActiveCategory] = useState<string>(initialState.cat);
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(initialState.sub);
  const [sortBy, setSortBy] = useState<SortKey>(initialState.sort);
  const [page, setPage] = useState(initialState.pageNum);

  // ─── Facets (price / brand / in-stock / on-sale) ─────────────────────────
  // Brand list + price bounds come from the taxon-scoped product set so they
  // make sense as the user navigates between top tabs. "All" → whole catalog.
  const categoryScoped = useMemo(() => {
    const t = findTaxon(activeCategory);
    if (!t) return products;
    return products.filter(p => t.categories.includes(p.category));
  }, [products, activeCategory]);

  const allBrands = useMemo<string[]>(() =>
    Array.from(
      new Set(
        categoryScoped
          .map(p => p.brand)
          .filter((b): b is string => Boolean(b)),
      ),
    ).sort()
  , [categoryScoped]);

  const priceBounds = useMemo(() => {
    if (categoryScoped.length === 0) return { min: 0, max: 10000 };
    let min = Infinity, max = -Infinity;
    for (const p of categoryScoped) {
      if (p.price < min) min = p.price;
      if (p.price > max) max = p.price;
    }
    return { min: Math.floor(min), max: Math.ceil(max) };
  }, [categoryScoped]);

  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(initialState.brands);
  const [selectedValueIds, setSelectedValueIds] = useState<Set<string>>(initialState.attrs);
  const [priceMin, setPriceMin] = useState<number | ''>(initialState.min);
  const [priceMax, setPriceMax] = useState<number | ''>(initialState.max);
  const [inStockOnly, setInStockOnly] = useState(initialState.stock);
  const [onSaleOnly, setOnSaleOnly] = useState(initialState.sale);
  const [q, setQ] = useState(initialState.q);
  const [selectedFreeFrom, setSelectedFreeFrom] = useState<Set<FreeFromToken>>(initialState.freeFrom);
  // In-rail brand search — quick filter when a category has many brands.
  // Industry-standard pattern on UK beauty retailers' filter sidebars.
  const [brandQuery, setBrandQuery] = useState('');

  // Filter rail behaviour depends on viewport:
  //   • Mobile/tablet (<1024px): collapsed by default; opening it slides a
  //     modal overlay in from the left, with body-scroll lock + focus trap.
  //   • Desktop (≥1024px): always visible as a persistent left sidebar
  //     (no modal semantics, no scroll lock, no focus trap).
  // We track viewport in a state so the ARIA shape switches cleanly between
  // the two modes (role=dialog vs role=region) and the modal-only hooks
  // (scroll lock / focus trap) only fire on mobile.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isDesktopRail, setIsDesktopRail] = useState(false);
  const filterPanelRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(min-width: 1024px)');
    const sync = () => setIsDesktopRail(mql.matches);
    sync();
    mql.addEventListener('change', sync);
    return () => mql.removeEventListener('change', sync);
  }, []);
  // Modal-only behaviour: only when the rail is actually behaving as an
  // overlay (mobile/tablet and the user has opened it).
  const railIsModal = filtersOpen && !isDesktopRail;
  useBodyScrollLock(railIsModal);
  useEscapeKey(railIsModal, () => setFiltersOpen(false));
  useFocusTrap(railIsModal, filterPanelRef);
  // Look up an attribute_value by id (for the chip label).
  const attrValueLookup = useMemo(() => {
    const m = new Map<string, { attrName: string; value: string }>();
    for (const a of attributes) for (const v of a.values) m.set(v.id, { attrName: a.name, value: v.value });
    return m;
  }, [attributes]);

  interface Chip { key: string; label: string; remove: () => void }
  const activeChips: Chip[] = useMemo(() => {
    const out: Chip[] = [];
    if (q.trim()) {
      out.push({
        key: 'q', label: `“${q.trim()}”`,
        remove: () => setQ(''),
      });
    }
    if (priceMin !== '' || priceMax !== '') {
      const lo = priceMin !== '' ? `£${priceMin}` : '';
      const hi = priceMax !== '' ? `£${priceMax}` : '';
      out.push({
        key: 'price', label: lo && hi ? `${lo} – ${hi}` : lo ? `≥ ${lo}` : `≤ ${hi}`,
        remove: () => { setPriceMin(''); setPriceMax(''); },
      });
    }
    if (inStockOnly) out.push({ key: 'stock', label: 'In stock', remove: () => setInStockOnly(false) });
    if (onSaleOnly) out.push({ key: 'sale', label: 'On sale', remove: () => setOnSaleOnly(false) });
    for (const b of selectedBrands) out.push({ key: `b:${b}`, label: b, remove: () => toggleBrand(b) });
    for (const id of selectedValueIds) {
      const v = attrValueLookup.get(id);
      out.push({
        key: `a:${id}`,
        label: v ? `${v.attrName}: ${v.value}` : id.slice(0, 8),
        remove: () => toggleValue(id),
      });
    }
    for (const token of selectedFreeFrom) {
      out.push({
        key: `ff:${token}`,
        label: FREE_FROM_LABELS[token],
        remove: () => toggleFreeFrom(token),
      });
    }
    return out;
  }, [q, priceMin, priceMax, inStockOnly, onSaleOnly, selectedBrands, selectedValueIds, selectedFreeFrom, attrValueLookup]);

  function toggleBrand(b: string) {
    setSelectedBrands(prev => {
      const next = new Set(prev);
      if (next.has(b)) next.delete(b); else next.add(b);
      return next;
    });
  }
  function toggleValue(id: string) {
    setSelectedValueIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleFreeFrom(token: FreeFromToken) {
    setSelectedFreeFrom(prev => {
      const next = new Set(prev);
      if (next.has(token)) next.delete(token); else next.add(token);
      return next;
    });
  }
  function clearFilters() {
    setSelectedBrands(new Set());
    setSelectedValueIds(new Set());
    setSelectedFreeFrom(new Set());
    setPriceMin(''); setPriceMax('');
    setInStockOnly(false); setOnSaleOnly(false);
    setQ('');
  }

  // Reset paging when *any* filter / sort / category / query changes.
  // Page state isn't derivable (it's user-driven within a filter set), so
  // resetting it on filter change has to happen in an effect.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setPage(1); }, [activeCategory, activeSubcategory, sortBy, selectedBrands, selectedValueIds, selectedFreeFrom, priceMin, priceMax, inStockOnly, onSaleOnly, q]);
  // Brand list rebuilds per-category; drop any selections that no longer apply.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setSelectedBrands(new Set()); }, [activeCategory]);

  // ─── URL persistence ─────────────────────────────────────────────────────
  useEffect(() => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set('q', q.trim());
    // Use `category=` / `subcategory=` (matches header nav + sitemap +
    // breadcrumb canonical URLs — see audit SEV-2 on cat/category mismatch).
    if (activeCategory && activeCategory !== 'All') sp.set('category', activeCategory);
    if (activeSubcategory) sp.set('subcategory', activeSubcategory);
    if (sortBy !== 'featured') sp.set('sort', sortBy);
    if (page !== 1) sp.set('page', String(page));
    if (selectedBrands.size > 0) sp.set('brand', Array.from(selectedBrands).join(','));
    if (selectedValueIds.size > 0) sp.set('attr', Array.from(selectedValueIds).join(','));
    if (selectedFreeFrom.size > 0) sp.set('free_from', Array.from(selectedFreeFrom).join(','));
    if (priceMin !== '') sp.set('min', String(priceMin));
    if (priceMax !== '') sp.set('max', String(priceMax));
    if (inStockOnly) sp.set('stock', '1');
    if (onSaleOnly) sp.set('sale', '1');
    const qs = sp.toString();
    const url = qs ? `/shop?${qs}` : '/shop';
    // Replace, not push — filtering shouldn't pile up history entries.
    router.replace(url, { scroll: false });
  }, [q, activeCategory, activeSubcategory, sortBy, page, selectedBrands, selectedValueIds, selectedFreeFrom, priceMin, priceMax, inStockOnly, onSaleOnly, router]);

  const activeFilterCount =
    (q.trim() ? 1 : 0) +
    selectedBrands.size +
    selectedValueIds.size +
    selectedFreeFrom.size +
    (priceMin !== '' || priceMax !== '' ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (onSaleOnly ? 1 : 0);

  // Leaf categories that actually have at least one product. The sub-category
  // chip row is built from this set so it can never show an empty category —
  // it stays correct automatically as the catalogue changes.
  const populatedLeaves = useMemo(
    () => new Set(products.map(p => p.category)),
    [products],
  );

  function handleTopCategory(cat: string) {
    setActiveCategory(cat);
    setActiveSubcategory(null);
  }

  // Pagination clicks must scroll back to the top of the catalogue.
  // `router.replace(..., { scroll: false })` suppresses Next's own scroll
  // restoration, so we scroll explicitly. Deferred one frame so it runs
  // after the new page's tiles commit, and INSTANT (not smooth) — a smooth
  // scroll gets aborted by the layout shift as the fresh tiles render,
  // which left the viewport stranded at the foot of the previous page.
  function goToPage(next: number) {
    setPage(next);
    requestAnimationFrame(() => window.scrollTo({ top: 0 }));
  }

  // Free-text query is matched case-insensitively against brand + name +
  // category + subcategory + variant. Cheap substring containment is fine
  // for the catalogue size we run — if it ever gets too big we'll swap in
  // the `search_products` RPC (pg_trgm) the typeahead overlay already uses.
  const qLower = q.trim().toLowerCase();
  const activeTaxon = findTaxon(activeCategory);

  let filtered = products.filter(p => {
    if (qLower) {
      const hay = `${p.brand} ${p.name} ${p.category ?? ''} ${p.variant ?? ''}`.toLowerCase();
      if (!hay.includes(qLower)) return false;
    }
    // Category scope: an active leaf chip narrows to that exact leaf
    // category; otherwise the active taxon narrows to its leaf set; the
    // "All" tab applies no category filter at all.
    if (activeSubcategory) {
      if (p.category !== activeSubcategory) return false;
    } else if (activeTaxon && !activeTaxon.categories.includes(p.category)) {
      return false;
    }
    if (selectedBrands.size > 0 && (!p.brand || !selectedBrands.has(p.brand))) return false;
    if (priceMin !== '' && p.price < priceMin) return false;
    if (priceMax !== '' && p.price > priceMax) return false;
    if (inStockOnly && p.track_inventory !== false && p.stock <= 0) return false;
    if (onSaleOnly && !(p.original_price && p.original_price > p.price)) return false;
    if (selectedFreeFrom.size > 0) {
      // AND match — every selected claim must appear on the product. A
      // shopper who ticks BOTH "sulphate-free" AND "silicone-free" wants
      // products that are both, not products that are either.
      const claims = p.free_from ?? [];
      for (const token of selectedFreeFrom) {
        if (!claims.includes(token)) return false;
      }
    }
    if (selectedValueIds.size > 0) {
      const productValues = productValueMap[p.id] ?? [];
      // Require the product to cover at least one selected value *per attribute* the user picked.
      // Build attrId → selectedValueIds map for this filter set.
      const selectedByAttr = new Map<string, string[]>();
      for (const id of selectedValueIds) {
        for (const a of attributes) {
          const v = a.values.find(x => x.id === id);
          if (v) {
            const arr = selectedByAttr.get(a.id) ?? [];
            arr.push(id);
            selectedByAttr.set(a.id, arr);
            break;
          }
        }
      }
      for (const [, ids] of selectedByAttr) {
        if (!ids.some(id => productValues.includes(id))) return false;
      }
    }
    return true;
  });

  if (sortBy === 'price-low') filtered = [...filtered].sort((a, b) => a.price - b.price);
  else if (sortBy === 'price-high') filtered = [...filtered].sort((a, b) => b.price - a.price);
  else if (sortBy === 'name') filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  else if (sortBy === 'newest') {
    // Newest first by created_at where present (Supabase). Demo-mode rows
    // don't carry timestamps, so fall back to reverse-id which preserves
    // insertion order from demo-data.ts.
    filtered = [...filtered].sort((a, b) => {
      const at = a.created_at ?? '';
      const bt = b.created_at ?? '';
      if (at && bt) return bt.localeCompare(at);
      return b.id.localeCompare(a.id);
    });
  }
  else if (sortBy === 'bestsellers') {
    // Bestseller-flagged products first, then everything else in stable order.
    filtered = [...filtered].sort((a, b) =>
      (b.is_bestseller ? 1 : 0) - (a.is_bestseller ? 1 : 0),
    );
  }

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Sub-category chips = the active taxon's leaf categories, filtered to the
  // ones that actually have products so the row never shows an empty chip.
  const subcats = activeTaxon
    ? activeTaxon.categories.filter(leaf => populatedLeaves.has(leaf))
    : [];
  // A single-brand view with no category filter is effectively that brand's
  // landing page — show the brand name as the heading and a brand intro line
  // (otherwise the page is the generic "All Products" with no copy of its own).
  const singleBrand = selectedBrands.size === 1 && activeCategory === 'All' && !activeSubcategory
    ? Array.from(selectedBrands)[0]
    : null;
  const pageTitle = singleBrand
    ?? activeSubcategory
    ?? (activeCategory === 'All' ? 'All Products' : activeCategory);

  return (
    <div>
      <section style={{ padding: '48px 0 0', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <Overline style={{ display: 'block', marginBottom: 8, color: 'var(--ink-500)' }}>Shop</Overline>
          <h1 className="display-l" style={{ fontSize: '2.5rem', marginBottom: 12 }}>{pageTitle}</h1>
          <p className="body-text" style={{ color: 'var(--ink-700)', maxWidth: 480, marginBottom: 32 }}>
            {singleBrand
              ? `Explore the full ${singleBrand} range at Aizel — 100% authentic, imported, with free UK delivery over £15.`
              : (activeSubcategory ? CATEGORY_DESCRIPTIONS[activeSubcategory] : undefined)
                ?? CATEGORY_DESCRIPTIONS[activeCategory]
                ?? CATEGORY_DESCRIPTIONS.All}
          </p>
          <div style={{ display: 'flex', gap: 0, overflowX: 'auto', marginBottom: -1 }}>
            {TOP_CATEGORY_NAMES.map(cat => (
              <button key={cat} onClick={() => handleTopCategory(cat)} style={{
                padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-ui)', fontSize: '0.8125rem', fontWeight: 600,
                color: activeCategory === cat && !activeSubcategory ? 'var(--ink-900)' : 'var(--ink-500)',
                borderBottom: activeCategory === cat && !activeSubcategory ? '2px solid var(--ink-900)' : '2px solid transparent',
                transition: 'color 150ms, border-color 150ms',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}>{cat}</button>
            ))}
          </div>
          {subcats.length > 0 && (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '12px 0', borderTop: '1px solid var(--line)' }}>
              {subcats.map(sub => (
                <button key={sub} onClick={() => setActiveSubcategory(activeSubcategory === sub ? null : sub)} style={{
                  padding: '6px 14px', background: activeSubcategory === sub ? 'var(--ink-900)' : 'transparent',
                  border: '1px solid', borderColor: activeSubcategory === sub ? 'var(--ink-900)' : 'var(--line)',
                  borderRadius: 100, cursor: 'pointer',
                  fontFamily: 'var(--font-ui)', fontSize: '0.75rem', fontWeight: 500,
                  color: activeSubcategory === sub ? 'var(--paper)' : 'var(--ink-700)',
                  transition: 'all 150ms',
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}>{sub}</button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section style={{ padding: 'var(--section-gap) 0' }}>
        <div className="container">

          {/* ─── Toolbar above the grid: Filters toggle · chips · sort · count ─
              Sticky on desktop (handled by .shop-toolbar in globals.css) so
              the sort + chips stay reachable as the user scrolls a long grid. */}
          <div className="shop-toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
              <button
                type="button"
                onClick={() => setFiltersOpen(o => !o)}
                aria-expanded={filtersOpen}
                aria-controls="shop-filter-rail"
                className="shop-filter-toggle"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '8px 14px', borderRadius: 100,
                  border: '1px solid ' + (filtersOpen ? 'var(--ink-900)' : 'var(--line)'),
                  background: filtersOpen ? 'var(--ink-900)' : 'var(--paper)',
                  color: filtersOpen ? 'var(--paper)' : 'var(--ink-900)',
                  fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <line x1="4" y1="6" x2="20" y2="6" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="10" y1="18" x2="14" y2="18" />
                </svg>
                Filters{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ''}
              </button>

              {/* Active filter chips — always visible so users know what's applied
                  without opening the rail. */}
              {activeChips.map(c => (
                <button
                  key={c.key}
                  type="button"
                  onClick={c.remove}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '5px 10px', borderRadius: 100,
                    border: '1px solid var(--line)',
                    background: 'var(--paper2)', color: 'var(--ink-900)',
                    fontSize: '0.75rem', cursor: 'pointer',
                    fontFamily: 'var(--font-ui)',
                  }}
                  aria-label={`Remove filter ${c.label}`}
                >
                  {c.label}
                  <span aria-hidden="true" style={{ color: 'var(--ink-500)', fontSize: '0.875rem', lineHeight: 1 }}>×</span>
                </button>
              ))}
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '0.75rem', color: 'var(--brand-pink-text)', fontWeight: 600,
                  fontFamily: 'var(--font-ui)',
                }}>
                  Clear all
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <span className="small-text">{filtered.length} product{filtered.length !== 1 ? 's' : ''}</span>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)}
                aria-label="Sort products"
                style={{
                  padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)',
                  background: 'var(--paper)', fontFamily: 'var(--font-ui)', fontSize: '0.8125rem',
                  color: 'var(--ink-900)', cursor: 'pointer', outline: 'none',
                }}
              >
                {SORT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Backdrop behind the slide-in rail (all viewports). Clicking closes it. */}
          <div
            onClick={() => setFiltersOpen(false)}
            aria-hidden="true"
            className="shop-rail-backdrop"
            style={{
              position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.45)',
              zIndex: 90,
              opacity: filtersOpen ? 1 : 0,
              pointerEvents: filtersOpen ? 'auto' : 'none',
              transition: 'opacity 220ms ease-out',
            }}
          />

          {/* Layout wrapper — at desktop (≥1024px) becomes a 2-col grid with
              a persistent left rail; at mobile/tablet the rail collapses
              back to the slide-in overlay defined inline below. CSS lives
              in .shop-layout / .shop-rail / .shop-filter-toggle. */}
          <div className="shop-layout">

          {/* Filter rail — fixed slide-in panel from the left, on every viewport.
              Always in the DOM so opening / closing animates the transform. */}
          <aside
            id="shop-filter-rail"
            className="shop-rail"
            ref={filterPanelRef}
            // On desktop the rail is a persistent region; on mobile it's a
            // modal dialog the user opens explicitly. The ARIA shape switches
            // to match — otherwise the desktop persistent sidebar would be
            // hidden from AT users.
            role={isDesktopRail ? 'region' : 'dialog'}
            aria-modal={isDesktopRail ? undefined : filtersOpen}
            aria-label="Filter products"
            aria-hidden={isDesktopRail ? undefined : !filtersOpen}
            style={{
              position: 'fixed', top: 0, left: 0, bottom: 0,
              width: 320, maxWidth: '88vw',
              background: 'var(--paper)',
              borderRight: '1px solid var(--line)',
              boxShadow: filtersOpen ? '4px 0 24px rgba(0,0,0,0.12)' : 'none',
              transform: filtersOpen ? 'translateX(0)' : 'translateX(-100%)',
              transition: 'transform 280ms ease-out, box-shadow 280ms ease-out',
              zIndex: 100,
              overflowY: 'auto',
              padding: '20px 24px 32px',
              display: 'flex', flexDirection: 'column',
            }}
          >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <Overline>Filters</Overline>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  aria-label="Close filters"
                  className="shop-rail-close"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: '1.125rem', color: 'var(--ink-500)', padding: 4, lineHeight: 1,
                    display: 'none',
                  }}
                >
                  ×
                </button>
              </div>

              {/* Price */}
              <fieldset style={{ border: 'none', padding: 0, margin: '0 0 20px' }}>
                <legend style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink-900)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  Price (GBP)
                </legend>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    aria-label="Minimum price in GBP"
                    placeholder={String(priceBounds.min)}
                    value={priceMin}
                    onChange={e => setPriceMin(e.target.value === '' ? '' : Number(e.target.value))}
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 6, fontSize: '0.8125rem', outline: 'none' }}
                  />
                  <span aria-hidden="true" style={{ color: 'var(--ink-500)' }}>–</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    aria-label="Maximum price in GBP"
                    placeholder={String(priceBounds.max)}
                    value={priceMax}
                    onChange={e => setPriceMax(e.target.value === '' ? '' : Number(e.target.value))}
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 6, fontSize: '0.8125rem', outline: 'none' }}
                  />
                </div>
              </fieldset>

              {/* Toggles */}
              <fieldset style={{ border: 'none', padding: 0, margin: '0 0 20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', cursor: 'pointer', padding: '4px 0' }}>
                  <input type="checkbox" checked={inStockOnly} onChange={e => setInStockOnly(e.target.checked)} />
                  In stock only
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', cursor: 'pointer', padding: '4px 0' }}>
                  <input type="checkbox" checked={onSaleOnly} onChange={e => setOnSaleOnly(e.target.checked)} />
                  On sale
                </label>
              </fieldset>

              {/* Brand */}
              {allBrands.length > 1 && (() => {
                // Filter brands by the in-rail brand query. We retain any
                // already-selected brands at the top of the list so the user
                // can always uncheck them — otherwise typing a search term
                // could "hide" an active selection from the list view.
                const ql = brandQuery.trim().toLowerCase();
                const matching = ql
                  ? allBrands.filter(b => b.toLowerCase().includes(ql))
                  : allBrands;
                const selectedShown = Array.from(selectedBrands).filter(b => !matching.includes(b));
                const displayBrands = [...selectedShown, ...matching];
                return (
                  <fieldset style={{ border: 'none', padding: 0, margin: '0 0 20px' }}>
                    <legend style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink-900)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                      Brand
                    </legend>
                    {allBrands.length > 8 && (
                      <input
                        type="search"
                        value={brandQuery}
                        onChange={e => setBrandQuery(e.target.value)}
                        placeholder="Search brands"
                        aria-label="Search brand list"
                        style={{
                          width: '100%', padding: '6px 10px', marginBottom: 8,
                          border: '1px solid var(--line)', borderRadius: 6,
                          fontSize: '0.8125rem', outline: 'none',
                          background: 'var(--paper)',
                        }}
                      />
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 280, overflowY: 'auto', paddingRight: 4 }}>
                      {displayBrands.length === 0 ? (
                        <div className="small-text" style={{ padding: '8px 0', color: 'var(--ink-500)' }}>
                          No brands match &ldquo;{brandQuery}&rdquo;
                        </div>
                      ) : displayBrands.map(b => (
                        <label key={b} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', cursor: 'pointer', padding: '3px 0' }}>
                          <input type="checkbox" checked={selectedBrands.has(b)} onChange={() => toggleBrand(b)} />
                          <span style={{ flex: 1 }}>{b}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                );
              })()}

              {/* Free-from claims — small closed vocabulary, rendered as
                  toggle chips because the labels are short and the binary
                  yes/no UX maps better to chips than checkboxes. We always
                  render the fieldset (even when 0 products carry a claim
                  in the current view) so the shopper learns the feature
                  exists — clicking a chip with no matches simply empties
                  the grid + surfaces the empty state. */}
              <fieldset style={{ border: 'none', padding: 0, margin: '0 0 20px' }}>
                <legend style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink-900)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  Free from
                </legend>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {FREE_FROM_TOKENS.map(token => {
                    const active = selectedFreeFrom.has(token);
                    return (
                      <button
                        key={token}
                        type="button"
                        onClick={() => toggleFreeFrom(token)}
                        aria-pressed={active}
                        style={{
                          padding: '4px 10px',
                          border: '1px solid ' + (active ? 'var(--ink-900)' : 'var(--line)'),
                          background: active ? 'var(--ink-900)' : 'var(--paper)',
                          color: active ? 'var(--paper)' : 'var(--ink-900)',
                          borderRadius: 100,
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          fontFamily: 'var(--font-ui)',
                        }}
                      >
                        {FREE_FROM_LABELS[token]}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {/* Variant attribute facets (Shade, Size, etc.) */}
              {attributes.map(attr => {
                const hasColor = attr.values.some(v => v.color_hex);
                return (
                  <fieldset key={attr.id} style={{ border: 'none', padding: 0, margin: '0 0 20px' }}>
                    <legend style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink-900)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                      {attr.name}
                    </legend>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {attr.values.map(v => {
                        const active = selectedValueIds.has(v.id);
                        if (hasColor && v.color_hex) {
                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => toggleValue(v.id)}
                              title={v.value}
                              aria-label={v.value}
                              aria-pressed={active}
                              style={{
                                width: 28, height: 28, borderRadius: '50%',
                                border: active ? '2px solid var(--ink-900)' : '2px solid var(--line)',
                                outline: active ? '2px solid var(--paper)' : 'none', outlineOffset: -3,
                                background: v.color_hex,
                                cursor: 'pointer', padding: 0,
                              }}
                            />
                          );
                        }
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => toggleValue(v.id)}
                            aria-pressed={active}
                            style={{
                              padding: '4px 10px',
                              border: '1px solid ' + (active ? 'var(--ink-900)' : 'var(--line)'),
                              background: active ? 'var(--ink-900)' : 'var(--paper)',
                              color: active ? 'var(--paper)' : 'var(--ink-900)',
                              borderRadius: 100,
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                            }}
                          >
                            {v.value}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                );
              })}
            </aside>

            {/* ─── Product grid (always full-width — rail floats over the top) ─ */}
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gutter)' }} className="product-grid">
            {paginated.map((p) => (
              <ProductTile key={p.id} product={p} />
            ))}
          </div>
          {filtered.length === 0 && (
            <div
              style={{
                textAlign: 'center', padding: '56px 24px',
                background: 'linear-gradient(135deg, var(--paper2) 0%, var(--paper) 100%)',
                border: '1px dashed var(--line)', borderRadius: 'var(--radius-card)',
                marginTop: 24,
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  width: 60, height: 60, margin: '0 auto 18px',
                  borderRadius: '50%',
                  // Pale purple tints — was pink → cream and read as a
                  // YellowPink hangover on the empty-results state.
                  background: 'linear-gradient(135deg, #F5EFF8 0%, #E2D2EB 100%)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.5rem', color: 'var(--brand-pink-text)',
                }}
              >○</div>
              <h2 className="display-l" style={{ fontSize: '1.5rem', margin: '0 0 8px' }}>
                {q.trim()
                  ? <>No results for &ldquo;{q.trim()}&rdquo;</>
                  : activeFilterCount > 0
                  ? 'No products match those filters'
                  : 'No products in this category yet'}
              </h2>
              <p className="body-text" style={{ color: 'var(--ink-700)', maxWidth: 420, margin: '0 auto 20px' }}>
                {q.trim()
                  ? 'Try a different spelling, a shorter term, or browse a category instead.'
                  : activeFilterCount > 0
                  ? "Try clearing a filter or two — we'll show you what's available."
                  : "We're restocking — check back soon or browse another category."}
              </p>
              <div style={{ display: 'inline-flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                {(q.trim() || activeFilterCount > 0) && (
                  <button
                    type="button"
                    onClick={() => { setQ(''); clearFilters(); }}
                    className="btn-primary"
                    style={{ fontSize: '0.75rem' }}
                  >Clear all filters</button>
                )}
                {TOP_CATEGORY_NAMES
                  .filter(c => c !== 'All' && c !== activeCategory)
                  .slice(0, 3)
                  .map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => { setQ(''); setActiveCategory(c); }}
                      style={{
                        padding: '10px 16px',
                        background: 'white', border: '1px solid var(--line)',
                        borderRadius: 'var(--radius-card)',
                        fontFamily: 'var(--font-ui)', fontSize: '0.75rem', fontWeight: 600,
                        letterSpacing: '0.06em', textTransform: 'uppercase',
                        color: 'var(--ink-900)', cursor: 'pointer',
                        minHeight: 36,
                      }}
                    >Try {c}</button>
                  ))
                }
              </div>
            </div>
          )}
          {totalPages > 1 && (
            <nav aria-label="Product pages" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, marginTop: 48 }}>
              <button
                onClick={() => goToPage(Math.max(1, page - 1))}
                disabled={page === 1}
                aria-label="Previous page"
                style={{
                  padding: '8px 14px', background: 'none', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)',
                  fontFamily: 'var(--font-ui)', fontSize: '0.8125rem', cursor: page === 1 ? 'default' : 'pointer',
                  color: page === 1 ? 'var(--ink-400)' : 'var(--ink-900)', transition: 'all 150ms',
                }}
              ><span aria-hidden="true">←</span></button>
              {(() => {
                const pages: (number | '…')[] = [];
                if (totalPages <= 7) {
                  for (let i = 1; i <= totalPages; i++) pages.push(i);
                } else {
                  pages.push(1);
                  if (page > 4) pages.push('…');
                  for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
                  if (page < totalPages - 3) pages.push('…');
                  pages.push(totalPages);
                }
                return pages.map((p, i) =>
                  p === '…' ? (
                    <span key={`ellipsis-${i}`} style={{ padding: '8px 6px', fontFamily: 'var(--font-ui)', fontSize: '0.8125rem', color: 'var(--ink-500)' }}>…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => goToPage(p as number)}
                      aria-label={`Page ${p}`}
                      aria-current={page === p ? 'page' : undefined}
                      style={{
                        padding: '8px 12px', border: '1px solid', borderRadius: 'var(--radius-card)',
                        borderColor: page === p ? 'var(--ink-900)' : 'var(--line)',
                        background: page === p ? 'var(--ink-900)' : 'none',
                        fontFamily: 'var(--font-ui)', fontSize: '0.8125rem', fontWeight: 600,
                        color: page === p ? 'var(--paper)' : 'var(--ink-900)', cursor: 'pointer', transition: 'all 150ms',
                      }}
                    >{p}</button>
                  )
                );
              })()}
              <button
                onClick={() => goToPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                aria-label="Next page"
                style={{
                  padding: '8px 14px', background: 'none', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)',
                  fontFamily: 'var(--font-ui)', fontSize: '0.8125rem', cursor: page === totalPages ? 'default' : 'pointer',
                  color: page === totalPages ? 'var(--ink-400)' : 'var(--ink-900)', transition: 'all 150ms',
                }}
              ><span aria-hidden="true">→</span></button>
            </nav>
          )}
            </div> {/* close product grid column */}
          </div> {/* close .shop-layout */}
        </div>
      </section>
    </div>
  );
}
