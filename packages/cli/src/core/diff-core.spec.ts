import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs-extra';
import { unifiedDiff, symbolDiff, diffComponentFiles } from './diff-core.js';

vi.mock('fs-extra', () => ({
  default: {
    pathExists: vi.fn(),
    readFile: vi.fn(),
  },
}));
vi.mock('./fetch.js', () => ({
  fetchAndTransform: vi.fn(),
  normalizeContent: (s: string) => s.replaceAll('\r\n', '\n').trim(),
}));

describe('unifiedDiff', () => {
  it('returns empty string for identical content', () => {
    expect(unifiedDiff('a.ts', 'x\ny', 'x\ny')).toBe('');
  });

  it('emits a real unified-diff hunk header and -/+ lines', () => {
    const d = unifiedDiff('a.ts', 'x\nold', 'x\nnew');
    expect(d).toContain('-old');
    expect(d).toContain('+new');
    expect(d).toMatch(/^@@ -\d+,\d+ \+\d+,\d+ @@/m);
  });

  it('handles added trailing lines (local shorter than remote)', () => {
    const d = unifiedDiff('a.ts', 'x', 'x\nextra');
    expect(d).toContain('+extra');
    const removedLines = d.split('\n').filter(l => l.startsWith('-') && !l.startsWith('--- '));
    expect(removedLines).toEqual([]);
  });

  it('B1: a single inserted line yields ONE small hunk, no cascade', () => {
    const base = Array.from({ length: 60 }, (_, i) => `line ${i}`);
    const local = base.join('\n');
    const remote = [...base.slice(0, 5), '  count = input<number>(0);', ...base.slice(5)].join('\n');
    const d = unifiedDiff('big.component.ts', local, remote);

    // Exactly one hunk — the insertion must not realign every following line.
    expect(d.match(/^@@ /gm) ?? []).toHaveLength(1);
    // The inserted line is the only added content; nothing is removed.
    const added = d.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++ '));
    const removed = d.split('\n').filter(l => l.startsWith('-') && !l.startsWith('--- '));
    expect(added).toEqual(['+  count = input<number>(0);']);
    expect(removed).toEqual([]);
    // And the whole thing stays tiny (the old positional diff produced ~KBs).
    expect(Buffer.byteLength(d)).toBeLessThan(2048);
  });

  it('re-synchronizes after an edit — the file tail is not re-emitted', () => {
    const a = Array.from({ length: 40 }, (_, i) => `L${i}`).join('\n');
    const b = a.replace('L20', 'L20-edited');
    const d = unifiedDiff('a.ts', a, b);
    expect(d.match(/^@@ /gm) ?? []).toHaveLength(1);
    expect(d).not.toContain('L39'); // a far-away unchanged line is outside the hunk
  });

  it('two distant edits produce two separate hunks', () => {
    const base = Array.from({ length: 40 }, (_, i) => `L${i}`);
    const local = base.join('\n');
    const editTwo = (l: string): string => {
      if (l === 'L2') return 'L2-x';
      if (l === 'L35') return 'L35-y';
      return l;
    };
    const remote = base.map(editTwo).join('\n');
    const d = unifiedDiff('a.ts', local, remote);
    expect(d.match(/^@@ /gm) ?? []).toHaveLength(2);
  });
});

describe('symbolDiff', () => {
  it('reports added inputs and removed methods', () => {
    const local = `  foo = input<string>();\n  doThing() {}\n`;
    const remote = `  foo = input<string>();\n  size = input<'sm'|'lg'>();\n`;
    const out = symbolDiff(local, remote);
    expect(out.added).toContain('size');
    expect(out.removed).toContain('doThing()');
  });
});

describe('diffComponentFiles', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reports no changes when no files are installed (all null)', async () => {
    (fs.pathExists as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    const cd = await diffComponentFiles('badge', '/proj/ui', { branch: 'master' }, '@/lib');
    expect(cd.hasChanges).toBe(false);
    expect(cd.files.every(f => f.diff === null && f.error === undefined)).toBe(true);
  });

  it('flags a fetch error as a change so the CLI still reports it', async () => {
    const fetch = await import('./fetch.js');
    (fs.pathExists as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (fs.readFile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('local');
    (fetch.fetchAndTransform as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('offline'));

    const cd = await diffComponentFiles('badge', '/proj/ui', { branch: 'master' }, '@/lib');

    expect(cd.hasChanges).toBe(true);
    expect(cd.files.some(f => f.error === 'offline' && f.diff === null)).toBe(true);
  });
});
