import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { loadRegistry, isValidRegistryShape, __resetRegistryManifestCache } from './load.js';
import { registry, __resetRegistryCaches, getReverseDependents, type ComponentDefinition } from './index.js';

const mutable = registry as unknown as Record<string, ComponentDefinition>;

function stubFetch(response: Partial<Response>): void {
    vi.stubGlobal('fetch', vi.fn(async () => response as Response));
}

describe('loadRegistry', () => {
    let snapshot: Record<string, ComponentDefinition>;

    beforeAll(() => {
        snapshot = structuredClone(mutable);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        __resetRegistryManifestCache();
        for (const key of Object.keys(mutable)) delete mutable[key];
        Object.assign(mutable, structuredClone(snapshot));
        __resetRegistryCaches();
    });

    it('caches one manifest per source: a second branch refetches, a repeat does not', async () => {
        const manifest = (extra: string): string => JSON.stringify({
            button: { name: 'button', files: ['button/button.component.ts'] },
            [extra]: { name: extra, files: [`${extra}/${extra}.component.ts`] },
        });
        const fetchMock = vi.fn(async (url: string) => ({
            ok: true,
            text: async () => manifest(url.includes('/feat/x/') ? 'branch-only' : 'master-only'),
        } as unknown as Response));
        vi.stubGlobal('fetch', fetchMock);

        await loadRegistry({ remote: true, branch: 'master' });
        expect(registry['master-only' as never]).toBeDefined();

        // A different branch is a different registry — its manifest is fetched.
        await loadRegistry({ remote: true, branch: 'feat/x' });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(registry['branch-only' as never]).toBeDefined();
        expect(registry['master-only' as never]).toBeUndefined();

        // Repeat calls on either key are served from the cache — no refetch.
        await loadRegistry({ remote: true, branch: 'master' });
        await loadRegistry({ remote: true, branch: 'feat/x' });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(registry['branch-only' as never]).toBeDefined();
    });

    it('keys the cache by registry base URL too', async () => {
        const fetchMock = vi.fn(async () => ({
            ok: true,
            text: async () => JSON.stringify({ button: { name: 'button', files: ['button/button.component.ts'] } }),
        } as unknown as Response));
        vi.stubGlobal('fetch', fetchMock);

        await loadRegistry({ remote: true, branch: 'master' });
        await loadRegistry({ remote: true, branch: 'master', registry: 'https://fork.test/components' });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('repopulates the registry from the live manifest and resets the reverse-dep memo', async () => {
        // Prime the memo against the bundled snapshot so we can prove it is reset.
        getReverseDependents('button' as never);

        stubFetch({
            ok: true,
            text: async () =>
                JSON.stringify({
                    foo: { name: 'foo', files: ['foo/foo.component.ts'], dependencies: ['button'] },
                    button: { name: 'button', files: ['button/button.component.ts'] },
                }),
        });

        const applied = await loadRegistry({ remote: true, branch: 'master' });

        expect(applied).toBe(true);
        expect(registry['foo' as never]).toBeDefined();
        // Old bundled entries are gone — it was repopulated, not merged.
        expect(registry['accordion' as never]).toBeUndefined();
        // Memo recomputed against fresh data: foo now depends on button.
        expect(getReverseDependents('button' as never).has('foo' as never)).toBe(true);
    });

    it('keeps the bundled snapshot and warns when the fetch fails', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        stubFetch({ ok: false, status: 500, statusText: 'Server Error' });

        const applied = await loadRegistry({ remote: true, branch: 'master' });

        expect(applied).toBe(false);
        expect(registry['accordion' as never]).toBeDefined();
        expect(warn).toHaveBeenCalledOnce();
    });

    it('keeps the bundled snapshot and warns on malformed JSON', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        stubFetch({ ok: true, text: async () => 'not json at all' });

        const applied = await loadRegistry({ remote: true, branch: 'master' });

        expect(applied).toBe(false);
        expect(registry['accordion' as never]).toBeDefined();
        expect(warn).toHaveBeenCalledOnce();
    });
});

describe('isValidRegistryShape', () => {
    it('accepts a manifest of plain components', () => {
        const manifest = {
            button: { name: 'button', files: ['button/button.component.ts'] },
        };
        expect(isValidRegistryShape(manifest)).toBe(true);
    });

    it('rejects non-object input', () => {
        expect(isValidRegistryShape(null)).toBe(false);
        expect(isValidRegistryShape(42)).toBe(false);
    });

    it('rejects an entry missing name or files', () => {
        expect(isValidRegistryShape({ x: { name: 'x' } })).toBe(false);
        expect(isValidRegistryShape({ x: { files: [] } })).toBe(false);
    });

    it('accepts a well-formed addon entry', () => {
        const manifest = {
            'data-table': {
                name: 'data-table',
                files: ['data-table/data-table.component.ts'],
            },
            'data-table/export': {
                name: 'data-table/export',
                files: ['data-table/addons/export/export.directive.ts'],
                type: 'addon',
                parent: 'data-table',
                attach: {
                    import: "DataTableExport from './ui/data-table/addons/export'",
                    selector: 'dtExport',
                },
            },
        };
        expect(isValidRegistryShape(manifest)).toBe(true);
    });

    it('rejects an addon entry missing parent', () => {
        const manifest = {
            'data-table/export': {
                name: 'data-table/export',
                files: ['data-table/addons/export/export.directive.ts'],
                type: 'addon',
                attach: { import: "DataTableExport from './x'", selector: 'dtExport' },
            },
        };
        expect(isValidRegistryShape(manifest)).toBe(false);
    });

    it('rejects an addon entry missing attach', () => {
        const manifest = {
            'data-table/export': {
                name: 'data-table/export',
                files: ['data-table/addons/export/export.directive.ts'],
                type: 'addon',
                parent: 'data-table',
            },
        };
        expect(isValidRegistryShape(manifest)).toBe(false);
    });

    it('accepts a base entry with a valid addons array', () => {
        const manifest = {
            'data-table': {
                name: 'data-table',
                files: ['data-table/data-table.component.ts'],
                addons: ['data-table/export', 'data-table/context-menu'],
            },
        };
        expect(isValidRegistryShape(manifest)).toBe(true);
    });

    it('rejects a base entry whose addons is not an array of strings', () => {
        const make = (addons: unknown) => ({
            a: { name: 'a', files: ['a/a.component.ts'], addons },
        });
        expect(isValidRegistryShape(make('data-table/export'))).toBe(false);
        expect(isValidRegistryShape(make([1, 2]))).toBe(false);
    });

    it('rejects an addon entry whose attach lacks import or selector', () => {
        const base = {
            name: 'data-table/export',
            files: ['data-table/addons/export/export.directive.ts'],
            type: 'addon',
            parent: 'data-table',
        };
        expect(isValidRegistryShape({ a: { ...base, attach: { selector: 'dtExport' } } })).toBe(false);
        expect(isValidRegistryShape({ a: { ...base, attach: { import: 'X from "./x"' } } })).toBe(false);
    });
});
