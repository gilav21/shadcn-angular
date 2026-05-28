import { describe, it, expect } from 'vitest';
import { resolveDependencies } from './resolve.js';
import { registry } from '../registry/index.js';

describe('resolveDependencies', () => {
  it('includes the component itself', () => {
    expect(resolveDependencies(['badge']).has('badge')).toBe(true);
  });

  it('pulls in transitive dependencies', () => {
    // button -> ripple (see registry)
    const set = resolveDependencies(['button']);
    expect(set.has('button')).toBe(true);
    for (const dep of registry['button'].dependencies ?? []) {
      expect(set.has(dep as never)).toBe(true);
    }
  });

  it('is idempotent for diamond dependencies', () => {
    const set = resolveDependencies(['autocomplete']); // -> badge, command, popover
    expect(set.has('autocomplete')).toBe(true);
    expect(set.has('command')).toBe(true);
  });
});
