import { describe, it, expect } from 'vitest';
import { groupByCategory } from './help.js';
import { registry, CATEGORIES } from '../registry/index.js';

describe('groupByCategory', () => {
  it('buckets every registry component under its category', () => {
    const groups = groupByCategory();
    const total = Object.values(groups).reduce((n, list) => n + list.length, 0);
    expect(total).toBe(Object.keys(registry).length);
  });

  it('only uses categories from the taxonomy', () => {
    const groups = groupByCategory();
    for (const key of Object.keys(groups)) {
      expect(CATEGORIES as readonly string[]).toContain(key);
    }
  });

  it('places button under navigation and sorts entries', () => {
    const groups = groupByCategory();
    expect(groups['navigation']).toContain('button');
    const nav = groups['navigation'];
    expect([...nav].sort((a, b) => a.localeCompare(b))).toEqual(nav);
  });
});
