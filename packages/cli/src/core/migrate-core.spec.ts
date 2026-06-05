import { describe, it, expect } from 'vitest';
import { planMigration } from './migrate-core.js';

describe('planMigration', () => {
  it('migrates legacy components, refreshes current, and pulls newly-required deps', () => {
    // button depends on ripple; with ripple not installed it becomes a new dep.
    const plan = planMigration({ legacy: ['button'], current: ['badge'] });
    expect(plan.structural).toEqual(['button']);
    expect(plan.refresh).toEqual(['badge']);
    expect(plan.migratedNames.has('button')).toBe(true);
    expect(plan.newDeps).toContain('ripple');
  });

  it('returns an empty structural plan when nothing is legacy', () => {
    const plan = planMigration({ legacy: [], current: ['button', 'ripple'] });
    expect(plan.structural).toEqual([]);
    expect(plan.newDeps).toEqual([]);
    expect(plan.migratedNames.size).toBe(0);
  });
});
