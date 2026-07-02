import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs-extra';
import {
  resolveUpdateTargets, partitionClosure, customizedAmong,
  shouldOfferAddonApply, filterUninstalledAddons, classifyCustomized,
} from './update.js';
import { getDefaultConfig } from '../utils/config.js';
import { emptyManifest, recordFile } from '../core/manifest.js';
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
    expect([...res.alreadyInstalled].sort((a, b) => a.localeCompare(b))).toEqual(['button', 'data-table']);
    expect(res.newlyRequired).toEqual(['context-menu']);
  });

  it('treats every closure member as already-installed when all present', () => {
    const res = partitionClosure(
      ['button'] as ComponentName[],
      new Set(['button', 'ripple']) as Set<ComponentName>,
      new Set(['button', 'ripple']) as Set<ComponentName>,
    );
    expect(res.newlyRequired).toEqual([]);
    expect([...res.alreadyInstalled].sort((a, b) => a.localeCompare(b))).toEqual(['button', 'ripple']);
  });
});

describe('customizedAmong', () => {
  const filesOf = (n: ComponentName) => [`${n}/${n}.component.ts`];

  it('returns components whose local content drifts from the manifest baseline', () => {
    const m = emptyManifest();
    recordFile(m, 'button/button.component.ts', 'orig', 'button');
    const local = new Map([['button/button.component.ts', 'edited']]);
    expect(customizedAmong(['button'] as ComponentName[], m, local, filesOf)).toEqual(['button']);
  });

  it('excludes components whose local content matches the baseline', () => {
    const m = emptyManifest();
    recordFile(m, 'button/button.component.ts', 'orig', 'button');
    const local = new Map([['button/button.component.ts', 'orig']]);
    expect(customizedAmong(['button'] as ComponentName[], m, local, filesOf)).toEqual([]);
  });
});


describe('shouldOfferAddonApply', () => {
  it('offers only on an interactive TTY without --yes', () => {
    expect(shouldOfferAddonApply({ yes: false, isTTY: true })).toBe(true);
  });

  it('does NOT offer under --yes (a non-interactive run cannot be asked)', () => {
    expect(shouldOfferAddonApply({ yes: true, isTTY: true })).toBe(false);
  });

  it('does NOT offer on a non-TTY stdin (piped / CI) — would auto-accept otherwise', () => {
    expect(shouldOfferAddonApply({ yes: false, isTTY: false })).toBe(false);
    expect(shouldOfferAddonApply({ yes: true, isTTY: false })).toBe(false);
  });
});

describe('filterUninstalledAddons', () => {
  it('drops addons whose first registry file already exists on disk', async () => {
    const seen: string[] = [];
    const out = await filterUninstalledAddons(['context-menu'], async (f) => {
      seen.push(f);
      return true; // installed
    });
    expect(out).toEqual([]);
    expect(seen).toHaveLength(1); // probed the addon's first file
  });

  it('keeps addons whose files are absent (still worth offering)', async () => {
    const out = await filterUninstalledAddons(['context-menu'], async () => false);
    expect(out).toEqual(['context-menu']);
  });

  it('keeps unknown names rather than silently dropping them', async () => {
    const out = await filterUninstalledAddons(['not-a-real-addon'], async () => true);
    expect(out).toEqual(['not-a-real-addon']);
  });
});

describe('classifyCustomized', () => {
  const names = ['button', 'card'] as ComponentName[];

  it('routes every customized component to overwrite when --overwrite is set', () => {
    const b = classifyCustomized(names, true, () => true);
    expect(b.overwrite).toEqual(names);
    expect(b.merge).toEqual([]);
    expect(b.noBaseline).toEqual([]);
  });

  it('splits into merge (has baseline) vs no-baseline when not overwriting', () => {
    const b = classifyCustomized(names, false, (n) => n === 'button');
    expect(b.overwrite).toEqual([]);
    expect(b.merge).toEqual(['button']);
    expect(b.noBaseline).toEqual(['card']);
  });
});
