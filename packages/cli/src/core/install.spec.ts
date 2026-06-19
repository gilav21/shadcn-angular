import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs-extra';
import { performInstall, planInstall } from './install.js';
import { getDefaultConfig } from '../utils/config.js';

vi.mock('fs-extra', () => ({
  default: {
    pathExists: vi.fn(async () => false),
    readFile: vi.fn(async () => ''),
    writeFile: vi.fn(async () => undefined),
    ensureDir: vi.fn(async () => undefined),
    existsSync: vi.fn(() => false),
    readJson: vi.fn(async () => ({ version: 1, files: {} })),
    writeJson: vi.fn(async () => undefined),
  },
}));
vi.mock('./fetch.js', () => ({
  fetchAndTransform: vi.fn(async (f: string) => `// ${f}`),
  fetchLibContent: vi.fn(async (f: string) => `// lib ${f}`),
  normalizeContent: (s: string) => s.replaceAll('\r\n', '\n').trim(),
}));
vi.mock('../utils/package-manager.js', () => ({ installPackages: vi.fn(async () => undefined) }));
vi.mock('../utils/shortcut-registry.js', () => ({ writeShortcutRegistryIndex: vi.fn(async () => undefined) }));

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

    const overwriteRun = await performInstall({ ...base, components: ['separator'], overwrite: ['separator'] });
    expect(overwriteRun.installed).toContain('separator');
    expect(overwriteRun.declined).toEqual([]);
    expect((fs.writeFile as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
  });

  it('honors precomputedConflicts instead of detecting again', async () => {
    // Files appear present on disk, which would normally classify as skip/conflict,
    // but the caller-supplied plan says "install badge" — that must win.
    (fs.pathExists as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (fs.readFile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('whatever');

    const result = await performInstall({
      ...base,
      components: ['badge'],
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
