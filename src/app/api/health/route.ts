// Lightweight diagnostic endpoint. Hit /api/health to see at a glance whether
// the deployment has the env vars and schema it expects — much faster than
// pulling Vercel logs every time a page starts throwing.
//
// Output:
//   {
//     "status": "ok" | "degraded",
//     "demo_mode": false,
//     "checks": {
//       "supabase_url": true,
//       "supabase_anon_key": true,
//       "supabase_service_role_key": true,
//       "resend_api_key": true,
//       "site_url": "https://aizel.co.uk",
//       "tables": {
//         "products":     { ok: true,  count: 247 },
//         "blog_posts":   { ok: true,  count: 12 },
//         "pages":        { ok: false, error: "relation \"pages\" does not exist" },
//         ...
//       }
//     }
//   }
//
// noindex via robots.ts (the /api/ prefix is disallowed). Returns 200 even
// when degraded so monitoring tools can poll the body for nuance instead of
// flipping at the status code level.

import { NextRequest, NextResponse } from 'next/server';
import { supabase, isDemo } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TABLES_TO_CHECK = [
  'products',
  'product_variants',
  'product_images',
  'product_attributes',
  'categories',
  'blog_posts',
  'pages',
  'orders',
  'order_items',
  'profiles',
  'site_settings',
  'product_reviews',
  'coupons',
  'addresses',
  'staff_members',
  'shipping_zones',
  'audit_log',
] as const;

interface TableCheck {
  ok: boolean;
  count?: number;
  error?: string;
}

// P2 audit fix: the endpoint enumerates env-var presence + row counts on
// every table including staff_members and audit_log — useful intelligence
// for an attacker mapping the deployment. Gate behind a shared secret
// passed as `?key=` or `Authorization: Bearer …`. The legacy unauth path
// is still allowed in non-production so local debugging stays fast.
function authorize(req: NextRequest): boolean {
  if (process.env.VERCEL_ENV !== 'production' && process.env.NODE_ENV !== 'production') {
    return true;
  }
  const expected = process.env.HEALTH_CHECK_SECRET ?? process.env.CRON_SECRET;
  if (!expected) return false;
  const fromHeader = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const fromQuery = new URL(req.url).searchParams.get('key');
  return fromHeader === expected || fromQuery === expected;
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const checks: Record<string, unknown> = {
    supabase_url: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabase_anon_key: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabase_service_role_key: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    resend_api_key: Boolean(process.env.RESEND_API_KEY),
    site_url: process.env.NEXT_PUBLIC_SITE_URL ?? null,
    vercel_env: process.env.VERCEL_ENV ?? null,
    node_env: process.env.NODE_ENV ?? null,
  };

  let tables: Record<string, TableCheck> = {};
  let degraded = isDemo;

  if (!isDemo) {
    // Probe every table with a HEAD-style count query — cheap and reveals
    // whether the table exists + whether RLS lets anon read it.
    const results = await Promise.all(
      TABLES_TO_CHECK.map(async (name): Promise<[string, TableCheck]> => {
        try {
          const { count, error } = await supabase
            .from(name)
            .select('*', { count: 'exact', head: true });
          if (error) return [name, { ok: false, error: error.message }];
          return [name, { ok: true, count: count ?? 0 }];
        } catch (err) {
          return [name, { ok: false, error: (err as Error).message }];
        }
      }),
    );
    tables = Object.fromEntries(results);
    degraded = results.some(([, t]) => !t.ok);
  }

  checks.tables = tables;

  return NextResponse.json({
    status: degraded ? 'degraded' : 'ok',
    demo_mode: isDemo,
    timestamp: new Date().toISOString(),
    checks,
  });
}
