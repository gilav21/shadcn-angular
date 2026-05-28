import { describe, it, expect } from 'vitest';
import { getDefaultConfig, getBlocksAlias } from './config.js';

describe('getBlocksAlias', () => {
  it('defaults to @/blocks when absent', () => {
    const cfg = getDefaultConfig();
    delete (cfg.aliases as { blocks?: string }).blocks;
    expect(getBlocksAlias(cfg)).toBe('@/blocks');
  });

  it('uses the configured value when present', () => {
    const cfg = getDefaultConfig();
    cfg.aliases.blocks = '@/features';
    expect(getBlocksAlias(cfg)).toBe('@/features');
  });

  it('includes blocks in the default config', () => {
    expect(getDefaultConfig().aliases.blocks).toBe('@/blocks');
  });
});
