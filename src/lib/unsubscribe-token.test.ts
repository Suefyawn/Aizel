import { describe, expect, it } from 'vitest';
import { makeUnsubscribeToken, verifyUnsubscribeToken, unsubscribeUrl } from './unsubscribe-token';

describe('unsubscribe token', () => {
  it('round-trips a normalised email', () => {
    const t = makeUnsubscribeToken('Hello@Example.COM');
    expect(verifyUnsubscribeToken('hello@example.com', t)).toBe(true);
    // normalisation is bidirectional — case in either side is fine
    expect(verifyUnsubscribeToken('Hello@Example.COM', t)).toBe(true);
  });

  it('rejects a token from a different email', () => {
    const t = makeUnsubscribeToken('alice@example.com');
    expect(verifyUnsubscribeToken('bob@example.com', t)).toBe(false);
  });

  it('rejects malformed tokens', () => {
    expect(verifyUnsubscribeToken('alice@example.com', '')).toBe(false);
    expect(verifyUnsubscribeToken('alice@example.com', 'short')).toBe(false);
    expect(verifyUnsubscribeToken('alice@example.com', 'a'.repeat(32))).toBe(false);
  });

  it('rejects missing email', () => {
    expect(verifyUnsubscribeToken('', 'anything')).toBe(false);
  });

  it('builds a query-stringed absolute URL', () => {
    const url = unsubscribeUrl('https://aizel.co.uk', 'alice@example.com');
    expect(url).toMatch(/^https:\/\/aizel\.co\.uk\/newsletter\/unsubscribe\?email=alice%40example\.com&token=[A-Za-z0-9_-]{32}$/);
  });

  it('handles trailing slash on the site url', () => {
    const url = unsubscribeUrl('https://aizel.co.uk/', 'alice@example.com');
    expect(url.startsWith('https://aizel.co.uk/newsletter/')).toBe(true);
    expect(url).not.toContain('.pk//newsletter');
  });
});
