// `dynamic = 'force-dynamic'` was previously set here to dodge the
// useSearchParams() inside PageViewTracker prerendering on user-scoped
// pages. That tracker is now wrapped in <Suspense> inside
// `src/components/analytics/PostHogProvider.tsx`, so the layout can
// stay edge-cacheable and per-page `revalidate = N` rules in
// `next.config.ts` actually take effect. Removing the override was the
// P0-1 finding in the 2026-05-19 launch-readiness audit.

import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import '@/styles/globals.css';
import { Providers } from '@/context/Providers';

// next/font/google self-hosts the woff2 + emits preload links automatically.
// CSS bridges via the `variable` option — globals.css reads
// --font-display / --font-ui and applies them to .display-*, .h*, body.
const fontDisplay = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});
const fontUI = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ui',
  display: 'swap',
});
import { SiteChrome } from '@/components/layout/SiteChrome';
import { GoogleAnalytics } from '@/components/analytics/GoogleAnalytics';
import { WebVitalsReporter } from '@/components/layout/WebVitalsReporter';
import { ServiceWorkerRegister } from '@/components/layout/ServiceWorkerRegister';
import { PWAInstallPrompt } from '@/components/layout/PWAInstallPrompt';
import { DemoBanner } from '@/components/layout/DemoBanner';
import { ConsentBanner } from '@/components/legal/ConsentBanner';
import { NewsletterModal } from '@/components/marketing/NewsletterModal';
import { CartAnnouncer } from '@/components/cart/CartAnnouncer';
import { AddToCartToast } from '@/components/cart/AddToCartToast';
import { getSiteSettings } from '@/lib/supabase';
import { normalizeTheme } from '@/lib/themes';
import { getActivePromos, audienceFor } from '@/lib/promos';
import { loadTrendingBrands, loadPopularCategories } from '@/lib/search-data';
import { SITE_URL, SITE_NAME, jsonLd, organizationLd, websiteLd } from '@/lib/seo';
import { socialSameAs } from '@/lib/socials';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Authentic Hair & Body Care`,
    template: `%s | ${SITE_NAME}`,
  },
  description: 'Authentic Afro/Black hair and body care brands — Cantu, ORS, Palmer\'s, Kuza and more. Free UK delivery over £15.',
  applicationName: SITE_NAME,
  // We deleted /icon.svg when installing the flower favicon. Next.js
  // auto-generates /icon and /apple-icon link tags from
  // src/app/icon.png + apple-icon.png, so we don't list them here — listing
  // /icon.svg explicitly was causing a 404'd <link rel="apple-touch-icon">.
  // The .ico is picked up automatically from src/app/favicon.ico too.
  openGraph: {
    siteName: SITE_NAME,
    locale: 'en_GB',
    type: 'website',
    url: SITE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    // Site handle for the brand attribution on shared cards. If the
    // merchant takes a different @, override TWITTER_HANDLE in Vercel env.
    site: process.env.TWITTER_HANDLE || '@aizeluk',
  },
  alternates: {
    canonical: SITE_URL,
  },
  // Backup verification meta tag. The DNS TXT (domain property) is the primary
  // verification — this is harmless redundancy that also covers URL-prefix
  // properties (e.g. www-subdomain) without a second DNS round-trip. Set
  // GOOGLE_SITE_VERIFICATION in Vercel env to the content="" value Google
  // gives you; leave blank to skip.
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
  },
};

export const viewport: Viewport = {
  themeColor: '#6B2C91',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [settings, promos, searchTrending, searchCategories] = await Promise.all([
    getSiteSettings(),
    // TODO: read auth session + lifetime-order count to refine the audience.
    // For now everyone is treated as 'guest' so any null-audience or
    // guest-audience promo will match; logged_in / first_time / returning
    // rows will simply not show until the audience resolver is wired to
    // session data.
    getActivePromos(audienceFor(false, false)),
    loadTrendingBrands(),
    loadPopularCategories(),
  ]);
  // Social profiles + store contact are owner-managed (admin Settings); the
  // JSON-LD reads from the same source as the footer.
  const sameAs = socialSameAs(settings);
  const orgContact = { phone: settings.store_phone, email: settings.store_email };
  return (
    <html
      lang="en-GB"
      // The seasonal makeover (palette + background motif) is gated by the
      // season_active toggle in admin Settings — a pre-selected season stays
      // dormant until the owner switches it on.
      data-theme={settings.season_active === 'true' ? normalizeTheme(settings.active_theme) : 'default'}
      className={`${fontDisplay.variable} ${fontUI.variable}`}
    >
      <head>
        {/* Site-wide JSON-LD: a single Organization node (@id-referenced by
            WebSite.publisher) plus WebSite for the sitelinks search box.
            Both render on every page — the duplication-across-pages pattern
            is what Google expects for this class of markup. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(organizationLd(sameAs, orgContact)) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(websiteLd()) }}
        />
      </head>
      <body>
        <a href="#main" className="skip-link">Skip to main content</a>
        <DemoBanner />
        <ConsentBanner />
        <NewsletterModal />
        <GoogleAnalytics />
        <WebVitalsReporter />
        <ServiceWorkerRegister />
        <PWAInstallPrompt />
        <Providers>
          <CartAnnouncer />
          <AddToCartToast />
          <SiteChrome
            settings={settings}
            promos={promos}
            searchTrending={searchTrending}
            searchCategories={searchCategories}
          >
            {/* tabindex=-1 so the skip-link can focus #main programmatically
                without making it a sequential Tab stop. */}
            <div id="main" tabIndex={-1} style={{ outline: 'none' }}>{children}</div>
          </SiteChrome>
        </Providers>
      </body>
    </html>
  );
}
