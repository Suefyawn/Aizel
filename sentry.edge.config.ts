import * as Sentry from '@sentry/nextjs';

// See sentry.client.config.ts for why this is read into a const + gated on
// `enabled` and why we fall back to the known DSN when the env var doesn't
// reach the build. The DSN is a public value, so hardcoding the fallback
// leaks nothing. Server/edge prefer SENTRY_DSN but accept the public
// NEXT_PUBLIC_SENTRY_DSN as a secondary source before the literal fallback.
const FALLBACK_DSN = 'https://b4e01e158d30f00285d73c406b2345e7@o4511454907138048.ingest.de.sentry.io/4511455001641040';
const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || FALLBACK_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  tracesSampleRate: 0.2,
});
