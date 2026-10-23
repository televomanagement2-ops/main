// ─────────────────────────────────────────────────────────────────────────────
// CSV — writing files a spreadsheet opens correctly, and reading them back.
//
// Excel decides how to split a .csv by the computer's regional settings: in
// Italian, Spanish or French it expects ";" between fields and "," in
// numbers, and a comma-separated file opens as a single column. Exports
// therefore follow the admin's language; imports detect the separator.
// ─────────────────────────────────────────────────────────────────────────────

export interface CsvDialect {
  delimiter: ',' | ';';
  decimal: '.' | ',';
}

export const COMMA_DIALECT: CsvDialect = { delimiter: ',', decimal: '.' };
export const SEMICOLON_DIALECT: CsvDialect = { delimiter: ';', decimal: ',' };

/** The dialect a spreadsheet in this locale expects. */
export function dialectForLocale(locale: string): CsvDialect {
  return /^(it|es|fr|de|pt|nl)\b/i.test(locale) ? SEMICOLON_DIALECT : COMMA_DIALECT;
}

export type CsvCell = string | number | boolean | null | undefined;

/** A number as the dialect writes it, without thousands separators. */
export function csvNumber(value: number | null | undefined, decimals: number | null, dialect: CsvDialect): string {
  if (value == null || !Number.isFinite(Number(value))) return '';
  const text = decimals == null ? String(Number(value)) : Number(value).toFixed(decimals);
  return dialect.decimal === ',' ? text.replace('.', ',') : text;
}

// A cell starting with one of these is run as a formula by spreadsheet apps
// ("CSV injection"); exported text — a product name, a customer's address —
// must never execute. Prefixing an apostrophe makes it plain text.
const FORMULA_START = /^[=+\-@\t\r]/;

function cellText(cell: CsvCell, dialect: CsvDialect): string {
  if (cell == null) return '';
  if (typeof cell === 'number') return csvNumber(cell, null, dialect);
  if (typeof cell === 'boolean') return cell ? 'yes' : 'no';
  return FORMULA_START.test(cell) ? `'${cell}` : cell;
}

/** Rows → CSV text (with a byte-order mark, so Excel reads it as UTF-8). */
export function toCsv(rows: readonly (readonly CsvCell[])[], dialect: CsvDialect): string {
  const needsQuotes = new RegExp(`["\\r\\n${dialect.delimiter}]|^\\s|\\s$`);
  const lines = rows.map((row) =>
    row
      .map((cell) => {
        const text = cellText(cell, dialect);
        return needsQuotes.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
      })
      .join(dialect.delimiter),
  );
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

/** Splits CSV text into rows of cells (RFC 4180: quotes, doubled quotes, line breaks in quotes). */
export function parseCsv(text: string): { rows: string[][]; delimiter: string } {
  const source = text.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(source);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && cell === '') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return {
    rows: rows
      .map((r) => r.map(unescapeCell))
      .filter((r) => r.some((c) => c.trim() !== '')),
    delimiter,
  };
}

/** The separator of the header line: whichever of , ; tab appears most outside quotes. */
function detectDelimiter(text: string): string {
  const firstLine: string[] = [];
  let quoted = false;
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    if (!quoted && (ch === '\n' || ch === '\r')) break;
    if (!quoted) firstLine.push(ch);
  }
  const count = (c: string) => firstLine.filter((x) => x === c).length;
  const candidates: [string, number][] = [[',', count(',')], [';', count(';')], ['\t', count('\t')]];
  candidates.sort((a, b) => b[1] - a[1]);
  return candidates[0][1] > 0 ? candidates[0][0] : ',';
}

/** Undo the apostrophe our own export puts before formula-like text. */
function unescapeCell(cell: string): string {
  return /^'[=+\-@]/.test(cell) ? cell.slice(1) : cell;
}

/**
 * A number from a spreadsheet cell, written with "." or "," as decimals:
 * "12.5", "12,5", "1.234,56", "1,234.56". '' → null; anything else → NaN.
 */
export function parseCsvNumber(raw: string): number | null {
  let text = raw.trim().replace(/\s/g, '');
  if (text === '') return null;
  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // The separator used last is the decimal one; the other groups thousands.
    text = lastComma > lastDot ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  } else if (lastComma > -1) {
    text = text.replace(',', '.');
  }
  return /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : Number.NaN;
}

const TRUE_WORDS = ['yes', 'y', 'true', '1', 'si', 'sì', 'sí', 'oui', 'x'];
const FALSE_WORDS = ['no', 'n', 'false', '0', 'non'];

/** yes/no in a cell ('' → null; anything unrecognised → undefined). */
export function parseCsvBoolean(raw: string): boolean | null | undefined {
  const text = raw.trim().toLowerCase();
  if (text === '') return null;
  if (TRUE_WORDS.includes(text)) return true;
  if (FALSE_WORDS.includes(text)) return false;
  return undefined;
}

/** Offers the text as a file download. */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "orders-2026-10-23.csv" */
export function datedFilename(prefix: string, date = new Date()): string {
  return `${prefix}-${date.toISOString().slice(0, 10)}.csv`;
}
