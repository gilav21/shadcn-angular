import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs-extra';
import { resolveUpdateTargets } from './update.js';
import { getDefaultConfig } from '../utils/config.js';

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
