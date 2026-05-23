// Post-process sanitized blog HTML so the first mention of each related
// product (by brand + name, or just brand) becomes an anchor link to its
// PDP. Cheap internal-linking win: keeps editorial flow intact, but every
// post gets a few keyword-rich links pointing into the catalogue.
//
// Constraints we respect:
//   * never insert a link inside an existing <a>...</a>
//   * never link inside <code>, <pre>, <style>, or <script>
//   * match longest product names first (Kiko Milano 3D Hydra Lip Gloss before "Kiko Milano")
//   * only the FIRST occurrence of each product becomes a link — repeated
//     mentions stay as plain text so the post doesn't read like a spam farm
//
// Pure function — no DOM, runs server-side. Called from BlogPostPage
// before dangerouslySetInnerHTML.

import type { Product } from '@/types';
import { absoluteUrl } from '@/lib/seo';
import { stripBrandPrefix } from '@/lib/product-display';

// Tags whose text contents we never touch.
const SKIP_TAGS = new Set(['a', 'code', 'pre', 'style', 'script', 'kbd', 'samp']);

interface Candidate {
  product: Product;
  /** Lowercase phrase we're looking for. */
  needle: string;
  /** Regex with word-boundary safety, case-insensitive, single-match. */
  pattern: RegExp;
}

/** Build the candidate list, sorted longest-needle-first so "Kiko Milano 3D
 *  Hydra" gets a shot before "Kiko Milano". Each product contributes up to
 *  two candidates: the full "brand + name" phrase and the bare brand. */
function buildCandidates(products: Product[]): Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];

  for (const p of products) {
    if (!p?.slug || !p?.name || !p?.brand) continue;
    const cleanName = stripBrandPrefix(p.brand, p.name).trim();
    const phrases = [
      `${p.brand} ${cleanName}`.trim(),
      cleanName,
      p.brand,
    ].filter(Boolean);
    for (const phrase of phrases) {
      const norm = phrase.toLowerCase().trim();
      if (norm.length < 4) continue;          // skip super-short matches
      if (seen.has(norm)) continue;
      seen.add(norm);
      out.push({
        product: p,
        needle: norm,
        // \b doesn't always behave with unicode/punctuation; bracket on
        // non-alphanumeric instead so "CeraVe's" and "(CeraVe)" both match.
        pattern: new RegExp(`(^|[^A-Za-z0-9])(${escapeRegExp(phrase)})(?=$|[^A-Za-z0-9])`, 'i'),
      });
    }
  }

  return out.sort((a, b) => b.needle.length - a.needle.length);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Walk the HTML string, replacing the first occurrence of each product
 * phrase with an anchor — skipping content inside <a> and other "no-go"
 * elements. Strings outside any element are also linked.
 */
export function linkProductMentions(html: string, products: Product[]): string {
  if (!html || products.length === 0) return html;
  const candidates = buildCandidates(products);
  if (candidates.length === 0) return html;

  // Track which products have already been linked (one anchor per product max).
  const linkedSlugs = new Set<string>();

  // Tokenise: split into a sequence of tags + text. Anything matching
  // <[/!]?tag …> is a tag token; everything else is a text token.
  const tokens = html.split(/(<[^>]+>)/g);
  // Stack of currently-open tags so we know whether we're inside an <a> etc.
  const tagStack: string[] = [];

  const linked: string[] = [];
  for (const tok of tokens) {
    if (!tok) continue;
    if (tok.startsWith('<')) {
      // Tag token — push/pop the stack, then emit unchanged.
      const closing = /^<\s*\//.test(tok);
      const selfClosing = /\/\s*>$/.test(tok) || /^<\s*(br|hr|img|input|link|meta)\b/i.test(tok);
      const tagMatch = /^<\s*\/?\s*([a-zA-Z][a-zA-Z0-9-]*)/.exec(tok);
      const name = tagMatch?.[1]?.toLowerCase();
      if (name) {
        if (closing) {
          // pop the most recent matching open
          for (let i = tagStack.length - 1; i >= 0; i--) {
            if (tagStack[i] === name) { tagStack.splice(i, 1); break; }
          }
        } else if (!selfClosing) {
          tagStack.push(name);
        }
      }
      linked.push(tok);
      continue;
    }

    // Text token. Skip if we're inside any blocked tag.
    if (tagStack.some(t => SKIP_TAGS.has(t))) {
      linked.push(tok);
      continue;
    }

    let text = tok;
    for (const c of candidates) {
      if (linkedSlugs.has(c.product.slug)) continue;
      const m = c.pattern.exec(text);
      if (!m) continue;
      const before = text.slice(0, m.index);
      const sep    = m[1];      // leading non-alphanumeric char (or '')
      const phrase = m[2];      // matched product phrase
      const after  = text.slice(m.index + m[0].length);
      const href = absoluteUrl(`/product/${c.product.slug}`);
      const anchor = `<a href="${href}" class="blog-product-link">${escapeHtml(phrase)}</a>`;
      text = `${before}${sep}${anchor}${after}`;
      linkedSlugs.add(c.product.slug);
    }
    linked.push(text);
  }

  return linked.join('');
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, ch => (
    ch === '&' ? '&amp;' :
    ch === '<' ? '&lt;'  :
    ch === '>' ? '&gt;'  :
    ch === '"' ? '&quot;' : '&#39;'
  ));
}
