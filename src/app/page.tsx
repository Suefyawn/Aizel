// 5-min ISR — featured products / new arrivals / hero copy change at most
// every few hours, and the global cache header in next.config.ts already
// puts a CDN in front. Was `force-dynamic` before the 2026-05-24 audit.
export const revalidate = 300;

import {
  getBestsellers,
  getFeatured,
  getOnSale,
  getSiteSettings,
  getBlogPosts,
  getAllBrands,
  getCategoryHeroImages,
  getCategoryProductCounts,
} from '@/lib/supabase';
import { loadTaxonomy } from '@/lib/category-taxonomy';
import { loadHomepageContent } from '@/lib/homepage-content';

// The "Shop by category" tile groups and the EditorialDuo banner cards
// are operator-managed via the admin Homepage page — they live as rows
// in `homepage_content` (migration 144) and are loaded here via
// `loadHomepageContent()`. The taxonomy is also DB-backed (migration
// 143, see `loadTaxonomy()`); the homepage uses it to resolve category
// slugs → display labels + landing-page descriptions.
import { HeroSection } from '@/sections/home/HeroSection';
import { TrustBar } from '@/sections/home/TrustBar';
import { QuizBanner } from '@/sections/home/QuizBanner';
import { HairTypeStrip } from '@/sections/home/HairTypeStrip';
import { FeaturedProducts } from '@/sections/home/FeaturedProducts';
import { EditorialDuo } from '@/sections/home/EditorialDuo';
import { SaleCollection } from '@/sections/home/SaleCollection';
import { BestsellersBand } from '@/sections/home/BestsellersBand';
import { BrandStrip } from '@/sections/home/BrandStrip';
import { CategoryTiles } from '@/sections/home/CategoryTiles';
import { RealResults } from '@/sections/home/RealResults';
import { JournalSection } from '@/sections/home/JournalSection';
// PressStrip removed: it implied "Featured in ELLE / VOGUE / STYLIST /
// etc." but Aizel has no live coverage from any of those mastheads. Under
// CMA / ASA guidance that's misleading by implication. Restore when there's
// real press to link.

export default async function HomePage() {
  // Pull the static rails + the dynamic homepage-content rows in parallel.
  const [featured, bestsellers, saleProducts, settings, blogPosts, brands, homepage, taxonomy] = await Promise.all([
    getFeatured(6),
    getBestsellers(8),
    getOnSale(8),
    getSiteSettings(),
    getBlogPosts(),
    getAllBrands(),
    loadHomepageContent(),
    loadTaxonomy(),
  ]);

  // The featured sale collection is shown only while a sale is switched on
  // in Admin → Settings → Sale (the central on/off switch).
  const saleActive = settings.sale_active === 'true';

  // Resolve every slug referenced by a homepage block (banner or tile) into
  // its canonical label, then fetch the per-label hero-image + product
  // count in one round-trip each. Lets us pass real category imagery into
  // the tile cards even when the operator hasn't uploaded a curated photo.
  const slugToLabel: Record<string, string> = {};
  for (const t of taxonomy.taxons) {
    for (const cat of t.categories) {
      const slug = cat.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      slugToLabel[slug] = cat;
    }
  }
  const allReferencedLabels = Array.from(new Set(
    homepage.raw.flatMap(b => b.category_slugs.map(s => slugToLabel[s]).filter((l): l is string => Boolean(l))),
  ));
  const [categoryImages, categoryCounts] = await Promise.all([
    getCategoryHeroImages(allReferencedLabels),
    getCategoryProductCounts(allReferencedLabels),
  ]);

  // Tile rows: build each row from the homepage_content `category_row`
  // blocks. Image: operator's image_url override > settings cat_tile_<slug> > auto-picked product photo > gradient.
  const categoryGroups = homepage.tileGroups.map(group => ({
    title: group.title,
    tiles: group.category_slugs.map(slug => {
      const label = slugToLabel[slug] ?? slug;
      const settingsKey = 'cat_tile_' + slug.replace(/-/g, '_');
      return {
        label,
        href: `/shop?category=${encodeURIComponent(label)}`,
        image: settings[settingsKey] || categoryImages[label] || undefined,
        tagline: taxonomy.categoryDescriptions[label],
        productCount: categoryCounts[label],
      };
    }),
  }));

  // Editorial banner cards: first two `banner_card` blocks. Image
  // resolution: operator's image_url > auto-picked from category_slug[0]
  // > empty (EditorialDuo renders gradient). The component still expects
  // a (hairImage, bodyImage) tuple for backward compat, so we feed it
  // the first two banners in order.
  const bannerImageFor = (block: typeof homepage.banners[number]): string => {
    if (block.image_url) return block.image_url;
    const slug = block.category_slugs[0];
    if (!slug) return '';
    const label = slugToLabel[slug];
    return label ? (categoryImages[label] ?? '') : '';
  };
  const [banner1, banner2] = homepage.banners;

  // Seasonal hero override — while the seasonal makeover is on, the homepage
  // hero uses the season_hero_* settings; any field left blank falls back to
  // the normal hero value. The secondary CTA + brand-logo row aren't seasonal.
  const seasonOn = settings.season_active === 'true';
  const heroField = (seasonKey: string, normalKey: string): string =>
    (seasonOn && settings[seasonKey]) || settings[normalKey] || '';
  // Hero image: settings override → first featured/bestseller image → empty
  // (HeroSection then renders the gradient fallback). This is the third
  // layer in the "use real catalogue imagery instead of an empty hero"
  // chain — settings is the manual override, the auto-pick is the
  // sensible default for a populated store.
  const autoHeroImage = featured[0]?.image_url ?? bestsellers[0]?.image_url ?? '';
  const heroSettings = {
    overline: heroField('season_hero_overline', 'hero_overline'),
    headline: heroField('season_hero_headline', 'hero_headline'),
    subline: heroField('season_hero_subline', 'hero_subline'),
    cta1Text: heroField('season_hero_cta1_text', 'hero_cta1_text'),
    cta1Url: heroField('season_hero_cta1_url', 'hero_cta1_url'),
    cta2Text: settings.hero_cta2_text,
    cta2Url: settings.hero_cta2_url,
    imageUrl: heroField('season_hero_image_url', 'hero_image_url') || autoHeroImage,
    brands: settings.hero_brands ? settings.hero_brands.split(',').map(b => b.trim()) : [],
  };

  return (
    <main className="fade-in">
      <HeroSection settings={heroSettings} />
      <TrustBar />
      <QuizBanner />
      <HairTypeStrip />
      <FeaturedProducts products={featured.length ? featured.slice(0, 4) : bestsellers.slice(0, 4)} />
      <EditorialDuo
        banners={[banner1, banner2].filter((b): b is typeof banner1 => Boolean(b)).map(b => ({
          title:    b.title,
          subtitle: b.subtitle ?? '',
          cta:      b.cta_text ?? 'Shop now',
          href:     b.cta_href ?? '/shop',
          img:      bannerImageFor(b),
        }))}
      />
      {saleActive && (
        <SaleCollection
          products={saleProducts}
          title={settings.sale_title || 'On Sale Now'}
          subtitle={settings.sale_subtitle}
          ctaText={settings.sale_cta_text || 'Shop the Sale'}
          ctaUrl={settings.sale_cta_url || '/shop?sale=1'}
        />
      )}
      <BestsellersBand products={bestsellers.slice(0, 4)} />
      <BrandStrip brands={brands} />
      <CategoryTiles groups={categoryGroups} />
      <RealResults />
      <JournalSection posts={blogPosts} />
      {/* PressStrip removed — see import comment above. */}
    </main>
  );
}
