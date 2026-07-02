import { describe, it, expect } from 'vitest';
import { extractBreakingTokens, scanFilesForTokens } from './breaking-scan.js';
import { registry } from '../registry/index.js';
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
