// Lazy session-secret resolver — separate file so it can be imported by
// `staff-auth.ts` (Node), the legacy admin login action (Node), and the
// signed-cookie helper used from middleware (Edge) without dragging the
// rest of staff-auth's Node-only crypto into the Edge bundle.
//
// Behaviour:
//   - In production (NODE_ENV=production AND VERCEL_ENV=production), throws
//     if the env var is unset or too short — refuses to start.
//   - In dev/preview, uses a constant fallback so smoke tests don't break.

const DEV_FALLBACK = 'yp-staff-dev-secret-NOT-FOR-PROD';

let _cached: string | null = null;

export function STAFF_SESSION_SECRET(): string {
  if (_cached) return _cached;
  const v = process.env.STAFF_SESSION_SECRET;
  if (v && v.length >= 16) {
    _cached = v;
    return v;
  }
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV === 'production') {
    throw new Error('STAFF_SESSION_SECRET must be set (≥16 chars) in production');
  }
  _cached = DEV_FALLBACK;
  return _cached;
}
