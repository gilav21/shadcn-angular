import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs-extra';
import { classifyComponent, summarizePlan } from './plan.js';
import { registry } from '../registry/index.js';

vi.mock('fs-extra', () => ({
  default: {
    pathExists: vi.fn(),
    readFile: vi.fn(),
    existsSync: vi.fn(() => false),
  },
}));
vi.mock('./fetch.js', () => ({
  fetchAndTransform: vi.fn(async () => 'REMOTE'),
  normalizeContent: (s: string) => s.replaceAll('\r\n', '\n').trim(),
}));

const opts = { branch: 'master' } as const;

describe('classifyComponent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns "install" when files are missing', async () => {
    (fs.pathExists as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    const result = await classifyComponent(
      'badge', '/proj/ui', opts, '@/lib', new Map(), new Set(),
    );
    expect(result).toBe('install');
  });

  it('returns "skip" when present and identical', async () => {
    (fs.pathExists as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (fs.readFile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('REMOTE');
    const result = await classifyComponent(
      'badge', '/proj/ui', opts, '@/lib', new Map(), new Set(),
    );
    expect(result).toBe('skip');
  });

  it('returns "conflict" when present but changed', async () => {
    (fs.pathExists as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (fs.readFile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('LOCAL EDIT');
    const result = await classifyComponent(
      'badge', '/proj/ui', opts, '@/lib', new Map(), new Set(),
    );
    expect(result).toBe('conflict');
  });

  it('queues a peer file that is MISSING on disk, not just changed (Bug 2)', async () => {
    // peerFiles is an opt-in mechanism; no shipped component currently declares
    // any, so inject a fixture to exercise the missing-file path. With nothing
    // on disk, every peer file reads as "missing".
    const entry = registry['data-table'] as { peerFiles?: readonly string[] };
    const original = entry.peerFiles;
    entry.peerFiles = ['alpha.directive.ts', 'beta.directive.ts'];
    try {
      (fs.pathExists as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(false);
      const peerSet = new Set<string>();
      await classifyComponent(
        'data-table', '/proj/ui', opts, '@/lib', new Map(), peerSet,
      );
      // Before the fix, "missing" peer files were skipped (only "changed" queued),
      // so peer directives never installed and the build broke. All declared peer
      // files must now be queued.
      expect([...peerSet].sort((a, b) => a.localeCompare(b))).toEqual([
        'alpha.directive.ts',
        'beta.directive.ts',
      ]);
    } finally {
      entry.peerFiles = original;
    }
  });
});

describe('summarizePlan', () => {
  it('flattens sets and collects npm deps', () => {
    const plan = summarizePlan(
      { toInstall: ['badge'], toSkip: [], conflicting: [], peerFilesToUpdate: new Set(['p.ts']), contentCache: new Map() },
      new Set(['badge']),
    );
    expect(plan.toInstall).toEqual(['badge']);
    expect(plan.peerFilesToUpdate).toEqual(['p.ts']);
    expect(Array.isArray(plan.npmDependencies)).toBe(true);
  });
});
