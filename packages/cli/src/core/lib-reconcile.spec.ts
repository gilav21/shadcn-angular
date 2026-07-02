import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs-extra';
import { hashContent, emptyManifest, recordFile, type Manifest } from './manifest.js';
import { collectLibDrift, requiredLibFiles, refreshLibFiles } from './lib-reconcile.js';

vi.mock('fs-extra', () => ({
  default: {
    pathExists: vi.fn(),
    readFile: vi.fn(),
    ensureDir: vi.fn(async () => undefined),
    writeFile: vi.fn(async () => undefined),
    writeJson: vi.fn(async () => undefined),
    readJson: vi.fn(async () => ({})),
  },
}));

const fetchLibContent = vi.fn();
vi.mock('./fetch.js', () => ({
  fetchLibContent: (...args: unknown[]) => fetchLibContent(...args),
  normalizeContent: (s: string) => s.replaceAll('\r\n', '\n').trim(),
}));

// Deterministic baselines so the untracked-pristine path is controllable.
const PRISTINE_OLD = 'export const cn = 1;\n'; // a "pristine but stale" lib copy
vi.mock('../registry/lib-baselines.js', () => ({
  LIB_BASELINES: { 'utils.ts': [hashContent('export const cn = 1;\n')] },
}));

const pathExists = fs.pathExists as unknown as ReturnType<typeof vi.fn>;
const readFile = fs.readFile as unknown as ReturnType<typeof vi.fn>;

const opts = { branch: 'master' };

describe('requiredLibFiles', () => {
  it('is empty when no components are installed', () => {
    expect(requiredLibFiles([])).toEqual([]);
  });

  it('includes the core set once any component is installed', () => {
    expect(requiredLibFiles(['label'])).toContain('utils.ts');
  });
});

describe('collectLibDrift', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchLibContent.mockResolvedValue('REMOTE-CURRENT');
  });

  it('reports nothing when the lib file is identical to the registry', async () => {
    pathExists.mockResolvedValue(true);
    readFile.mockResolvedValue('REMOTE-CURRENT');
    const report = await collectLibDrift('/lib', ['label'], emptyManifest(), opts);
    expect(report).toEqual({ stale: [], missing: [], userEdited: [] });
  });

  it('flags a required lib file that is absent on disk as missing', async () => {
    pathExists.mockResolvedValue(false);
    const report = await collectLibDrift('/lib', ['label'], emptyManifest(), opts);
    expect(report.missing).toEqual(['utils.ts']);
  });

  it('treats a manifest-clean file that the registry moved past as stale (safe)', async () => {
    pathExists.mockResolvedValue(true);
    readFile.mockResolvedValue('LOCAL-INSTALLED');
    const manifest: Manifest = emptyManifest();
    recordFile(manifest, 'utils.ts', 'LOCAL-INSTALLED', '(lib)'); // baseline == local
    const report = await collectLibDrift('/lib', ['label'], manifest, opts);
    expect(report.stale).toEqual(['utils.ts']);
    expect(report.userEdited).toEqual([]);
  });

  it('protects a manifest-modified (user-edited) lib file', async () => {
    pathExists.mockResolvedValue(true);
    readFile.mockResolvedValue('USER-EDITED');
    const manifest: Manifest = emptyManifest();
    recordFile(manifest, 'utils.ts', 'WHAT-WE-INSTALLED', '(lib)'); // baseline != local
    const report = await collectLibDrift('/lib', ['label'], manifest, opts);
    expect(report.userEdited).toEqual(['utils.ts']);
    expect(report.stale).toEqual([]);
  });

  it('treats a manifest-modified file matching a published baseline as stale, not user-edited', async () => {
    // A byte-exact historical revision is never a user edit — e.g. the manifest
    // was fingerprinted at init (new content) but the disk carries an old
    // pristine copy (old consumer, branch checkout). Refreshing is safe.
    pathExists.mockResolvedValue(true);
    readFile.mockResolvedValue(PRISTINE_OLD);
    const manifest: Manifest = emptyManifest();
    recordFile(manifest, 'utils.ts', 'REMOTE-CURRENT', '(lib)'); // baseline != local
    const report = await collectLibDrift('/lib', ['label'], manifest, opts);
    expect(report.stale).toEqual(['utils.ts']);
    expect(report.userEdited).toEqual([]);
  });

  it('treats an untracked file matching a published baseline as stale (safe)', async () => {
    pathExists.mockResolvedValue(true);
    readFile.mockResolvedValue(PRISTINE_OLD); // hashes to a baseline, no manifest entry
    const report = await collectLibDrift('/lib', ['label'], emptyManifest(), opts);
    expect(report.stale).toEqual(['utils.ts']);
  });

  it('protects an untracked file matching no baseline (e.g. a set-locale edit)', async () => {
    pathExists.mockResolvedValue(true);
    readFile.mockResolvedValue('LOCALE-CUSTOMIZED-UNKNOWN');
    const report = await collectLibDrift('/lib', ['label'], emptyManifest(), opts);
    expect(report.userEdited).toEqual(['utils.ts']);
  });
});

describe('refreshLibFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchLibContent.mockResolvedValue('FRESH');
  });

  it('writes each file and records its fingerprint', async () => {
    const result = await refreshLibFiles(['utils.ts'], '/lib', '/proj', opts);
    expect(result.refreshed).toEqual(['utils.ts']);
    expect(fs.writeFile).toHaveBeenCalled();
  });

  it('no-ops on an empty list', async () => {
    const result = await refreshLibFiles([], '/lib', '/proj', opts);
    expect(result.refreshed).toEqual([]);
    expect(fs.writeFile).not.toHaveBeenCalled();
  });
});
