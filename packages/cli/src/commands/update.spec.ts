import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs-extra';
import { resolveUpdateTargets, partitionClosure } from './update.js';
import { getDefaultConfig } from '../utils/config.js';
import type { ComponentName } from '../registry/index.js';

vi.mock('fs-extra', () => ({ default: { pathExists: vi.fn() } }));

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
    expect(res.alreadyInstalled.sort()).toEqual(['button', 'data-table']);
    expect(res.newlyRequired).toEqual(['context-menu']);
  });

  it('treats every closure member as already-installed when all present', () => {
    const res = partitionClosure(
      ['button'] as ComponentName[],
      new Set(['button', 'ripple']) as Set<ComponentName>,
      new Set(['button', 'ripple']) as Set<ComponentName>,
    );
    expect(res.newlyRequired).toEqual([]);
    expect(res.alreadyInstalled.sort()).toEqual(['button', 'ripple']);
  });
});
