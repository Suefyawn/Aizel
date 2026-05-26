import { describe, it, expect } from 'vitest';
import { markdownToHtml, isMarkdown } from './markdown';

describe('isMarkdown', () => {
  it('treats plain markdown as markdown', () => {
    expect(isMarkdown('## Heading\n\nA paragraph.')).toBe(true);
    expect(isMarkdown('A line with **bold** and *italic*.')).toBe(true);
  });

  it('treats HTML-tagged bodies as not-markdown', () => {
    expect(isMarkdown('<p>Already HTML.</p>')).toBe(false);
    expect(isMarkdown('<h2>Heading</h2><p>Paragraph.</p>')).toBe(false);
  });
});

describe('markdownToHtml', () => {
  it('emits <h2> for ## lines', () => {
    expect(markdownToHtml('## The honest difference')).toBe('<h2>The honest difference</h2>');
  });

  it('wraps paragraphs', () => {
    expect(markdownToHtml('First paragraph.\n\nSecond paragraph.'))
      .toBe('<p>First paragraph.</p>\n<p>Second paragraph.</p>');
  });

  it('inlines bold and italic', () => {
    expect(markdownToHtml('A **bold** and *italic* line.'))
      .toBe('<p>A <strong>bold</strong> and <em>italic</em> line.</p>');
  });

  it('renders inline links', () => {
    expect(markdownToHtml('See **[Kuza JBCO](/product/kuza)** for value.'))
      .toBe('<p>See <strong><a href="/product/kuza">Kuza JBCO</a></strong> for value.</p>');
  });

  it('builds a <ul> from consecutive dash items', () => {
    const md = '- First item\n- Second item\n- Third';
    expect(markdownToHtml(md)).toBe('<ul><li>First item</li><li>Second item</li><li>Third</li></ul>');
  });

  it('emits <hr> for --- on its own line', () => {
    const md = 'Before.\n\n---\n\nAfter.';
    expect(markdownToHtml(md)).toBe('<p>Before.</p>\n<hr>\n<p>After.</p>');
  });

  it('escapes URL attribute payload to prevent attribute injection', () => {
    const md = '[Click](https://x.com/?q="onerror=alert)';
    expect(markdownToHtml(md)).toContain('href="https://x.com/?q=&quot;onerror=alert"');
  });

  it('end-to-end shape matches a real blog body', () => {
    const md = [
      "Wash day shouldn't feel like a punishment.",
      '',
      '## 1. Pre-poo, every wash',
      '',
      'Apply a generous coat of a heavy oil.',
      '',
      '- First',
      '- Second',
      '',
      '---',
      '',
      '**The shortlist**: ten products, lasts six months.',
    ].join('\n');
    const html = markdownToHtml(md);
    expect(html).toContain('<h2>1. Pre-poo, every wash</h2>');
    expect(html).toContain('<ul><li>First</li><li>Second</li></ul>');
    expect(html).toContain('<hr>');
    expect(html).toContain('<strong>The shortlist</strong>');
    // Three paragraphs: intro, pre-poo body, closing shortlist.
    expect(html.match(/<p>/g)?.length).toBe(3);
  });
});
