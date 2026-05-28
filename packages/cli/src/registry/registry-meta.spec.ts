import { describe, it, expect } from 'vitest';
import { registry, CATEGORIES } from './index.js';

describe('registry metadata shape', () => {
  it('exposes a frozen category taxonomy', () => {
    expect(Array.isArray(CATEGORIES)).toBe(true);
    expect(CATEGORIES).toContain('form');
    expect(CATEGORIES).toContain('charts');
  });

  it('every component has category + description + >=3 tags', () => {
    for (const [name, def] of Object.entries(registry)) {
      expect(def.category, `${name}.category`).toBeDefined();
      expect(CATEGORIES as readonly string[]).toContain(def.category);
      expect(def.description, `${name}.description`).toBeTruthy();
      expect((def.description ?? '').length, `${name}.description length`).toBeLessThanOrEqual(140);
      expect((def.tags ?? []).length, `${name}.tags`).toBeGreaterThanOrEqual(3);
    }
  });
});
