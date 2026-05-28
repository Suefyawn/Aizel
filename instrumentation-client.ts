import * as Sentry from '@sentry/nextjs';

// CLIENT-SIDE Sentry init. This MUST live in `instrumentation-client.ts`
// (a Next.js-native client hook, loaded before hydration under BOTH webpack
// and Turbopack) rather than `sentry.client.config.ts`. The Sentry SDK only
// auto-injects `sentry.client.config.ts` via its webpack plugin — under
// Turbopack (the default bundler in Next 16) that injection never runs, so
// the old file silently never executed and browser error monitoring was dead
// (window.__SENTRY__ was undefined in production).
//
// Public Sentry DSN. Prefer the env var (so a staging deploy can point at a
// different Sentry project) but fall back to the known production DSN so
// browser error monitoring works even when the Vercel env var doesn't reach
// the build. The DSN is a PUBLIC value — it ships in the client bundle by
// design, exactly like the GA/PostHog keys — so there is no secret to
// protect by keeping it env-only. Same pattern as the PostHog api_host
// default. `enabled` stays gated so a deliberately-blanked DSN still turns
// Sentry off cleanly.
const FALLBACK_DSN = 'https://b4e01e158d30f00285d73c406b2345e7@o4511454907138048.ingest.de.sentry.io/4511455001641040';
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || FALLBACK_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  tracesSampleRate: 0.2,
  // Capture replays for 5% of sessions, 100% of sessions with errors.
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,
  // Perf P1 audit fix: replayIntegration eagerly loads ~50-80 KB gz of
  // recorder code on every page. With a 5% session-sample rate, 95% of
  // visitors paid for nothing. Lazy-load it after first paint so it
  // never blocks the initial render; Sentry will still pick up the
  // replay for any error caught later in the session.
  integrations: [],
});

if (typeof window !== 'undefined') {
  // Schedule the replay integration for after the page has settled.
  // requestIdleCallback isn't universally supported — fall back to a
  // 1-second timeout in Safari.
  const start = () => {
    Sentry.addIntegration(
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    );
  };
  const ric: typeof requestIdleCallback | undefined = (window as unknown as { requestIdleCallback?: typeof requestIdleCallback }).requestIdleCallback;
  if (typeof ric === 'function') {
    ric(start, { timeout: 3000 });
  } else {
    setTimeout(start, 1000);
  }
}

// Surfaces App Router navigations to Sentry tracing. Sentry warns at build
// time if this isn't exported once a client config exists.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
