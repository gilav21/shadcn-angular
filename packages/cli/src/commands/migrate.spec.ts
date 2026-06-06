import { describe, it, expect } from 'vitest';
import { closureWritten } from './migrate.js';
import { type MigrationPlan } from '../core/migrate-core.js';
import { type ComponentName } from '../registry/index.js';

// button depends on ripple; both are in the write set when migrating button.
const plan: MigrationPlan = {
  structural: ['button'] as ComponentName[],
  writeSet: ['button', 'ripple'] as ComponentName[],
  newDeps: ['ripple'] as ComponentName[],
  refreshed: [] as ComponentName[],
  untouched: [] as ComponentName[],
};

describe('closureWritten', () => {
  it('is false when an in-writeSet dependency is absent (partial failure)', () => {
    // ripple failed to write — finalizing button would delete its working flat
    // file and leave a dangling `../ripple` import.
    expect(closureWritten('button' as ComponentName, plan, new Set(['button'] as ComponentName[]))).toBe(false);
  });

  it('is true when the component and all its deps are present', () => {
    expect(closureWritten('button' as ComponentName, plan, new Set(['button', 'ripple'] as ComponentName[]))).toBe(true);
  });

  it('ignores deps that are not part of this migration (already on disk)', () => {
    // A plan whose writeSet is just the component itself: an external dep that
    // isn't being migrated must not block finalization.
    const soloPlan: MigrationPlan = { ...plan, writeSet: ['button'] as ComponentName[] };
    expect(closureWritten('button' as ComponentName, soloPlan, new Set(['button'] as ComponentName[]))).toBe(true);
  });
});
