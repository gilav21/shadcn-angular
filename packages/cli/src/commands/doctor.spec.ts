import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import fs from 'fs-extra';
import {
  collectDoctorReport, classifyDrift, buildFixPlan, doctorFixCore, installedComponents,
  doctor, refreshLibCore, type DoctorReport,
} from './doctor.js';
import { registry, getComponentNames } from '../registry/index.js';
import { getConfig, getDefaultConfig, type Config } from '../utils/config.js';
import { performInstall } from '../core/install.js';
import { installPackages } from '../utils/package-manager.js';
import { scanLayouts } from '../core/layout.js';
import { collectLibDrift, refreshLibFiles } from '../core/lib-reconcile.js';
import { collectStaleReport, rewriteMovedImports } from '../core/clean-reinstall.js';
import { hashContent, type Manifest } from '../core/manifest.js';

vi.mock('fs-extra', () => ({
  default: {
    pathExists: vi.fn(), readFile: vi.fn(), readJson: vi.fn(async () => ({})),
    remove: vi.fn(async () => undefined), writeJson: vi.fn(async () => undefined),
  },
}));
vi.mock('../core/fetch.js', () => ({
  fetchAndTransform: vi.fn(async () => 'REMOTE'),
  normalizeContent: (s: string) => s.replaceAll('\r\n', '\n').trim(),
}));
vi.mock('../core/install.js', () => ({
  performInstall: vi.fn(async () => ({ installed: ['button', 'card'], skipped: [], declined: [], pruned: [], warnings: [] })),
}));
vi.mock('../utils/package-manager.js', () => ({
  installPackages: vi.fn(async () => undefined),
}));
vi.mock('../utils/config.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('../utils/config.js')>(),
  getConfig: vi.fn(),
}));
vi.mock('../core/layout.js', () => ({
  scanLayouts: vi.fn(async () => ({ legacy: [], current: [] })),
}));
vi.mock('../core/lib-reconcile.js', () => ({
  collectLibDrift: vi.fn(async () => ({ stale: [], missing: [], userEdited: [] })),
  refreshLibFiles: vi.fn(async () => ({ refreshed: [], warnings: [] })),
}));
vi.mock('../core/clean-reinstall.js', () => ({
  collectStaleReport: vi.fn(async () => ({ entries: [] })),
  rewriteMovedImports: vi.fn(async () => []),
}));
vi.mock('../core/breaking-scan.js', () => ({
  printBreakingUsages: vi.fn(async () => undefined),
}));

const cfg = getDefaultConfig();

type AnyMock = ReturnType<typeof vi.fn>;
/** Narrow a mocked module export to its mock handle (the module IS mocked above). */
const asMock = (fn: unknown): AnyMock => fn as AnyMock;

// `vi.clearAllMocks()` clears call history but NOT implementations, so a
// `mockResolvedValue` set by one test would otherwise leak into the next.
beforeEach(() => {
  asMock(fs.pathExists).mockResolvedValue(false);
  asMock(fs.readFile).mockResolvedValue('LOCAL EDIT');
  asMock(fs.readJson).mockResolvedValue({});
  asMock(fs.remove).mockResolvedValue(undefined);
  asMock(fs.writeJson).mockResolvedValue(undefined);
  asMock(getConfig).mockResolvedValue(cfg);
  asMock(installPackages).mockResolvedValue(undefined);
  asMock(performInstall).mockResolvedValue({
    installed: ['button', 'card'], skipped: [], declined: [], pruned: [], warnings: [],
  });
  asMock(scanLayouts).mockResolvedValue({ legacy: [], current: [] });
  asMock(collectLibDrift).mockResolvedValue({ stale: [], missing: [], userEdited: [] });
  asMock(refreshLibFiles).mockResolvedValue({ refreshed: [], warnings: [] });
  asMock(collectStaleReport).mockResolvedValue({ entries: [] });
  asMock(rewriteMovedImports).mockResolvedValue([]);
});

describe('collectDoctorReport', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reports a clean bill when nothing is installed', async () => {
    (fs.pathExists as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    const report = await collectDoctorReport('/proj', cfg, { branch: 'master' });
    expect(report.missingFiles).toEqual([]);
    expect(report.modified).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('flags a component whose installed files were modified', async () => {
    // button present but changed: pathExists true, local != remote
    (fs.pathExists as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (p: string) =>
      String(p).includes('button'));
    (fs.readFile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('LOCAL EDIT');
    const report = await collectDoctorReport('/proj', cfg, { branch: 'master' });
    expect(report.modified).toContain('button');
    expect(report.ok).toBe(false);
  });
});

describe('installedComponents', () => {
  beforeEach(() => vi.clearAllMocks());

  it('detects a component by ANY of its files, not only files[0] (B6b)', async () => {
    // A multi-file component whose ENTRY file (files[0]) is absent but a later
    // file is present — the stale-after-rename case that must not go invisible.
    const multi = getComponentNames().find(n => registry[n].files.length > 1)!;
    const laterFile = registry[multi].files[1];
    (fs.pathExists as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (p: string) => String(p).replaceAll('\\', '/').endsWith(laterFile),
    );
    const installed = await installedComponents('/proj/ui');
    expect(installed).toContain(multi);
  });
});

describe('classifyDrift', () => {
  it('flags user-edited when local differs from the manifest baseline', () => {
    const out = classifyDrift(['button'], { button: 'modified' });
    expect(out.userEdited).toEqual(['button']);
    expect(out.updateAvailable).toEqual([]);
  });

  it('flags update-available when local matches manifest but registry moved on', () => {
    const out = classifyDrift(['button'], { button: 'clean' });
    expect(out.updateAvailable).toEqual(['button']);
    expect(out.userEdited).toEqual([]);
  });

  it('treats untracked (no manifest baseline) drift as update-available', () => {
    const out = classifyDrift(['button'], { button: 'untracked' });
    expect(out.updateAvailable).toEqual(['button']);
    expect(out.userEdited).toEqual([]);
  });
});

function makeReport(partial: Partial<DoctorReport>): DoctorReport {
  return {
    missingFiles: [], modified: [], userEdited: [], updateAvailable: [],
    legacy: [], missingNpmDeps: [], libStale: [], libMissing: [], libUserEdited: [],
    stale: [], ok: false, ...partial,
  };
}

describe('buildFixPlan', () => {
  it('merges missing-files and update-available into one reinstall list', () => {
    const plan = buildFixPlan(makeReport({
      missingFiles: ['button'], updateAvailable: ['card', 'button'],
    }));
    expect(plan.reinstall).toEqual(['button', 'card']);
    expect(plan.hasActions).toBe(true);
  });

  it('never schedules user-edited components for reinstall', () => {
    const plan = buildFixPlan(makeReport({
      modified: ['badge'], userEdited: ['badge'],
    }));
    expect(plan.reinstall).toEqual([]);
    expect(plan.protected).toEqual(['badge']);
    expect(plan.hasActions).toBe(false);
  });

  it('lists npm deps and legacy components without auto-fixing legacy', () => {
    const plan = buildFixPlan(makeReport({
      missingNpmDeps: ['date-fns'], legacy: ['alert'],
    }));
    expect(plan.npmDeps).toEqual(['date-fns']);
    expect(plan.legacy).toEqual(['alert']);
    expect(plan.hasActions).toBe(true);
  });
});

describe('doctorFixCore', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reinstalls components with overwrite authorization and --yes', async () => {
    const plan = buildFixPlan(makeReport({ missingFiles: ['button'], updateAvailable: ['card'] }));
    const actions = await doctorFixCore('/proj', cfg, { branch: 'master' }, plan);
    expect(performInstall).toHaveBeenCalledWith(expect.objectContaining({
      components: ['button', 'card'],
      overwrite: ['button', 'card'],
      options: expect.objectContaining({ yes: true }),
    }));
    expect(actions.some(a => a.includes('Re-installed 2'))).toBe(true);
  });

  it('installs missing npm dependencies', async () => {
    const plan = buildFixPlan(makeReport({ missingNpmDeps: ['date-fns', 'embla-carousel'] }));
    const actions = await doctorFixCore('/proj', cfg, { branch: 'master' }, plan);
    expect(installPackages).toHaveBeenCalledWith(['date-fns', 'embla-carousel'], { cwd: '/proj' });
    expect(performInstall).not.toHaveBeenCalled();
    expect(actions.some(a => a.includes('date-fns'))).toBe(true);
  });

  it('does nothing when the plan has no actions', async () => {
    const plan = buildFixPlan(makeReport({ userEdited: ['badge'], modified: ['badge'] }));
    const actions = await doctorFixCore('/proj', cfg, { branch: 'master' }, plan);
    expect(performInstall).not.toHaveBeenCalled();
    expect(installPackages).not.toHaveBeenCalled();
    expect(actions).toEqual([]);
  });

  it('surfaces install warnings as actions', async () => {
    (performInstall as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      installed: ['button'], skipped: [], declined: [], pruned: [], warnings: ['peer file skipped'],
    });
    const plan = buildFixPlan(makeReport({ missingFiles: ['button'] }));
    const actions = await doctorFixCore('/proj', cfg, { branch: 'master' }, plan);
    expect(actions.some(a => a.includes('peer file skipped'))).toBe(true);
  });

  it('refreshes stale lib files and surfaces refresh warnings', async () => {
    asMock(refreshLibFiles).mockResolvedValueOnce({
      refreshed: ['utils.ts'], warnings: ['Could not refresh lib file i18n/index.ts: 404'],
    });
    const plan = buildFixPlan(makeReport({ libStale: ['utils.ts'], libMissing: ['i18n/index.ts'] }));
    const actions = await doctorFixCore('/proj', cfg, { branch: 'master' }, plan);
    expect(refreshLibFiles).toHaveBeenCalledWith(
      ['i18n/index.ts', 'utils.ts'], expect.stringContaining('lib'), '/proj', expect.anything(),
    );
    expect(actions).toContain('Refreshed 1 lib file(s): utils.ts');
    expect(actions).toContain('Warning: Could not refresh lib file i18n/index.ts: 404');
  });

  it('migrates a relocated file: installs the new component, re-points imports, deletes the old file', async () => {
    const move = {
      fromFile: 'page-builder/page-renderer.component.ts',
      toComponent: 'page-renderer' as const,
      fromImport: 'page-builder/page-renderer.component',
      toImport: 'page-renderer',
    };
    asMock(collectStaleReport)
      .mockResolvedValueOnce({ entries: [{ file: move.fromFile, action: 'migrate', move }] })
      .mockResolvedValueOnce({ entries: [] });
    asMock(rewriteMovedImports).mockResolvedValueOnce(['src/app/app.component.ts']);

    const actions = await doctorFixCore(
      '/proj', cfg, { branch: 'master' },
      buildFixPlan(makeReport({ stale: [{ file: move.fromFile, action: 'migrate', move }] })),
    );

    expect(performInstall).toHaveBeenCalledWith(expect.objectContaining({
      components: ['page-renderer'],
      options: expect.objectContaining({ yes: true, overwrite: true }),
    }));
    expect(fs.remove).toHaveBeenCalledWith(expect.stringContaining('page-renderer.component.ts'));
    expect(actions.some(a =>
      a.includes('Migrated page-builder/page-renderer.component.ts → page-renderer')
      && a.includes('re-pointed 1 import(s)'))).toBe(true);
  });

  it('prunes stale files and drops them from the lockfile', async () => {
    const stale = { file: 'chart/legacy-chart.component.ts', action: 'prune' as const };
    asMock(collectStaleReport).mockResolvedValue({ entries: [stale] });
    asMock(fs.pathExists).mockResolvedValue(true);
    asMock(fs.readJson).mockResolvedValue({
      version: 2,
      files: { [stale.file]: { sha256: 'abc', component: 'chart' }, 'button/index.ts': { sha256: 'def', component: 'button' } },
    } satisfies Manifest);

    const actions = await doctorFixCore(
      '/proj', cfg, { branch: 'master' }, buildFixPlan(makeReport({ stale: [stale] })),
    );

    expect(fs.remove).toHaveBeenCalledWith(expect.stringContaining('legacy-chart.component.ts'));
    const written = asMock(fs.writeJson).mock.calls[0][1] as Manifest;
    expect(written.files).not.toHaveProperty(stale.file);
    expect(written.files).toHaveProperty('button/index.ts');
    expect(actions.some(a => a.startsWith('Removed 1 stale file(s)'))).toBe(true);
  });

  it('warns instead of deleting a stale file the consumer still imports', async () => {
    const stale = { file: 'chart/legacy-chart.component.ts', action: 'keep-warn' as const };
    asMock(collectStaleReport).mockResolvedValue({ entries: [stale] });
    const actions = await doctorFixCore(
      '/proj', cfg, { branch: 'master' }, buildFixPlan(makeReport({ stale: [stale], missingFiles: ['button'] })),
    );
    expect(fs.remove).not.toHaveBeenCalled();
    expect(actions.some(a => a.includes(`Warning: ${stale.file} is a stale shadcn file you still import`))).toBe(true);
  });

  it('warns (does not throw) when the lockfile cannot be rewritten after a prune', async () => {
    const stale = { file: 'chart/legacy-chart.component.ts', action: 'prune' as const };
    asMock(collectStaleReport).mockResolvedValue({ entries: [stale] });
    asMock(fs.pathExists).mockResolvedValue(true);
    asMock(fs.readJson).mockResolvedValue({ version: 2, files: {} } satisfies Manifest);
    asMock(fs.writeJson).mockRejectedValueOnce(new Error('EACCES: read-only fs'));

    const actions = await doctorFixCore(
      '/proj', cfg, { branch: 'master' }, buildFixPlan(makeReport({ stale: [stale] })),
    );
    expect(actions.some(a =>
      a.includes('Warning: could not update components.lock.json: EACCES: read-only fs'))).toBe(true);
    expect(actions.some(a => a.startsWith('Removed 1 stale file(s)'))).toBe(true);
  });
});

describe('refreshLibCore', () => {
  const drift = { stale: ['utils.ts'], missing: ['i18n/index.ts'], userEdited: ['i18n/i18n.token.ts'] };

  beforeEach(() => {
    vi.clearAllMocks();
    asMock(fs.pathExists).mockResolvedValue(false);
    asMock(collectLibDrift).mockResolvedValue(drift);
    asMock(refreshLibFiles).mockImplementation(
      async (files: string[]) => ({ refreshed: files, warnings: [] }),
    );
  });

  it('refreshes the stale + missing lib files and protects the customized ones', async () => {
    const result = await refreshLibCore('/proj', cfg, { branch: 'master' }, {});
    const sorted = [...result.targets].sort((a, b) => a.localeCompare(b));
    expect(sorted).toEqual(['i18n/index.ts', 'utils.ts']);
    expect(result.refreshed).toEqual(result.targets);
    expect(result.protectedFiles).toEqual(['i18n/i18n.token.ts']);
  });

  it('also overwrites customized lib files under force (nothing left protected)', async () => {
    const result = await refreshLibCore('/proj', cfg, { branch: 'master' }, { force: true });
    expect(result.targets).toContain('i18n/i18n.token.ts');
    expect(result.protectedFiles).toEqual([]);
  });

  it('dry run reports the targets and writes nothing', async () => {
    const result = await refreshLibCore('/proj', cfg, { branch: 'master' }, { dryRun: true });
    expect(refreshLibFiles).not.toHaveBeenCalled();
    expect(result.refreshed).toEqual([]);
    expect(result.targets).toContain('utils.ts');
    expect(result.protectedFiles).toEqual(['i18n/i18n.token.ts']);
  });

  it('treats an explicit file list as consent — it overrides the drift scan', async () => {
    const result = await refreshLibCore(
      '/proj', cfg, { branch: 'master' }, { files: ['i18n/i18n.token.ts'] },
    );
    expect(result.targets).toEqual(['i18n/i18n.token.ts']);
    expect(result.refreshed).toEqual(['i18n/i18n.token.ts']);
    expect(result.protectedFiles).toEqual([]);
  });
});

class ProcessExitError extends Error {
  constructor(readonly code: number | undefined) {
    super(`process.exit(${code})`);
  }
}

const BUTTON_FILES = registry['button'].files;
const ANSI = new RegExp(String.fromCodePoint(27) + String.raw`\[\d+(?:;\d+)*m`, 'g');

/**
 * pathExists impl: only `button`'s registry files are on disk. The leading `/`
 * matters — without it `split-button/index.ts` would match `button/index.ts`.
 */
const buttonOnDisk = async (p: string): Promise<boolean> => {
  const norm = String(p).replaceAll('\\', '/');
  return BUTTON_FILES.some(f => norm.endsWith('/' + f));
};

/** A lockfile recording `content` as the installed baseline for every button file. */
function buttonManifest(content: string): Manifest {
  const files: Manifest['files'] = {};
  for (const f of BUTTON_FILES) files[f] = { sha256: hashContent(content), component: 'button' };
  return { version: 2, files };
}

describe('doctor (command)', () => {
  let logged: string[];
  let logSpy: MockInstance<typeof console.log>;
  let exitSpy: MockInstance<typeof process.exit>;

  const output = (): string => logged.join('\n').replaceAll(ANSI, '');

  beforeEach(() => {
    vi.clearAllMocks();
    logged = [];
    logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logged.push(args.map(a => String(a)).join(' '));
    });
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number | string | null): never => {
      throw new ProcessExitError(typeof code === 'number' ? code : undefined);
    });
    asMock(getConfig).mockResolvedValue(cfg);
    asMock(fs.pathExists).mockResolvedValue(false);
    asMock(fs.readFile).mockResolvedValue('LOCAL EDIT');
    asMock(fs.readJson).mockResolvedValue({});
  });

  afterEach(() => {
    logSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('exits 1 and points at `init` when components.json is missing', async () => {
    asMock(getConfig).mockResolvedValue(null);
    await expect(doctor({ branch: 'master' })).rejects.toThrow(ProcessExitError);
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(output()).toContain('components.json not found');
    expect(output()).toContain('init');
  });

  it('reports a healthy project and does not exit', async () => {
    await doctor({ branch: 'master' });
    expect(output()).toContain('All installed components are healthy.');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('inherits the registry from components.json when no --registry flag is given', async () => {
    const configured: Config = { ...cfg, registry: 'https://example.test/registry' };
    asMock(getConfig).mockResolvedValue(configured);
    const options = { branch: 'master' };
    await doctor(options);
    expect(options).toMatchObject({ registry: 'https://example.test/registry' });
  });

  it('--dry-run prints the fix plan and writes nothing', async () => {
    asMock(fs.pathExists).mockImplementation(buttonOnDisk);
    await doctor({ branch: 'master', dryRun: true });
    expect(output()).toContain('doctor --fix would do the following');
    expect(output()).toContain('Would re-install from the registry:');
    expect(output()).toContain('button');
    expect(performInstall).not.toHaveBeenCalled();
    expect(installPackages).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('without --fix prints the report and exits 1', async () => {
    asMock(fs.pathExists).mockImplementation(buttonOnDisk);
    await expect(doctor({ branch: 'master' })).rejects.toThrow(ProcessExitError);
    expect(output()).toContain('Update available (newer registry version):');
    expect(output()).toContain('button');
    expect(performInstall).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('--fix reinstalls the drifted component and reports success once the re-check is clean', async () => {
    let repaired = false;
    asMock(fs.pathExists).mockImplementation(buttonOnDisk);
    asMock(fs.readFile).mockImplementation(async () => (repaired ? 'REMOTE' : 'LOCAL EDIT'));
    asMock(performInstall).mockImplementation(async () => {
      repaired = true;
      return { installed: ['button'], skipped: [], declined: [], pruned: [], warnings: [] };
    });

    await doctor({ branch: 'master', fix: true });

    expect(performInstall).toHaveBeenCalledWith(expect.objectContaining({
      components: ['button'], overwrite: ['button'],
      options: expect.objectContaining({ yes: true }),
    }));
    expect(output()).toContain('Re-installed 1 component(s): button');
    expect(output()).toContain('All repairable issues fixed.');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('--fix exits 1 when the issue survives the repair', async () => {
    asMock(fs.pathExists).mockImplementation(buttonOnDisk);
    asMock(performInstall).mockResolvedValue({
      installed: [], skipped: [], declined: ['button'], pruned: [], warnings: [],
    });
    await expect(doctor({ branch: 'master', fix: true })).rejects.toThrow(ProcessExitError);
    expect(output()).toContain('Some issues remain after fixing:');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('--fix exits 1 when the only defect is a legacy layout it cannot repair automatically', async () => {
    asMock(scanLayouts).mockResolvedValue({ legacy: ['alert'], current: [] });
    await expect(doctor({ branch: 'master', fix: true })).rejects.toThrow(ProcessExitError);
    expect(output()).toContain('Nothing doctor --fix can repair automatically.');
    expect(output()).toContain('migrate');
    expect(performInstall).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('--fix never touches user-edited components and exits 0', async () => {
    asMock(fs.pathExists).mockImplementation(async (p: string) =>
      String(p).endsWith('components.lock.json') || buttonOnDisk(p));
    asMock(fs.readJson).mockResolvedValue(buttonManifest('ORIGINAL'));
    asMock(fs.readFile).mockResolvedValue('LOCAL EDIT');

    await doctor({ branch: 'master', fix: true });

    expect(output()).toContain('only locally modified components remain (protected)');
    expect(output()).toContain('Protected (your edits');
    expect(performInstall).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
