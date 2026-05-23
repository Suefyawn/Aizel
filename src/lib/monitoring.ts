// ============================================================================
// Optional Sentry integration. Phase 6.5.
//
// The Sentry SDK adds ~15 KB and requires its own webpack plugin; rather
// than make it a hard dependency, we only initialise when SENTRY_DSN is set
// and import dynamically so non-Sentry installs don't pay the cost.
//
// To enable:
//   1. `npm install @sentry/nextjs`
//   2. Set SENTRY_DSN (server) and NEXT_PUBLIC_SENTRY_DSN (browser) env vars.
//   3. Wrap next.config.ts with `withSentryConfig` per Sentry's wizard.
//
// This file gives you the primitives so the rest of the codebase can call
// `captureError()` without caring whether Sentry is wired up.
// ============================================================================

type ErrorContext = Record<string, unknown>;

interface SentryLike {
  captureException(err: unknown, scope?: { extra?: ErrorContext }): void;
  captureMessage(msg: string, level?: 'info' | 'warning' | 'error'): void;
}

let sentry: SentryLike | null = null;
let initAttempted = false;

async function maybeInit(): Promise<void> {
  if (initAttempted) return;
  initAttempted = true;
  if (!process.env.SENTRY_DSN) return;
  try {
    // Dynamic import so the bundle stays slim when Sentry isn't installed.
    // We use `Function(...)` to dodge the bundler's static-import resolution
    // since @sentry/nextjs isn't a hard dependency.
    const mod = await (Function('return import("@sentry/nextjs")')() as Promise<SentryLike>);
    sentry = mod;
  } catch {
    // @sentry/nextjs not installed yet — no-op.
  }
}

export async function captureError(err: unknown, extra?: ErrorContext): Promise<void> {
  await maybeInit();
  if (sentry) sentry.captureException(err, { extra });
  else if (process.env.NODE_ENV !== 'production') {
    console.error('[monitoring]', err, extra);
  }
}

export async function captureMessage(msg: string, level: 'info' | 'warning' | 'error' = 'info'): Promise<void> {
  await maybeInit();
  if (sentry) sentry.captureMessage(msg, level);
  else if (process.env.NODE_ENV !== 'production') {
    console.log(`[monitoring:${level}]`, msg);
  }
}
