import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// axe-core sweep across the customer-facing routes that matter most for
// launch. Run order roughly mirrors traffic: homepage → shop → PDP →
// cart → checkout → quiz → key static pages.
//
// Failure rule: we fail the test on `serious` + `critical` impact only.
// `minor` and `moderate` are real but often live in third-party widgets
// (Stripe iframes / cookie banners) that we don't control during E2E,
// and pinning every page to zero-of-anything turns into a brittle
// blocker rather than a useful signal.
//
// Each test runs the full axe ruleset (WCAG 2.1 A, AA, plus best-practice
// rules). Local dev is the source of truth; CI runs the same against
// the Vercel preview deployment.

interface Page { name: string; path: string; }

const PAGES: Page[] = [
  { name: 'homepage',     path: '/' },
  { name: 'shop',         path: '/shop' },
  { name: 'shop hair',    path: '/shop?taxon=hair' },
  { name: 'brand index',  path: '/brand' },
  { name: 'cart (empty)', path: '/cart' },
  { name: 'checkout',     path: '/checkout' },
  { name: 'quiz',         path: '/quiz' },
  { name: 'track',        path: '/track' },
  { name: 'blog',         path: '/blog' },
  { name: 'privacy',      path: '/privacy' },
];

// Selectors we exclude from the axe scan because they're under outside
// control or known-noisy:
//   • #demo-banner — visual stripe in demo mode, ARIA-correct but redundant.
//   • [data-stripe] / Stripe iframes — Stripe's own DOM, can't fix here.
//   • .cookie-banner [data-third-party] — placeholder for future
//     consent-vendor widgets; nothing matches today.
const EXCLUDED_SELECTORS = ['#demo-banner', '[data-stripe]'];

for (const p of PAGES) {
  test(`a11y — ${p.name}`, async ({ page }) => {
    await page.goto(p.path);
    // Wait for the page to settle — most a11y violations are stable, but
    // late-loading content (product tiles, ISR hydration) can flap.
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .exclude(EXCLUDED_SELECTORS)
      // WCAG 2.1 A + AA covers what UK accessibility regs (Equality Act
      // 2010 + PSBAR) actually reference. The `best-practice` tag adds
      // a few non-statutory rules we still want to know about.
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();

    // Filter to serious + critical so this stays a launch-blocker test,
    // not a low-priority noise generator. We still log the count of
    // moderate / minor so they're visible in CI output.
    const blocking = results.violations.filter(v =>
      v.impact === 'serious' || v.impact === 'critical',
    );
    const lesser = results.violations.length - blocking.length;
    if (lesser > 0) {
      // eslint-disable-next-line no-console
      console.log(`a11y — ${p.name}: ${lesser} non-blocking violation${lesser !== 1 ? 's' : ''} (moderate/minor)`);
    }

    // Friendlier failure message — Playwright's default just dumps the
    // expected/actual which isn't useful for axe results. Include the
    // rule + the first failing node so the operator can locate it.
    if (blocking.length > 0) {
      const lines = blocking.map(v =>
        ` • [${v.impact}] ${v.id} — ${v.help}\n   first node: ${v.nodes[0]?.target.join(' ')}\n   ${v.helpUrl}`,
      );
      throw new Error(`${blocking.length} serious/critical a11y violation${blocking.length !== 1 ? 's' : ''} on ${p.path}:\n${lines.join('\n')}`);
    }
    expect(blocking).toEqual([]);
  });
}
