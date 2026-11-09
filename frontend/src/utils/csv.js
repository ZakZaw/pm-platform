// Characters that make Excel / Sheets / LibreOffice treat a cell as a
// formula (or a DDE payload) when the CSV is opened.
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Escape one CSV cell (RFC 4180 quoting) and neutralise spreadsheet
 * formula injection: text cells that start with = + - @ tab or CR are
 * prefixed with a single quote so a task titled `=HYPERLINK(...)` opens as
 * text, not a live formula. Numbers pass through unchanged.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function csvEscape(value) {
  if (value == null) return '';
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);

  let s = String(value);
  if (s.length > 0 && FORMULA_TRIGGERS.includes(s[0])) s = `'${s}`;
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Join rows of already-escaped cells into a CSV document.
 *
 * @param {Array<Array<string|number>>} rows
 * @returns {string}
 */
export function toCsv(rows) {
  return rows.map((r) => r.join(',')).join('\r\n');
}