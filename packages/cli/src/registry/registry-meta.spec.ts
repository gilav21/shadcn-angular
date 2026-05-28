import { describe, it, expect } from 'vitest';
import { registry, CATEGORIES } from './index.js';

describe('registry metadata shape', () => {
  it('exposes a frozen category taxonomy', () => {
    expect(Array.isArray(CATEGORIES)).toBe(true);
    expect(CATEGORIES).toContain('form');
    expect(CATEGORIES).toContain('charts');
  });

  it('allows optional category/description/tags on entries', () => {
    // button is enriched in Phase 2; here we only assert the fields are
    // type-compatible and that, when present, category is in the taxonomy.
    for (const def of Object.values(registry)) {
      if (def.category !== undefined) {
        expect(CATEGORIES as readonly string[]).toContain(def.category);
      }
      if (def.tags !== undefined) {
        expect(Array.isArray(def.tags)).toBe(true);
      }
    }
  });
});
