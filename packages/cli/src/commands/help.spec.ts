import { describe, it, expect } from 'vitest';
import { groupByCategory, groupBlocks } from './help.js';
import { registry, getComponentNames, CATEGORIES } from '../registry/index.js';

describe('groupByCategory', () => {
  it('buckets every non-block component under its category', () => {
    const groups = groupByCategory();
    const total = Object.values(groups).reduce((n, list) => n + list.length, 0);
    const nonBlockCount = getComponentNames().filter(n => registry[n].type !== 'block').length;
    expect(total).toBe(nonBlockCount);
  });

  it('only uses categories from the taxonomy', () => {
    const groups = groupByCategory();
    for (const key of Object.keys(groups)) {
      expect(CATEGORIES as readonly string[]).toContain(key);
    }
  });

  it('excludes blocks from component category groups', () => {
    const groups = groupByCategory();
    for (const list of Object.values(groups)) {
      for (const name of list) expect(registry[name as keyof typeof registry].type).not.toBe('block');
    }
  });

  it('places button under navigation and sorts entries', () => {
    const groups = groupByCategory();
    expect(groups['navigation']).toContain('button');
    const nav = groups['navigation'];
    expect([...nav].sort((a, b) => a.localeCompare(b))).toEqual(nav);
  });
});

describe('groupBlocks', () => {
  it('only contains block entries', () => {
    const groups = groupBlocks();
    for (const list of Object.values(groups)) {
      for (const name of list) expect(registry[name as keyof typeof registry].type).toBe('block');
    }
  });
});
