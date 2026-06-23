import { describe, it, expect } from 'vitest';
import { buildFillValues } from './data-table.utils';

describe('buildFillValues (B1 fill series)', () => {
  it('returns nothing for a non-positive count', () => {
    expect(buildFillValues([1, 2], 0)).toEqual([]);
    expect(buildFillValues([1, 2], -3)).toEqual([]);
  });

  it('extrapolates an arithmetic number series', () => {
    expect(buildFillValues([1, 2, 3], 3)).toEqual([4, 5, 6]);
    expect(buildFillValues([2, 4], 3)).toEqual([6, 8, 10]);
    expect(buildFillValues([10, 7], 2)).toEqual([4, 1]);
  });

  it('repeats a single number (no detectable step)', () => {
    expect(buildFillValues([5], 3)).toEqual([5, 5, 5]);
  });

  it('increments a trailing number in text with a shared prefix', () => {
    expect(buildFillValues(['Item 1', 'Item 2'], 2)).toEqual(['Item 3', 'Item 4']);
    expect(buildFillValues(['Q1'], 3)).toEqual(['Q2', 'Q3', 'Q4']);
  });

  it('preserves zero-padding when incrementing trailing numbers', () => {
    expect(buildFillValues(['SKU-008', 'SKU-009'], 2)).toEqual(['SKU-010', 'SKU-011']);
  });

  it('cycles non-numeric, non-trailing values', () => {
    expect(buildFillValues(['red', 'green'], 4)).toEqual(['red', 'green', 'red', 'green']);
  });

  it('returns empty strings when the source is empty', () => {
    expect(buildFillValues([], 2)).toEqual(['', '']);
  });
});
