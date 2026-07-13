import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { migrate, closureWritten } from './migrate.js';
import {
  migrateCore,
  gitTreeClean,
  type MigrationPlan,
  type MigrationExecution,
  type MigrateOutcome,
} from '../core/migrate-core.js';
import { getConfig, getDefaultConfig } from '../utils/config.js';
import { emptyMergeReport } from '../core/merge.js';
import { type ComponentName } from '../registry/index.js';

const { spinner } = vi.hoisted(() => ({ spinner: { start: vi.fn(), stop: vi.fn() } }));

vi.mock('ora', () => ({ default: vi.fn(() => spinner) }));
// Only the two side-effecting entry points are stubbed; `closureWritten` (tested
// below) stays the real implementation.
vi.mock('../core/migrate-core.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../core/migrate-core.js')>();
  return { ...actual, migrateCore: vi.fn(), gitTreeClean: vi.fn(() => true) };
});
vi.mock('../utils/config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/config.js')>();
  return { ...actual, getConfig: vi.fn() };
});

// button depends on ripple; both are in the write set when migrating button.
const plan: MigrationPlan = {
  structural: ['button'] as ComponentName[],
  writeSet: ['button', 'ripple'] as ComponentName[],
  newDeps: ['ripple'] as ComponentName[],
  refreshed: [] as ComponentName[],
  untouched: [] as ComponentName[],
  customized: [] as ComponentName[],
  blocked: [] as ComponentName[],
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

/** The npm name the CLI actually ships under. The unscoped `shadcn-angular` is
 *  someone else's package — telling a user to run it is a real bug, so every
 *  command-line the migrate copy prints is pinned to the scoped name. */
const PACKAGE = '@gilav21/shadcn-angular';

const protectedPlan: MigrationPlan = {
  structural: [] as ComponentName[],
  writeSet: [] as ComponentName[],
  newDeps: [] as ComponentName[],
  refreshed: [] as ComponentName[],
  untouched: [] as ComponentName[],
  customized: ['button'] as ComponentName[],
  blocked: ['card'] as ComponentName[],
};

function makeExecution(overrides: Partial<MigrationExecution> = {}): MigrationExecution {
  return {
    result: {
      installed: ['button', 'ripple'] as ComponentName[],
      skipped: [],
      declined: [] as ComponentName[],
      pruned: [],
      warnings: [],
      mergeReport: emptyMergeReport(),
    },
    migrated: ['button'] as ComponentName[],
    failed: [] as ComponentName[],
    deleted: ['button.component.ts', 'button.component.html'],
    rewritten: ['src/app.component.ts'],
    editedRefreshed: [] as ComponentName[],
    ...overrides,
  };
}

describe('migrate (command)', () => {
  const logs: string[] = [];
  const output = (): string => logs.join('\n');

  function mockOutcome(outcome: MigrateOutcome): void {
    vi.mocked(migrateCore).mockResolvedValue(outcome);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    logs.length = 0;
    vi.mocked(getConfig).mockResolvedValue(getDefaultConfig());
    vi.mocked(gitTreeClean).mockReturnValue(true);
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    });
    vi.spyOn(process, 'exit').mockImplementation((code?: number): never => {
      throw new Error(`process.exit(${code})`);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exits 1 when components.json is missing and never runs the migration', async () => {
    vi.mocked(getConfig).mockResolvedValue(null);

    await expect(migrate({ branch: 'master' })).rejects.toThrow('process.exit(1)');

    expect(output()).toContain('components.json not found');
    expect(output()).toContain(`npx ${PACKAGE} init`);
    expect(migrateCore).not.toHaveBeenCalled();
  });

  it('falls back to the registry recorded in components.json', async () => {
    vi.mocked(getConfig).mockResolvedValue({ ...getDefaultConfig(), registry: 'https://mirror.test/components' });
    mockOutcome({ status: 'nothing-to-migrate', plan });

    await migrate({ branch: 'master' });

    expect(vi.mocked(migrateCore).mock.calls[0][2].registry).toBe('https://mirror.test/components');
  });

  it('keeps an explicit --registry over the one in components.json', async () => {
    vi.mocked(getConfig).mockResolvedValue({ ...getDefaultConfig(), registry: 'https://mirror.test/components' });
    mockOutcome({ status: 'nothing-to-migrate', plan });

    await migrate({ branch: 'master', registry: 'https://fork.test/components' });

    expect(vi.mocked(migrateCore).mock.calls[0][2].registry).toBe('https://fork.test/components');
  });

  it('reports nothing-to-migrate without starting the spinner', async () => {
    mockOutcome({ status: 'nothing-to-migrate', plan });

    await migrate({ branch: 'master' });

    expect(output()).toContain('Nothing to migrate');
    expect(spinner.start).not.toHaveBeenCalled();
  });

  it('prints the plan and states that nothing was written on a dry run', async () => {
    mockOutcome({ status: 'dry-run', plan });

    await migrate({ branch: 'master', dryRun: true });

    expect(output()).toContain('Convert to folder layout: button');
    expect(output()).toContain('Install new dependencies: ripple');
    expect(output()).toContain('[Dry Run] No changes written.');
    expect(spinner.start).not.toHaveBeenCalled();
  });

  it('lists refreshed and untouched components in the plan', async () => {
    mockOutcome({
      status: 'dry-run',
      plan: {
        ...plan,
        newDeps: [] as ComponentName[],
        refreshed: ['ripple'] as ComponentName[],
        untouched: ['badge'] as ComponentName[],
      },
    });

    await migrate({ branch: 'master', dryRun: true });

    expect(output()).toContain('Refresh required deps: ripple');
    expect(output()).toContain('Left as-is (run `update` to refresh): badge');
    expect(output()).not.toContain('Install new dependencies');
  });

  it('reassures (not errors) when every legacy component is protected', async () => {
    mockOutcome({ status: 'nothing-migratable', plan: protectedPlan });

    await migrate({ branch: 'master' });

    expect(output()).toContain('nothing to migrate automatically');
    expect(output()).toContain('kept these exactly as they are');
    expect(output()).toContain('button');
    expect(output()).toContain('Held back for now');
    expect(output()).toContain('card');
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('tells the user to migrate a customized component with the SCOPED package name', async () => {
    mockOutcome({ status: 'nothing-migratable', plan: protectedPlan });

    await migrate({ branch: 'master' });

    expect(output()).toContain(`npx ${PACKAGE} add <name> --overwrite`);
    // The unscoped `npx shadcn-angular` is a different, foreign npm package.
    expect(output()).not.toMatch(/npx shadcn-angular/);
  });

  it('refuses an unclean git tree with exit code 1', async () => {
    mockOutcome({ status: 'unclean-tree', plan });

    await expect(migrate({ branch: 'master' })).rejects.toThrow('process.exit(1)');

    expect(output()).toContain('git working tree is not clean');
    expect(output()).toContain('--force');
  });

  it('prints the backup notice and plan before writing, and stops the spinner after', async () => {
    vi.mocked(migrateCore).mockImplementation(async (_cwd, _config, _options, hooks) => {
      hooks?.onBeforeExecute?.(plan);
      return { status: 'migrated', plan, execution: makeExecution() };
    });

    await migrate({ branch: 'master' });

    expect(output()).toContain('Before we start:');
    expect(output()).toContain('Convert to folder layout: button');
    expect(spinner.start).toHaveBeenCalledWith('Migrating...');
    expect(spinner.stop).toHaveBeenCalled();
    expect(output()).not.toContain('--force: proceeding');
  });

  it('warns that --force removes the git backstop only when the tree is actually dirty', async () => {
    vi.mocked(gitTreeClean).mockReturnValue(false);
    vi.mocked(migrateCore).mockImplementation(async (_cwd, _config, _options, hooks) => {
      hooks?.onBeforeExecute?.(plan);
      return { status: 'migrated', plan, execution: makeExecution() };
    });

    await migrate({ branch: 'master', force: true });

    expect(output()).toContain('--force: proceeding on an unclean working tree.');
    expect(output()).toContain('may be overwritten');
  });

  it('reports what was migrated, rewritten, deleted and pulled', async () => {
    mockOutcome({ status: 'migrated', plan, execution: makeExecution() });

    await migrate({ branch: 'master' });

    expect(output()).toContain('Migrated 2 component(s) to the folder layout.');
    expect(output()).toContain('Updated imports in 1 file(s); removed 2 legacy file(s).');
    expect(output()).toContain('Pulled new dependencies: ripple');
    expect(output()).toContain('git diff');
  });

  it('surfaces install warnings and refreshed deps that carried local edits', async () => {
    const execution = makeExecution({
      editedRefreshed: ['card'] as ComponentName[],
      result: { ...makeExecution().result, warnings: ['peer file lib/utils.ts updated'] },
    });
    mockOutcome({ status: 'migrated', plan: { ...plan, refreshed: ['card'] as ComponentName[] }, execution });

    await migrate({ branch: 'master' });

    expect(output()).toContain('Refreshed these shared dependencies');
    expect(output()).toContain('card');
    expect(output()).toContain('peer file lib/utils.ts updated');
  });

  it('reports components left as legacy after a partial failure', async () => {
    const execution = makeExecution({
      migrated: [] as ComponentName[],
      failed: ['button'] as ComponentName[],
      deleted: [],
      rewritten: [],
    });
    mockOutcome({ status: 'migrated', plan, execution });

    await migrate({ branch: 'master' });

    expect(output()).toContain('1 component(s) could not be migrated and were left as legacy: button');
    expect(output()).toContain('Their flat files and imports are untouched.');
  });

  it('says nothing about failures when every component migrated', async () => {
    mockOutcome({ status: 'migrated', plan, execution: makeExecution() });

    await migrate({ branch: 'master' });

    expect(output()).not.toContain('could not be migrated');
  });
});
