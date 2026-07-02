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

  // Addon resolution invariants (the one-directional boundary).
  it('resolving an addon pulls its parent base and its own deps', () => {
    const set = resolveDependencies(['data-table/context-menu' as never]);
    expect(set.has('data-table/context-menu' as never)).toBe(true);
    expect(set.has('data-table' as never)).toBe(true);   // parent base
    expect(set.has('context-menu' as never)).toBe(true); // the addon's own dep
  });

  it('resolving a base never auto-pulls its addons or addon-only deps', () => {
    const set = resolveDependencies(['data-table']);
    expect(set.has('data-table')).toBe(true);
    expect(set.has('data-table/context-menu' as never)).toBe(false); // addon stays opt-in
    expect(set.has('context-menu' as never)).toBe(false);            // only the addon needs it
  });
});
