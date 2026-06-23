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

  it('keeps a single cell per line when there is no delimiter', () => {
    expect(parseClipboardGrid('one\ntwo')).toEqual([['one'], ['two']]);
  });
});
