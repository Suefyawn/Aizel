// Tiny CSV builder used by the admin export buttons. RFC-4180 quoting —
// every cell is wrapped in double-quotes and inner quotes are doubled.
// Excel + Google Sheets + Numbers all open this dialect cleanly without
// needing a sniffer hint.
//
// We deliberately stringify everything here rather than letting callers
// hand-roll the CSV — keeps the quoting consistent and means one place to
// fix if the export ever needs to switch to TSV or a BOM-prefixed UTF-8
// variant for older Excel versions.

export type CsvCell = string | number | boolean | null | undefined;

function quote(v: CsvCell): string {
  if (v === null || v === undefined) return '""';
  const s = String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

export function buildCsv(headers: string[], rows: CsvCell[][]): string {
  const headerLine = headers.map(quote).join(',');
  const bodyLines = rows.map(r => r.map(quote).join(','));
  return [headerLine, ...bodyLines].join('\r\n');
}

/** Filename helper — "orders-2026-05-25.csv" — keeps Y-M-D so filenames
 *  sort chronologically in Finder / Explorer. */
export function csvFilename(prefix: string): string {
  const d = new Date().toISOString().slice(0, 10);
  return `${prefix}-${d}.csv`;
}
