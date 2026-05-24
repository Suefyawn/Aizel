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
} from '@/lib/supabase';

// Homepage "Shop by category" tiles — eight category landings split
// across two named groups so the section reads as curated rails rather
// than a flat grid.
const HAIR_TILE_CATS = ['Shampoo & Conditioner', 'Hair Oils & Serums', 'Curl & Styling Creams', 'Edge Control & Gels'];
const BODY_TILE_CATS = ['Cocoa & Shea Butter', 'Body Oils', 'Petroleum Jelly', 'Wig & Lace Adhesives'];

// Curated editorial image per tile category, hosted in this project's
// Supabase Storage `images` bucket. The base URL is derived from the
// configured project so a no-Supabase demo build resolves to `undefined` and
// the tile falls back to its gradient placeholder instead of 404-ing.
const CATEGORY_IMAGE_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/images/categories`
  : null;
const CATEGORY_TILE_FILES: Record<string, string> = {
  'Shampoo & Conditioner':   'shampoo-conditioner.webp',
  'Hair Oils & Serums':      'hair-oils.webp',
  'Curl & Styling Creams':   'curl-creams.webp',
  'Edge Control & Gels':     'edge-control.webp',
  'Cocoa & Shea Butter':     'cocoa-shea.webp',
  'Body Oils':               'body-oils.webp',
  'Petroleum Jelly':         'petroleum-jelly.webp',
  'Wig & Lace Adhesives':    'wig-adhesives.webp',
};
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
import Link from 'next/link';

export default async function HomePage() {
  // Pull each rail in parallel. The new helpers all fall back to a stock-
  // /recency-ordered slice of the live catalog if their flag-based query
  // returns fewer rows than requested, so empty sections shouldn't happen
  // once the catalog has any products. Migration 076 backfilled
  // is_featured + is_bestseller; the queries respect those first.
  const [featured, bestsellers, saleProducts, settings, blogPosts, brands] = await Promise.all([
    getFeatured(6),
    getBestsellers(8),
    getOnSale(8),
    getSiteSettings(),
    getBlogPosts(),
    getAllBrands(),
  ]);

  // The featured sale collection is shown only while a sale is switched on
  // in Admin → Settings → Sale (the central on/off switch).
  const saleActive = settings.sale_active === 'true';

  const tile = (label: string) => ({
    label,
    href: `/shop?category=${encodeURIComponent(label)}`,
    image: CATEGORY_IMAGE_BASE ? `${CATEGORY_IMAGE_BASE}/${CATEGORY_TILE_FILES[label]}` : undefined,
  });
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
  const heroSettings = {
    overline: heroField('season_hero_overline', 'hero_overline'),
    headline: heroField('season_hero_headline', 'hero_headline'),
    subline: heroField('season_hero_subline', 'hero_subline'),
    cta1Text: heroField('season_hero_cta1_text', 'hero_cta1_text'),
    cta1Url: heroField('season_hero_cta1_url', 'hero_cta1_url'),
    cta2Text: settings.hero_cta2_text,
    cta2Url: settings.hero_cta2_url,
    imageUrl: heroField('season_hero_image_url', 'hero_image_url'),
    brands: settings.hero_brands ? settings.hero_brands.split(',').map(b => b.trim()) : [],
  };

  return (
    <main className="fade-in">
      <HeroSection settings={heroSettings} />
      <TrustBar />
      <FeaturedProducts products={featured.length ? featured.slice(0, 4) : bestsellers.slice(0, 4)} />
      <EditorialDuo />
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
      {/* All-products CTA — closes the discoverability gap between curated
          homepage rails and the full catalogue. Placed after the category
          tiles so it reads as "still haven't found it? browse the lot". */}
      <section style={{ padding: '0 0 var(--section-gap)' }}>
        <div className="container" style={{
          padding: '40px var(--side)',
          background: 'var(--ink-900)',
          color: 'var(--paper)',
          borderRadius: 'var(--radius-card)',
          textAlign: 'center',
        }}>
          <h2 className="display-l" style={{
            fontSize: '1.875rem', margin: '0 0 10px',
            letterSpacing: '-0.02em',
            color: 'var(--paper)',
          }}>
            Browse every product
          </h2>
          <p style={{
            color: 'rgba(255, 255, 255, 0.7)', maxWidth: 520,
            margin: '0 auto 22px', fontSize: '0.9375rem',
          }}>
            The full catalogue — every brand and every line we stock,
            sortable by price, brand and category.
          </p>
          <Link
            href="/shop"
            style={{
              display: 'inline-block',
              padding: '12px 28px',
              background: 'var(--brand-yellow)',
              color: 'var(--ink-900)',
              textDecoration: 'none',
              borderRadius: 'var(--radius-pill)',
              fontWeight: 700, fontSize: '0.875rem',
              letterSpacing: '0.04em',
            }}
          >
            Shop all {brands.reduce((s, b) => s + b.productCount, 0)}+ products →
          </Link>
        </div>
      </section>
      <RealResults />
      <JournalSection posts={blogPosts} />
      <PressStrip />
    </main>
  );
}
