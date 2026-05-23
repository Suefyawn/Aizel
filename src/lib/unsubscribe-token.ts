// HMAC-signed unsubscribe tokens. Lets us put a one-click unsubscribe link
// in every transactional email without exposing a user id or relying on
// auth — the email itself is the identifier.
//
// Token format: base64url(hmac256(secret, email)).slice(0, 32)
// Validation: re-compute the HMAC and compare (constant time).
//
// SECRET resolution:
//   * `NEWSLETTER_TOKEN_SECRET` env var (preferred)
//   * Falls back to `SUPABASE_SERVICE_ROLE_KEY` so we don't need a separate
//     env var to ship; service-role key is always set in production and
//     never reaches the client.

import { createHmac, timingSafeEqual } from 'node:crypto';

function getSecret(): string {
  return process.env.NEWSLETTER_TOKEN_SECRET
      ?? process.env.SUPABASE_SERVICE_ROLE_KEY
      ?? 'dev-newsletter-token-secret-do-not-use-in-prod';
}

export function makeUnsubscribeToken(email: string): string {
  const e = email.trim().toLowerCase();
  const h = createHmac('sha256', getSecret()).update(e).digest('base64url');
  return h.slice(0, 32);
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  if (!email || !token) return false;
  const expected = makeUnsubscribeToken(email);
  if (expected.length !== token.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  } catch {
    return false;
  }
}

/** Build the absolute unsubscribe URL for `email`. Drop into transactional
 *  + newsletter emails — clicking the link 1-click unsubscribes and lands the
 *  user on a confirmation page. */
export function unsubscribeUrl(siteUrl: string, email: string): string {
  const t = makeUnsubscribeToken(email);
  return `${siteUrl.replace(/\/$/, '')}/newsletter/unsubscribe?email=${encodeURIComponent(email)}&token=${t}`;
}
