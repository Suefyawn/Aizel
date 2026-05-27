import { test, expect } from '@playwright/test';

// Golden-path smoke tests for the Aizel storefront. These run against a
// live dev server (started automatically per playwright.config.ts) or
// against $PLAYWRIGHT_BASE_URL when set (e.g. a Vercel preview deploy).
//
// Coverage rationale: each test catches a specific rebrand-critical
// regression. If any of these go red after a change, the storefront isn't
// shippable until the assertion is restored.

test.describe('Storefront — golden path', () => {
  test('homepage renders Aizel hair-care branding', async ({ page }) => {
    await page.goto('/');
    // The HTML <title> uses the SITE_NAME template — proves the rebrand is
    // wired through the metadata helpers and not just in the JSX.
    await expect(page).toHaveTitle(/Aizel/);
    // Hero headline copy — guards against the demo settings + HeroSection
    // defaults drifting.
    await expect(page.getByRole('heading', { name: /Hair you love/i })).toBeVisible();
    // £15 free-shipping threshold is the single biggest pricing change from
    // the YellowPink era. If it ever reverts, the customer-facing copy
    // would tell the wrong story.
    await expect(page.locator('body')).toContainText(/Free UK delivery/i);
    await expect(page.locator('body')).toContainText(/£15/);
  });

  test('header nav uses the new hair-and-body taxonomy', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('nav[aria-label="Primary"]');
    // Four curated mega-menus: Hair Care, Skincare, Body Care, Styling.
    // Styling consolidates the "Styling & Tools" + "Grooming" taxons into
    // one mega-menu with two columns so the top bar stays uncluttered —
    // those taxon labels move down a level into the mega's sub-headings.
    await expect(nav.getByRole('link', { name: /^Hair Care$/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /^Skincare$/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /^Body Care$/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /^Styling$/i })).toBeVisible();
    // Grooming should NOT be a primary nav item — it lives inside the
    // Styling mega as a second column heading.
    await expect(nav.getByRole('link', { name: /^Grooming$/i })).toHaveCount(0);
    // Belt-and-braces against a Wellness / Makeup regression.
    await expect(nav.getByText(/Wellness/i)).toHaveCount(0);
    await expect(nav.getByText(/Makeup/i)).toHaveCount(0);
  });

  test('header nav surfaces All + Brands + Quiz directly', async ({ page }) => {
    // Regression guard: from the top of every page a shopper should be one
    // click from the full catalogue, the brand index, AND the hair quiz.
    // Hiding any of those inside a mega-menu (or, in the quiz's case, in
    // the footer only) kills discoverability — the previous footer-only
    // placement made the quiz functionally invisible.
    await page.goto('/');
    const nav = page.locator('nav[aria-label="Primary"]');
    const all = nav.getByRole('link', { name: /^All$/ });
    const brands = nav.getByRole('link', { name: /^Brands$/ });
    const quiz = nav.getByRole('link', { name: /^Quiz$/i });
    await expect(all).toBeVisible();
    await expect(brands).toBeVisible();
    await expect(quiz).toBeVisible();
    await expect(all).toHaveAttribute('href', '/shop');
    await expect(brands).toHaveAttribute('href', '/brand');
    await expect(quiz).toHaveAttribute('href', '/quiz');
  });

  test('homepage features a hair-quiz CTA banner', async ({ page }) => {
    // Regression guard: the hair quiz is the primary first-time-shopper
    // funnel; it must surface above-the-fold (or close to it) on the
    // homepage, not just in the footer.
    await page.goto('/');
    const banner = page.getByRole('heading', { name: /Build your routine/i });
    await expect(banner).toBeVisible();
    const cta = page.getByRole('link', { name: /Take the hair quiz/i });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', '/quiz');
  });

  test('homepage features a Shop by Brand section', async ({ page }) => {
    await page.goto('/');
    // Brand strip section header.
    await expect(page.getByRole('heading', { name: /Shop by brand/i })).toBeVisible();
    // At least 4 brand tiles rendered, each linking to /brand/<slug>.
    const tiles = page.locator('a[href^="/brand/"]');
    expect(await tiles.count()).toBeGreaterThanOrEqual(4);
  });

  test('shop page lists products with GBP prices', async ({ page }) => {
    await page.goto('/shop');
    await expect(page).toHaveTitle(/Aizel/);
    // At least one product card rendered (in demo mode this comes from
    // DEMO_PRODUCTS; in live mode from Supabase).
    const prices = page.locator('text=/£\\d/');
    await expect(prices.first()).toBeVisible();
    // PKR should never appear anywhere on the storefront.
    await expect(page.locator('body')).not.toContainText('PKR');
  });

  test('shop?taxon=hair filters to hair products', async ({ page }) => {
    await page.goto('/shop?taxon=hair');
    await expect(page).toHaveTitle(/Aizel/);
    // The collection page should render at least one product tile. Under
    // parallel-worker load the dev server's first response on this route
    // can win the race against the initial paint, so wait for the first
    // tile to materialise before counting (auto-retrying assertion) — a
    // bare .count() would race the empty initial DOM.
    const tiles = page.locator('a[href^="/product/"]');
    await expect(tiles.first()).toBeVisible();
    expect(await tiles.count()).toBeGreaterThan(0);
  });

  test('shop page exposes the industry-standard sort menu', async ({ page }) => {
    // Regression: the sort dropdown must expose Featured + recency +
    // popularity + price + alpha — matches the merchandising menus on
    // every major UK beauty retailer. A flat 4-option list (the previous
    // shape) is a discoverability regression.
    await page.goto('/shop');
    const sort = page.getByLabel('Sort products');
    await expect(sort).toBeVisible();
    const optionTexts = await sort.locator('option').allTextContents();
    const text = optionTexts.join('|');
    expect(text).toContain('Featured');
    expect(text).toContain('Newest first');
    expect(text).toContain('Bestsellers first');
    expect(text).toContain('Price: Low');
    expect(text).toContain('Price: High');
    expect(text).toContain('Name A');
  });

  test('shop page renders the persistent filter rail on desktop', async ({ page }) => {
    // At ≥1024px the filter rail should be in-flow (no longer a slide-in
    // modal), matching Cult Beauty / LookFantastic. We assert it via the
    // ARIA shape: at desktop the rail switches to role=region (not dialog),
    // which is what AT users hear when filters are persistently available.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/shop');
    const rail = page.locator('#shop-filter-rail');
    await expect(rail).toBeVisible();
    await expect(rail).toHaveAttribute('role', 'region');
  });

  test('checkout page shows card option and £15 threshold messaging', async ({ page }) => {
    await page.goto('/checkout');
    await expect(page).toHaveTitle(/Checkout/i);
    // We don't try to actually transact — just verify the rebrand-critical
    // surface is intact: card is the primary method, JazzCash/Easypaisa
    // are gone.
    await expect(page.locator('body')).toContainText(/Credit \/ Debit Card/i);
    await expect(page.locator('body')).not.toContainText(/JazzCash/i);
    await expect(page.locator('body')).not.toContainText(/Easypaisa/i);
  });

  test('track page renders the lookup form', async ({ page }) => {
    await page.goto('/track');
    await expect(page.getByRole('heading', { name: /track/i }).first()).toBeVisible();
  });

  test('hair quiz renders the first question', async ({ page }) => {
    // Marketing-relevant route: drives high-intent traffic into a curated
    // PLP. If the question renderer breaks, the entire acquisition funnel
    // we point the /quiz footer link at is dead.
    await page.goto('/quiz');
    await expect(page.getByRole('heading', { name: /Build your routine/i })).toBeVisible();
    await expect(page.getByText(/Question 1 of/i)).toBeVisible();
    // First question should expose its radio answers.
    await expect(page.getByRole('radio').first()).toBeVisible();
  });

  test('homepage Shop-by-hair-type strip routes into the quiz', async ({ page }) => {
    // The HairTypeStrip lets a shopper who already knows their hair type
    // skip the first quiz question. Each card seeds /quiz?seed=<answer-id>
    // and QuizClient pre-selects the curl answer + advances to question 2.
    // Pre-set consent so the cookie banner doesn't render. Storage key
    // matches src/lib/consent.ts STORAGE_KEY ('yp_consent_v1' — leftover
    // name from the rebrand, never renamed) and shape matches the Consent
    // interface (essential:true + ts/v).
    await page.addInitScript(() => {
      localStorage.setItem(
        'yp_consent_v1',
        JSON.stringify({
          essential: true,
          analytics: false,
          marketing: false,
          ts: Date.now(),
          v: 1,
        }),
      );
    });
    await page.goto('/');
    const strip = page.getByRole('heading', { name: /Know your hair\? Jump straight in\./i });
    await expect(strip).toBeVisible();
    // Three primary type cards + one "Not sure" → full quiz.
    for (const badge of ['Type 2', 'Type 3', 'Type 4', 'Not sure']) {
      await expect(page.locator(`a[data-hair-type] >> text=${badge}`)).toBeVisible();
    }
    // Click the Type 4 card; we should land on question 2 (curl already
    // answered by the seed), not question 1.
    await page.locator('a[data-hair-type="type-4"]').click();
    await page.waitForURL(/\/quiz\?seed=type-4/);
    await expect(page.getByText(/Question 2 of/i)).toBeVisible();
  });

  test('blog index renders the Aizel journal', async ({ page }) => {
    await page.goto('/blog');
    await expect(page).toHaveTitle(/Aizel/);
    // Default-mode posts are seeded by demo-data.ts — at least one card.
    const hasPost = await page.locator('a[href^="/blog/"]').count();
    expect(hasPost).toBeGreaterThan(0);
  });

  test('brand index lists every demo brand', async ({ page }) => {
    await page.goto('/brand');
    await expect(page).toHaveTitle(/brand/i);
    // Demo data covers Cantu, ApHogee, Kuza, Dabur, KeraCare, Eco Style,
    // got2b, Palmer's, Ghana's Best, Vaseline, Ebin, ORS. Spot-check three.
    await expect(page.locator('a[href="/brand/cantu"]')).toBeVisible();
    await expect(page.locator('a[href="/brand/aphogee"]')).toBeVisible();
    await expect(page.locator('a[href="/brand/palmers"]')).toBeVisible();
  });

  test('brand landing page renders for a known brand', async ({ page }) => {
    await page.goto('/brand/cantu');
    await expect(page.getByRole('heading', { name: /^Cantu$/ })).toBeVisible();
    // At least one product tile linking to /product/...
    const tiles = await page.locator('a[href^="/product/"]').count();
    expect(tiles).toBeGreaterThan(0);
  });

  test('unknown brand 404s rather than redirecting away', async ({ page }) => {
    // Regression: a pre-existing legacy proxy rule used to rewrite
    // /brand/<anything> → /shop?category=<anything>, breaking the new
    // brand landing routes. This test guards against re-introducing it.
    const res = await page.goto('/brand/this-brand-does-not-exist');
    expect(res?.status()).toBe(404);
  });
});

test.describe('Storefront — infrastructure', () => {
  test('robots.txt is served', async ({ page }) => {
    const res = await page.goto('/robots.txt');
    expect(res?.ok()).toBe(true);
    const body = await page.content();
    // robots.txt minimum: a User-Agent declaration. We don't assert the
    // domain because robots.txt is served from the origin and doesn't need
    // to mention it; SITE_URL coverage lives on the sitemap/manifest tests.
    expect(body).toMatch(/User-Agent:/i);
  });

  test('sitemap.xml is served', async ({ page }) => {
    const res = await page.goto('/sitemap.xml');
    expect(res?.ok()).toBe(true);
  });

  test('llms.txt mentions the hair-and-body positioning', async ({ page }) => {
    const res = await page.goto('/llms.txt');
    expect(res?.ok()).toBe(true);
    const body = await page.content();
    expect(body).toMatch(/Hair Care/i);
    expect(body).toMatch(/Body Care/i);
    // llms.txt should never expose admin / api surfaces as primary pages.
    expect(body).not.toMatch(/^\s*\/admin\b/im);
  });

  test('manifest is served with the hair-care branding', async ({ page }) => {
    const res = await page.goto('/manifest.webmanifest');
    expect(res?.ok()).toBe(true);
    const text = await res?.text();
    expect(text).toMatch(/"name":\s*"Aizel"/);
    expect(text).toMatch(/"lang":\s*"en-GB"/);
  });
});

test.describe('Storefront — accessibility skeleton', () => {
  test('skip link is the first focusable element', async ({ page }) => {
    await page.goto('/');
    // The skip link is .skip-link in layout.tsx, first DOM-order focusable.
    // Tab once and confirm it's focused. (Headless Chromium starts focus on
    // <body>; the first Tab moves to the first focusable.)
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.textContent);
    expect(focused?.toLowerCase()).toContain('skip to main content');
  });
});
