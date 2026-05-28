import * as Sentry from '@sentry/nextjs';

// See sentry.client.config.ts for why this is read into a const + gated on
// `enabled` (avoid a half-initialised SDK + force a cache-busting recompile
// when the env value changes on Vercel).
const dsn = process.env.SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  tracesSampleRate: 0.2,
});
