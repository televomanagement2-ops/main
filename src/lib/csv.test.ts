import { describe, expect, it } from 'vitest';
import {
  COMMA_DIALECT,
  SEMICOLON_DIALECT,
  csvNumber,
  dialectForLocale,
  parseCsv,
  parseCsvBoolean,
  parseCsvNumber,
  toCsv,
} from './csv';

describe('toCsv', () => {
  it('writes a BOM, CRLF lines and quotes only what needs quoting', () => {
    const text = toCsv([['a', 'b,c', 'say "hi"', 'line\nbreak', 3.5, true, null]], COMMA_DIALECT);
    expect(text).toBe('\uFEFFa,"b,c","say ""hi""","line\nbreak",3.5,yes,\r\n');
  });

  it('uses ; and decimal commas for an Italian spreadsheet', () => {
    expect(dialectForLocale('it-IT')).toEqual(SEMICOLON_DIALECT);
    expect(dialectForLocale('en-US')).toEqual(COMMA_DIALECT);
    expect(toCsv([['x;y', 12.5]], SEMICOLON_DIALECT)).toBe('\uFEFF"x;y";12,5\r\n');
    expect(csvNumber(3, 2, SEMICOLON_DIALECT)).toBe('3,00');
  });

  it('neutralises text a spreadsheet would run as a formula, but not numbers', () => {
    expect(toCsv([['=HYPERLINK("x")', '+1', '@cmd', -5]], COMMA_DIALECT)).toBe(
      "\uFEFF\"'=HYPERLINK(\"\"x\"\")\",'+1,'@cmd,-5\r\n",
    );
  });
});

describe('parseCsv', () => {
  it('reads back what toCsv writes, in either dialect', () => {
    const rows = [
      ['handle', 'name', 'price'],
      ['tee', 'Tee, "classic"', '12,5'],
      ['mug', 'Mug\nwhite', '=1+1'],
    ];
    for (const dialect of [COMMA_DIALECT, SEMICOLON_DIALECT]) {
      const parsed = parseCsv(toCsv(rows, dialect));
      expect(parsed.delimiter).toBe(dialect.delimiter);
      expect(parsed.rows).toEqual(rows);
    }
  });

  it('skips blank lines and handles a final line without a newline', () => {
    expect(parseCsv('a,b\n\n1,2').rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('detects a tab-separated file', () => {
    expect(parseCsv('a\tb\n1\t2\n').rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('cell parsers', () => {
  it('reads numbers with either decimal mark', () => {
    expect(parseCsvNumber('12.5')).toBe(12.5);
    expect(parseCsvNumber('12,5')).toBe(12.5);
    expect(parseCsvNumber('1.234,56')).toBe(1234.56);
    expect(parseCsvNumber('1,234.56')).toBe(1234.56);
    expect(parseCsvNumber('-3')).toBe(-3);
    expect(parseCsvNumber('')).toBeNull();
    expect(parseCsvNumber('12 eur')).toBeNaN();
  });

  it('reads yes/no in several languages', () => {
    expect(parseCsvBoolean('Sì')).toBe(true);
    expect(parseCsvBoolean('oui')).toBe(true);
    expect(parseCsvBoolean('NO')).toBe(false);
    expect(parseCsvBoolean('')).toBeNull();
    expect(parseCsvBoolean('maybe')).toBeUndefined();
  });
});
