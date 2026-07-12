import { describe, it, expect } from 'vitest';
import { buildComponentRecord } from './why-core.js';
import { getReverseDependents, type ComponentName } from '../registry/index.js';

describe('buildComponentRecord', () => {
  it('lists files, direct and resolved dependencies', () => {
    const record = buildComponentRecord('button' as ComponentName);
    expect(record.files.length).toBeGreaterThan(0);
    expect(record.directDependencies).toContain('ripple');
    expect(record.resolvedDependencies).toContain('button');
    expect(record.resolvedDependencies).toContain('ripple');
  });

  it('includes the transitive reverse-dependents (the same traversal `why` prints)', () => {
    const record = buildComponentRecord('ripple' as ComponentName);
    const expected = [...getReverseDependents('ripple' as ComponentName)].sort((a, b) => a.localeCompare(b));
    expect(record.reverseDependents).toEqual(expected);
    expect(record.reverseDependents).toContain('button');
  });

  it('sorts reverse-dependents alphabetically', () => {
    const record = buildComponentRecord('button' as ComponentName);
    const sorted = [...record.reverseDependents].sort((a, b) => a.localeCompare(b));
    expect(record.reverseDependents).toEqual(sorted);
  });

  it('has no reverse-dependents for a leaf nobody depends on', () => {
    const record = buildComponentRecord('data-table/context-menu' as ComponentName);
    expect(record.reverseDependents).toEqual([]);
  });

  it('surfaces a base component\'s opt-in addons', () => {
    expect(buildComponentRecord('data-table' as ComponentName).addons)
      .toContain('data-table/context-menu');
  });

  it('exposes an addon entry\'s parent, attach and requiresBaseFiles', () => {
    const record = buildComponentRecord('data-table/context-menu' as ComponentName);
    expect(record.type).toBe('addon');
    expect(record.parent).toBe('data-table');
    expect(record.attach?.selector).toBe('uiDtContextMenu');
    expect(record.requiresBaseFiles).toContain('data-table/data-table.host.ts');
  });
});
