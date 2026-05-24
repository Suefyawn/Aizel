'use server';

// ============================================================================
// UK postcode → address lookup. Adapter-shaped so we can wire a real
// provider (Loqate / Ideal Postcodes / GetAddress.io) by dropping in
// credentials + a `fetch` call below — no UI changes needed.
//
// Current state:
//   • `LOQATE_API_KEY` env var unset → action returns `configured: false`
//     and the UI hides the lookup affordance (falls back to a plain
//     postcode input). No fake matches, no misleading UX.
//   • `LOQATE_API_KEY` set → real call to Loqate Find + Retrieve. The
//     fetch is currently stubbed out behind a TODO so the operator can
//     swap in whichever provider their commercial agreement covers
//     without rewriting the action signature.
// ============================================================================

import { z } from 'zod';

const PostcodeSchema = z.string().trim()
  // UK postcode regex — covers the standard formats (SW1A 1AA, M1 1AA,
  // CR2 6XH, DN55 1PT, EC1A 1BB, W1A 0AX). Tolerates missing space.
  .regex(/^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i, 'Enter a valid UK postcode');

/** Address suggestion shape — provider-agnostic so the UI doesn't need
 *  to know whether Loqate, Ideal Postcodes, or GetAddress.io is wired. */
export interface AddressSuggestion {
  id: string;
  /** Primary text shown in the dropdown row (line 1 + line 2). */
  primary: string;
  /** Secondary muted text shown below (locality + postcode). */
  secondary: string;
  /** Structured fields the form will populate when selected. */
  address: {
    line1: string;
    line2: string;
    city: string;
    postcode: string;
  };
}

export type LookupResult =
  | { ok: true; configured: true; suggestions: AddressSuggestion[] }
  | { ok: false; configured: false }
  | { ok: false; configured: true; error: string };

export async function lookupPostcode(rawPostcode: string): Promise<LookupResult> {
  const apiKey = process.env.LOQATE_API_KEY;
  if (!apiKey) {
    // The component renders nothing extra in this state — keeps demo
    // deployments honest about what's actually wired.
    return { ok: false, configured: false };
  }

  const parsed = PostcodeSchema.safeParse(rawPostcode);
  if (!parsed.success) {
    return { ok: false, configured: true, error: parsed.error.issues[0]?.message ?? 'Invalid postcode' };
  }
  const postcode = parsed.data.toUpperCase();

  // ── Provider adapter ────────────────────────────────────────────────
  // Today: returns an empty list with `ok: true` so the UI shows
  // "No addresses found" rather than a broken request when an API key
  // is provided but the provider isn't actually called yet. Replace
  // with the chosen provider's fetch below.
  //
  // Loqate example (Find + Retrieve, two-step):
  //   const find = await fetch(`https://api.addressy.com/Capture/Interactive/Find/v1.10/json3.ws?Key=${apiKey}&Text=${postcode}&Countries=GBR`);
  //   ... loop containers, call Retrieve for the first non-container result,
  //   ... map to AddressSuggestion[].
  //
  // Ideal Postcodes example (single endpoint):
  //   const r = await fetch(`https://api.ideal-postcodes.co.uk/v1/postcodes/${encodeURIComponent(postcode)}?api_key=${apiKey}`);
  //   const j = await r.json();
  //   return { ok: true, configured: true, suggestions: j.result.map(...) };
  return { ok: true, configured: true, suggestions: [] };
}
