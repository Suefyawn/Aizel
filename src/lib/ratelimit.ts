// ============================================================================
// Rate limiting. Phase 1.9.
//
// Primary backend: Upstash Redis via @upstash/ratelimit (works on Vercel Edge
// and Node runtimes; persistent across cold starts).
//
// Fallback when UPSTASH_* env vars are missing: an in-memory limiter so dev
// and self-hosted environments don't crash. The in-memory fallback is *per
// instance* and resets on cold start — fine for local dev, not safe for prod.
// ============================================================================

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const HAS_UPSTASH = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

// ─── Upstash-backed limiter ─────────────────────────────────────────────────
function makeUpstashLimiter(prefix: string, max: number, windowSec: number): Ratelimit {
  return new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(max, `${windowSec} s`),
    analytics: false,
    prefix: `yp:${prefix}`,
  });
}

// ─── In-memory fallback (per process) ───────────────────────────────────────
const memBuckets = new Map<string, { count: number; resetAt: number }>();

function makeMemoryLimiter(prefix: string, max: number, windowMs: number) {
  return {
    async limit(identifier: string): Promise<{ success: boolean; remaining: number; reset: number }> {
      const key = `${prefix}:${identifier}`;
      const now = Date.now();
      let bucket = memBuckets.get(key);
      if (!bucket || bucket.resetAt < now) {
        bucket = { count: 0, resetAt: now + windowMs };
        memBuckets.set(key, bucket);
      }
      bucket.count++;
      const success = bucket.count <= max;
      return { success, remaining: Math.max(0, max - bucket.count), reset: bucket.resetAt };
    },
  };
}

interface LimiterLike {
  limit(id: string): Promise<{ success: boolean; remaining: number; reset: number }>;
}

function makeLimiter(prefix: string, max: number, windowSec: number): LimiterLike {
  if (HAS_UPSTASH) return makeUpstashLimiter(prefix, max, windowSec) as unknown as LimiterLike;
  return makeMemoryLimiter(prefix, max, windowSec * 1000);
}

// ─── Pre-baked policies ─────────────────────────────────────────────────────
// Tune per-endpoint. Lower limits on auth-adjacent surfaces.
export const authLimiter      = makeLimiter('auth',      5, 60);   // 5 per minute
export const checkoutLimiter  = makeLimiter('checkout', 20, 60);   // 20 per minute
export const reviewLimiter    = makeLimiter('review',    5, 60);   // 5 per minute
export const trackLimiter     = makeLimiter('track',    10, 60);   // 10 per minute
export const uploadLimiter    = makeLimiter('upload',   30, 60);   // 30 per minute
export const newsletterLimiter = makeLimiter('newsletter', 5, 60 * 10);  // 5 per 10 minutes per IP

// ─── Identifier extraction ──────────────────────────────────────────────────
// Use IP from Vercel-set x-forwarded-for, fall back to a stable header.
export function ipFromHeaders(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return headers.get('x-real-ip') ?? 'unknown';
}
