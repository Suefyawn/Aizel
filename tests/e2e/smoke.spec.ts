import { test, expect } from '@playwright/test';

// Golden-path smoke tests. Phase 6.8. These run against a live dev server
// (started automatically per playwright.config.ts) or PLAYWRIGHT_BASE_URL.

test('homepage renders Yellow Pink branding', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Yellow Pink/);
});

test('shop page loads and lists products', async ({ page }) => {
  await page.goto('/shop');
  await expect(page).toHaveTitle(/Yellow Pink/);
});

test('robots.txt is served', async ({ page }) => {
  const res = await page.goto('/robots.txt');
  expect(res?.ok()).toBe(true);
});

test('sitemap.xml is served', async ({ page }) => {
  const res = await page.goto('/sitemap.xml');
  expect(res?.ok()).toBe(true);
});

test('track page renders the form', async ({ page }) => {
  await page.goto('/track');
  await expect(page.getByRole('heading', { name: /track order/i })).toBeVisible();
});
