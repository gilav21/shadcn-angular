import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { getDefaultConfig, getBlocksAlias, getConfig } from './config.js';

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

describe('getConfig — update defaults (persistent overwrite preference)', () => {
  let dir: string;
  afterEach(async () => { if (dir) await fs.remove(dir); });

  async function writeComponentsJson(extra: object): Promise<string> {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cfg-'));
    await fs.writeJson(path.join(dir, 'components.json'), {
      tailwind: { css: 'src/styles.scss', baseColor: 'slate' },
      aliases: { components: '@/components', utils: '@/components/lib', ui: '@/components/ui' },
      ...extra,
    });
    return dir;
  }

  it('parses update.overwrite: true', async () => {
    const cwd = await writeComponentsJson({ update: { overwrite: true } });
    const cfg = await getConfig(cwd);
    expect(cfg?.update?.overwrite).toBe(true);
  });

  it('tolerates an absent update block', async () => {
    const cwd = await writeComponentsJson({});
    const cfg = await getConfig(cwd);
    expect(cfg).not.toBeNull();
    expect(cfg?.update).toBeUndefined();
  });

  it('rejects a malformed update block (non-boolean overwrite)', async () => {
    const cwd = await writeComponentsJson({ update: { overwrite: 'yes' } });
    expect(await getConfig(cwd)).toBeNull();
  });
});
