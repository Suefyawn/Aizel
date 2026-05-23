export const dynamic = 'force-dynamic';

import { SettingsPageHeader } from '@/components/admin/settings-controls';
import { readAnalyticsCache, timeAgoShort } from '@/lib/analytics-cache';

// IMPORTANT: never render an env-var VALUE on this page — only its presence.
// All checks happen server-side; only the boolean leaves this module.

interface IntegrationCheck {
  name: string;
  /** Short purpose so the owner knows what this integration does. */
  purpose: string;
  /** Env vars required for the integration to work. Missing any one =
   *  the integration is considered "Not configured". */
  envVars: string[];
  /** Env vars that are nice-to-have but not required — missing ones don't
   *  affect the status badge. Used for fallback knobs that an upstream
   *  service can already satisfy without the env var (e.g. a redundant SEO
   *  verification meta tag when DNS verification is already done). */
  optionalEnvVars?: string[];
  /** Optional analytics_cache key whose updated_at lets us show a freshness
   *  badge ("Last synced 12m ago"). */
  cacheKey?: string;
  /** Doc-ref shown when the integration is missing — points the owner at the
   *  setup instructions (file path or USER-MANUAL section). */
  setupRef: string;
}

const INTEGRATIONS: IntegrationCheck[] = [
  {
    name: 'Resend (transactional email)',
    purpose: 'Order confirmations, shipping updates, password resets, newsletter sends. The webhook secret unlocks delivery/open/click tracking on the Email log.',
    envVars: ['RESEND_API_KEY', 'EMAIL_FROM', 'RESEND_WEBHOOK_SECRET'],
    setupRef: 'src/lib/email.ts',
  },
  {
    name: 'PostHog analytics',
    purpose: 'Pageviews, sessions, funnel, top pages, top referrers — the traffic widgets on Analytics.',
    envVars: ['POSTHOG_PERSONAL_API_KEY'],
    cacheKey: 'posthog',
    setupRef: 'src/app/admin/dashboard/actions.ts',
  },
  {
    name: 'Sentry error tracking',
    purpose: 'Captures runtime errors and surfaces them on the Analytics page.',
    envVars: ['SENTRY_DSN', 'SENTRY_AUTH_TOKEN'],
    cacheKey: 'sentry',
    setupRef: 'src/lib/sentry.ts',
  },
  {
    name: 'Upstash Redis (rate-limiting)',
    purpose: 'Backs the per-IP rate limit on the contact form, login, and password reset.',
    envVars: ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
    setupRef: 'src/lib/rate-limit.ts',
  },
  {
    name: 'Stripe payments',
    purpose: 'Card checkout via Stripe (Visa, Mastercard, Amex, Apple Pay, Google Pay). Skip if you only take bank transfer.',
    envVars: ['STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET'],
    setupRef: 'Pending wiring at src/lib/payments/stripe.ts',
  },
  {
    name: 'PayPal Checkout',
    purpose: 'PayPal smart buttons at checkout. Optional alongside Stripe.',
    envVars: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'],
    setupRef: 'Pending wiring at src/lib/payments/paypal.ts',
  },
  {
    name: 'Google Search Console',
    purpose: 'Backup HTML meta-tag verification. Only needed for URL-prefix properties; Domain properties verify via DNS and don\'t need this.',
    envVars: [],
    optionalEnvVars: ['GOOGLE_SITE_VERIFICATION'],
    setupRef: 'docs/USER-MANUAL.md §7',
  },
  {
    name: 'WhatsApp business',
    purpose: 'The footer button + per-order WhatsApp link to message the customer about their order.',
    envVars: ['NEXT_PUBLIC_WHATSAPP_NUMBER'],
    setupRef: 'docs/USER-MANUAL.md §3',
  },
];

interface RenderedVar { name: string; present: boolean; optional: boolean }

interface ResolvedIntegration extends IntegrationCheck {
  status: 'ok' | 'partial' | 'missing';
  /** Only the missing *required* vars — drives the status badge. */
  missingVars: string[];
  /** Required + optional vars merged into render-ready rows. */
  renderedVars: RenderedVar[];
  lastSync: string | null;
}

async function resolve(integration: IntegrationCheck): Promise<ResolvedIntegration> {
  const missingVars = integration.envVars.filter(v => !process.env[v]);
  // An integration with no required vars (e.g. one whose only knob is an
  // optional fallback) is considered "ok" — there's nothing to configure for
  // it to do its job.
  const status: 'ok' | 'partial' | 'missing' =
    integration.envVars.length === 0 || missingVars.length === 0 ? 'ok' :
    missingVars.length < integration.envVars.length ? 'partial' :
    'missing';

  const renderedVars: RenderedVar[] = [
    ...integration.envVars.map(name => ({ name, present: Boolean(process.env[name]), optional: false })),
    ...(integration.optionalEnvVars ?? []).map(name => ({ name, present: Boolean(process.env[name]), optional: true })),
  ];

  let lastSync: string | null = null;
  if (integration.cacheKey && status !== 'missing') {
    const cached = await readAnalyticsCache<unknown>(integration.cacheKey);
    if (cached) lastSync = cached.updatedAt;
  }

  return { ...integration, status, missingVars, renderedVars, lastSync };
}

function StatusBadge({ status }: { status: 'ok' | 'partial' | 'missing' }) {
  const map = {
    ok:      { bg: '#f0fdf4', fg: '#15803d', label: 'Configured' },
    partial: { bg: '#fef3c7', fg: '#92400e', label: 'Partial' },
    missing: { bg: '#f3f4f6', fg: '#6b7280', label: 'Not configured' },
  } as const;
  const v = map[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '4px 10px', borderRadius: 999,
      background: v.bg, color: v.fg,
      fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
      whiteSpace: 'nowrap',
    }}>
      {v.label}
    </span>
  );
}

export default async function SettingsIntegrationsPage() {
  const resolved = await Promise.all(INTEGRATIONS.map(resolve));

  const summary = {
    ok:      resolved.filter(r => r.status === 'ok').length,
    partial: resolved.filter(r => r.status === 'partial').length,
    missing: resolved.filter(r => r.status === 'missing').length,
  };

  return (
    <>
      <SettingsPageHeader
        title="Integrations"
        subtitle="Third-party services Aizel uses. Statuses are computed live from the deployed environment variables."
      />

      {/* Summary row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{
          flex: '1 1 140px', minWidth: 140,
          background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          padding: '14px 18px',
        }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#15803d' }}>{summary.ok}</div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Configured</div>
        </div>
        <div style={{
          flex: '1 1 140px', minWidth: 140,
          background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          padding: '14px 18px',
        }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#92400e' }}>{summary.partial}</div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Partial</div>
        </div>
        <div style={{
          flex: '1 1 140px', minWidth: 140,
          background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          padding: '14px 18px',
        }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#6b7280' }}>{summary.missing}</div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Not configured</div>
        </div>
      </div>

      {/* Per-integration cards */}
      <div style={{ display: 'grid', gap: 12 }}>
        {resolved.map(i => (
          <div key={i.name} style={{
            background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            padding: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 10 }}>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>{i.name}</h3>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6b7280', lineHeight: 1.5 }}>{i.purpose}</p>
              </div>
              <StatusBadge status={i.status} />
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8,
              marginTop: 12, paddingTop: 12, borderTop: '1px solid #f3f4f6',
              fontSize: '0.75rem',
            }}>
              <div>
                <div style={{ color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 4 }}>Env vars</div>
                <div style={{ color: '#374151', lineHeight: 1.6 }}>
                  {i.renderedVars.length === 0 ? (
                    <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>None required</div>
                  ) : i.renderedVars.map(v => {
                    // Missing-but-optional gets a muted tick mark, not a red ✗ —
                    // it's a knob, not a gap.
                    const colour = v.present ? '#15803d' : (v.optional ? '#9ca3af' : '#dc2626');
                    return (
                      <div key={v.name} style={{ fontFamily: 'monospace' }}>
                        <span style={{ color: colour }}>{v.present ? '✓' : '✗'}</span> {v.name}
                        {v.optional && (
                          <span style={{ color: '#9ca3af', fontStyle: 'italic', fontFamily: 'inherit' }}> (optional)</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {i.cacheKey && (
                <div>
                  <div style={{ color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 4 }}>Last sync</div>
                  <div style={{ color: '#374151' }}>
                    {i.lastSync ? timeAgoShort(i.lastSync) : '—'}
                  </div>
                </div>
              )}

              <div>
                <div style={{ color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 4 }}>Setup ref</div>
                <div style={{ color: '#374151', fontFamily: 'monospace', fontSize: '0.6875rem', wordBreak: 'break-all' }}>
                  {i.setupRef}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p style={{ margin: '20px 0 0', fontSize: '0.75rem', color: '#9ca3af', lineHeight: 1.5 }}>
        To configure a missing integration, open Vercel → <em>Project Settings</em> → <em>Environment Variables</em>,
        add the env vars under <em>Production</em>, then redeploy. This page never shows the secret values themselves.
      </p>
    </>
  );
}
