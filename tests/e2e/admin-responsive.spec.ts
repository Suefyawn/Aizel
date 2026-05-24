import { test, expect } from '@playwright/test';
import { createHmac } from 'crypto';

// Admin-side responsive spec — mirrors tests/e2e/responsive.spec.ts but
// for /admin/* routes that need an authenticated session.
//
// Auth shape: the owner uses an HMAC-signed cookie (`admin_session`)
// produced by src/lib/signed-cookie.ts. We re-implement sign() here in
// Node's `crypto` module rather than importing the source module (which
// uses Web Crypto via `crypto.subtle` — fine for Edge but heavier under
// vitest/playwright Node).
//
// Required env vars (set via .env.local locally, or in CI as secrets):
//   ADMIN_PASSWORD      — any non-empty value; middleware just checks
//                         that this env var is set, not its contents.
//   STAFF_SESSION_SECRET — the HMAC key. Must match the dev server's.
//
// In demo mode (no Supabase env), admin pages render with empty data.
// That's fine for the overflow check — empty tables, empty cards, the
// breakpoint scaffolding still has to hold.

function b64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function signOwnerCookie(secret: string): string {
  const payload = { sub: 'owner', iat: Math.floor(Date.now() / 1000) };
  const body = Buffer.from(JSON.stringify(payload));
  const sig = createHmac('sha256', secret).update(body).digest();
  return `${b64urlEncode(body)}.${b64urlEncode(sig)}`;
}

const SECRET = process.env.STAFF_SESSION_SECRET;
const ADMIN_PASS = process.env.ADMIN_PASSWORD;

// Skip the whole suite cleanly if the env isn't wired — keeps CI green
// while making the gap visible in the report.
test.describe.configure({ mode: 'serial' });

const adminTest = SECRET && ADMIN_PASS ? test : test.skip;

const VIEWPORTS = [
  { name: 'mobile-320',  width: 320,  height: 568  },
  { name: 'mobile-375',  width: 375,  height: 667  },
  { name: 'tablet-768',  width: 768,  height: 1024 },
  { name: 'tablet-1024', width: 1024, height: 768  },
  { name: 'desktop-1280', width: 1280, height: 800 },
] as const;

// Admin routes the auditors flagged as the most-likely-to-break.
// /admin (the login screen) is excluded — it's the only admin route
// without an `adm-page` wrapper and the only one that should look
// completely different from the rest.
const ADMIN_ROUTES = [
  '/admin/dashboard',
  '/admin/orders',
  '/admin/orders/new',
  '/admin/products',
  '/admin/inventory',
  '/admin/users',
  '/admin/audit',
  '/admin/blog',
  '/admin/coupons',
  '/admin/segments',
  '/admin/promos',
  '/admin/reviews',
  '/admin/returns',
  '/admin/emails',
  '/admin/newsletter',
  '/admin/team',
  '/admin/analytics',
  '/admin/settings',
  '/admin/pos/dashboard',
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`admin responsive — ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const route of ADMIN_ROUTES) {
      adminTest(`${route} fits viewport without horizontal scroll`, async ({ page, context, baseURL }) => {
        // Inject the owner cookie before the first navigation so the
        // middleware admin gate passes and the page actually renders.
        const cookieValue = signOwnerCookie(SECRET!);
        const url = new URL(baseURL ?? 'http://localhost:3000');
        await context.addCookies([{
          name: 'admin_session',
          value: cookieValue,
          domain: url.hostname,
          path: '/',
          httpOnly: true,
          secure: false,
          sameSite: 'Lax',
        }]);

        const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
        // If middleware redirected us back to /admin (login screen), the
        // cookie didn't take — surface that as a clear failure rather
        // than silently passing on the wrong page.
        expect(response?.status() ?? 0).toBeLessThan(500);
        const landedAt = new URL(page.url()).pathname;
        expect(landedAt, `expected to stay on ${route} but landed on ${landedAt}`).not.toBe('/admin');

        await page.waitForLoadState('networkidle').catch(() => {});

        const overflow = await page.evaluate(() => {
          const docEl = document.documentElement;
          return {
            scrollWidth: docEl.scrollWidth,
            clientWidth: docEl.clientWidth,
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

        expect(
          overflow.scrollWidth,
          `Horizontal overflow on ${route} @ ${vp.name}: ${overflow.scrollWidth} > ${overflow.clientWidth}. ` +
          `First offenders: ${JSON.stringify(overflow.offenders)}`,
        ).toBeLessThanOrEqual(overflow.clientWidth + 2);
      });
    }
  });
}
