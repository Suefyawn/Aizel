import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// next/og (Satori) can't reference public/ URLs, so the wordmark is read off
// disk and inlined as a base64 data URI. OG images are generated once and
// cached, but memoise per tone anyway so repeated reads in one process are free.
const cache: Partial<Record<'ink' | 'cream', string>> = {};

// Natural artwork size (1379×631) — callers scale by height and derive width.
export const OG_LOGO_ASPECT = 1379 / 631;

export async function ogLogoDataUri(tone: 'ink' | 'cream' = 'ink'): Promise<string> {
  const cached = cache[tone];
  if (cached) return cached;
  const file = tone === 'cream' ? 'logo-cream.png' : 'logo-ink.png';
  const buf = await readFile(join(process.cwd(), 'public', file));
  return (cache[tone] = `data:image/png;base64,${buf.toString('base64')}`);
}
