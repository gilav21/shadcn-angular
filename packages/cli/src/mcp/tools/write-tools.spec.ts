import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs-extra';
import path from 'node:path';
import { registerWriteTools } from './write-tools.js';
import type { ToolHost } from '../serialize.js';
import type { ToolResult } from './result.js';
import { performInstall, type InstallResult } from '../../core/install.js';
import { initProject } from '../../core/init-core.js';
import { applyInitDefaults } from '../../commands/init.js';
import { applyCore, ApplyError, type ApplyCoreResult } from '../../core/apply-core.js';
import { diffComponentFiles, type ComponentDiff } from '../../core/diff-core.js';
import { migrateCore, type MigrateOutcome } from '../../core/migrate-core.js';
import { scanStaleSelectors } from '../../core/codemod.js';
import {
  collectDoctorReport, buildFixPlan, doctorFixCore, refreshLibCore,
  type DoctorReport, type DoctorFixPlan, type RefreshLibResult,
} from '../../commands/doctor.js';
import { setDensityCore } from '../../commands/set-density.js';
import { setRadiusCore } from '../../commands/set-radius.js';
import { setMotionCore } from '../../commands/set-motion.js';
import { setLocaleCore } from '../../commands/set-locale.js';
import { changeThemeCore } from '../../commands/change-theme.js';
import { getConfig, getDefaultConfig, type Config } from '../../utils/config.js';
import { emptyMergeReport, type MergeReport } from '../../core/merge.js';
import { DEFAULT_BRANCH, aliasToProjectPath, resolveProjectPath } from '../../utils/paths.js';
import type { ComponentName } from '../../registry/index.js';

vi.mock('fs-extra', () => ({ default: { pathExists: vi.fn() } }));
vi.mock('../../core/install.js', () => ({ performInstall: vi.fn() }));
vi.mock('../../core/init-core.js', () => ({ initProject: vi.fn() }));
vi.mock('../../core/diff-core.js', () => ({ diffComponentFiles: vi.fn() }));
vi.mock('../../core/migrate-core.js', () => ({ migrateCore: vi.fn() }));
vi.mock('../../core/codemod.js', () => ({ scanStaleSelectors: vi.fn() }));
vi.mock('../../commands/doctor.js', () => ({
  collectDoctorReport: vi.fn(),
  buildFixPlan: vi.fn(),
  doctorFixCore: vi.fn(),
  refreshLibCore: vi.fn(),
}));

vi.mock('../../commands/init.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../commands/init.js')>(),
  applyInitDefaults: vi.fn(),
}));
vi.mock('../../core/apply-core.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../core/apply-core.js')>(),
  applyCore: vi.fn(),
}));
vi.mock('../../commands/set-density.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../commands/set-density.js')>(),
  setDensityCore: vi.fn(),
}));
vi.mock('../../commands/set-radius.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../commands/set-radius.js')>(),
  setRadiusCore: vi.fn(),
}));
vi.mock('../../commands/set-motion.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../commands/set-motion.js')>(),
  setMotionCore: vi.fn(),
}));
vi.mock('../../commands/set-locale.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../commands/set-locale.js')>(),
  setLocaleCore: vi.fn(),
}));
vi.mock('../../commands/change-theme.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../commands/change-theme.js')>(),
  changeThemeCore: vi.fn(),
}));
vi.mock('../../utils/config.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../utils/config.js')>(),
  getConfig: vi.fn(),
}));
// Keep the real precedence logic (toFetchOptions) but never hit the network:
// resolveSource's only other job is repointing the in-memory registry.
vi.mock('./options.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./options.js')>();
  return {
    ...actual,
    resolveSource: vi.fn((args: Parameters<typeof actual.toFetchOptions>[0], config?: Config) =>
      Promise.resolve(actual.toFetchOptions(args, config))),
  };
});

const CWD = '/proj';
type ToolArgs = Record<string, unknown>;
type ToolHandler = (args: ToolArgs) => Promise<ToolResult>;

const handlers = new Map<string, ToolHandler>();

/** A ToolHost that records handlers instead of exposing them over MCP. */
const host = {
  registerTool: (name: string, _config: unknown, handler: ToolHandler) => {
    handlers.set(name, handler);
  },
} as unknown as ToolHost;

const call = (tool: string, args: ToolArgs = {}): Promise<ToolResult> => {
  const handler = handlers.get(tool);
  if (!handler) throw new Error(`tool "${tool}" was never registered`);
  return handler(args);
};
const text = (res: ToolResult): string => res.content[0].text;
const parsed = <T>(res: ToolResult): T => JSON.parse(text(res)) as T;

const mockPathExists = vi.mocked(fs.pathExists) as unknown as ReturnType<typeof vi.fn>;

const installResult = (mergeReport: MergeReport = emptyMergeReport()): InstallResult => ({
  installed: ['button'] as ComponentName[],
  skipped: [], declined: [], pruned: [], warnings: [], mergeReport,
});

const libResult = (): RefreshLibResult => ({
  refreshed: ['utils.ts'], targets: ['utils.ts'], protectedFiles: [], warnings: ['lib warn'],
});

const doctorReport = (ok: boolean): DoctorReport => ({
  missingFiles: ok ? [] : ['button'],
  modified: [], userEdited: [], updateAvailable: [], legacy: [],
  missingNpmDeps: [], libStale: [], libMissing: [], libUserEdited: [],
  stale: [], ok,
});

const fixPlan = (): DoctorFixPlan => ({
  reinstall: ['button'] as ComponentName[],
  npmDeps: [], protected: [], legacy: [],
  refreshLib: [], libProtected: [], stalePrune: [], staleMigrate: [], staleKeepWarn: [],
  hasActions: true,
});

const applyResult = (mergeReport: MergeReport = emptyMergeReport()): ApplyCoreResult => ({
  addon: 'data-table/context-menu',
  installed: true,
  targets: [],
  totalWired: 1,
  mergeReport,
  snippet: { import: 'i', selector: 'uiDtContextMenu', tag: 'ui-data-table' },
});

const conflictedReport = (): MergeReport => ({
  ...emptyMergeReport(), mergedConflicted: ['button/button.component.ts'],
});

beforeEach(() => {
  vi.clearAllMocks();
  handlers.clear();
  registerWriteTools(host, CWD);
  vi.mocked(getConfig).mockResolvedValue(getDefaultConfig());
  mockPathExists.mockResolvedValue(false);
  vi.mocked(performInstall).mockResolvedValue(installResult());
  vi.mocked(refreshLibCore).mockResolvedValue(libResult());
  vi.mocked(scanStaleSelectors).mockResolvedValue([]);
});

describe('registerWriteTools', () => {
  it('registers every write tool the MCP surface promises', () => {
    expect([...handlers.keys()].sort((a, b) => a.localeCompare(b))).toEqual([
      'add_component', 'apply_addon', 'change_theme', 'diff_component', 'doctor_fix',
      'init_project', 'migrate', 'refresh_lib', 'set_density', 'set_locale',
      'set_motion', 'set_radius', 'set_test_runner', 'update_component',
    ]);
  });
});

describe('init_project', () => {
  beforeEach(() => {
    vi.mocked(initProject).mockResolvedValue({ created: ['components.json'], warnings: [] });
    vi.mocked(applyInitDefaults).mockResolvedValue(['density 2']);
  });

  it('refuses when components.json already exists', async () => {
    mockPathExists.mockResolvedValue(true);
    const res = await call('init_project');
    expect(mockPathExists).toHaveBeenCalledWith(path.join(CWD, 'components.json'));
    expect(res.isError).toBe(true);
    expect(text(res)).toContain('Already initialized');
    expect(initProject).not.toHaveBeenCalled();
  });

  it('rejects an invalid selector prefix', async () => {
    const res = await call('init_project', { prefix: 'Ui_Bad' });
    expect(res.isError).toBe(true);
    expect(text(res)).toContain('Invalid prefix');
    expect(initProject).not.toHaveBeenCalled();
  });

  it('rejects theme and themeFrom together', async () => {
    const res = await call('init_project', { theme: 'blue', themeFrom: '#3b82f6' });
    expect(res.isError).toBe(true);
    expect(text(res)).toContain('not both');
  });

  it('rejects a themeFrom that is not a hex color', async () => {
    const res = await call('init_project', { themeFrom: 'blueish' });
    expect(res.isError).toBe(true);
    expect(text(res)).toContain('Invalid themeFrom');
  });

  it('builds the config from the args and applies the init defaults', async () => {
    const res = await call('init_project', {
      prefix: 'acme', baseColor: 'slate', theme: 'blue', cssPath: 'src/global.css',
      registry: 'https://fork.test/components', density: 2, radius: 'lg', motion: 0,
      locale: 'he', branch: 'feat/x',
    });

    const input = vi.mocked(initProject).mock.calls[0][0];
    expect(input.cwd).toBe(CWD);
    expect(input.config.prefix).toBe('acme');
    expect(input.config.tailwind.baseColor).toBe('slate');
    expect(input.config.tailwind.theme).toBe('blue');
    expect(input.config.tailwind.css).toBe('src/global.css');
    expect(input.config.registry).toBe('https://fork.test/components');
    expect(input.createShortcutRegistry).toBe(true);
    expect(input.fetchOptions.branch).toBe('feat/x');

    expect(applyInitDefaults).toHaveBeenCalledWith(
      CWD,
      { density: 2, radius: 'lg', motion: 0, themeFrom: undefined, locale: 'he' },
      expect.objectContaining({ branch: 'feat/x' }),
    );
    expect(res.isError).toBeFalsy();
    expect(parsed<{ created: string[]; defaultsApplied: string[] }>(res)).toEqual({
      created: ['components.json'], warnings: [], defaultsApplied: ['density 2'],
    });
  });

  it('defaults prefix to ui and createShortcutRegistry to true', async () => {
    await call('init_project', {});
    const input = vi.mocked(initProject).mock.calls[0][0];
    expect(input.config.prefix).toBe('ui');
    expect(input.createShortcutRegistry).toBe(true);
    expect(input.fetchOptions.branch).toBe(DEFAULT_BRANCH);
  });

  it('honors createShortcutRegistry: false', async () => {
    await call('init_project', { createShortcutRegistry: false });
    expect(vi.mocked(initProject).mock.calls[0][0].createShortcutRegistry).toBe(false);
  });

  it('reports a defaults failure without failing the init itself', async () => {
    vi.mocked(applyInitDefaults).mockRejectedValue(new Error('bad radius'));
    const res = await call('init_project', { radius: 'huge' });
    expect(res.isError).toBeFalsy();
    expect(parsed<{ defaultsApplied: string[]; defaultsError: string }>(res)).toEqual({
      created: ['components.json'], warnings: [], defaultsApplied: [], defaultsError: 'bad radius',
    });
  });
});

describe('add_component', () => {
  it('errors when the project is not initialized', async () => {
    vi.mocked(getConfig).mockResolvedValue(null);
    const res = await call('add_component', { names: ['button'] });
    expect(res.isError).toBe(true);
    expect(text(res)).toContain('init_project');
    expect(performInstall).not.toHaveBeenCalled();
  });

  it('rejects unknown component names before installing anything', async () => {
    const res = await call('add_component', { names: ['button', 'nope', 'also-nope'] });
    expect(res.isError).toBe(true);
    expect(text(res)).toBe('Unknown component(s): nope, also-nope');
    expect(performInstall).not.toHaveBeenCalled();
  });

  it('delegates to performInstall with the names, overwrite set, optional deps and path', async () => {
    const res = await call('add_component', {
      names: ['button'], overwrite: ['card'], optionalDeps: ['ripple'],
      path: 'src/ui', branch: 'feat/x',
    });
    expect(performInstall).toHaveBeenCalledWith(expect.objectContaining({
      components: ['button'],
      overwrite: ['card'],
      optionalDeps: ['ripple'],
      path: 'src/ui',
      cwd: CWD,
      options: expect.objectContaining({ branch: 'feat/x' }),
    }));
    expect(parsed<InstallResult>(res).installed).toEqual(['button']);
  });

  it('defaults overwrite and optionalDeps to empty arrays', async () => {
    await call('add_component', { names: ['button'] });
    const input = vi.mocked(performInstall).mock.calls[0][0];
    expect(input.overwrite).toEqual([]);
    expect(input.optionalDeps).toEqual([]);
    expect(input.options.branch).toBe(DEFAULT_BRANCH);
  });

  it('accepts a preset and forwards the resolved addons as optionalDeps (T-24)', async () => {
    await call('add_component', { names: ['rich-text-editor'], preset: 'writing' });

    const input = vi.mocked(performInstall).mock.calls[0][0];
    expect(input.optionalDeps).toEqual([
      'rich-text-editor/slash-commands',
      'rich-text-editor/links',
      'rich-text-editor/history',
      'rich-text-editor/outline',
    ]);
  });

  it('unions an explicit optionalDeps list with the preset (T-24)', async () => {
    await call('add_component', {
      names: ['rich-text-editor'], preset: 'writing', optionalDeps: ['rich-text-editor/ai'],
    });

    const input = vi.mocked(performInstall).mock.calls[0][0];
    expect(input.optionalDeps).toContain('rich-text-editor/ai');
    expect(input.optionalDeps).toContain('rich-text-editor/links');
  });

  it('returns the PresetError text for an unknown preset and installs nothing (T-25)', async () => {
    const res = await call('add_component', { names: ['rich-text-editor'], preset: 'wrting' });

    expect(res.isError).toBe(true);
    expect(text(res)).toContain(
      'Unknown preset "wrting" for rich-text-editor. Available: core, writing, media, styling, everything',
    );
    expect(performInstall).not.toHaveBeenCalled();
  });

  it('returns the PresetError text when the base declares no presets (T-25)', async () => {
    const res = await call('add_component', { names: ['button'], preset: 'writing' });

    expect(res.isError).toBe(true);
    expect(text(res)).toContain('button declares no presets');
    expect(performInstall).not.toHaveBeenCalled();
  });
});

describe('update_component', () => {
  it('errors when the project is not initialized', async () => {
    vi.mocked(getConfig).mockResolvedValue(null);
    const res = await call('update_component', { names: ['button'] });
    expect(res.isError).toBe(true);
    expect(text(res)).toContain('init_project');
  });

  it('rejects unknown component names', async () => {
    const res = await call('update_component', { names: ['nope'] });
    expect(res.isError).toBe(true);
    expect(text(res)).toContain('Unknown component(s): nope');
    expect(performInstall).not.toHaveBeenCalled();
  });

  it('always passes the named components as the overwrite set (3-way merge is opt-out)', async () => {
    await call('update_component', { names: ['button'] });
    const input = vi.mocked(performInstall).mock.calls[0][0];
    expect(input.components).toEqual(['button']);
    expect(input.overwrite).toEqual(['button']);
    expect(input.options.overwrite).toBeUndefined();
  });

  it('forwards overwrite:true as a whole-file replace option', async () => {
    await call('update_component', { names: ['button'], overwrite: true, branch: 'feat/x' });
    const input = vi.mocked(performInstall).mock.calls[0][0];
    expect(input.options.overwrite).toBe(true);
    expect(input.options.branch).toBe('feat/x');
  });

  it('reconciles the shared lib files and reports the refresh', async () => {
    const res = await call('update_component', { names: ['button'] });
    expect(refreshLibCore).toHaveBeenCalledWith(CWD, getDefaultConfig(), expect.anything(), {});
    const out = parsed<{ libRefreshed: string[]; libWarnings: string[] }>(res);
    expect(out.libRefreshed).toEqual(['utils.ts']);
    expect(out.libWarnings).toEqual(['lib warn']);
  });

  it('surfaces hadConflicts when a file was written with conflict markers', async () => {
    vi.mocked(performInstall).mockResolvedValue(installResult(conflictedReport()));
    const res = await call('update_component', { names: ['button'] });
    expect(parsed<{ hadConflicts: boolean }>(res).hadConflicts).toBe(true);
  });

  it('reports hadConflicts false on a clean merge and includes the stale-selector scan', async () => {
    vi.mocked(scanStaleSelectors).mockResolvedValue([
      { file: 'src/app/app.component.html', line: 12, component: 'button', from: 'ui-old', to: 'ui-new' },
    ]);
    const res = await call('update_component', { names: ['button'] });
    const out = parsed<{
      hadConflicts: boolean;
      staleSelectors: { file: string }[];
      breakingChanges: unknown[];
    }>(res);
    expect(out.hadConflicts).toBe(false);
    expect(scanStaleSelectors).toHaveBeenCalledWith(CWD, ['button']);
    expect(out.staleSelectors[0].file).toBe('src/app/app.component.html');
    expect(Array.isArray(out.breakingChanges)).toBe(true);
  });
});

describe('diff_component', () => {
  const diffOf = (name: string, diff: string | null): ComponentDiff => ({
    name, files: [{ file: `${name}/${name}.component.ts`, diff }], hasChanges: diff !== null,
  });

  it('errors when the project is not initialized', async () => {
    vi.mocked(getConfig).mockResolvedValue(null);
    const res = await call('diff_component', { names: ['button'] });
    expect(res.isError).toBe(true);
    expect(text(res)).toContain('init_project');
  });

  it('rejects unknown component names', async () => {
    const res = await call('diff_component', { names: ['nope'] });
    expect(res.isError).toBe(true);
    expect(text(res)).toContain('Unknown component(s): nope');
    expect(diffComponentFiles).not.toHaveBeenCalled();
  });

  it('defaults to summary mode and diffs against the configured ui dir', async () => {
    vi.mocked(diffComponentFiles).mockResolvedValue(diffOf('button', null));
    const res = await call('diff_component', { names: ['button'] });
    const config = getDefaultConfig();
    const targetDir = resolveProjectPath(CWD, aliasToProjectPath(config.aliases.ui));
    expect(diffComponentFiles).toHaveBeenCalledWith(
      'button', targetDir, expect.objectContaining({ branch: DEFAULT_BRANCH }),
      config.aliases.utils, 'ui', 'summary',
    );
    expect(parsed<ComponentDiff[]>(res)).toHaveLength(1);
  });

  it('diffs each name in turn in full mode', async () => {
    vi.mocked(diffComponentFiles)
      .mockResolvedValueOnce(diffOf('button', '@@ -1 +1 @@'))
      .mockResolvedValueOnce(diffOf('card', '@@ -2 +2 @@'));
    const res = await call('diff_component', { names: ['button', 'card'], mode: 'full' });
    expect(vi.mocked(diffComponentFiles).mock.calls.map(c => [c[0], c[5]]))
      .toEqual([['button', 'full'], ['card', 'full']]);
    const out = parsed<ComponentDiff[]>(res);
    expect(out.map(c => c.name)).toEqual(['button', 'card']);
    expect(out[1].files[0].diff).toBe('@@ -2 +2 @@');
  });

  it('caps a full diff at file boundaries: files up to the budget are kept whole, the rest omitted', async () => {
    vi.mocked(diffComponentFiles)
      .mockResolvedValueOnce(diffOf('button', 'x'.repeat(20_000)))
      .mockResolvedValueOnce(diffOf('card', 'y'.repeat(10_000)))
      .mockResolvedValueOnce(diffOf('badge', '@@ small @@'));
    const res = await call('diff_component', { names: ['button', 'card', 'badge'], mode: 'full' });
    const out = parsed<ComponentDiff[]>(res);
    expect(out[0].files[0].diff).toHaveLength(20_000);
    expect(out[1].files[0].diff).toContain('omitted');
    expect(out[1].files[0].diff).toContain('24000');
    expect(out[2].files[0].diff).toContain('omitted');
  });

  it('omits a single file that alone exceeds the budget (its own hunks never fit)', async () => {
    vi.mocked(diffComponentFiles).mockResolvedValueOnce(diffOf('button', 'x'.repeat(25_000)));
    const res = await call('diff_component', { names: ['button'], mode: 'full' });
    expect(parsed<ComponentDiff[]>(res)[0].files[0].diff).toContain('omitted');
  });

  it('leaves identical files (diff null) untouched by the cap', async () => {
    vi.mocked(diffComponentFiles)
      .mockResolvedValueOnce(diffOf('button', null))
      .mockResolvedValueOnce(diffOf('card', 'z'.repeat(25_000)));
    const res = await call('diff_component', { names: ['button', 'card'], mode: 'full' });
    expect(parsed<ComponentDiff[]>(res)[0].files[0].diff).toBeNull();
  });

  it('does not cap in summary mode (no diff text to blow the budget)', async () => {
    vi.mocked(diffComponentFiles)
      .mockResolvedValueOnce(diffOf('button', 'y'.repeat(25_000)))
      .mockResolvedValueOnce(diffOf('card', 'kept'));
    const res = await call('diff_component', { names: ['button', 'card'] });
    expect(parsed<ComponentDiff[]>(res)[1].files[0].diff).toBe('kept');
  });
});

describe('set_density', () => {
  it('delegates to setDensityCore with the level, component overrides and cwd', async () => {
    vi.mocked(setDensityCore).mockResolvedValue('Density set to 2');
    const res = await call('set_density', { level: 2, components: ['card'] });
    expect(setDensityCore).toHaveBeenCalledWith(2, ['card'], CWD);
    expect(parsed<{ success: boolean; message: string }>(res))
      .toEqual({ success: true, message: 'Density set to 2' });
  });

  it('returns an MCP error result when the core throws', async () => {
    vi.mocked(setDensityCore).mockRejectedValue(new Error('Invalid density level "9"'));
    const res = await call('set_density', { level: 9 });
    expect(res.isError).toBe(true);
    expect(text(res)).toBe('Invalid density level "9"');
  });

  it('stringifies a non-Error rejection', async () => {
    vi.mocked(setDensityCore).mockRejectedValue('boom');
    const res = await call('set_density', { level: 3 });
    expect(res.isError).toBe(true);
    expect(text(res)).toBe('boom');
  });
});

describe('set_radius / set_motion / set_locale', () => {
  it('set_radius delegates the raw value and returns the core message', async () => {
    vi.mocked(setRadiusCore).mockResolvedValue('Radius set to 0.5rem');
    const res = await call('set_radius', { value: '0.5rem' });
    expect(setRadiusCore).toHaveBeenCalledWith('0.5rem', CWD);
    expect(parsed<{ message: string }>(res).message).toBe('Radius set to 0.5rem');
  });

  it('set_radius surfaces a core failure as an error result', async () => {
    vi.mocked(setRadiusCore).mockRejectedValue(new Error('Invalid radius'));
    const res = await call('set_radius', { value: 'wat' });
    expect(res.isError).toBe(true);
    expect(text(res)).toBe('Invalid radius');
  });

  it('set_motion delegates the level', async () => {
    vi.mocked(setMotionCore).mockResolvedValue('Motion set to 0');
    const res = await call('set_motion', { level: 0 });
    expect(setMotionCore).toHaveBeenCalledWith(0, CWD);
    expect(parsed<{ success: boolean }>(res).success).toBe(true);
  });

  it('set_motion surfaces a core failure as an error result', async () => {
    vi.mocked(setMotionCore).mockRejectedValue(new Error('Invalid motion level'));
    const res = await call('set_motion', { level: 7 });
    expect(res.isError).toBe(true);
    expect(text(res)).toBe('Invalid motion level');
  });

  it('set_locale passes the resolved fetch options so i18n files come from the right branch', async () => {
    vi.mocked(setLocaleCore).mockResolvedValue('Locale set to he');
    const res = await call('set_locale', { code: 'he', branch: 'feat/x' });
    expect(setLocaleCore).toHaveBeenCalledWith('he', CWD, expect.objectContaining({ branch: 'feat/x' }));
    expect(parsed<{ message: string }>(res).message).toBe('Locale set to he');
  });

  it('set_locale works on an uninitialized project (no config to resolve)', async () => {
    vi.mocked(getConfig).mockResolvedValue(null);
    vi.mocked(setLocaleCore).mockResolvedValue('Locale set to en');
    const res = await call('set_locale', { code: 'en' });
    expect(res.isError).toBeFalsy();
    expect(setLocaleCore).toHaveBeenCalledWith('en', CWD, expect.objectContaining({ branch: DEFAULT_BRANCH }));
  });

  it('set_locale surfaces an invalid locale as an error result', async () => {
    vi.mocked(setLocaleCore).mockRejectedValue(new Error('Invalid locale code "zz zz"'));
    const res = await call('set_locale', { code: 'zz zz' });
    expect(res.isError).toBe(true);
    expect(text(res)).toContain('Invalid locale code');
  });
});

describe('change_theme', () => {
  it('delegates a preset theme name', async () => {
    vi.mocked(changeThemeCore).mockResolvedValue('Theme changed to blue');
    const res = await call('change_theme', { name: 'blue' });
    expect(changeThemeCore).toHaveBeenCalledWith('blue', CWD, { from: undefined });
    expect(parsed<{ message: string }>(res).message).toBe('Theme changed to blue');
  });

  it('passes null for the name when generating from a brand hex', async () => {
    vi.mocked(changeThemeCore).mockResolvedValue('Theme generated');
    await call('change_theme', { from: '#3b82f6' });
    expect(changeThemeCore).toHaveBeenCalledWith(null, CWD, { from: '#3b82f6' });
  });

  it('surfaces a core validation failure as an error result', async () => {
    vi.mocked(changeThemeCore).mockRejectedValue(new Error('Pass either a theme name or --from'));
    const res = await call('change_theme', { name: 'blue', from: '#3b82f6' });
    expect(res.isError).toBe(true);
    expect(text(res)).toContain('Pass either');
  });
});

describe('doctor_fix', () => {
  beforeEach(() => {
    vi.mocked(collectDoctorReport).mockResolvedValue(doctorReport(false));
    vi.mocked(buildFixPlan).mockReturnValue(fixPlan());
    vi.mocked(doctorFixCore).mockResolvedValue(['reinstalled button']);
  });

  it('errors when the project is not initialized', async () => {
    vi.mocked(getConfig).mockResolvedValue(null);
    const res = await call('doctor_fix', {});
    expect(res.isError).toBe(true);
    expect(text(res)).toContain('init_project');
    expect(collectDoctorReport).not.toHaveBeenCalled();
  });

  it('returns the plan without repairing anything on dryRun', async () => {
    const res = await call('doctor_fix', { dryRun: true });
    expect(doctorFixCore).not.toHaveBeenCalled();
    const out = parsed<{ ok: boolean; plan: DoctorFixPlan; actions: string[] }>(res);
    expect(out.ok).toBe(false);
    expect(out.plan.reinstall).toEqual(['button']);
    expect(out.actions).toEqual([]);
  });

  it('skips the repair when the project is already healthy', async () => {
    vi.mocked(collectDoctorReport).mockResolvedValue(doctorReport(true));
    const res = await call('doctor_fix', {});
    expect(doctorFixCore).not.toHaveBeenCalled();
    expect(parsed<{ ok: boolean }>(res).ok).toBe(true);
  });

  it('repairs, re-collects the report and scans stale selectors for the reinstalled set', async () => {
    vi.mocked(collectDoctorReport)
      .mockResolvedValueOnce(doctorReport(false))
      .mockResolvedValueOnce(doctorReport(true));
    const res = await call('doctor_fix', {});
    expect(doctorFixCore).toHaveBeenCalledWith(
      CWD, getDefaultConfig(), expect.objectContaining({ branch: DEFAULT_BRANCH }), fixPlan(),
    );
    expect(scanStaleSelectors).toHaveBeenCalledWith(CWD, ['button']);
    const out = parsed<{ ok: boolean; actions: string[]; remaining: DoctorReport }>(res);
    expect(out.ok).toBe(true);
    expect(out.actions).toEqual(['reinstalled button']);
    expect(out.remaining.ok).toBe(true);
  });

  it('returns an error result when the diagnosis throws', async () => {
    vi.mocked(collectDoctorReport).mockRejectedValue(new Error('registry unreachable'));
    const res = await call('doctor_fix', {});
    expect(res.isError).toBe(true);
    expect(text(res)).toBe('registry unreachable');
  });
});

describe('refresh_lib', () => {
  it('errors when the project is not initialized', async () => {
    vi.mocked(getConfig).mockResolvedValue(null);
    const res = await call('refresh_lib', {});
    expect(res.isError).toBe(true);
    expect(text(res)).toContain('init_project');
    expect(refreshLibCore).not.toHaveBeenCalled();
  });

  it('forwards files / force / dryRun to refreshLibCore and returns its result', async () => {
    const res = await call('refresh_lib', {
      files: ['utils.ts'], force: true, dryRun: true, branch: 'feat/x',
    });
    expect(refreshLibCore).toHaveBeenCalledWith(
      CWD, getDefaultConfig(), expect.objectContaining({ branch: 'feat/x' }),
      { files: ['utils.ts'], force: true, dryRun: true },
    );
    expect(parsed<RefreshLibResult>(res).targets).toEqual(['utils.ts']);
  });

  it('returns an error result when the refresh throws', async () => {
    vi.mocked(refreshLibCore).mockRejectedValue(new Error('lib fetch failed'));
    const res = await call('refresh_lib', {});
    expect(res.isError).toBe(true);
    expect(text(res)).toBe('lib fetch failed');
  });
});

describe('migrate', () => {
  const outcome = (status: string): MigrateOutcome =>
    ({ status, plan: { structural: ['button'] } } as unknown as MigrateOutcome);

  it('errors when the project is not initialized', async () => {
    vi.mocked(getConfig).mockResolvedValue(null);
    const res = await call('migrate', { dryRun: true });
    expect(res.isError).toBe(true);
    expect(text(res)).toContain('init_project');
    expect(migrateCore).not.toHaveBeenCalled();
  });

  it('forwards dryRun / force alongside the resolved source and returns the outcome', async () => {
    vi.mocked(migrateCore).mockResolvedValue(outcome('dry-run'));
    const res = await call('migrate', { dryRun: true, force: true, branch: 'feat/x' });
    expect(migrateCore).toHaveBeenCalledWith(CWD, getDefaultConfig(), expect.objectContaining({
      branch: 'feat/x', dryRun: true, force: true,
    }));
    expect(parsed<MigrateOutcome>(res).status).toBe('dry-run');
  });

  it('passes the unclean-tree refusal straight through as a normal result', async () => {
    vi.mocked(migrateCore).mockResolvedValue(outcome('unclean-tree'));
    const res = await call('migrate', {});
    expect(res.isError).toBeFalsy();
    expect(parsed<MigrateOutcome>(res).status).toBe('unclean-tree');
  });

  it('returns an error result when the migration throws', async () => {
    vi.mocked(migrateCore).mockRejectedValue(new Error('write failed'));
    const res = await call('migrate', {});
    expect(res.isError).toBe(true);
    expect(text(res)).toBe('write failed');
  });
});

describe('apply_addon', () => {
  beforeEach(() => {
    vi.mocked(applyCore).mockResolvedValue(applyResult());
  });

  it('rejects a component that is not an addon before touching the project', async () => {
    const res = await call('apply_addon', { addon: 'button' });
    expect(res.isError).toBe(true);
    expect(text(res)).toContain('not an addon');
    expect(applyCore).not.toHaveBeenCalled();
  });

  it('errors when the project is not initialized', async () => {
    vi.mocked(getConfig).mockResolvedValue(null);
    const res = await call('apply_addon', { addon: 'data-table/context-menu' });
    expect(res.isError).toBe(true);
    expect(text(res)).toContain('init_project');
    expect(applyCore).not.toHaveBeenCalled();
  });

  it('wires the addon non-interactively with the targeting filters', async () => {
    const res = await call('apply_addon', {
      addon: 'data-table/context-menu', components: ['UsersTableComponent'],
      all: true, class: 'grid', id: 'main', dryRun: true, branch: 'feat/x',
    });
    expect(applyCore).toHaveBeenCalledWith(
      'data-table/context-menu',
      ['UsersTableComponent'],
      expect.objectContaining({
        yes: true, all: true, class: 'grid', id: 'main', dryRun: true, branch: 'feat/x',
      }),
      CWD,
      getDefaultConfig(),
    );
    expect(parsed<{ totalWired: number; hadConflicts: boolean }>(res))
      .toMatchObject({ totalWired: 1, hadConflicts: false });
  });

  it('defaults the target list to every app-code usage', async () => {
    await call('apply_addon', { addon: 'data-table/context-menu' });
    expect(vi.mocked(applyCore).mock.calls[0][1]).toEqual([]);
  });

  it('reports hadConflicts when the base was merged with conflict markers', async () => {
    vi.mocked(applyCore).mockResolvedValue(applyResult(conflictedReport()));
    const res = await call('apply_addon', { addon: 'data-table/context-menu' });
    expect(parsed<{ hadConflicts: boolean }>(res).hadConflicts).toBe(true);
  });

  it('turns an ApplyError from the core into an error result', async () => {
    vi.mocked(applyCore).mockRejectedValue(new ApplyError('no usage found'));
    const res = await call('apply_addon', { addon: 'data-table/context-menu' });
    expect(res.isError).toBe(true);
    expect(text(res)).toBe('no usage found');
  });

  it('turns an unexpected failure into an error result', async () => {
    vi.mocked(applyCore).mockRejectedValue(new Error('disk full'));
    const res = await call('apply_addon', { addon: 'data-table/context-menu' });
    expect(res.isError).toBe(true);
    expect(text(res)).toBe('disk full');
  });
});
