import { describe, it, expect } from 'vitest';
import {
  parseAttachSymbol,
  addonImportModule,
  missingBaseFiles,
  findTemplateInstances,
  filterInstances,
  insertSelectorAtInstances,
  wireDirectiveImport,
  resolveTemplateLocation,
  filterFromOptions,
  decideInstances,
} from './apply-wire.js';

describe('parseAttachSymbol', () => {
  it('extracts the symbol from an "X from \'mod\'" attach import', () => {
    expect(parseAttachSymbol("DataTableContextMenuDirective from './ui/data-table/addons/context-menu'"))
      .toBe('DataTableContextMenuDirective');
  });

  it('falls back to the trimmed string when there is no "from"', () => {
    expect(parseAttachSymbol('  DataTableContextMenuDirective ')).toBe('DataTableContextMenuDirective');
  });
});

describe('addonImportModule', () => {
  it('builds the module path under the ui alias from parent + addon key', () => {
    expect(addonImportModule('@/components/ui', 'data-table', 'data-table/context-menu'))
      .toBe('@/components/ui/data-table/addons/context-menu');
  });

  it('trims a trailing slash on the alias', () => {
    expect(addonImportModule('@/components/ui/', 'data-table', 'data-table/context-menu'))
      .toBe('@/components/ui/data-table/addons/context-menu');
  });
});

describe('missingBaseFiles', () => {
  it('returns the required contract files that are absent in the base', () => {
    const present = new Set(['data-table/data-table.host.ts']);
    expect(missingBaseFiles(['data-table/data-table.host.ts'], f => present.has(f))).toEqual([]);
    expect(missingBaseFiles(['data-table/data-table.host.ts', 'data-table/x.ts'], f => present.has(f)))
      .toEqual(['data-table/x.ts']);
  });

  it('returns [] when the addon requires no contract files', () => {
    expect(missingBaseFiles([], () => false)).toEqual([]);
  });
});

describe('findTemplateInstances', () => {
  it('finds each opening tag of the base, quote-aware (ignores ">" inside bindings)', () => {
    const tpl = `
      <ui-data-table [data]="rows" [hidden]="a > b" class="orders" #grid></ui-data-table>
      <ui-data-table [data]="other" />
      <ui-button>nope</ui-button>
    `;
    const found = findTemplateInstances(tpl, 'ui-data-table');
    expect(found).toHaveLength(2);
    expect(found[0].classToken).toBe('orders');
    expect(found[0].ids).toContain('grid');
    expect(found[0].hasSelector('uiDtContextMenu')).toBe(false);
  });

  it('detects an already-present bare attribute (idempotency)', () => {
    const tpl = `<ui-data-table [data]="rows" uiDtContextMenu />`;
    const found = findTemplateInstances(tpl, 'ui-data-table');
    expect(found[0].hasSelector('uiDtContextMenu')).toBe(true);
  });

  it('captures id / template-ref / data-testid', () => {
    const tpl = `<ui-data-table #grid id="orders" data-testid="ordersTable" />`;
    const ids = findTemplateInstances(tpl, 'ui-data-table')[0].ids;
    expect(ids).toEqual(expect.arrayContaining(['grid', 'orders', 'ordersTable']));
  });
});

describe('filterInstances', () => {
  const tpl = `
    <ui-data-table class="orders" #a />
    <ui-data-table class="users" #b />
    <ui-data-table #c data-testid="reports" />
  `;
  const all = findTemplateInstances(tpl, 'ui-data-table');

  it('--all returns every instance', () => {
    expect(filterInstances(all, { mode: 'all' })).toHaveLength(3);
  });

  it('--class matches the tag CSS class token', () => {
    const r = filterInstances(all, { mode: 'class', token: 'users' });
    expect(r).toHaveLength(1);
    expect(r[0].ids).toContain('b');
  });

  it('--id matches id / ref / data-testid', () => {
    expect(filterInstances(all, { mode: 'id', token: 'a' })).toHaveLength(1);
    expect(filterInstances(all, { mode: 'id', token: 'reports' })).toHaveLength(1);
  });
});

describe('insertSelectorAtInstances', () => {
  it('inserts the bare attribute on the selected instances only', () => {
    const tpl = `<ui-data-table [data]="a" />\n<ui-data-table [data]="b" />`;
    const found = findTemplateInstances(tpl, 'ui-data-table');
    const out = insertSelectorAtInstances(tpl, [found[1]], 'uiDtContextMenu');
    expect(out.wired).toBe(1);
    expect(out.content).toBe(`<ui-data-table [data]="a" />\n<ui-data-table [data]="b" uiDtContextMenu />`);
  });

  it('is idempotent — skips an instance that already has the attribute', () => {
    const tpl = `<ui-data-table [data]="a" uiDtContextMenu />`;
    const found = findTemplateInstances(tpl, 'ui-data-table');
    const out = insertSelectorAtInstances(tpl, found, 'uiDtContextMenu');
    expect(out.wired).toBe(0);
    expect(out.content).toBe(tpl);
  });

  it('inserts before the self-closing slash', () => {
    const tpl = `<ui-data-table [data]="a"/>`;
    const found = findTemplateInstances(tpl, 'ui-data-table');
    const out = insertSelectorAtInstances(tpl, found, 'uiDtContextMenu');
    expect(out.content).toBe(`<ui-data-table [data]="a" uiDtContextMenu/>`);
  });
});

describe('wireDirectiveImport', () => {
  const base = `import { Component } from '@angular/core';
import { DataTableComponent } from '@/components/ui/data-table';

@Component({
  selector: 'app-x',
  imports: [DataTableComponent],
  template: '<ui-data-table />',
})
export class XComponent {}`;

  it('adds the import statement and registers the symbol in imports[]', () => {
    const out = wireDirectiveImport(base, 'DataTableContextMenuDirective', '@/components/ui/data-table/addons/context-menu');
    expect(out).not.toBeNull();
    expect(out!.changed).toBe(true);
    expect(out!.content).toContain("import { DataTableContextMenuDirective } from '@/components/ui/data-table/addons/context-menu';");
    expect(/imports:\s*\[[^\]]*DataTableContextMenuDirective[^\]]*\]/.test(out!.content)).toBe(true);
  });

  it('is idempotent when already wired', () => {
    const once = wireDirectiveImport(base, 'DataTableContextMenuDirective', '@/components/ui/data-table/addons/context-menu')!;
    const twice = wireDirectiveImport(once.content, 'DataTableContextMenuDirective', '@/components/ui/data-table/addons/context-menu')!;
    expect(twice.changed).toBe(false);
    expect(twice.content).toBe(once.content);
  });

  it('returns null when there is no @Component imports array to edit', () => {
    const noImports = `export class Bare {}`;
    expect(wireDirectiveImport(noImports, 'Foo', '@/x')).toBeNull();
  });

  it('is idempotent when the symbol is already imported in a multi-line block', () => {
    const src = `import {
  SomethingElse,
  DataTableContextMenuDirective,
} from '@/components/ui/data-table/addons/context-menu';

@Component({ imports: [DataTableContextMenuDirective], template: '' })
export class X {}`;
    const out = wireDirectiveImport(src, 'DataTableContextMenuDirective', '@/components/ui/data-table/addons/context-menu')!;
    expect(out.changed).toBe(false);
    // exactly the original two occurrences (multi-line import + imports[]) — no duplicate import added
    expect((out.content.match(/DataTableContextMenuDirective/g) ?? []).length).toBe(2);
  });
});

describe('resolveTemplateLocation', () => {
  it('detects an inline template', () => {
    expect(resolveTemplateLocation(`@Component({ template: '<ui-data-table />' })`)).toEqual({ inline: true });
  });

  it('detects a backtick inline template', () => {
    expect(resolveTemplateLocation('@Component({ template: `<x/>` })')).toEqual({ inline: true });
  });

  it('detects an external templateUrl and returns it', () => {
    expect(resolveTemplateLocation(`@Component({ templateUrl: './x.component.html' })`))
      .toEqual({ inline: false, templateUrl: './x.component.html' });
  });

  it('returns null when neither is present', () => {
    expect(resolveTemplateLocation(`export class X {}`)).toBeNull();
  });
});

describe('filterFromOptions', () => {
  it('maps instance-selection flags to a filter, or null', () => {
    expect(filterFromOptions({ all: true })).toEqual({ mode: 'all' });
    expect(filterFromOptions({ class: 'x' })).toEqual({ mode: 'class', token: 'x' });
    expect(filterFromOptions({ id: 'y' })).toEqual({ mode: 'id', token: 'y' });
    expect(filterFromOptions({})).toBeNull();
  });
});

describe('decideInstances', () => {
  const two = findTemplateInstances(`<ui-data-table #a /><ui-data-table #b />`, 'ui-data-table');

  it('applies an explicit filter (--all)', () => {
    const d = decideInstances('uiDtContextMenu', two, { all: true });
    expect(d.kind).toBe('instances');
    expect(d.kind === 'instances' && d.instances).toHaveLength(2);
  });

  it('applies --class', () => {
    const inst = findTemplateInstances(`<ui-data-table class="x" /><ui-data-table class="y" />`, 'ui-data-table');
    const d = decideInstances('uiDtContextMenu', inst, { class: 'y' });
    expect(d.kind === 'instances' && d.instances).toHaveLength(1);
  });

  it('auto-selects when exactly one unwired instance and no flag', () => {
    const one = findTemplateInstances(`<ui-data-table #only />`, 'ui-data-table');
    const d = decideInstances('uiDtContextMenu', one, {});
    expect(d).toEqual({ kind: 'instances', instances: one });
  });

  it('returns "snippet" when ambiguous and non-interactive (--yes)', () => {
    expect(decideInstances('uiDtContextMenu', two, { yes: true }).kind).toBe('snippet');
  });

  it('returns "prompt" when ambiguous and interactive', () => {
    expect(decideInstances('uiDtContextMenu', two, {}).kind).toBe('prompt');
  });

  it('returns "snippet" when an explicit filter matches no instances', () => {
    expect(decideInstances('uiDtContextMenu', two, { class: 'nonexistent' }).kind).toBe('snippet');
  });

  it('treats already-wired instances as not needing a choice (single unwired → auto)', () => {
    const wired = findTemplateInstances(`<ui-data-table uiDtContextMenu #a /><ui-data-table #b />`, 'ui-data-table');
    expect(decideInstances('uiDtContextMenu', wired, {})).toEqual({ kind: 'instances', instances: wired });
  });
});
