import { describe, it, expect } from 'vitest';
import { searchComponents } from './search.js';

describe('searchComponents', () => {
  it('returns [] for an empty query', () => {
    expect(searchComponents('')).toEqual([]);
    expect(searchComponents('   ')).toEqual([]);
  });

  it('ranks an exact name match first', () => {
    const hits = searchComponents('button');
    expect(hits[0].name).toBe('button');
    expect(hits[0].score).toBe(100);
  });

  it('finds fuzzy matches for typos', () => {
    const hits = searchComponents('buton');
    expect(hits.some(h => h.name === 'button')).toBe(true);
  });

  it('respects the result limit', () => {
    const hits = searchComponents('a', 3);
    expect(hits.length).toBeLessThanOrEqual(3);
  });
});
