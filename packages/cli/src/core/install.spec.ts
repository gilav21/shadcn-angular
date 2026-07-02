import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs-extra';
import { performInstall, planInstall } from './install.js';
import { getDefaultConfig } from '../utils/config.js';
import { isPristineLib } from './lib-reconcile.js';

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

const base = { cwd: '/proj', config: getDefaultConfig(), options: { branch: 'master' } };

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
    // The merge report is threaded out; newly-created files land in `overwritten`.
    expect(result.mergeReport.overwritten.length).toBeGreaterThan(0);
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
});
