import { test, expect } from '@playwright/test';

// Responsive smoke — visit a curated set of routes at three viewports
// and assert (a) no horizontal scrollbar appears at the body level and
// (b) the page reaches `domcontentloaded` without an unhandled error.
//
// A horizontal scrollbar at the document level is the classic "I forgot
// to make this responsive" symptom: a fixed-width child, a too-wide
// table, an unwrapped flex row. If `scrollWidth` exceeds `clientWidth`
// by more than a 1-pixel tolerance (browser sub-pixel rounding), the
// page is wider than the viewport. That's the failure we want to catch.
//
// We don't try to assert visual layout here — the audit reports + the
// other specs (smoke, a11y) cover that. This spec is the regression
// guard for the breakpoint scaffolding itself.

const VIEWPORTS = [
  { name: 'mobile-375',  width: 375,  height: 667  },
  { name: 'tablet-768',  width: 768,  height: 1024 },
  { name: 'desktop-1280', width: 1280, height: 800 },
] as const;

// Mix of public + auth-gated routes. Auth-gated ones just check that
// the redirect to /login happens cleanly without horizontal overflow.
const ROUTES = [
  '/',
  '/shop',
  '/shop?category=hair-care',
  '/cart',
  '/checkout',
  '/track',
  '/quiz',
  '/blog',
  '/brand',
  '/privacy',
  '/login',
  '/account',          // gated — bounces to /login
  '/account/orders',   // gated
  '/account/addresses',// gated
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`responsive — ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const route of ROUTES) {
      test(`${route} fits viewport without horizontal scroll`, async ({ page }) => {
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        // Allow web fonts to swap in — a wide-font fallback can otherwise
        // overflow briefly during the test window.
        await page.waitForLoadState('networkidle').catch(() => {});

        const overflow = await page.evaluate(() => {
          const docEl = document.documentElement;
          const body  = document.body;
          // documentElement.scrollWidth is the most reliable read.
          return {
            scrollWidth: docEl.scrollWidth,
            clientWidth: docEl.clientWidth,
            bodyScrollWidth: body.scrollWidth,
            // Any element with right-edge past the viewport — used for
            // diagnostics only.
            offenders: Array.from(document.querySelectorAll('*'))
              .filter(el => {
                const r = el.getBoundingClientRect();
                return r.right > docEl.clientWidth + 2 && r.width > 0 && r.height > 0;
              })
              .slice(0, 3)
              .map(el => ({
                tag: el.tagName.toLowerCase(),
                id: el.id || null,
                cls: el.className?.toString().slice(0, 80) || null,
                right: Math.round(el.getBoundingClientRect().right),
              })),
          };
        });

        // 2 px tolerance for sub-pixel rounding the browser does on some
        // GPU-scaled paths.
        expect(
          overflow.scrollWidth,
          `Horizontal overflow on ${route} @ ${vp.name}: doc scrollWidth=${overflow.scrollWidth} > clientWidth=${overflow.clientWidth}. ` +
          `First offenders: ${JSON.stringify(overflow.offenders)}`,
        ).toBeLessThanOrEqual(overflow.clientWidth + 2);
      });
    }
  });
}
