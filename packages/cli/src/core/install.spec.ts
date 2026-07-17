import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs-extra';
import { performInstall, planInstall, previewComponentMerges, expandForTests } from './install.js';
import { getDefaultConfig } from '../utils/config.js';
import { isPristineLib } from './lib-reconcile.js';
import { installPackages } from '../utils/package-manager.js';
import { writeShortcutRegistryIndex } from '../utils/shortcut-registry.js';
import { fetchAndTransform, fetchLibContent } from './fetch.js';
import type { ComponentName } from '../registry/index.js';
import type { ConflictCheckResult } from './plan.js';

vi.mock('fs-extra', () => ({
  default: {
    pathExists: vi.fn(async () => false),
    readFile: vi.fn(async () => ''),
    writeFile: vi.fn(async () => undefined),
    ensureDir: vi.fn(async () => undefined),
    existsSync: vi.fn(() => false),
    readJson: vi.fn(async () => ({ version: 1, files: {} })),
    writeJson: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
    pathExistsSync: vi.fn(() => false),
    readJsonSync: vi.fn(() => ({})),
  },
}));
vi.mock('./fetch.js', () => ({
  fetchAndTransform: vi.fn(async (f: string) => `// ${f}`),
  fetchLibContent: vi.fn(async (f: string) => `// lib ${f}`),
  normalizeContent: (s: string) => s.replaceAll('\r\n', '\n').trim(),
}));
vi.mock('../utils/package-manager.js', () => ({ installPackages: vi.fn(async () => undefined) }));
vi.mock('../utils/shortcut-registry.js', () => ({ writeShortcutRegistryIndex: vi.fn(async () => undefined) }));
// Control baseline recognition for the L5 pre-manifest pristine-lib path.
vi.mock('./lib-reconcile.js', () => ({ isPristineLib: vi.fn(() => false) }));

// Partial registry mock: every real component plus two fixtures carrying
// `peerFiles` / `npmDependencies`. No shipped component declares either today,
// so the peer-file write, the peer-file prune and the npm-dependency install
// are otherwise unreachable from the real registry.
vi.mock('../registry/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../registry/index.js')>();
  return {
    ...actual,
    registry: {
      ...actual.registry,
      'peer-fixture': {
        name: 'peer-fixture',
        files: ['peer-fixture/peer-fixture.component.ts'],
        peerFiles: ['peer-fixture/shared-peer.ts'],
        npmDependencies: ['@fixture/dep'],
      },
      'peer-fixture-two': {
        name: 'peer-fixture-two',
        files: ['peer-fixture-two/peer-fixture-two.component.ts'],
        peerFiles: ['peer-fixture/shared-peer.ts'],
      },
      // Verified-portable fixtures for the --include-tests path. No shipped
      // component declares testFiles/testDependencies yet, so the test-ship
      // write, the shim install and the testDependency source pull are only
      // reachable through these.
      'tested-fixture': {
        name: 'tested-fixture',
        files: ['tested-fixture/tested-fixture.component.ts'],
        testFiles: ['tested-fixture/tested-fixture.component.spec.ts'],
        testDependencies: ['sibling-fixture'],
      },
      'sibling-fixture': {
        name: 'sibling-fixture',
        files: ['sibling-fixture/sibling-fixture.component.ts'],
        testFiles: ['sibling-fixture/sibling-fixture.component.spec.ts'],
      },
    },
  };
});

const base = { cwd: '/proj', config: getDefaultConfig(), options: { branch: 'master' } };

type Mock = ReturnType<typeof vi.fn>;
const asMock = (fn: unknown): Mock => fn as Mock;

const PEER = 'peer-fixture' as ComponentName;
const PEER_TWO = 'peer-fixture-two' as ComponentName;
const PEER_FILE = 'peer-fixture/shared-peer.ts';

const norm = (p: unknown): string => String(p).replaceAll('\\', '/');
const writtenPaths = (): string[] => asMock(fs.writeFile).mock.calls.map(c => norm(c[0]));

/**
 * Re-establish the module-mock implementations a previous test may have
 * overridden (`vi.clearAllMocks()` clears calls, not implementations).
 */
function resetMocks(): void {
  vi.clearAllMocks();
  asMock(fs.pathExists).mockResolvedValue(false);
  asMock(fs.readFile).mockResolvedValue('');
  asMock(fs.writeFile).mockResolvedValue(undefined);
  asMock(fs.ensureDir).mockResolvedValue(undefined);
  asMock(fs.existsSync).mockReturnValue(false);
  asMock(fs.readJson).mockResolvedValue({ version: 1, files: {} });
  asMock(fs.writeJson).mockResolvedValue(undefined);
  asMock(fs.remove).mockResolvedValue(undefined);
  asMock(fs.pathExistsSync).mockReturnValue(false);
  asMock(fs.readJsonSync).mockReturnValue({});
  asMock(fetchAndTransform).mockImplementation(async (f: string) => `// ${f}`);
  asMock(fetchLibContent).mockImplementation(async (f: string) => `// lib ${f}`);
  asMock(installPackages).mockResolvedValue(undefined);
  asMock(writeShortcutRegistryIndex).mockResolvedValue(undefined);
}

/** A caller-supplied conflict plan, so no detection (or fetching) happens. */
function conflicts(partial: Partial<ConflictCheckResult> = {}): ConflictCheckResult {
  return {
    toInstall: [], toSkip: [], conflicting: [],
    peerFilesToUpdate: new Set<string>(), contentCache: new Map<string, string>(),
    ...partial,
  };
}

describe('performInstall blocks', () => {
  beforeEach(() => vi.clearAllMocks());
  it('writes a block under the blocks base and its component deps under ui', async () => {
    const result = await performInstall({ ...base, components: ['login'], blocksPath: 'src/blocks' });
    expect(result.installed).toContain('login');
    const writes = (fs.writeFile as unknown as ReturnType<typeof vi.fn>).mock.calls
      .map(c => String(c[0]).replaceAll('\\', '/'));
    expect(writes.some(p => p.includes('/blocks/login/'))).toBe(true);
    expect(writes.some(p => p.includes('/components/ui/button/'))).toBe(true);
  });
});

describe('expandForTests', () => {
  it('returns the closure untouched and no testsFor when tests are off', () => {
    const closure = new Set<ComponentName>(['tested-fixture' as ComponentName]);
    const { all, testsFor } = expandForTests(closure, false);
    expect(all).toBe(closure);
    expect(testsFor.size).toBe(0);
  });

  it('pulls testDependencies into the install set but not into testsFor', () => {
    const { all, testsFor } = expandForTests(new Set(['tested-fixture' as ComponentName]), true);
    expect(all.has('tested-fixture' as ComponentName)).toBe(true);
    expect(all.has('sibling-fixture' as ComponentName)).toBe(true);
    expect(testsFor.has('tested-fixture' as ComponentName)).toBe(true);
    expect(testsFor.has('sibling-fixture' as ComponentName)).toBe(false);
  });
});

describe('performInstall --include-tests', () => {
  beforeEach(() => vi.clearAllMocks());
  const TESTED = 'tested-fixture' as ComponentName;
  const specWrites = (): string[] => writtenPaths().filter(p => p.endsWith('.spec.ts'));

  it('writes a component\'s own specs but not those of a test-only dependency', async () => {
    await performInstall({ ...base, components: [TESTED], includeTests: true, testRunner: 'vitest' });
    const specs = specWrites();
    expect(specs.some(p => p.includes('tested-fixture/tested-fixture.component.spec.ts'))).toBe(true);
    expect(specs.some(p => p.includes('sibling-fixture/sibling-fixture.component.spec.ts'))).toBe(false);
    // The test-only dependency's SOURCE is still installed so the specs compile.
    expect(writtenPaths().some(p => p.includes('sibling-fixture/sibling-fixture.component.ts'))).toBe(true);
  });

  it('ships no specs when includeTests is off', async () => {
    await performInstall({ ...base, components: [TESTED] });
    expect(specWrites()).toEqual([]);
  });

  it('installs the vitest-compat shim in jest mode', async () => {
    await performInstall({ ...base, components: [TESTED], includeTests: true, testRunner: 'jest' });
    expect(asMock(fetchLibContent).mock.calls.some(c => String(c[0]) === 'testing/vitest-compat.ts')).toBe(true);
    expect(writtenPaths().some(p => p.includes('lib/testing/vitest-compat.ts'))).toBe(true);
  });

  it('does not install the shim in vitest mode', async () => {
    await performInstall({ ...base, components: [TESTED], includeTests: true, testRunner: 'vitest' });
    expect(writtenPaths().some(p => p.includes('vitest-compat'))).toBe(false);
  });
});

describe('planInstall', () => {
  beforeEach(() => vi.clearAllMocks());
  it('reports a fresh install (no files present)', async () => {
    const plan = await planInstall({ ...base, components: ['badge'] });
    expect(plan.toInstall).toContain('badge');
    expect(plan.conflicting).toEqual([]);
  });
});

describe('performInstall', () => {
  beforeEach(() => vi.clearAllMocks());
  it('writes files for a fresh component and reports it installed', async () => {
    const result = await performInstall({ ...base, components: ['badge'] });
    expect(result.installed).toContain('badge');
    expect((fs.writeFile as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
    // The merge report is threaded out; newly-created files land in `created`.
    expect(result.mergeReport.created.length).toBeGreaterThan(0);
    expect(result.mergeReport.overwritten).toEqual([]);
  });

  it('records installed files in components.lock.json with content hashes', async () => {
    await performInstall({ ...base, components: ['badge'] });
    const writeJson = fs.writeJson as unknown as ReturnType<typeof vi.fn>;
    const lockCall = writeJson.mock.calls.find(c =>
      String(c[0]).replaceAll('\\', '/').endsWith('components.lock.json'));
    expect(lockCall).toBeDefined();
    const manifest = lockCall![1] as { files: Record<string, { sha256: string; component: string }> };
    const entries = Object.values(manifest.files);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(entries[0].component).toBe('badge');
  });

  it('overwrites a changed component only when listed in overwrite, else declines it', async () => {
    // Present (pathExists true) but local content differs from remote => "conflict".
    (fs.pathExists as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (fs.readFile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('LOCAL EDIT');

    const declinedRun = await performInstall({ ...base, components: ['separator'] });
    expect(declinedRun.installed).toEqual([]);
    expect(declinedRun.declined).toContain('separator');

    vi.clearAllMocks();
    (fs.pathExists as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (fs.readFile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('LOCAL EDIT');

    // With the explicit --overwrite escape hatch, the edited file is overwritten
    // whole. (Without --overwrite and with no recorded baseline, the merge layer
    // skips + warns rather than clobbering — covered in merge.spec.ts.)
    const overwriteRun = await performInstall({
      ...base, components: ['separator'], overwrite: ['separator'],
      options: { branch: 'master', overwrite: true },
    });
    expect(overwriteRun.installed).toContain('separator');
    expect(overwriteRun.declined).toEqual([]);
    expect((fs.writeFile as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
  });

  it('treats an interactive overwrite selection (forceOverwrite) as a whole-file clobber', async () => {
    // No --overwrite flag, but the caller marked the overwrite set as an
    // explicit override (interactive selection) → clobber whole-file + advance ref.
    (fs.pathExists as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (fs.readFile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('LOCAL EDIT');

    const run = await performInstall({
      ...base, components: ['separator'], overwrite: ['separator'], forceOverwrite: true,
    });
    expect(run.installed).toContain('separator');
    expect(run.declined).toEqual([]);
    expect((fs.writeFile as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
  });

  it('honors precomputedConflicts instead of detecting again', async () => {
    // Files appear present on disk, which would normally classify as skip/conflict,
    // but the caller-supplied plan says "install badge" — that must win. With
    // --overwrite the present-but-different files are taken whole-file.
    (fs.pathExists as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (fs.readFile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('whatever');

    const result = await performInstall({
      ...base,
      components: ['badge'],
      options: { branch: 'master', overwrite: true },
      precomputedConflicts: {
        toInstall: ['badge'],
        toSkip: [],
        conflicting: [],
        peerFilesToUpdate: new Set(),
        contentCache: new Map(),
      },
    });

    expect(result.installed).toContain('badge');
    expect((fs.writeFile as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
  });

  it('does not write when files are present and identical (skip)', async () => {
    // The fetch mock returns the SAME string for both the local read and the
    // remote fetch, so every file classifies as "identical" => skip.
    const SAME = 'IDENTICAL CONTENT';
    (fs.pathExists as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (fs.readFile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(SAME);
    const fetch = await import('./fetch.js');
    (fetch.fetchAndTransform as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(SAME);

    const result = await performInstall({ ...base, components: ['badge'] });

    expect(result.installed).toEqual([]);
    expect(result.skipped).toContain('badge');
    expect((fs.writeFile as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });
});

describe('performInstall prunes obsolete files (B7)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes a reinstalled component\'s obsolete old-layout file', async () => {
    // page-builder declares `page-builder/property-editor.component.ts` obsolete
    // (replaced by sub/). Present on disk + untracked (no manifest) => pruned.
    const OBSOLETE = 'page-builder/property-editor.component.ts';
    (fs.pathExists as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (p: string) => String(p).replaceAll('\\', '/').endsWith(OBSOLETE),
    );

    const result = await performInstall({ ...base, components: ['page-builder'], options: { branch: 'master', overwrite: true } });

    expect(result.pruned).toContain(OBSOLETE);
    const removed = (fs.remove as unknown as ReturnType<typeof vi.fn>).mock.calls
      .map(c => String(c[0]).replaceAll('\\', '/'));
    expect(removed.some(p => p.endsWith(OBSOLETE))).toBe(true);
  });

  it('keeps an obsolete file the user modified from baseline', async () => {
    const OBSOLETE = 'page-builder/property-editor.component.ts';
    (fs.pathExists as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (p: string) => {
        const norm = String(p).replaceAll('\\', '/');
        return norm.endsWith(OBSOLETE) || norm.endsWith('components.lock.json');
      },
    );
    // Manifest records a DIFFERENT baseline for the obsolete file => "modified" => protected.
    (fs.readJson as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      version: 1,
      files: { [OBSOLETE]: { sha256: 'deadbeef', component: 'page-builder' } },
    });
    (fs.readFile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('USER EDITED');

    const result = await performInstall({ ...base, components: ['page-builder'], options: { branch: 'master', overwrite: true } });

    expect(result.pruned).not.toContain(OBSOLETE);
    expect(result.warnings.some(w => w.includes(OBSOLETE))).toBe(true);
  });
});

describe('installSingleLibFile pre-manifest pristine refresh (L5)', () => {
  // input-group ships a single lib file and no registry deps, so the only lib
  // file installLibFiles touches is input-group.token.ts.
  const LIB = 'input-group.token.ts';
  const isPristineMock = isPristineLib as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Lib file present on disk, everything else (incl. lock.json) absent =>
    // component files install fresh and the lib file reads as 'untracked'.
    (fs.pathExists as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (p: string) => String(p).replaceAll('\\', '/').endsWith(LIB),
    );
    (fs.readFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (p: string) => String(p).replaceAll('\\', '/').endsWith(LIB) ? 'STALE PRISTINE' : '',
    );
  });

  it('refreshes an untracked lib file a published baseline recognizes', async () => {
    isPristineMock.mockReturnValue(true);
    const result = await performInstall({ ...base, components: ['input-group'] });
    const writes = (fs.writeFile as unknown as ReturnType<typeof vi.fn>).mock.calls
      .map(c => String(c[0]).replaceAll('\\', '/'));
    expect(writes.some(p => p.endsWith(LIB))).toBe(true);
    expect(result.warnings.some(w => w.includes(LIB))).toBe(false);
  });

  it('keeps and warns about an untracked lib file no baseline recognizes', async () => {
    isPristineMock.mockReturnValue(false);
    const result = await performInstall({ ...base, components: ['input-group'] });
    const writes = (fs.writeFile as unknown as ReturnType<typeof vi.fn>).mock.calls
      .map(c => String(c[0]).replaceAll('\\', '/'));
    expect(writes.some(p => p.endsWith(LIB))).toBe(false);
    expect(result.warnings.some(w => w.includes(LIB))).toBe(true);
  });

  it('warns (and installs the component anyway) when a lib file cannot be fetched', async () => {
    resetMocks();
    asMock(fetchLibContent).mockRejectedValue(new Error('network down'));

    const result = await performInstall({ ...base, components: ['input-group'] });

    expect(result.installed).toContain('input-group');
    expect(result.warnings.some(w => w.includes(`Could not install lib file ${LIB}`) && w.includes('network down'))).toBe(true);
    expect(writtenPaths().some(p => p.endsWith(LIB))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Peer files
// ---------------------------------------------------------------------------

describe('performInstall peer files', () => {
  beforeEach(() => resetMocks());

  it('writes a peer file listed in peerFilesToUpdate', async () => {
    const result = await performInstall({
      ...base, components: [PEER],
      precomputedConflicts: conflicts({ toInstall: [PEER], peerFilesToUpdate: new Set([PEER_FILE]) }),
    });

    expect(result.installed).toContain(PEER);
    expect(writtenPaths().some(p => p.endsWith(PEER_FILE))).toBe(true);
  });

  it('leaves a peer file alone when it is not in peerFilesToUpdate', async () => {
    await performInstall({
      ...base, components: [PEER],
      precomputedConflicts: conflicts({ toInstall: [PEER] }),
    });

    expect(writtenPaths().some(p => p.endsWith(PEER_FILE))).toBe(false);
  });

  it('drops the peer file of a declined component that nothing else needs', async () => {
    const peerFilesToUpdate = new Set([PEER_FILE]);

    const result = await performInstall({
      ...base, components: [PEER, 'badge'],
      precomputedConflicts: conflicts({
        toInstall: ['badge'], conflicting: [PEER], peerFilesToUpdate,
      }),
    });

    expect(result.declined).toContain(PEER);
    expect(peerFilesToUpdate.has(PEER_FILE)).toBe(false);
    expect(writtenPaths().some(p => p.endsWith(PEER_FILE))).toBe(false);
  });

  it('keeps a declined component\'s peer file when an installed component still ships it', async () => {
    const peerFilesToUpdate = new Set([PEER_FILE]);

    await performInstall({
      ...base, components: [PEER, PEER_TWO],
      precomputedConflicts: conflicts({
        toInstall: [PEER_TWO], conflicting: [PEER], peerFilesToUpdate,
      }),
    });

    expect(peerFilesToUpdate.has(PEER_FILE)).toBe(true);
    expect(writtenPaths().some(p => p.endsWith(PEER_FILE))).toBe(true);
  });

  it('warns when a peer file cannot be fetched, without failing the component', async () => {
    // The component's own file resolves from the cache; only the peer file is fetched.
    const contentCache = new Map([['peer-fixture/peer-fixture.component.ts', '// cached']]);
    asMock(fetchAndTransform).mockRejectedValue(new Error('404'));

    const result = await performInstall({
      ...base, components: [PEER],
      precomputedConflicts: conflicts({
        toInstall: [PEER], peerFilesToUpdate: new Set([PEER_FILE]), contentCache,
      }),
    });

    expect(result.installed).toContain(PEER);
    expect(result.warnings.some(w => w.includes(`Could not update peer file ${PEER_FILE}`) && w.includes('404'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// npm dependencies
// ---------------------------------------------------------------------------

describe('performInstall npm dependencies', () => {
  beforeEach(() => resetMocks());

  it('installs the npm dependencies declared by the written components', async () => {
    await performInstall({
      ...base, components: [PEER],
      precomputedConflicts: conflicts({ toInstall: [PEER] }),
    });

    expect(installPackages).toHaveBeenCalledWith(['@fixture/dep'], { cwd: '/proj' });
  });

  it('warns instead of throwing when the package manager fails', async () => {
    asMock(installPackages).mockRejectedValue(new Error('EACCES'));

    const result = await performInstall({
      ...base, components: [PEER],
      precomputedConflicts: conflicts({ toInstall: [PEER] }),
    });

    expect(result.installed).toContain(PEER);
    expect(result.warnings.some(w => w.includes('Failed to install npm dependencies') && w.includes('EACCES'))).toBe(true);
  });

  it('does not call the package manager when nothing declares npm dependencies', async () => {
    await performInstall({ ...base, components: ['badge'] });
    expect(installPackages).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Failure paths — fetch, manifest write, unmergeable local edits
// ---------------------------------------------------------------------------

describe('performInstall failure paths', () => {
  beforeEach(() => resetMocks());

  it('warns and omits the component when its files cannot be fetched', async () => {
    asMock(fetchAndTransform).mockRejectedValue(new Error('boom'));

    const result = await performInstall({
      ...base, components: ['separator'],
      precomputedConflicts: conflicts({ toInstall: ['separator'] }),
    });

    expect(result.installed).toEqual([]);
    expect(result.warnings.some(w => w.startsWith('Could not add separator/') && w.includes('boom'))).toBe(true);
  });

  it('keeps a locally-edited file with no baseline and tells the user how to take upstream', async () => {
    // Present + edited + no recorded baseline + no force → merge falls back to
    // keeping OURS (never a silent clobber) and the file is left untouched.
    asMock(fs.pathExists).mockResolvedValue(true);
    asMock(fs.readFile).mockResolvedValue('LOCAL EDIT');

    const result = await performInstall({
      ...base, components: ['separator'], overwrite: ['separator'],
    });

    expect(result.mergeReport.fellBack.length).toBeGreaterThan(0);
    expect(result.warnings.some(w => w.includes('locally edited and no recorded baseline') && w.includes('--overwrite'))).toBe(true);
    expect(writtenPaths().some(p => p.includes('separator/'))).toBe(false);
  });

  it('warns when components.lock.json cannot be written', async () => {
    asMock(fs.writeJson).mockRejectedValue(new Error('EROFS'));

    const result = await performInstall({ ...base, components: ['badge'] });

    expect(result.installed).toContain('badge');
    expect(result.warnings.some(w => w.includes('Could not write components.lock.json') && w.includes('EROFS'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Shortcut service
// ---------------------------------------------------------------------------

describe('ensureShortcutService', () => {
  const COMMAND_SOURCE = 'command/command.component.ts';
  const SERVICE = 'shortcut-binding.service.ts';

  beforeEach(() => resetMocks());

  it('installs the shortcut service and indexes the entry when a shortcut component is on disk', async () => {
    asMock(fs.existsSync).mockImplementation((p: string) => norm(p).endsWith(COMMAND_SOURCE));

    await performInstall({
      ...base, components: ['badge'],
      precomputedConflicts: conflicts({ toInstall: ['badge'] }),
    });

    expect(writtenPaths().some(p => p.endsWith(SERVICE))).toBe(true);
    const entries = asMock(writeShortcutRegistryIndex).mock.calls[0][2] as { componentName: string }[];
    expect(entries.map(e => e.componentName)).toContain('command-dialog');
  });

  it('does not re-fetch the service when it already exists', async () => {
    asMock(fs.existsSync).mockImplementation((p: string) => norm(p).endsWith(COMMAND_SOURCE));
    asMock(fs.pathExists).mockImplementation(async (p: string) => norm(p).endsWith(SERVICE));

    await performInstall({
      ...base, components: ['badge'],
      precomputedConflicts: conflicts({ toInstall: ['badge'] }),
    });

    expect(writtenPaths().some(p => p.endsWith(SERVICE))).toBe(false);
    expect(asMock(fetchLibContent).mock.calls.some(c => c[0] === SERVICE)).toBe(false);
  });

  it('writes an empty index when no shortcut component is installed', async () => {
    await performInstall({
      ...base, components: ['badge'],
      precomputedConflicts: conflicts({ toInstall: ['badge'] }),
    });

    expect(writtenPaths().some(p => p.endsWith(SERVICE))).toBe(false);
    expect(asMock(writeShortcutRegistryIndex).mock.calls[0][2]).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// previewComponentMerges — `update --dry-run` predictions (no writes)
// ---------------------------------------------------------------------------

describe('previewComponentMerges', () => {
  beforeEach(() => resetMocks());

  it('predicts "created" for an absent file and writes nothing', async () => {
    const previews = await previewComponentMerges(['separator'], conflicts(), { ...base, components: ['separator'] });

    expect(previews.length).toBeGreaterThan(0);
    expect(previews.every(p => p.outcome === 'created')).toBe(true);
    expect(previews.map(p => p.file)).toContain('separator/separator.component.ts');
    expect(asMock(fs.writeFile)).not.toHaveBeenCalled();
    expect(asMock(fs.writeJson)).not.toHaveBeenCalled();
  });

  it('predicts "fellback-kept" for a locally-edited file with no baseline', async () => {
    asMock(fs.pathExists).mockResolvedValue(true);
    asMock(fs.readFile).mockResolvedValue('LOCAL EDIT');

    const previews = await previewComponentMerges(['separator'], conflicts(), { ...base, components: ['separator'] });

    expect(previews.every(p => p.outcome === 'fellback-kept')).toBe(true);
    expect(asMock(fs.writeFile)).not.toHaveBeenCalled();
  });

  it('predicts "overwritten" for the same edited file under --overwrite', async () => {
    asMock(fs.pathExists).mockResolvedValue(true);
    asMock(fs.readFile).mockResolvedValue('LOCAL EDIT');

    const previews = await previewComponentMerges(['separator'], conflicts(), {
      ...base, components: ['separator'], options: { branch: 'master', overwrite: true },
    });

    expect(previews.every(p => p.outcome === 'overwritten')).toBe(true);
    expect(asMock(fs.writeFile)).not.toHaveBeenCalled();
  });

  it('serves THEIRS from the conflict scan\'s content cache instead of re-fetching', async () => {
    const cached = conflicts({ contentCache: new Map([['separator/separator.component.ts', '// cached']]) });

    await previewComponentMerges(['separator'], cached, { ...base, components: ['separator'] });

    expect(asMock(fetchAndTransform).mock.calls.some(c => c[0] === 'separator/separator.component.ts')).toBe(false);
  });

  it('omits a file whose fetch fails rather than aborting the preview', async () => {
    asMock(fetchAndTransform).mockImplementation(async (f: string) => {
      if (f.endsWith('.component.ts')) throw new Error('404');
      return `// ${f}`;
    });

    const previews = await previewComponentMerges(['separator'], conflicts(), { ...base, components: ['separator'] });

    expect(previews.map(p => p.file)).toEqual(['separator/index.ts']);
  });
});
