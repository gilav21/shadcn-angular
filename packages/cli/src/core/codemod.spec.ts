import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { scanStaleSelectors, selectorRenames } from './codemod.js';
import { collectBreakingChanges } from './plan.js';

describe('selectorRenames', () => {
  it('extracts virtual-scroll selector rename from breaking metadata', () => {
    const renames = selectorRenames(['virtual-scroll']);
    expect(renames).toContainEqual({ component: 'virtual-scroll', from: 'virtualItem', to: 'uiVirtualItem' });
  });

  it('is empty for a component with no selector renames', () => {
    expect(selectorRenames(['button'])).toEqual([]);
  });
});

describe('collectBreakingChanges', () => {
  it('surfaces file-viewer output rename', () => {
    const out = collectBreakingChanges(['file-viewer']);
    expect(out[0].component).toBe('file-viewer');
    expect(out[0].changes[0]).toMatchObject({ kind: 'output', from: 'error', to: 'loadError' });
  });

  it('is empty for a component with no breaking changes', () => {
    expect(collectBreakingChanges(['button'])).toEqual([]);
  });
});

describe('scanStaleSelectors', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'codemod-'));
  });
  afterEach(async () => {
    await fs.remove(dir);
  });

  it('warns (file:line) about a consumer template using the old selector', async () => {
    const tpl = path.join(dir, 'src', 'list.component.html');
    await fs.ensureDir(path.dirname(tpl));
    await fs.writeFile(tpl, '<div>\n  <ng-template virtualItem let-item>{{ item }}</ng-template>\n</div>\n');

    const hits = await scanStaleSelectors(dir, ['virtual-scroll']);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ from: 'virtualItem', to: 'uiVirtualItem', line: 2 });
  });

  it('does not flag an unrelated identifier outside ng-template', async () => {
    const ts = path.join(dir, 'src', 'thing.ts');
    await fs.ensureDir(path.dirname(ts));
    await fs.writeFile(ts, 'const virtualItem = 1;\n');
    expect(await scanStaleSelectors(dir, ['virtual-scroll'])).toEqual([]);
  });

  it('rewrites the selector when fix is true', async () => {
    const tpl = path.join(dir, 'a.html');
    await fs.writeFile(tpl, '<ng-template virtualItem let-x>{{x}}</ng-template>\n');
    await scanStaleSelectors(dir, ['virtual-scroll'], true);
    const after = await fs.readFile(tpl, 'utf-8');
    expect(after).toContain('uiVirtualItem');
    expect(after).not.toContain('virtualItem ');
  });
});
