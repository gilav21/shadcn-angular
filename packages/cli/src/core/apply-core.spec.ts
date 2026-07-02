import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { ApplyError, resolveAddonInfo, wireAddonCore, applyCore } from './apply-core.js';
import { getDefaultConfig } from '../utils/config.js';
import { emptyMergeReport } from './merge.js';

describe('resolveAddonInfo', () => {
  it('resolves a real addon entry to its attach metadata', () => {
    const info = resolveAddonInfo('data-table/context-menu', 'src/app/ui');
    expect(info.parent).toBe('data-table');
    expect(info.tag).toBe('ui-data-table');
    expect(info.selector).toBe('uiDtContextMenu');
    expect(info.requiresBaseFiles).toContain('data-table/data-table.host.ts');
  });

  it('defaults the tag to the ui- prefix when none is given', () => {
    expect(resolveAddonInfo('data-table/context-menu', 'src/app/ui').tag).toBe('ui-data-table');
  });

  it('uses the configured prefix for the base tag (prefixed install)', () => {
    const info = resolveAddonInfo('data-table/context-menu', 'src/app/ui', 'acme');
    expect(info.tag).toBe('acme-data-table');
    // The attribute selector is a camelCase directive selector — the prefix
    // rewrite never touches it, so it stays canonical regardless of prefix.
    expect(info.selector).toBe('uiDtContextMenu');
  });

  it('throws ApplyError (not process.exit) for a non-addon component', () => {
    expect(() => resolveAddonInfo('button', 'src/app/ui')).toThrow(ApplyError);
  });
});

describe('wireAddonCore (silent, non-interactive)', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'apply-core-'));
  });
  afterEach(async () => {
    await fs.remove(dir);
  });

  const COMPONENT = (template: string, className = 'FooComponent') => `import { Component } from '@angular/core';

@Component({
  selector: 'app-foo',
  standalone: true,
  imports: [],
  template: \`${template}\`,
})
export class ${className} {}
`;

  it('wires the addon attribute + import into a target chosen by class name', async () => {
    const file = path.join(dir, 'foo.component.ts');
    await fs.writeFile(file, COMPONENT('<ui-data-table></ui-data-table>'));

    const addon = resolveAddonInfo('data-table/context-menu', 'src/app/ui');
    const result = await wireAddonCore(addon, ['FooComponent'], { branch: 'master' }, dir, []);

    expect(result.totalWired).toBe(1);
    const after = await fs.readFile(file, 'utf-8');
    expect(after).toContain('uiDtContextMenu');
    expect(after).toContain("DataTableContextMenuDirective");
    expect(after).toMatch(/imports:\s*\[DataTableContextMenuDirective/);
  });

  it('finds the usage by project scan when no component is named', async () => {
    const file = path.join(dir, 'bar.component.ts');
    await fs.writeFile(file, COMPONENT('<ui-data-table />', 'BarComponent'));

    const addon = resolveAddonInfo('data-table/context-menu', 'src/app/ui');
    const result = await wireAddonCore(addon, [], { branch: 'master' }, dir, []);

    expect(result.totalWired).toBe(1);
    expect(result.targets[0].className).toBe('BarComponent');
    expect(await fs.readFile(file, 'utf-8')).toContain('uiDtContextMenu');
  });

  it('dry-run reports the wiring count without touching the file', async () => {
    const file = path.join(dir, 'foo.component.ts');
    const original = COMPONENT('<ui-data-table></ui-data-table>');
    await fs.writeFile(file, original);

    const addon = resolveAddonInfo('data-table/context-menu', 'src/app/ui');
    const result = await wireAddonCore(addon, ['FooComponent'], { dryRun: true, branch: 'master' }, dir, []);

    expect(result.totalWired).toBe(1);
    expect(await fs.readFile(file, 'utf-8')).toBe(original);
  });

  it('is idempotent — re-wiring an already-wired target changes nothing', async () => {
    const file = path.join(dir, 'foo.component.ts');
    await fs.writeFile(file, COMPONENT('<ui-data-table></ui-data-table>'));

    const addon = resolveAddonInfo('data-table/context-menu', 'src/app/ui');
    await wireAddonCore(addon, ['FooComponent'], { branch: 'master' }, dir, []);
    const afterFirst = await fs.readFile(file, 'utf-8');
    const second = await wireAddonCore(addon, ['FooComponent'], { branch: 'master' }, dir, []);

    expect(second.totalWired).toBe(0);
    expect(await fs.readFile(file, 'utf-8')).toBe(afterFirst);
  });
});

describe('applyCore merge reporting', () => {
  let dir: string;
  beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'apply-core-merge-')); });
  afterEach(async () => { await fs.remove(dir); });

  it('threads a mergeReport through the result (empty on a dry-run, no install)', async () => {
    const result = await applyCore('data-table/context-menu', [], { branch: 'master', dryRun: true }, dir, getDefaultConfig());
    // The field must exist so the MCP apply_addon tool can surface install conflicts
    // (previously the performInstall result was discarded).
    expect(result.mergeReport).toEqual(emptyMergeReport());
    expect(result.installed).toBe(false);
  });
});
