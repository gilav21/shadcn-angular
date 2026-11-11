import { describe, it, expect } from 'vitest';
import { parseClipboardGrid } from './data-table.utils';

describe('parseClipboardGrid (B2)', () => {
  it('returns an empty grid for empty text', () => {
    expect(parseClipboardGrid('')).toEqual([]);
  });

  it('parses a tab-separated grid (the Excel / copy-out format)', () => {
    expect(parseClipboardGrid('a\tb\tc\n1\t2\t3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('drops a single trailing newline', () => {
    expect(parseClipboardGrid('a\tb\n1\t2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('normalizes CRLF and CR line endings', () => {
    expect(parseClipboardGrid('a\tb\r\n1\t2\r3\t4')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('parses comma-separated text when no tabs are present', () => {
    expect(parseClipboardGrid('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('honors quoted CSV cells containing commas and escaped quotes', () => {
    expect(parseClipboardGrid('"a,b","c""d"\n1,2')).toEqual([
      ['a,b', 'c"d'],
      ['1', '2'],
    ]);
  });

  it('keeps a quoted cell with a line break in one cell, tab- or comma-separated (Excel / Sheets)', () => {
    expect(parseClipboardGrid('"a\nb",c\n1,2')).toEqual([['a\nb', 'c'], ['1', '2']]);
    expect(parseClipboardGrid('"a\nb"\tc\n1\t2')).toEqual([['a\nb', 'c'], ['1', '2']]);
    expect(parseClipboardGrid('"say ""hi"""\t"x\ty"\r\n1\t2\r\n')).toEqual([['say "hi"', 'x\ty'], ['1', '2']]);
  });

  it('treats a quote inside a cell as literal text', () => {
    expect(parseClipboardGrid('5" pipe\tb')).toEqual([['5" pipe', 'b']]);
  });

  it('keeps text from a non-quoting source verbatim when a leading quote never closes', () => {
    expect(parseClipboardGrid('"5 inch\tA\n12\tB')).toEqual([['"5 inch', 'A'], ['12', 'B']]);
    expect(parseClipboardGrid('"quoted" text\tA')).toEqual([['"quoted" text', 'A']]);
  });

  it('keeps a single cell per line when there is no delimiter', () => {
    expect(parseClipboardGrid('one\ntwo')).toEqual([['one'], ['two']]);
  });
});
