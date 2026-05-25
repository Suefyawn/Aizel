import { describe, expect, it } from 'vitest';
import { buildCsv, csvFilename } from './csv';

describe('buildCsv', () => {
  it('quotes every cell and uses CRLF line endings', () => {
    const csv = buildCsv(['a', 'b'], [['1', '2'], ['3', '4']]);
    expect(csv).toBe('"a","b"\r\n"1","2"\r\n"3","4"');
  });

  it('escapes embedded double quotes by doubling them', () => {
    const csv = buildCsv(['note'], [['She said "hi"']]);
    expect(csv).toBe('"note"\r\n"She said ""hi"""');
  });

  it('does NOT split on commas — they\'re safe inside the quoted cell', () => {
    const csv = buildCsv(['addr'], [['12 High St, London, EC1']]);
    expect(csv).toBe('"addr"\r\n"12 High St, London, EC1"');
  });

  it('renders null and undefined as empty strings', () => {
    const csv = buildCsv(['x'], [[null], [undefined]]);
    expect(csv).toBe('"x"\r\n""\r\n""');
  });

  it('coerces numbers and booleans via String()', () => {
    const csv = buildCsv(['n', 'b'], [[42, true], [0, false]]);
    expect(csv).toBe('"n","b"\r\n"42","true"\r\n"0","false"');
  });

  it('handles newlines inside a cell without breaking the row', () => {
    const csv = buildCsv(['body'], [['line 1\nline 2']]);
    // The newline stays inside the quoted cell; the row separator is \r\n.
    expect(csv).toBe('"body"\r\n"line 1\nline 2"');
  });

  it('returns just the header row when no data rows are supplied', () => {
    expect(buildCsv(['a', 'b'], [])).toBe('"a","b"');
  });
});

describe('csvFilename', () => {
  it('formats as <prefix>-<YYYY-MM-DD>.csv', () => {
    expect(csvFilename('orders')).toMatch(/^orders-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
