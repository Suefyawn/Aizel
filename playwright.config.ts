import { defineConfig, devices } from '@playwright/test';

// E2E config. Phase 6.8. Run with `npm run e2e`.
// Add specs under tests/e2e/.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  // Flaky-test insurance in CI: a cold route or a parallel-worker race
  // shouldn't fail the whole job on the first try. Local runs keep 0 retries
  // so failures surface immediately.
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        // Run against a PRODUCTION build, not `next dev`. The dev server
        // compiles each route on first hit, so under fullyParallel load the
        // first request to a cold route could blow the per-test timeout (and
        // the boot itself could exceed the webServer budget) — the root cause
        // of the intermittent E2E CI failures. `next start` serves
        // precompiled output with no JIT compile pauses.
        command: 'npm run build && npm run start',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        // Generous budget: the production build runs as part of startup.
        timeout: 240_000,
      },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Add 'mobile-safari' / 'firefox' as needed.
  ],
});
