import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
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
