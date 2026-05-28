import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs-extra';
import { unifiedDiff, diffComponentFiles } from './diff-core.js';

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

  it('marks changed lines with -/+ and a line marker', () => {
    const d = unifiedDiff('a.ts', 'x\nold', 'x\nnew');
    expect(d).toContain('- old');
    expect(d).toContain('+ new');
    expect(d).toContain('@@ line 2 @@');
  });

  it('handles added trailing lines (local shorter than remote)', () => {
    const d = unifiedDiff('a.ts', 'x', 'x\nextra');
    expect(d).toContain('+ extra');
    // No removed-line markers (the `--- ` header is not a content line).
    const removedLines = d.split('\n').filter(l => l.startsWith('- '));
    expect(removedLines).toEqual([]);
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
