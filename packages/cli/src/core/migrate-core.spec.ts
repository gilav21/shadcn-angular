import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';
import {
  planMigration,
  rewriteProjectImports,
  deleteLegacyFiles,
  migrateCore,
  migrationUiDir,
  runMigration,
  buildMigrationPlan,
  gitTreeClean,
  envWithoutGitVars,
  detectCustomizedLegacy,
} from './migrate-core.js';
import { getDefaultConfig } from '../utils/config.js';
import { performInstall } from './install.js';
import { detectConflicts } from './plan.js';
import { emptyMergeReport } from './merge.js';
import { hashContent, MANIFEST_VERSION, type ManifestEntry } from './manifest.js';
import { registry, type ComponentName } from '../registry/index.js';

// A pristine legacy file is one whose hash matches a published release, which no
// fabricated fixture can be. `pristine.value` lets a test say "this legacy
// install is untouched" without shipping a historical component source; left
// null, the REAL fingerprint check runs (that is what the customized-component
// tests below rely on).
const { pristine } = vi.hoisted(() => ({ pristine: { value: null as boolean | null } }));

vi.mock('./baseline.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./baseline.js')>();
  return {
    ...actual,
    isPristine: (...args: Parameters<typeof actual.isPristine>): boolean =>
      pristine.value ?? actual.isPristine(...args),
  };
});
// The installer and the conflict scan both hit the network; the migration logic
// under test is what happens AROUND them.
vi.mock('./install.js', () => ({ performInstall: vi.fn() }));
vi.mock('./plan.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./plan.js')>();
  return { ...actual, detectConflicts: vi.fn() };
});

describe('planMigration', () => {
  it('writes the legacy set closure and leaves unrelated folder components alone', () => {
    // button depends on ripple (not installed -> a new dep). badge is an
    // unrelated already-folder component -> left untouched.
    const plan = planMigration({ legacy: ['button'], current: ['badge'] });
    expect(plan.structural).toEqual(['button']);
    expect(plan.writeSet).toContain('button');
    expect(plan.writeSet).toContain('ripple');
    expect(plan.newDeps).toContain('ripple');
    expect(plan.untouched).toEqual(['badge']);
  });

  it('refreshes an already-folder dependency of the legacy set', () => {
    // ripple is button's dep and is already installed as a folder component;
    // migrating button refreshes ripple (it's in the closure), not "untouched".
    const plan = planMigration({ legacy: ['button'], current: ['ripple'] });
    expect(plan.refreshed).toContain('ripple');
    expect(plan.untouched).not.toContain('ripple');
    expect(plan.newDeps).not.toContain('ripple');
  });

  it('returns an empty plan when nothing is legacy', () => {
    const plan = planMigration({ legacy: [], current: ['button', 'ripple'] });
    expect(plan.structural).toEqual([]);
    expect(plan.writeSet).toEqual([]);
    expect(plan.newDeps).toEqual([]);
    expect(plan.untouched).toEqual(['button', 'ripple']);
    expect(plan.customized).toEqual([]);
    expect(plan.blocked).toEqual([]);
  });

  it('migrates a pristine closure and flags a customized leaf only', () => {
    // badge is an unrelated edited leaf; button (deps: ripple) is pristine.
    const plan = planMigration({ legacy: ['button', 'badge'], current: [] }, new Set(['badge']));
    expect(plan.customized).toEqual(['badge']);
    expect(plan.structural).toContain('button');
    expect(plan.structural).not.toContain('badge');
    expect(plan.blocked).toEqual([]);
  });

  it('blocks the dependents of a customized shared dependency', () => {
    // ripple is button's dependency. Editing ripple must defer button: a folder
    // component cannot import a still-flat dependency.
    const plan = planMigration({ legacy: ['button', 'ripple'], current: [] }, new Set(['ripple']));
    expect(plan.customized).toEqual(['ripple']);
    expect(plan.blocked).toContain('button');
    expect(plan.structural).not.toContain('button');
    expect(plan.writeSet).not.toContain('ripple'); // never overwritten
  });

  it('only treats legacy components as customized (a customized name not in the legacy set is ignored)', () => {
    const plan = planMigration({ legacy: ['button'], current: [] }, new Set(['badge']));
    expect(plan.customized).toEqual([]);
    expect(plan.structural).toContain('button');
  });
});

describe('rewriteProjectImports', () => {
  const ALIAS = '@/components/ui';

  it('rewrites in-scope alias imports, skipping node_modules', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mig-'));
    const ui = path.join(dir, 'src/components/ui');
    try {
      await fs.outputFile(
        path.join(dir, 'src/app.component.ts'),
        `import { B } from '@/components/ui/button.component';\n`,
      );
      await fs.outputFile(
        path.join(dir, 'node_modules/x/y.ts'),
        `import { B } from '@/components/ui/button.component';\n`,
      );

      const changed = await rewriteProjectImports(dir, new Set(['button']), ui, ALIAS);

      expect(changed).toHaveLength(1);
      expect(await fs.readFile(path.join(dir, 'src/app.component.ts'), 'utf-8'))
        .toContain(`from '@/components/ui/button'`);
      expect(await fs.readFile(path.join(dir, 'node_modules/x/y.ts'), 'utf-8'))
        .toContain('button.component');
    } finally {
      await fs.remove(dir);
    }
  });

  it('does NOT rewrite a consumer file that merely shares a component name', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mig-'));
    const ui = path.join(dir, 'src/components/ui');
    try {
      // Consumer's own card component, imported relatively from its own folder.
      await fs.outputFile(
        path.join(dir, 'src/features/checkout/page.ts'),
        `import { CheckoutCard } from './card.component';\n`,
      );
      const changed = await rewriteProjectImports(dir, new Set(['card']), ui, ALIAS);
      expect(changed).toEqual([]);
      expect(await fs.readFile(path.join(dir, 'src/features/checkout/page.ts'), 'utf-8'))
        .toContain(`'./card.component'`);
    } finally {
      await fs.remove(dir);
    }
  });

  it('no-ops when there are no migrated names', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mig-'));
    try {
      await fs.outputFile(path.join(dir, 'src/a.ts'), `import { B } from './button.component';\n`);
      const changed = await rewriteProjectImports(dir, new Set(), path.join(dir, 'src/components/ui'), ALIAS);
      expect(changed).toEqual([]);
    } finally {
      await fs.remove(dir);
    }
  });

  it('preserves a component barrel self-reference but rewrites a cross-component sibling import', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mig-'));
    const ui = path.join(dir, 'src/components/ui');
    try {
      // button's own barrel: `./button.component` resolves to button/button.component
      // (the folder's own file, still exists) — must NOT be rewritten.
      await fs.outputFile(path.join(ui, 'button/index.ts'), `export * from './button.component';\n`);
      // A pre-existing folder component importing a now-migrated SIBLING via the
      // old flat path — this MUST be rewritten (`../button.component` → `../button`).
      await fs.outputFile(
        path.join(ui, 'page-builder/page-builder.component.ts'),
        `import { ButtonComponent } from '../button.component';\n`,
      );
      // And an app-code import (outside ui/) — rewritten as before.
      await fs.outputFile(path.join(dir, 'src/app.ts'), `import { B } from '@/components/ui/button.component';\n`);

      const changed = await rewriteProjectImports(dir, new Set(['button']), ui, ALIAS);

      // Barrel self-reference preserved (scope, not a uiDir skip).
      expect(await fs.readFile(path.join(ui, 'button/index.ts'), 'utf-8')).toContain(`'./button.component'`);
      // Cross-component sibling import rewritten.
      expect(await fs.readFile(path.join(ui, 'page-builder/page-builder.component.ts'), 'utf-8'))
        .toContain(`'../button'`);
      // App import rewritten.
      expect(await fs.readFile(path.join(dir, 'src/app.ts'), 'utf-8')).toContain(`'@/components/ui/button'`);
      expect(changed).toHaveLength(2);
    } finally {
      await fs.remove(dir);
    }
  });
});

describe('deleteLegacyFiles', () => {
  it('deletes the legacy flat files for a migrated component only', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'del-'));
    try {
      await fs.outputFile(path.join(dir, 'button.component.ts'), 'x');
      await fs.outputFile(path.join(dir, 'button.component.html'), 'x');
      await fs.outputFile(path.join(dir, 'input.component.ts'), 'x'); // not migrated

      const deleted = await deleteLegacyFiles(dir, ['button']);

      expect(deleted).toContain('button.component.ts');
      expect(deleted).toContain('button.component.html');
      expect(await fs.pathExists(path.join(dir, 'button.component.ts'))).toBe(false);
      expect(await fs.pathExists(path.join(dir, 'input.component.ts'))).toBe(true);
    } finally {
      await fs.remove(dir);
    }
  });
});

describe('migrateCore', () => {
  const config = getDefaultConfig();

  it('reports nothing-to-migrate when no legacy flat component exists', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'migrate-core-'));
    try {
      await fs.ensureDir(migrationUiDir(dir, config));
      const outcome = await migrateCore(dir, config, { branch: 'master' });
      expect(outcome.status).toBe('nothing-to-migrate');
      expect(outcome.execution).toBeUndefined();
    } finally {
      await fs.remove(dir);
    }
  });

  it('returns the plan without writing on a dry run', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'migrate-core-'));
    try {
      const ui = migrationUiDir(dir, config);
      await fs.outputFile(path.join(ui, 'button.component.ts'),
        "@Component({ selector: 'ui-button' }) export class ButtonComponent {}");
      const outcome = await migrateCore(dir, config, { branch: 'master', dryRun: true });
      expect(outcome.status).toBe('dry-run');
      expect(outcome.execution).toBeUndefined();
      // Flat file untouched — a dry run writes nothing.
      expect(await fs.pathExists(path.join(ui, 'button.component.ts'))).toBe(true);
      expect(await fs.pathExists(path.join(ui, 'button'))).toBe(false);
    } finally {
      await fs.remove(dir);
    }
  });

  it('never touches a customized legacy component (nothing-migratable)', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'migrate-core-'));
    try {
      const ui = migrationUiDir(dir, config);
      // Content matches no published release fingerprint -> treated as customized.
      await fs.outputFile(path.join(ui, 'button.component.ts'),
        "@Component({ selector: 'ui-button' }) export class MyEditedButton {}");
      const outcome = await migrateCore(dir, config, { branch: 'master' });
      expect(outcome.status).toBe('nothing-migratable');
      expect(outcome.plan.customized).toContain('button');
      expect(outcome.plan.structural).toEqual([]);
      expect(await fs.readFile(path.join(ui, 'button.component.ts'), 'utf-8')).toContain('MyEditedButton');
    } finally {
      await fs.remove(dir);
    }
  });
});

describe('gitTreeClean', () => {
  it('is true on a committed tree and false once a file is added', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-'));
    try {
      // Without a scrubbed env this `git init` follows the caller's GIT_DIR —
      // under the pre-push hook that is the real repository, which it then
      // re-initialises as bare and breaks for every later git command.
      execSync('git init -q', { cwd: dir, env: envWithoutGitVars() });
      expect(gitTreeClean(dir)).toBe(true);
      fs.outputFileSync(path.join(dir, 'src/a.ts'), 'x');
      expect(gitTreeClean(dir)).toBe(false);
    } finally {
      fs.removeSync(dir);
    }
  });

  it('is false when git cannot run there (no repo) — never a false "clean"', () => {
    expect(gitTreeClean(path.join(os.tmpdir(), 'does-not-exist-migrate-spec'))).toBe(false);
  });
});

describe('migrationUiDir', () => {
  it('resolves the configured ui alias to a project path', () => {
    const config = { ...getDefaultConfig(), aliases: { ...getDefaultConfig().aliases, ui: '@/lib/widgets' } };
    expect(migrationUiDir('/proj', config)).toBe(path.resolve('/proj', 'src/lib/widgets'));
  });
});

describe('detectCustomizedLegacy', () => {
  const { utils } = getDefaultConfig().aliases;

  afterEach(() => {
    pristine.value = null;
  });

  it('flags an edited legacy component (matches no published fingerprint)', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cust-'));
    try {
      await fs.outputFile(path.join(dir, 'button.component.ts'), 'export class MyButton {}');
      const customized = await detectCustomizedLegacy(dir, ['button'] as ComponentName[], 'ui', utils);
      expect([...customized]).toEqual(['button']);
    } finally {
      await fs.remove(dir);
    }
  });

  it('treats an unreadable/absent flat file as customized (conservative — never overwritten)', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cust-'));
    try {
      const customized = await detectCustomizedLegacy(dir, ['button'] as ComponentName[], 'ui', utils);
      expect([...customized]).toEqual(['button']);
    } finally {
      await fs.remove(dir);
    }
  });

  it('leaves a pristine legacy component unflagged', async () => {
    pristine.value = true;
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cust-'));
    try {
      await fs.outputFile(path.join(dir, 'button.component.ts'), 'export class ButtonComponent {}');
      const customized = await detectCustomizedLegacy(dir, ['button'] as ComponentName[], 'ui', utils);
      expect([...customized]).toEqual([]);
    } finally {
      await fs.remove(dir);
    }
  });
});

const config = getDefaultConfig();

function installResult(installed: ComponentName[], skipped: string[] = [], warnings: string[] = []) {
  return {
    installed, skipped, warnings,
    declined: [] as ComponentName[],
    pruned: [] as string[],
    mergeReport: emptyMergeReport(),
  };
}

interface InstallSim {
  /** Names the installer reports as NOT written (a mid-stream failure). */
  omit?: ComponentName[];
  /** Names already identical upstream: on disk, reported as `skipped`. */
  skip?: ComponentName[];
}

/** Stand in for the real installer: write a folder for every component in the
 *  write set (the folders really land on disk), then report `omit` as never
 *  installed and `skip` as skipped-because-identical. */
function installs({ omit = [], skip = [] }: InstallSim = {}): void {
  vi.mocked(performInstall).mockImplementation(async (input) => {
    const uiDir = migrationUiDir(input.cwd, input.config);
    for (const name of input.components) {
      await fs.outputFile(path.join(uiDir, name, `${name}.component.ts`), `export class X${name} {}`);
      await fs.outputFile(path.join(uiDir, name, 'index.ts'), `export * from './${name}.component';`);
    }
    const excluded = new Set<string>([...omit, ...skip]);
    return installResult(input.components.filter(n => !excluded.has(n)), skip);
  });
}

function entry(sha256: string, component: string): ManifestEntry {
  return { sha256, component };
}

async function writeManifestFile(cwd: string, files: Record<string, ManifestEntry>): Promise<void> {
  await fs.outputJson(path.join(cwd, 'components.lock.json'), { version: MANIFEST_VERSION, files });
}

/** A legacy install: a flat button (+ its flat ripple dep) and an app importing it. */
async function legacyProject(): Promise<{ dir: string; ui: string; app: string }> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'run-mig-'));
  const ui = migrationUiDir(dir, config);
  await fs.outputFile(path.join(ui, 'button.component.ts'), "@Component({ selector: 'ui-button' }) export class ButtonComponent {}");
  await fs.outputFile(path.join(ui, 'button.component.html'), '<button></button>');
  const app = path.join(dir, 'src/app.component.ts');
  await fs.outputFile(app, `import { ButtonComponent } from '@/components/ui/button.component';\n`);
  return { dir, ui, app };
}

describe('runMigration', () => {
  beforeEach(() => {
    vi.mocked(detectConflicts).mockResolvedValue({
      toInstall: [], toSkip: [], conflicting: [],
      peerFilesToUpdate: new Set<string>(), contentCache: new Map<string, string>(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    pristine.value = null;
  });

  it('installs exactly the write set, with overwrite forced on', async () => {
    const { dir, ui } = await legacyProject();
    try {
      installs();
      const plan = planMigration({ legacy: ['button'], current: [] });

      await runMigration(plan, dir, ui, config, { branch: 'master' });

      const input = vi.mocked(performInstall).mock.calls[0][0];
      expect(input.components).toEqual(plan.writeSet);
      expect(input.overwrite).toEqual(plan.writeSet);
      expect(input.options.overwrite).toBe(true);
      // Conflicts are precomputed over exactly the write set, so performInstall
      // does not re-resolve and pull in unrelated installed components.
      expect(vi.mocked(detectConflicts).mock.calls[0][0]).toEqual(new Set(plan.writeSet));
      expect(input.precomputedConflicts).toBeDefined();
    } finally {
      await fs.remove(dir);
    }
  });

  it('deletes the flat files and re-points imports once the whole closure is written', async () => {
    const { dir, ui, app } = await legacyProject();
    try {
      installs();
      const plan = planMigration({ legacy: ['button'], current: [] });

      const execution = await runMigration(plan, dir, ui, config, { branch: 'master' });

      expect(execution.migrated).toEqual(['button']);
      expect(execution.failed).toEqual([]);
      expect(execution.deleted).toEqual(['button.component.ts', 'button.component.html']);
      expect(await fs.pathExists(path.join(ui, 'button.component.ts'))).toBe(false);
      expect(execution.rewritten).toEqual([app]);
      expect(await fs.readFile(app, 'utf-8')).toContain(`from '@/components/ui/button'`);
    } finally {
      await fs.remove(dir);
    }
  });

  it('counts a skipped (already up-to-date) dependency as present', async () => {
    const { dir, ui } = await legacyProject();
    try {
      // ripple was identical upstream -> skipped, not installed. It is on disk
      // and fine, so button must still finalize.
      installs({ skip: ['ripple'] as ComponentName[] });
      const plan = planMigration({ legacy: ['button'], current: [] });

      const execution = await runMigration(plan, dir, ui, config, { branch: 'master' });

      expect(execution.migrated).toEqual(['button']);
      expect(execution.failed).toEqual([]);
    } finally {
      await fs.remove(dir);
    }
  });

  it('keeps the working flat file and its imports when a dependency fails to write', async () => {
    const { dir, ui, app } = await legacyProject();
    try {
      // ripple did not install -> finalizing button would delete its working flat
      // file and leave a dangling `../ripple` import, so button stays legacy.
      installs({ omit: ['ripple'] as ComponentName[] });
      const plan = planMigration({ legacy: ['button'], current: [] });

      const execution = await runMigration(plan, dir, ui, config, { branch: 'master' });

      expect(execution.failed).toEqual(['button']);
      expect(execution.migrated).toEqual([]);
      expect(execution.deleted).toEqual([]);
      expect(execution.rewritten).toEqual([]);
      expect(await fs.pathExists(path.join(ui, 'button.component.ts'))).toBe(true);
      expect(await fs.readFile(app, 'utf-8')).toContain('button.component');
    } finally {
      await fs.remove(dir);
    }
  });

  it('rolls back the half-written folder of a new dep that did not install', async () => {
    const { dir, ui } = await legacyProject();
    try {
      // ripple's folder landed on disk but the installer reported it as not
      // installed — leave it and the tree keeps an orphan folder.
      installs({ omit: ['ripple'] as ComponentName[] });
      const plan = planMigration({ legacy: ['button'], current: [] });

      await runMigration(plan, dir, ui, config, { branch: 'master' });

      expect(await fs.pathExists(path.join(ui, 'ripple'))).toBe(false);
      // A component that DID install keeps its folder (nothing to roll back).
      expect(await fs.pathExists(path.join(ui, 'button/index.ts'))).toBe(true);
    } finally {
      await fs.remove(dir);
    }
  });

  it('drops the deleted legacy files from the manifest', async () => {
    const { dir, ui } = await legacyProject();
    try {
      await writeManifestFile(dir, { 'button.component.ts': entry('deadbeef', 'button') });
      installs();

      await runMigration(planMigration({ legacy: ['button'], current: [] }), dir, ui, config, { branch: 'master' });

      const manifest = await fs.readJson(path.join(dir, 'components.lock.json'));
      expect(manifest.files['button.component.ts']).toBeUndefined();
    } finally {
      await fs.remove(dir);
    }
  });

  it('flags a refreshed folder dep that carried local edits (non-blocking heads-up)', async () => {
    const { dir, ui } = await legacyProject();
    try {
      const rippleFile = registry['ripple'].files[0];
      await fs.outputFile(path.join(ui, rippleFile), '// my tweak');
      await writeManifestFile(dir, { [rippleFile]: entry('deadbeef', 'ripple') });
      installs();

      const plan = planMigration({ legacy: ['button'], current: ['ripple'] });
      const execution = await runMigration(plan, dir, ui, config, { branch: 'master' });

      expect(plan.refreshed).toEqual(['ripple']);
      expect(execution.editedRefreshed).toEqual(['ripple']);
    } finally {
      await fs.remove(dir);
    }
  });

  it('does not flag a refreshed dep whose files match the manifest baseline', async () => {
    const { dir, ui } = await legacyProject();
    try {
      const rippleFile = registry['ripple'].files[0];
      const content = '// pristine';
      await fs.outputFile(path.join(ui, rippleFile), content);
      await writeManifestFile(dir, { [rippleFile]: entry(hashContent(content), 'ripple') });
      installs();

      const execution = await runMigration(
        planMigration({ legacy: ['button'], current: ['ripple'] }), dir, ui, config, { branch: 'master' },
      );

      expect(execution.editedRefreshed).toEqual([]);
    } finally {
      await fs.remove(dir);
    }
  });
});

describe('migrateCore (executing path)', () => {
  beforeEach(() => {
    vi.mocked(detectConflicts).mockResolvedValue({
      toInstall: [], toSkip: [], conflicting: [],
      peerFilesToUpdate: new Set<string>(), contentCache: new Map<string, string>(),
    });
    pristine.value = true;
  });

  afterEach(() => {
    vi.clearAllMocks();
    pristine.value = null;
  });

  it('refuses a dirty/absent git tree and writes nothing', async () => {
    const { dir, ui } = await legacyProject();
    try {
      installs();

      const outcome = await migrateCore(dir, config, { branch: 'master' });

      expect(outcome.status).toBe('unclean-tree');
      expect(outcome.plan.structural).toEqual(['button']);
      expect(outcome.execution).toBeUndefined();
      expect(performInstall).not.toHaveBeenCalled();
      expect(await fs.pathExists(path.join(ui, 'button.component.ts'))).toBe(true);
    } finally {
      await fs.remove(dir);
    }
  });

  it('executes with --force on an unclean tree and reports the migration', async () => {
    const { dir, ui } = await legacyProject();
    try {
      installs();
      const seen: string[] = [];

      const outcome = await migrateCore(dir, config, { branch: 'master', force: true }, {
        onBeforeExecute: (plan) => seen.push(...plan.structural),
      });

      expect(seen).toEqual(['button']);
      expect(outcome.status).toBe('migrated');
      expect(outcome.execution?.migrated).toEqual(['button']);
      expect(await fs.pathExists(path.join(ui, 'button.component.ts'))).toBe(false);
      expect(await fs.pathExists(path.join(ui, 'button/index.ts'))).toBe(true);
    } finally {
      await fs.remove(dir);
    }
  });

  it('does not call the onBeforeExecute hook on a dry run', async () => {
    const { dir } = await legacyProject();
    try {
      const hook = vi.fn();
      const outcome = await migrateCore(dir, config, { branch: 'master', dryRun: true }, { onBeforeExecute: hook });

      expect(outcome.status).toBe('dry-run');
      expect(hook).not.toHaveBeenCalled();
      expect(performInstall).not.toHaveBeenCalled();
    } finally {
      await fs.remove(dir);
    }
  });
});

describe('buildMigrationPlan', () => {
  afterEach(() => {
    pristine.value = null;
  });

  it('scans the ui dir and plans the legacy closure', async () => {
    const { dir, ui } = await legacyProject();
    try {
      pristine.value = true;
      const { scan, plan } = await buildMigrationPlan(ui, config);

      expect(scan.legacy).toEqual(['button']);
      expect(plan.structural).toEqual(['button']);
      expect(plan.writeSet).toContain('ripple');
    } finally {
      await fs.remove(dir);
    }
  });
});
