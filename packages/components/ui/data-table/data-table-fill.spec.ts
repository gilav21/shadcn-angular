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

  it('cycles non-string values that match no numeric, date, or name series', () => {
    expect(buildFillValues([true, false], 3)).toEqual([true, false, true]);
  });

  it('cycles trailing-number text when the prefixes differ', () => {
    expect(buildFillValues(['A1', 'B2'], 3)).toEqual(['A1', 'B2', 'A1']);
  });

  it('cycles weekday names when the step is inconsistent', () => {
    expect(buildFillValues(['Mon', 'Tue', 'Thu'], 4)).toEqual(['Mon', 'Tue', 'Thu', 'Mon']);
  });

  it('cycles a repeated name whose step resolves to zero', () => {
    expect(buildFillValues(['Mon', 'Mon'], 2)).toEqual(['Mon', 'Mon']);
  });

  it('cycles Date objects when the day step is not constant', () => {
    const source = [new Date(2024, 0, 1), new Date(2024, 0, 3), new Date(2024, 0, 4)];
    const out = buildFillValues(source, 2) as Date[];
    expect(out).toEqual([source[0], source[1]]);
  });

  it('cycles an invalid Date object that cannot form a series', () => {
    const invalid = new Date(Number.NaN);
    const out = buildFillValues([invalid], 2) as Date[];
    expect(out).toHaveLength(2);
    expect(out[0]).toBe(invalid);
  });

  it('renders negative trailing numbers with a leading minus sign', () => {
    expect(buildFillValues(['Item 2', 'Item 1'], 3)).toEqual(['Item 0', 'Item -1', 'Item -2']);
  });

  describe('ISO date strings', () => {
    it('steps by day', () => {
      expect(buildFillValues(['2024-01-01', '2024-01-02'], 2)).toEqual(['2024-01-03', '2024-01-04']);
    });

    it('detects a weekly (7-day) step', () => {
      expect(buildFillValues(['2024-01-01', '2024-01-08'], 2)).toEqual(['2024-01-15', '2024-01-22']);
    });

    it('rolls a single date forward by one day across a month boundary (leap year)', () => {
      expect(buildFillValues(['2024-02-28'], 2)).toEqual(['2024-02-29', '2024-03-01']);
    });

    it('steps by month when the day-of-month is constant', () => {
      expect(buildFillValues(['2024-01-15', '2024-02-15'], 2)).toEqual(['2024-03-15', '2024-04-15']);
    });

    it('clamps the day when stepping into a shorter month', () => {
      expect(buildFillValues(['2024-01-31', '2024-03-31'], 1)).toEqual(['2024-05-31']);
    });
  });

  describe('Date objects', () => {
    it('steps by day and returns Date objects', () => {
      const out = buildFillValues([new Date(2024, 0, 1), new Date(2024, 0, 2)], 2) as Date[];
      expect(out.every((d) => d instanceof Date)).toBe(true);
      expect(out.map((d) => d.getDate())).toEqual([3, 4]);
    });
  });

  describe('weekday names', () => {
    it('steps abbreviated weekdays', () => {
      expect(buildFillValues(['Mon', 'Tue'], 2)).toEqual(['Wed', 'Thu']);
    });

    it('wraps full weekday names', () => {
      expect(buildFillValues(['Friday', 'Saturday'], 2)).toEqual(['Sunday', 'Monday']);
    });

    it('preserves lower casing', () => {
      expect(buildFillValues(['mon', 'tue'], 2)).toEqual(['wed', 'thu']);
    });
  });

  describe('month names', () => {
    it('steps abbreviated months', () => {
      expect(buildFillValues(['Jan', 'Feb'], 2)).toEqual(['Mar', 'Apr']);
    });

    it('wraps and preserves upper casing for a single full month', () => {
      expect(buildFillValues(['DECEMBER'], 2)).toEqual(['JANUARY', 'FEBRUARY']);
    });
  });
});
