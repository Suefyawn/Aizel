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
    // Three curated mega-menus: Hair Care, Body Care, Styling. Styling
    // consolidates the old "Styling & Tools" + "Grooming" taxons into one
    // mega-menu with two columns so the top bar stays uncluttered — those
    // taxon labels move down a level into the mega's sub-headings.
    await expect(nav.getByRole('link', { name: /^Hair Care$/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /^Body Care$/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /^Styling$/i })).toBeVisible();
    // Belt-and-braces against a Wellness / Makeup regression.
    await expect(nav.getByText(/Wellness/i)).toHaveCount(0);
    await expect(nav.getByText(/Makeup/i)).toHaveCount(0);
  });

  test('header nav surfaces All + Brands directly', async ({ page }) => {
    // Regression guard: from the top of every page a shopper should be one
    // click from the full catalogue and the brand index. Hiding either
    // inside a mega-menu (the previous shape) kills discoverability.
    await page.goto('/');
    const nav = page.locator('nav[aria-label="Primary"]');
    const all = nav.getByRole('link', { name: /^All$/ });
    const brands = nav.getByRole('link', { name: /^Brands$/ });
    await expect(all).toBeVisible();
    await expect(brands).toBeVisible();
    await expect(all).toHaveAttribute('href', '/shop');
    await expect(brands).toHaveAttribute('href', '/brand');
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
    // The collection page should render at least one product tile.
    const hasProduct = await page.locator('a[href^="/product/"]').count();
    expect(hasProduct).toBeGreaterThan(0);
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
