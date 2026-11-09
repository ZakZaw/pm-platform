import { describe, expect, it } from 'vitest';
import { csvEscape, toCsv } from './csv';

describe('csvEscape', () => {
  it('returns an empty string for null and undefined', () => {
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
  });

  it('leaves plain text and numbers alone', () => {
    expect(csvEscape('Fix login')).toBe('Fix login');
    expect(csvEscape(5)).toBe('5');
    expect(csvEscape(-3)).toBe('-3');
  });

  it('quotes cells with commas, quotes and line breaks', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
  });

  it.each([
    ['=HYPERLINK("http://evil","x")', `"'=HYPERLINK(""http://evil"",""x"")"`],
    ['+1+2', "'+1+2"],
    ['-2+3', "'-2+3"],
    ['@SUM(A1)', "'@SUM(A1)"],
    ['\tcmd', "'\tcmd"],
    ['\rcmd', `"'\rcmd"`],
  ])('neutralises formula injection in %j', (input, expected) => {
    expect(csvEscape(input)).toBe(expected);
  });

  it('only checks the first character', () => {
    expect(csvEscape('a=b')).toBe('a=b');
    expect(csvEscape('Email: ada@example.com')).toBe('Email: ada@example.com');
  });
});

describe('toCsv', () => {
  it('joins cells with commas and rows with CRLF', () => {
    expect(toCsv([['a', 'b'], ['1', '2']])).toBe('a,b\r\n1,2');
  });
});