import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { extractBreakingTokens, scanFilesForTokens, printBreakingUsages } from './breaking-scan.js';
import { registry, type ComponentName } from '../registry/index.js';
import type { BreakingChange } from '../registry/index.js';

/** The two real data-table input breaking entries the M4/L8 fix targets. */
function dataTableInputBreaking(): BreakingChange[] {
    return (registry['data-table'].breaking ?? []).filter(c => c.kind === 'input');
}

describe('extractBreakingTokens', () => {
    it('extracts every bracketed input name from a multi-input entry', () => {
        const change: BreakingChange = {
            kind: 'input',
            from: '[rowActions] / [showRowActionsColumn] / [showRowActionsContextMenu] on <ui-data-table>',
            to: 'the uiDtContextMenu directive', note: '', codemod: 'none',
        };
        expect(extractBreakingTokens(change)).toEqual([
            'rowActions', 'showRowActionsColumn', 'showRowActionsContextMenu',
        ]);
    });

    it('extracts a single bracketed input', () => {
        const change: BreakingChange = {
            kind: 'input', from: '[enableColumnMenu] on <ui-data-table>', note: '', codemod: 'none',
        };
        expect(extractBreakingTokens(change)).toEqual(['enableColumnMenu']);
    });

    it('uses the raw from token for a selector change with no brackets', () => {
        const change: BreakingChange = {
            kind: 'selector', from: 'virtualItem', to: 'uiVirtualItem', note: '', codemod: 'selector',
        };
        expect(extractBreakingTokens(change)).toEqual(['virtualItem']);
    });

    it('ignores kinds with no bracketed tokens (output rename, type change)', () => {
        expect(extractBreakingTokens({ kind: 'output', from: 'error', to: 'loadError', note: '' })).toEqual([]);
        expect(extractBreakingTokens({ kind: 'type', from: 'items: T[]', to: 'items: T[] where T', note: '' })).toEqual([]);
    });

    it('matches the real registry data-table entries', () => {
        const tokens = dataTableInputBreaking().flatMap(extractBreakingTokens);
        expect(tokens).toContain('rowActions');
        expect(tokens).toContain('showRowActionsColumn');
        expect(tokens).toContain('enableColumnMenu');
    });
});

describe('scanFilesForTokens', () => {
    const tokens = ['rowActions', 'showRowActionsColumn', 'enableColumnMenu'];

    it('finds a property binding form [token] with a 1-based line number', () => {
        const content = [
            '<ui-data-table',
            '  [data]="rows"',
            '  [rowActions]="actions" />',
        ].join('\n');
        const usages = scanFilesForTokens([{ path: 'a.html', content }], tokens);
        expect(usages).toEqual([{ path: 'a.html', line: 3, token: 'rowActions' }]);
    });

    it('finds banana-box [(token)] and event (token) forms without double-counting', () => {
        const banana = scanFilesForTokens(
            [{ path: 'a.html', content: '<x [(enableColumnMenu)]="v" />' }], tokens,
        );
        expect(banana).toEqual([{ path: 'a.html', line: 1, token: 'enableColumnMenu' }]);
        const event = scanFilesForTokens(
            [{ path: 'b.html', content: '<x (rowActions)="onit()" />' }], tokens,
        );
        expect(event).toEqual([{ path: 'b.html', line: 1, token: 'rowActions' }]);
    });

    it('does not match a longer token that merely contains a shorter one', () => {
        // scanning only for [rowActions] must NOT report [showRowActionsColumn]
        const usages = scanFilesForTokens(
            [{ path: 'a.html', content: '<x [showRowActionsColumn]="true" />' }], ['rowActions'],
        );
        expect(usages).toEqual([]);
    });

    it('reports one usage per line per token across multiple files', () => {
        const usages = scanFilesForTokens([
            { path: 'a.html', content: '<x [rowActions]="a" />\n<y [enableColumnMenu]="b" />' },
            { path: 'b.html', content: 'nothing here' },
        ], tokens);
        expect(usages).toEqual([
            { path: 'a.html', line: 1, token: 'rowActions' },
            { path: 'a.html', line: 2, token: 'enableColumnMenu' },
        ]);
    });

    it('returns nothing when no token is bound', () => {
        expect(scanFilesForTokens([{ path: 'a.html', content: '<ui-data-table [data]="x" />' }], tokens)).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// printBreakingUsages — end-to-end against real consumer files on disk
// ---------------------------------------------------------------------------

describe('printBreakingUsages', () => {
    let root = '';
    let logged: string[] = [];

    /** Write an app component with an external `.html` template. */
    async function writeExternalTemplateComponent(dir: string, name: string, template: string): Promise<void> {
        await fs.ensureDir(dir);
        await fs.writeFile(path.join(dir, `${name}.component.ts`), [
            `import { Component } from '@angular/core';`,
            `@Component({ selector: 'app-${name}', templateUrl: './${name}.component.html' })`,
            `export class ${name}Component {}`,
        ].join('\n'));
        await fs.writeFile(path.join(dir, `${name}.component.html`), template);
    }

    beforeEach(async () => {
        root = await fs.mkdtemp(path.join(os.tmpdir(), 'breaking-scan-'));
        logged = [];
        vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
            logged.push(args.map(String).join(' '));
        });
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        await fs.remove(root);
    });

    it('reports the consumer file and 1-based line that binds a removed input', async () => {
        await writeExternalTemplateComponent(root, 'page', [
            '<h1>Report</h1>',
            '<ui-data-table',
            '  [rowActions]="actions" />',
        ].join('\n'));

        await printBreakingUsages(['data-table'] as ComponentName[], root, []);

        const output = logged.join('\n');
        expect(output).toContain('data-table');
        expect(output).toContain(`page.component.html:3 ([rowActions])`);
    });

    it('resolves an inline template to the .ts file itself', async () => {
        await fs.writeFile(path.join(root, 'inline.component.ts'), [
            `import { Component } from '@angular/core';`,
            '@Component({',
            '  selector: "app-inline",',
            '  template: `<ui-data-table [enableColumnMenu]="true" />`,',
            '})',
            'export class InlineComponent {}',
        ].join('\n'));

        await printBreakingUsages(['data-table'] as ComponentName[], root, []);

        expect(logged.join('\n')).toContain('inline.component.ts:4 ([enableColumnMenu])');
    });

    it('reassures a consumer whose code binds none of the removed inputs', async () => {
        await writeExternalTemplateComponent(root, 'clean', '<ui-data-table [data]="rows" />');

        await printBreakingUsages(['data-table'] as ComponentName[], root, []);

        const output = logged.join('\n');
        expect(output).toContain('no usages found in your app code');
        expect(output).not.toContain('.component.html:');
    });

    it('prints nothing when no touched component carries scannable breaking tokens', async () => {
        await writeExternalTemplateComponent(root, 'page', '<ui-data-table [rowActions]="a" />');

        await printBreakingUsages(['button', 'badge'] as ComponentName[], root, []);

        expect(logged).toEqual([]);
    });

    it('caps the listing at 10 usages and reports the remainder as "+N more"', async () => {
        const lines = Array.from({ length: 13 }, (_, i) => `<ui-data-table [rowActions]="a${i}" />`);
        await writeExternalTemplateComponent(root, 'many', lines.join('\n'));

        await printBreakingUsages(['data-table'] as ComponentName[], root, []);

        const output = logged.join('\n');
        expect(output).toContain('many.component.html:10 ([rowActions])');
        expect(output).not.toContain('many.component.html:11 ([rowActions])');
        expect(output).toContain('+3 more');
    });

    it('ignores a component class that declares no template at all', async () => {
        await fs.writeFile(path.join(root, 'no-template.component.ts'), [
            `import { Component } from '@angular/core';`,
            `@Component({ selector: 'app-none' })`,
            'export class NoneComponent { readonly rowActions = []; }',
        ].join('\n'));

        await printBreakingUsages(['data-table'] as ComponentName[], root, []);

        expect(logged.join('\n')).toContain('no usages found in your app code');
    });

    it('does not scan the managed UI directory (only the consumer\'s own code)', async () => {
        const managedDir = path.join(root, 'src', 'components', 'ui');
        await writeExternalTemplateComponent(managedDir, 'data-table', '<x [rowActions]="a" />');

        await printBreakingUsages(['data-table'] as ComponentName[], root, [managedDir]);

        expect(logged.join('\n')).toContain('no usages found in your app code');
    });
});
