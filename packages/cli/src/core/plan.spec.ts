import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs-extra';
import { classifyComponent, summarizePlan, collectBreakingChanges, collectSuggestedAddons } from './plan.js';
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
    // on disk, every peer file reads as "missing". This is now the sole
    // regression guard for Bug 2 — the former e2e/cli-specs/peerfiles-missing.ts
    // asserted against data-table's real peerFiles, which were retired when
    // context-menu moved to an opt-in addon (commit 511514e); it was retired
    // rather than kept failing against data that no longer exists.
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

describe('collectBreakingChanges (data-table context-menu migration)', () => {
  it('surfaces the rowActions / enableColumnMenu input breaking changes for data-table', () => {
    const breaking = collectBreakingChanges(['data-table']);
    expect(breaking).toHaveLength(1);
    const { component, changes } = breaking[0];
    expect(component).toBe('data-table');
    // the context-menu migration entries are input-kind (other addons add their own)
    expect(changes.some(c => c.kind === 'input')).toBe(true);
    expect(changes.some(c => c.from.includes('rowActions'))).toBe(true);
    expect(changes.some(c => c.from.includes('enableColumnMenu'))).toBe(true);
    // every note must point the dev at the migration (the uiDtContextMenu directive)
    expect(changes.every(c => c.note.includes('uiDtContextMenu') || c.note.toLowerCase().includes('apply'))).toBe(true);
  });

  it('returns [] for a component with no breaking changes', () => {
    expect(collectBreakingChanges(['button'])).toEqual([]);
  });
});

describe('collectSuggestedAddons', () => {
  it('dedupes the addon suggested by multiple breaking changes on the same component', () => {
    const breaking = collectBreakingChanges(['data-table']);
    expect(collectSuggestedAddons(breaking)).toEqual(['data-table/context-menu', 'data-table/export', 'data-table/pivot']);
  });

  it('returns [] when no breaking change suggests an addon', () => {
    const breaking = collectBreakingChanges(['file-viewer']);
    expect(collectSuggestedAddons(breaking)).toEqual([]);
  });

  it('sorts and dedupes across multiple components', () => {
    const breaking = [
      { component: 'b', changes: [{ kind: 'input' as const, from: 'x', note: 'n', suggestedAddon: 'z/addon' }] },
      { component: 'a', changes: [{ kind: 'input' as const, from: 'y', note: 'n', suggestedAddon: 'z/addon' }] },
      { component: 'c', changes: [{ kind: 'input' as const, from: 'w', note: 'n', suggestedAddon: 'a/addon' }] },
    ];
    expect(collectSuggestedAddons(breaking)).toEqual(['a/addon', 'z/addon']);
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

  it('surfaces suggestedAddons for a plan whose breaking changes recommend one (C12)', () => {
    const plan = summarizePlan(
      { toInstall: ['data-table'], toSkip: [], conflicting: [], peerFilesToUpdate: new Set(), contentCache: new Map() },
      new Set(['data-table']),
    );
    expect(plan.suggestedAddons).toEqual(['data-table/context-menu', 'data-table/export', 'data-table/pivot']);
  });

  it('reports an empty suggestedAddons list when nothing recommends an addon (C12)', () => {
    const plan = summarizePlan(
      { toInstall: ['badge'], toSkip: [], conflicting: [], peerFilesToUpdate: new Set(), contentCache: new Map() },
      new Set(['badge']),
    );
    expect(plan.suggestedAddons).toEqual([]);
  });
});
