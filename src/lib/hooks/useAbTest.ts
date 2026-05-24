'use client';

import { useEffect, useState } from 'react';

// ============================================================================
// Lightweight, env-driven A/B test harness.
//
// Designed to land an experiment in production with one env-var change
// and one line of component code — no third-party flag provider, no
// extra dependency, no schema migration.
//
// ── Configuring an experiment ───────────────────────────────────────────
// Each experiment lives in an env var of the form
//
//   NEXT_PUBLIC_AB_<EXPERIMENT_KEY>="<variant>:<weight>,<variant>:<weight>"
//
// e.g. to A/B test the hero headline 50/50:
//   NEXT_PUBLIC_AB_HERO_HEADLINE="A:50,B:50"
//
// Weights are relative — `A:1,B:3` is a 25/75 split. The "control" name
// is whatever the operator chooses; the engine doesn't care.
//
// ── Consuming an experiment ─────────────────────────────────────────────
//   const variant = useAbTest('HERO_HEADLINE');
//   if (variant === 'B') return <NewHero />;
//   return <ControlHero />;            // also runs when env is unset
//
// During SSR the hook returns the control (first variant in the env
// string) so the server-rendered HTML stays consistent — the swap
// happens on the client after hydration. For above-the-fold UI that
// would CLS-flash, prefer a server-resolved experiment via middleware
// (out of scope for this harness).
//
// ── Bucketing ───────────────────────────────────────────────────────────
// Each visitor gets a stable random visitorId in localStorage. The
// (visitorId + experimentKey) string is hashed to 0-99 and walked
// against the variant weights — so the same visitor always lands in
// the same bucket for the same experiment, AND different experiments
// bucket independently of each other (no carry-over from previous
// tests).
//
// The assigned variant is persisted to localStorage under the
// experiment key, so even if the env weights change mid-flight, the
// visitor stays where they were originally bucketed.
//
// ── Reporting ──────────────────────────────────────────────────────────
// On first assignment we fire one event to each of gtag, fbq, and
// Plausible (whichever are present). The event names match the
// platform's "experiment_assigned" convention so the analyst can
// segment trends + funnels by variant downstream.
// ============================================================================

const VISITOR_ID_KEY = 'aizel:visitor-id';
const ASSIGNMENT_KEY_PREFIX = 'aizel:ab:';

interface VariantSpec { variant: string; weight: number }

function envVarFor(experimentKey: string): string | undefined {
  // Vite/Next inline env at build time — must reference the var directly,
  // not via dynamic property access. We do the lookup against a known set
  // here; downstream code adds new entries when shipping new experiments.
  //
  // Pattern: `process.env.NEXT_PUBLIC_AB_<EXPERIMENT_KEY>` for each
  // experiment shipped. The switch is exhaustive against the known set;
  // an unknown key returns undefined so the consumer falls back to control.
  switch (experimentKey) {
    case 'HERO_HEADLINE':       return process.env.NEXT_PUBLIC_AB_HERO_HEADLINE;
    case 'PDP_CTA':             return process.env.NEXT_PUBLIC_AB_PDP_CTA;
    case 'QUIZ_OPENER':         return process.env.NEXT_PUBLIC_AB_QUIZ_OPENER;
    // Add new experiment keys here when shipping. Keep this list small —
    // running > 3 experiments simultaneously makes the signal noisy.
    default: return undefined;
  }
}

function parseSpec(raw: string | undefined): VariantSpec[] {
  if (!raw) return [];
  return raw.split(',')
    .map(part => {
      const [variant, weightStr] = part.split(':');
      const weight = Number(weightStr);
      return variant && isFinite(weight) && weight > 0 ? { variant: variant.trim(), weight } : null;
    })
    .filter((v): v is VariantSpec => v !== null);
}

/** Deterministic 32-bit hash — `(visitorId + experimentKey)` → 0..2^32-1.
 *  djb2 because it's tiny, well-distributed enough for bucketing, and
 *  needs no crypto dep. */
function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) + s.charCodeAt(i); // h * 33 + c
    h |= 0; // coerce to 32-bit
  }
  return h >>> 0;
}

function readOrCreateVisitorId(): string {
  try {
    const existing = window.localStorage.getItem(VISITOR_ID_KEY);
    if (existing) return existing;
    // Browser-supplied UUID where available; fall back to a Math.random
    // base36 string so we work in older browsers + Safari private mode.
    const id = (window.crypto?.randomUUID?.()
      ?? Math.random().toString(36).slice(2) + Date.now().toString(36));
    window.localStorage.setItem(VISITOR_ID_KEY, id);
    return id;
  } catch {
    // localStorage unavailable (private window with strict storage) — fall
    // back to a per-session pseudo-id so the experiment still buckets
    // consistently within a single tab.
    return 'session-' + Math.random().toString(36).slice(2);
  }
}

function reportAssignment(experimentKey: string, variant: string) {
  if (typeof window === 'undefined') return;
  // gtag (GA4)
  try { window.gtag?.('event', 'experiment_assigned', { experiment_id: experimentKey, variant_id: variant }); } catch {}
  // Plausible custom event
  try {
    (window as unknown as { plausible?: (event: string, opts?: { props?: Record<string, string> }) => void })
      .plausible?.('experiment_assigned', { props: { experiment: experimentKey, variant } });
  } catch {}
  // Meta Pixel custom event
  try { window.fbq?.('trackCustom', 'ExperimentAssigned', { experiment: experimentKey, variant }); } catch {}
}

/**
 * Returns the variant the visitor is bucketed into for an experiment.
 * SSR-safe — returns the first-listed variant during the server render
 * and on the first client paint, then swaps to the real assignment in a
 * microtask so the server + client agree.
 *
 * Pass `controlFallback` to override what to return when the env var
 * isn't set (default: 'control').
 */
export function useAbTest(experimentKey: string, controlFallback = 'control'): string {
  const spec = parseSpec(envVarFor(experimentKey));
  const controlVariant = spec[0]?.variant ?? controlFallback;
  const [variant, setVariant] = useState<string>(controlVariant);

  useEffect(() => {
    if (spec.length === 0) return;
    const storageKey = ASSIGNMENT_KEY_PREFIX + experimentKey;
    let assigned: string | null = null;
    try { assigned = window.localStorage.getItem(storageKey); } catch { /* noop */ }
    if (!assigned) {
      // Fresh assignment — bucket the visitor.
      const visitorId = readOrCreateVisitorId();
      const totalWeight = spec.reduce((s, v) => s + v.weight, 0);
      const bucket = hash(visitorId + ':' + experimentKey) % totalWeight;
      let cursor = 0;
      for (const v of spec) {
        cursor += v.weight;
        if (bucket < cursor) { assigned = v.variant; break; }
      }
      assigned = assigned ?? spec[0].variant;
      try { window.localStorage.setItem(storageKey, assigned); } catch { /* noop */ }
      reportAssignment(experimentKey, assigned);
    }
    if (assigned !== variant) setVariant(assigned);
    // We intentionally exclude `variant` from the dep array — the assignment
    // is a one-shot per experiment, not a state we want to re-react to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experimentKey]);

  return variant;
}

// ── Exported test helpers ──────────────────────────────────────────────
// Exposed for unit tests + the rare consumer that wants to score against
// the bucketing directly (e.g. a server component that knows the
// visitor id from a cookie). Pure functions — no DOM dependency.
export const __test = { parseSpec, hash };
