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
} from '@/lib/supabase';

// Homepage "Shop by category" tiles — eight category landings split
// across two named groups so the section reads as curated rails rather
// than a flat grid.
const HAIR_TILE_CATS = ['Shampoo & Conditioner', 'Hair Oils & Serums', 'Curl & Styling Creams', 'Edge Control & Gels'];
const BODY_TILE_CATS = ['Cocoa & Shea Butter', 'Body Oils', 'Petroleum Jelly', 'Wig & Lace Adhesives'];

// Editorial banner taxons → category to pull a hero product image from.
// Used for the two-up "EditorialDuo" section below the hero.
const EDITORIAL_HAIR_CAT = 'Shampoo & Conditioner';
const EDITORIAL_BODY_CAT = 'Cocoa & Shea Butter';

// Until brand-curated category photography exists in the `images` Storage
// bucket, the homepage uses a real product photo per category — pulled at
// render time via getCategoryHeroImages() — so the tiles look populated
// instead of the gradient-placeholder shipping state. An operator can
// upload a curated tile photo later and override per-category via
// site_settings.cat_tile_<slug> (read below) to take over from the
// auto-picked product image.
import { HeroSection } from '@/sections/home/HeroSection';
import { TrustBar } from '@/sections/home/TrustBar';
import { FeaturedProducts } from '@/sections/home/FeaturedProducts';
import { EditorialDuo } from '@/sections/home/EditorialDuo';
import { SaleCollection } from '@/sections/home/SaleCollection';
import { BestsellersBand } from '@/sections/home/BestsellersBand';
import { BrandStrip } from '@/sections/home/BrandStrip';
import { CategoryTiles } from '@/sections/home/CategoryTiles';
import { RealResults } from '@/sections/home/RealResults';
import { JournalSection } from '@/sections/home/JournalSection';
import { PressStrip } from '@/sections/home/PressStrip';

export default async function HomePage() {
  // Pull each rail in parallel. The new helpers all fall back to a stock-
  // /recency-ordered slice of the live catalog if their flag-based query
  // returns fewer rows than requested, so empty sections shouldn't happen
  // once the catalog has any products. Migration 076 backfilled
  // is_featured + is_bestseller; the queries respect those first.
  const allTileCats = [...HAIR_TILE_CATS, ...BODY_TILE_CATS, EDITORIAL_HAIR_CAT, EDITORIAL_BODY_CAT];
  const [featured, bestsellers, saleProducts, settings, blogPosts, brands, categoryImages] = await Promise.all([
    getFeatured(6),
    getBestsellers(8),
    getOnSale(8),
    getSiteSettings(),
    getBlogPosts(),
    getAllBrands(),
    getCategoryHeroImages(allTileCats),
  ]);

  // The featured sale collection is shown only while a sale is switched on
  // in Admin → Settings → Sale (the central on/off switch).
  const saleActive = settings.sale_active === 'true';

  // Per-category tile image: site_settings override wins (operator uploads a
  // curated tile via /admin/settings/homepage), then the auto-picked product
  // image, then undefined (lets CategoryTiles fall back to its gradient).
  const tile = (label: string) => {
    const settingsKey = 'cat_tile_' + label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return {
      label,
      href: `/shop?category=${encodeURIComponent(label)}`,
      image: settings[settingsKey] || categoryImages[label] || undefined,
    };
  };
  const categoryGroups = [
    { title: 'Hair Care',     tiles: HAIR_TILE_CATS.map(tile) },
    { title: 'Body & More',   tiles: BODY_TILE_CATS.map(tile) },
  ];

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

  // Editorial banner imagery — one Hair Care and one Body Care lead product.
  const editorialImages = {
    hair: categoryImages[EDITORIAL_HAIR_CAT] ?? '',
    body: categoryImages[EDITORIAL_BODY_CAT] ?? '',
  };

  return (
    <main className="fade-in">
      <HeroSection settings={heroSettings} />
      <TrustBar />
      <FeaturedProducts products={featured.length ? featured.slice(0, 4) : bestsellers.slice(0, 4)} />
      <EditorialDuo hairImage={editorialImages.hair} bodyImage={editorialImages.body} />
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
      <PressStrip />
    </main>
  );
}
