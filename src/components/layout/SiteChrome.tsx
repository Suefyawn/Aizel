'use client';
import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { AnnouncementBar } from './AnnouncementBar';
import { PromoBanner } from './PromoBanner';
import { Header } from './Header';
import { Footer } from './Footer';
import { MiniCart } from '@/components/cart/MiniCart';
import { SearchOverlay } from '@/components/search/SearchOverlay';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { ScrollToTop } from './ScrollToTop';
import type { Promo } from '@/lib/promos';
import { socialLinks } from '@/lib/socials';

interface SiteChromeProps {
  children: React.ReactNode;
  settings: Record<string, string>;
  /** Resolved by the server layout for the current visitor's audience.
   *  If null, we fall back to the legacy site_settings-based config so the
   *  bars still render before the merchant has authored any rows. */
  promos?: { top_bar: Promo | null; hero_strip: Promo | null } | null;
  /** Server-resolved data for the search overlay. Passed through here
   *  (rather than rendered as its own server-component wrapper) because
   *  SiteChrome is `'use client'` — an async server component cannot live
   *  inside a client tree without a Suspense boundary. */
  searchTrending: string[];
  searchCategories: string[];
}

export function SiteChrome({ children, settings, promos, searchTrending, searchCategories }: SiteChromeProps) {
  const pathname = usePathname();
  if (pathname.startsWith('/admin')) return <>{children}</>;

  // ── Top bar (thin announcement) ──
  // Prefer a live `promos` row for the slot; otherwise fall back to the
  // settings-driven AnnouncementBar.
  const topBar = promos?.top_bar;
  const topBarSettingsActive = settings.announcement_active === 'true';

  // ── Hero strip (richer promo card) ──
  const heroStrip = promos?.hero_strip;
  const heroStripSettingsActive = settings.promo_active === 'true';

  return (
    <>
      <ScrollToTop />
      {topBar ? (
        <AnnouncementBar
          text={topBar.headline}
          bgColor={topBar.bg_color ?? '#111827'}
        />
      ) : topBarSettingsActive && (
        <AnnouncementBar
          text={settings.announcement_text ?? 'Free UK delivery on orders over £15 · Authentic brands · Fast tracked shipping'}
          bgColor={settings.announcement_color ?? '#111827'}
        />
      )}

      {heroStrip ? (
        <PromoBanner
          label={heroStrip.label ?? 'New'}
          headline={heroStrip.headline}
          subline={heroStrip.subline ?? ''}
          ctaText={heroStrip.cta_text ?? ''}
          ctaUrl={heroStrip.cta_url ?? '/shop'}
          bgColor={heroStrip.bg_color ?? '#6B2C91'}
          textColor={heroStrip.text_color ?? '#ffffff'}
          endDate={heroStrip.show_countdown ? (heroStrip.end_at ?? '') : ''}
        />
      ) : heroStripSettingsActive && (
        <PromoBanner
          label={settings.promo_label ?? 'Sale'}
          headline={settings.promo_headline ?? ''}
          subline={settings.promo_subline ?? ''}
          ctaText={settings.promo_cta_text ?? 'Shop Sale'}
          ctaUrl={settings.promo_cta_url ?? '/shop'}
          bgColor={settings.promo_bg_color ?? '#6B2C91'}
          textColor={settings.promo_text_color ?? '#ffffff'}
          endDate={settings.promo_end_date ?? ''}
        />
      )}

      {/* Header reads useSearchParams() to highlight the active nav item;
          without a Suspense boundary, static prerender bails on every
          route that doesn't itself opt out. Wrapping here lets routes
          like /forgot-password / /reset-password / /track / /login
          prerender cleanly while Header still hydrates on the client. */}
      <Suspense fallback={null}>
        <Header />
      </Suspense>
      {children}
      <Footer socials={socialLinks(settings)} />
      <MiniCart />
      <SearchOverlay trending={searchTrending} categories={searchCategories} />
      <KeyboardShortcuts />
    </>
  );
}
