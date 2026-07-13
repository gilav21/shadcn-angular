import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import fs from 'fs-extra';
import prompts from 'prompts';
import {
  resolveUpdateTargets, partitionClosure, customizedAmong,
  shouldOfferAddonApply, filterUninstalledAddons, classifyCustomized, update,
} from './update.js';
import { getConfig, getDefaultConfig, type Config } from '../utils/config.js';
import { emptyManifest, recordFile, hashContent, type Manifest } from '../core/manifest.js';
import { registry, type ComponentName } from '../registry/index.js';
import { resolveDependencies } from '../core/resolve.js';
import { detectConflicts, type AddOptions, type ConflictCheckResult } from '../core/plan.js';
import { performInstall, previewComponentMerges, type InstallResult } from '../core/install.js';
import { scanLayouts } from '../core/layout.js';
import { reportMergeSummary } from './merge-report.js';
import { apply } from './apply.js';
import { emptyMergeReport } from '../core/merge.js';

vi.mock('fs-extra', () => ({
  default: { pathExists: vi.fn(), readFile: vi.fn(), readJson: vi.fn(async () => ({})) },
}));
vi.mock('prompts', () => ({ default: vi.fn(async () => ({ run: true })) }));
vi.mock('ora', () => ({
  default: vi.fn(() => ({ start: () => ({ stop: vi.fn() }) })),
}));
vi.mock('../utils/config.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('../utils/config.js')>(),
  getConfig: vi.fn(),
}));
vi.mock('../core/plan.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('../core/plan.js')>(),
  detectConflicts: vi.fn(),
}));
vi.mock('../core/install.js', () => ({
  performInstall: vi.fn(),
  previewComponentMerges: vi.fn(async () => []),
}));
vi.mock('../core/layout.js', () => ({
  scanLayouts: vi.fn(async () => ({ legacy: [], current: [] })),
}));
vi.mock('../core/breaking-scan.js', () => ({
  printBreakingUsages: vi.fn(async () => undefined),
}));
vi.mock('./merge-report.js', () => ({ reportMergeSummary: vi.fn(() => false) }));
vi.mock('./apply.js', () => ({ apply: vi.fn(async () => undefined) }));

type AnyMock = ReturnType<typeof vi.fn>;
/** Narrow a mocked module export to its mock handle (the module IS mocked above). */
const asMock = (fn: unknown): AnyMock => fn as AnyMock;

describe('resolveUpdateTargets', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the explicitly named components when given', async () => {
    const targets = await resolveUpdateTargets(['button', 'card'], '/proj', getDefaultConfig());
    expect(targets).toEqual(['button', 'card']);
  });

  it('detects installed components when none named', async () => {
    (fs.pathExists as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (p: string) =>
      String(p).includes('button'));
    const targets = await resolveUpdateTargets([], '/proj', getDefaultConfig());
    expect(targets).toContain('button');
    expect(targets).not.toContain('card');
  });

  it('rejects unknown component names', async () => {
    await expect(resolveUpdateTargets(['not-real'], '/proj', getDefaultConfig())).rejects.toThrow(/Unknown/);
  });
});

describe('partitionClosure', () => {
  it('splits a closure into already-installed vs newly-required', () => {
    const res = partitionClosure(
      ['data-table'] as ComponentName[],
      new Set(['button', 'data-table']) as Set<ComponentName>,
      new Set(['data-table', 'button', 'context-menu']) as Set<ComponentName>,
    );
    expect([...res.alreadyInstalled].sort((a, b) => a.localeCompare(b))).toEqual(['button', 'data-table']);
    expect(res.newlyRequired).toEqual(['context-menu']);
  });

  it('treats every closure member as already-installed when all present', () => {
    const res = partitionClosure(
      ['button'] as ComponentName[],
      new Set(['button', 'ripple']) as Set<ComponentName>,
      new Set(['button', 'ripple']) as Set<ComponentName>,
    );
    expect(res.newlyRequired).toEqual([]);
    expect([...res.alreadyInstalled].sort((a, b) => a.localeCompare(b))).toEqual(['button', 'ripple']);
  });
});

describe('customizedAmong', () => {
  const filesOf = (n: ComponentName) => [`${n}/${n}.component.ts`];

  it('returns components whose local content drifts from the manifest baseline', () => {
    const m = emptyManifest();
    recordFile(m, 'button/button.component.ts', 'orig', 'button');
    const local = new Map([['button/button.component.ts', 'edited']]);
    expect(customizedAmong(['button'] as ComponentName[], m, local, filesOf)).toEqual(['button']);
  });

  it('excludes components whose local content matches the baseline', () => {
    const m = emptyManifest();
    recordFile(m, 'button/button.component.ts', 'orig', 'button');
    const local = new Map([['button/button.component.ts', 'orig']]);
    expect(customizedAmong(['button'] as ComponentName[], m, local, filesOf)).toEqual([]);
  });
});


describe('shouldOfferAddonApply', () => {
  it('offers only on an interactive TTY without --yes', () => {
    expect(shouldOfferAddonApply({ yes: false, isTTY: true })).toBe(true);
  });

  it('does NOT offer under --yes (a non-interactive run cannot be asked)', () => {
    expect(shouldOfferAddonApply({ yes: true, isTTY: true })).toBe(false);
  });

  it('does NOT offer on a non-TTY stdin (piped / CI) — would auto-accept otherwise', () => {
    expect(shouldOfferAddonApply({ yes: false, isTTY: false })).toBe(false);
    expect(shouldOfferAddonApply({ yes: true, isTTY: false })).toBe(false);
  });
});

describe('filterUninstalledAddons', () => {
  it('drops addons whose first registry file already exists on disk', async () => {
    const seen: string[] = [];
    const out = await filterUninstalledAddons(['context-menu'], async (f) => {
      seen.push(f);
      return true; // installed
    });
    expect(out).toEqual([]);
    expect(seen).toHaveLength(1); // probed the addon's first file
  });

  it('keeps addons whose files are absent (still worth offering)', async () => {
    const out = await filterUninstalledAddons(['context-menu'], async () => false);
    expect(out).toEqual(['context-menu']);
  });

  it('keeps unknown names rather than silently dropping them', async () => {
    const out = await filterUninstalledAddons(['not-a-real-addon'], async () => true);
    expect(out).toEqual(['not-a-real-addon']);
  });
});

describe('classifyCustomized', () => {
  const names = ['button', 'card'] as ComponentName[];

  it('routes every customized component to overwrite when --overwrite is set', () => {
    const b = classifyCustomized(names, true, () => true);
    expect(b.overwrite).toEqual(names);
    expect(b.merge).toEqual([]);
    expect(b.noBaseline).toEqual([]);
  });

  it('splits into merge (has baseline) vs no-baseline when not overwriting', () => {
    const b = classifyCustomized(names, false, (n) => n === 'button');
    expect(b.overwrite).toEqual([]);
    expect(b.merge).toEqual(['button']);
    expect(b.noBaseline).toEqual(['card']);
  });
});

class ProcessExitError extends Error {
  constructor(readonly code: number | undefined) {
    super(`process.exit(${code})`);
  }
}

const ANSI = new RegExp(String.fromCodePoint(27) + '\\[\\d+(?:;\\d+)*m', 'g');

const closureOf = (name: ComponentName): ComponentName[] => [...resolveDependencies([name])];

function conflictResult(over: Partial<ConflictCheckResult> = {}): ConflictCheckResult {
  return {
    toInstall: [], toSkip: [], conflicting: [],
    peerFilesToUpdate: new Set<string>(), contentCache: new Map<string, string>(), ...over,
  };
}

function installResult(over: Partial<InstallResult> = {}): InstallResult {
  return {
    installed: [], skipped: [], declined: [], pruned: [], warnings: [],
    mergeReport: emptyMergeReport(), ...over,
  };
}

/** A lockfile recording `content` as the installed baseline for every file of `name`. */
function manifestFor(name: ComponentName, content: string, ref?: string): Manifest {
  const files: Manifest['files'] = {};
  for (const f of registry[name].files) files[f] = { sha256: hashContent(content), component: name };
  return ref ? { version: 2, files, components: { [name]: { ref } } } : { version: 2, files };
}

const opts = (over: Partial<AddOptions> = {}): AddOptions => ({ branch: 'master', ...over });

describe('update (command)', () => {
  const cfg = getDefaultConfig();
  let logged: string[];
  let logSpy: MockInstance<typeof console.log>;
  let exitSpy: MockInstance<typeof process.exit>;
  let originalIsTTY: boolean;

  const output = (): string => logged.join('\n').replaceAll(ANSI, '');

  beforeEach(() => {
    vi.clearAllMocks();
    logged = [];
    originalIsTTY = process.stdin.isTTY;
    process.stdin.isTTY = false;
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
    asMock(detectConflicts).mockResolvedValue(conflictResult());
    asMock(performInstall).mockResolvedValue(installResult());
    asMock(scanLayouts).mockResolvedValue({ legacy: [], current: closureOf('button') });
    asMock(reportMergeSummary).mockReturnValue(false);
    asMock(prompts).mockResolvedValue({ run: true });
  });

  afterEach(() => {
    logSpy.mockRestore();
    exitSpy.mockRestore();
    process.stdin.isTTY = originalIsTTY;
  });

  it('exits 1 and points at `init` when components.json is missing', async () => {
    asMock(getConfig).mockResolvedValue(null);
    await expect(update([], opts())).rejects.toThrow(ProcessExitError);
    expect(output()).toContain('components.json not found');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(detectConflicts).not.toHaveBeenCalled();
  });

  it('exits 1 on an unknown component name without touching the project', async () => {
    await expect(update(['not-a-component'], opts())).rejects.toThrow(ProcessExitError);
    expect(output()).toContain('Unknown component(s): not-a-component');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(performInstall).not.toHaveBeenCalled();
  });

  it('does nothing when no components are installed', async () => {
    await update([], opts());
    expect(output()).toContain('No installed components to update.');
    expect(detectConflicts).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('routes to `migrate` and exits 1 when a closure member is in the legacy layout', async () => {
    asMock(scanLayouts).mockResolvedValue({ legacy: ['ripple'], current: ['button'] });
    await expect(update(['button'], opts())).rejects.toThrow(ProcessExitError);
    expect(output()).toContain('legacy single-file layout');
    expect(output()).toContain('Affected: ripple');
    expect(output()).toContain('migrate');
    expect(detectConflicts).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('refuses to pull in newly-required dependencies without --yes', async () => {
    asMock(scanLayouts).mockResolvedValue({ legacy: [], current: ['button'] });
    await expect(update(['button'], opts())).rejects.toThrow(ProcessExitError);
    expect(output()).toContain('require new dependencies not yet installed');
    expect(output()).toContain('ripple');
    expect(output()).toContain('--yes');
    expect(detectConflicts).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('adds newly-required dependencies to the write set under --yes', async () => {
    asMock(scanLayouts).mockResolvedValue({ legacy: [], current: ['button'] });
    asMock(detectConflicts).mockResolvedValue(conflictResult({
      toInstall: ['ripple'], conflicting: ['button'],
    }));
    asMock(performInstall).mockResolvedValue(installResult({ installed: ['button', 'ripple'] }));

    await update(['button'], opts({ yes: true }));

    const universe = asMock(detectConflicts).mock.calls[0][0] as Set<ComponentName>;
    expect(universe.has('ripple')).toBe(true);
    expect(universe.has('button')).toBe(true);
    expect(performInstall).toHaveBeenCalledWith(expect.objectContaining({
      components: expect.arrayContaining(['button', 'ripple']),
    }));
    expect(output()).toContain('+ ripple (new dependency)');
    expect(output()).toContain('~ button (modified)');
    expect(output()).toContain('Updated 2 component(s).');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('reports "up to date" and writes nothing when the scan finds no changes', async () => {
    await update(['button'], opts());
    expect(output()).toContain('Everything is up to date.');
    expect(performInstall).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('--dry-run prints the merge preview and writes nothing', async () => {
    asMock(detectConflicts).mockResolvedValue(conflictResult({ conflicting: ['button'] }));
    asMock(previewComponentMerges).mockResolvedValue([
      { file: 'button/button.component.ts', outcome: 'merged-conflict' },
      { file: 'button/index.ts', outcome: 'merged-clean' },
    ]);

    await update(['button'], opts({ dryRun: true }));

    expect(output()).toContain('WOULD CONFLICT (<<<<<<< markers): button/button.component.ts');
    expect(output()).toContain('would merge cleanly: button/index.ts');
    expect(output()).toContain('[Dry Run] No changes written.');
    expect(performInstall).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('defaults --overwrite from components.json `update.overwrite`', async () => {
    const configured: Config = { ...cfg, update: { overwrite: true } };
    asMock(getConfig).mockResolvedValue(configured);
    asMock(detectConflicts).mockResolvedValue(conflictResult({ conflicting: ['button'] }));
    const options = opts();

    await update(['button'], options);

    expect(options.overwrite).toBe(true);
    expect(performInstall).toHaveBeenCalledWith(expect.objectContaining({
      options: expect.objectContaining({ overwrite: true }),
    }));
  });

  it('warns that an edited component with a baseline will be 3-way merged', async () => {
    asMock(fs.pathExists).mockResolvedValue(true);
    asMock(fs.readJson).mockResolvedValue(manifestFor('button', 'ORIGINAL', 'abc123'));
    asMock(fs.readFile).mockResolvedValue('MY LOCAL EDIT');
    asMock(detectConflicts).mockResolvedValue(conflictResult({ conflicting: ['button'] }));

    await update(['button'], opts());

    expect(output()).toContain('update will 3-way merge the upstream changes into them');
    expect(output()).toContain('re-run with --overwrite');
  });

  it('warns that --overwrite replaces an edited component whole-file (no merge)', async () => {
    asMock(fs.pathExists).mockResolvedValue(true);
    asMock(fs.readJson).mockResolvedValue(manifestFor('button', 'ORIGINAL', 'abc123'));
    asMock(fs.readFile).mockResolvedValue('MY LOCAL EDIT');
    asMock(detectConflicts).mockResolvedValue(conflictResult({ conflicting: ['button'] }));

    await update(['button'], opts({ overwrite: true }));

    expect(output()).toContain('--overwrite will replace them whole-file (no merge)');
    expect(output()).not.toContain('3-way merge the upstream changes');
  });

  it('warns that an edited component WITHOUT a baseline cannot be merged', async () => {
    asMock(fs.pathExists).mockResolvedValue(true);
    asMock(fs.readJson).mockResolvedValue(manifestFor('button', 'ORIGINAL'));
    asMock(fs.readFile).mockResolvedValue('MY LOCAL EDIT');
    asMock(detectConflicts).mockResolvedValue(conflictResult({ conflicting: ['button'] }));

    await update(['button'], opts());

    expect(output()).toContain('no recorded baseline — your edited files will be kept and warned');
  });

  it('exits 1 when merge conflicts were written in a non-interactive run (--yes)', async () => {
    asMock(detectConflicts).mockResolvedValue(conflictResult({ conflicting: ['button'] }));
    asMock(performInstall).mockResolvedValue(installResult({ installed: ['button'] }));
    asMock(reportMergeSummary).mockReturnValue(true);

    await expect(update(['button'], opts({ yes: true }))).rejects.toThrow(ProcessExitError);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('does NOT exit on written conflicts in an interactive run (the user can resolve them)', async () => {
    asMock(detectConflicts).mockResolvedValue(conflictResult({ conflicting: ['button'] }));
    asMock(performInstall).mockResolvedValue(installResult({ installed: ['button'] }));
    asMock(reportMergeSummary).mockReturnValue(true);

    await update(['button'], opts());
    expect(exitSpy).not.toHaveBeenCalled();
  });

  describe('post-update addon offer', () => {
    beforeEach(() => {
      asMock(scanLayouts).mockResolvedValue({ legacy: [], current: closureOf('data-table') });
      asMock(detectConflicts).mockResolvedValue(conflictResult({ conflicting: ['data-table'] }));
      asMock(performInstall).mockResolvedValue(installResult({ installed: ['data-table'] }));
    });

    it('runs `apply <addon>` for a suggested addon the user accepts', async () => {
      process.stdin.isTTY = true;
      asMock(prompts).mockResolvedValue({ run: true });

      const options = opts();
      await update(['data-table'], options);

      expect(apply).toHaveBeenCalledWith('data-table/context-menu', [], options);
      expect(apply).toHaveBeenCalledWith('data-table/export', [], options);
    });

    it('prints the apply-later hint when the user declines', async () => {
      process.stdin.isTTY = true;
      asMock(prompts).mockResolvedValue({ run: false });

      await update(['data-table'], opts());

      expect(apply).not.toHaveBeenCalled();
      expect(output()).toContain('apply data-table/context-menu` later');
    });

    it('never prompts (nor installs) under --yes — it prints the hint instead', async () => {
      process.stdin.isTTY = true;
      await update(['data-table'], opts({ yes: true }));

      expect(prompts).not.toHaveBeenCalled();
      expect(apply).not.toHaveBeenCalled();
      expect(output()).toContain('apply data-table/export` later');
    });

    it('exits 0 with "Cancelled." when the user Ctrl-Cs the addon prompt', async () => {
      process.stdin.isTTY = true;
      asMock(prompts).mockImplementation(
        async (_questions: unknown, opts: { onCancel: () => never }) => opts.onCancel(),
      );

      await expect(update(['data-table'], opts())).rejects.toThrow(ProcessExitError);
      expect(output()).toContain('Cancelled.');
      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(apply).not.toHaveBeenCalled();
    });

    it('does not re-offer an addon already installed on disk', async () => {
      process.stdin.isTTY = true;
      asMock(fs.pathExists).mockResolvedValue(true);
      asMock(fs.readJson).mockResolvedValue(emptyManifest());

      await update(['data-table'], opts());

      expect(prompts).not.toHaveBeenCalled();
      expect(apply).not.toHaveBeenCalled();
    });
  });
});
