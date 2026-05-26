// ============================================================================
// Minimal Markdown → HTML converter for blog body content.
//
// The blog_posts.body column carries operator-authored copy. Historic posts
// were stored as raw HTML; the current editor writes Markdown. Rather than
// run a one-off SQL conversion (which doesn't help future posts) we do the
// transform at render time — fast enough for the post-detail page, no extra
// runtime dependency, and `isMarkdown()` lets us no-op when the body is
// already HTML so existing posts render unchanged.
//
// Supported markdown:
//   - `## Heading`  → <h2>
//   - `**bold**`    → <strong>
//   - `*italic*`    → <em>          (single `*` only, not nested **/*)
//   - `[text](url)` → <a href="url">text</a>
//   - `- item` lines (consecutive) → <ul><li>…</li></ul>
//   - `---` on its own line → <hr>
//   - blank-line-separated paragraphs → <p>…</p>
//
// Code blocks, tables, images, and reference-style links are deliberately
// out of scope — the editorial style guide doesn't use them; adding them
// later is straightforward.
//
// The output is HTML; the BlogPostPage caller still runs it through
// sanitizeHtml() before inserting via dangerouslySetInnerHTML, so a hostile
// post body can't smuggle a <script> in via markdown syntax.
// ============================================================================

/** Heuristic: a body is HTML if it contains any HTML tag we'd render. */
export function isMarkdown(body: string): boolean {
  // Quick check: if it has any of the structural tags we'd otherwise emit
  // (<p>, <h2>, <ul>, <li>), assume the body is already HTML.
  return !/<(p|h[1-6]|ul|ol|li|hr|br|strong|em|a)\b/i.test(body);
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;')
   .replace(/</g, '&lt;')
   .replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;');

/** Inline transforms applied within a single line / paragraph. */
function inlineMd(s: string): string {
  // Order matters — links first (they contain `[`/`]`/`(`/`)` which the
  // emphasis pass might otherwise misinterpret), then bold, then italic.
  return s
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,
             (_, text: string, url: string) =>
               `<a href="${escapeHtml(url)}">${text}</a>`)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic — single * but not part of an already-substituted <strong>.
    // The bold pass above already swallowed `**…**`, so a remaining `*` is
    // unambiguous emphasis.
    .replace(/(^|[^*])\*([^*]+?)\*(?!\*)/g, '$1<em>$2</em>');
}

export function markdownToHtml(input: string): string {
  if (!input) return '';

  // Normalise line endings + trim outer blanks so paragraph splitting is
  // predictable on body strings exported from any editor.
  const text = input.replace(/\r\n?/g, '\n').trim();

  // Block-level pass: split on blank lines, handle each block.
  const blocks = text.split(/\n{2,}/);
  const out: string[] = [];

  for (const raw of blocks) {
    const block = raw.replace(/^\n+|\n+$/g, '');
    if (!block) continue;

    // Horizontal rule on its own line.
    if (/^---+$/.test(block)) {
      out.push('<hr>');
      continue;
    }

    // ATX heading: `## Text` (only h2 supported — no h1 from inside post
    // bodies because the page already renders the title as <h1>).
    const h2 = /^##\s+(.+)$/.exec(block);
    if (h2) {
      out.push(`<h2>${inlineMd(h2[1])}</h2>`);
      continue;
    }

    // Unordered list — every line in the block starts with `- `.
    const lines = block.split('\n');
    if (lines.every(l => /^-\s+/.test(l))) {
      const items = lines.map(l => l.replace(/^-\s+/, ''));
      out.push('<ul>' + items.map(it => `<li>${inlineMd(it)}</li>`).join('') + '</ul>');
      continue;
    }

    // Default — a paragraph. Soft line breaks inside the block become
    // spaces (markdown convention); the inline pass handles emphasis +
    // links.
    out.push(`<p>${inlineMd(block.replace(/\n/g, ' '))}</p>`);
  }

  return out.join('\n');
}
