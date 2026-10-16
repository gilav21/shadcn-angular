import { describe, it, expect, afterEach } from 'vitest';
import { resolveDependencies, UnknownComponentError } from './resolve.js';
import { registry, type ComponentDefinition, type ComponentName } from '../registry/index.js';

const mutable = registry as unknown as Record<string, ComponentDefinition>;

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

  it('follows a multi-level chain, across several requested components', () => {
    // date-picker -> calendar -> button -> ripple
    const set = resolveDependencies(['date-picker', 'sparkles']);
    for (const name of ['date-picker', 'calendar', 'select', 'button', 'ripple', 'sparkles']) {
      expect(set.has(name as never), name).toBe(true);
    }
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

  describe('with an in-memory entry the loader never validated', () => {
    afterEach(() => {
      delete mutable['fixture-a'];
    });

    // A dangling dependency, and an inherited name asked for directly — an `in`
    // or bare-index lookup finds `constructor` on Object.prototype.
    it.each([
      { requested: 'fixture-a', message: 'Unknown component "fixture-b" (required by "fixture-a")' },
      { requested: 'constructor', message: 'Unknown component "constructor"' },
    ])('resolveDependencies throws UnknownComponentError naming the missing dependency and its dependent: $requested', ({ requested, message }) => {
      mutable['fixture-a'] = {
        name: 'fixture-a',
        files: ['fixture-a/fixture-a.component.ts'],
        dependencies: ['badge', 'fixture-b'],
      };

      const resolve = (): unknown => resolveDependencies([requested as ComponentName]);

      expect(resolve).toThrow(UnknownComponentError);
      expect(resolve).toThrow(message);
    });
  });
});
