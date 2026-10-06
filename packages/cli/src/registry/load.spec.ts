import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { loadRegistry, isValidRegistryShape, __resetRegistryManifestCache } from './load.js';
import { registry, __resetRegistryCaches, getReverseDependents, type ComponentDefinition } from './index.js';

const mutable = registry as unknown as Record<string, ComponentDefinition>;
const REGISTRY_JSON = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)), '../../../components/registry.json',
);

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

    // Regression (review finding #4): a local monorepo checkout only stands in for
    // the DEFAULT source. Ignoring an explicit branch / registry here resolved
    // NAMES and files[] from the local manifest while core/fetch.ts pulled the
    // SOURCES from the named branch or fork — the exact split this branch closes.
    it('goes remote for the manifest when a non-default branch is named, even in the monorepo', async () => {
        const fetchMock = vi.fn(async (_url: string) => ({
            ok: true,
            text: async () => JSON.stringify({ 'branch-only': { name: 'branch-only', files: [] } }),
        } as unknown as Response));
        vi.stubGlobal('fetch', fetchMock);

        // No `remote: true` — the local packages/components/registry.json exists.
        await loadRegistry({ branch: 'feat/x' });

        expect(fetchMock).toHaveBeenCalledOnce();
        expect(String(fetchMock.mock.calls[0][0])).toContain('/feat/x/');
        expect(registry['branch-only' as never]).toBeDefined();
    });

    it('goes remote for the manifest when a custom registry base URL is named', async () => {
        const fetchMock = vi.fn(async (_url: string) => ({
            ok: true,
            text: async () => JSON.stringify({ 'fork-only': { name: 'fork-only', files: [] } }),
        } as unknown as Response));
        vi.stubGlobal('fetch', fetchMock);

        await loadRegistry({ registry: 'https://fork.test/components' });

        expect(String(fetchMock.mock.calls[0][0])).toBe('https://fork.test/components/registry.json');
        expect(registry['fork-only' as never]).toBeDefined();
    });

    it('still reads the local manifest for the default source (no fetch)', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        expect(await loadRegistry({})).toBe(true);
        expect(await loadRegistry({ branch: 'master' })).toBe(true);

        expect(fetchMock).not.toHaveBeenCalled();
        expect(registry['button' as never]).toBeDefined();
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

    it('loadRegistry warns with the violation and applies the bundled snapshot', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const bundledObsolete = structuredClone(registry['page-builder'].obsoleteFiles);
        const live = JSON.parse(fs.readFileSync(REGISTRY_JSON, 'utf-8')) as Record<string, ComponentDefinition>;
        live['page-builder'] = { ...live['page-builder'], obsoleteFiles: ['../../../.env'] };
        stubFetch({ ok: true, text: async () => JSON.stringify(live) });

        const applied = await loadRegistry({ remote: true, branch: 'master' });

        expect(applied).toBe(false);
        expect(warn).toHaveBeenCalledWith(
            '⚠ Could not use the registry manifest from '
            + 'https://raw.githubusercontent.com/gilav21/shadcn-angular/master/packages/components/registry.json: '
            + 'page-builder.obsoleteFiles contains "../../../.env" (path leaves its install directory); '
            + 'using the bundled copy, which may be stale.',
        );
        expect(registry['page-builder'].obsoleteFiles).toEqual(bundledObsolete);
    });

    it('lists the first three violations and counts the rest', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        stubFetch({
            ok: true,
            text: async () => JSON.stringify({
                a: { name: 'a', files: ['../1.ts', '../2.ts', '../3.ts', '../4.ts', '../5.ts'] },
            }),
        });

        await loadRegistry({ remote: true, branch: 'master' });

        const message = String(warn.mock.calls[0][0]);
        expect(message).toContain('a.files contains "../3.ts" (path leaves its install directory) (+2 more);');
        expect(message).not.toContain('../4.ts');
    });

    it('never prints a control character from the manifest into the terminal', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        // Hostile keys carrying a C0 ESC and a C1 CSI: keys are printed outside
        // the JSON-quoted value, so they need escaping of their own.
        stubFetch({
            ok: true,
            text: async () => JSON.stringify({
                'x\u001b[2J': { name: 'x\u001b[2J', files: [] },
                'y\u009b2J': { name: 'y\u009b2J', files: [] },
            }),
        });

        await loadRegistry({ remote: true, branch: 'master' });

        const message = String(warn.mock.calls[0][0]);
        expect(message).not.toContain('\u001b');
        expect(message).not.toContain('\u009b');
        expect(message).toContain(String.raw`x\u001b[2J.key`);
        expect(message).toContain(String.raw`y\u009b2J.key`);
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

    // -----------------------------------------------------------------------
    // presets (UC-16 / T-29)
    // -----------------------------------------------------------------------

    const withPresets = (presets: unknown) => ({
        a: { name: 'a', files: ['a/a.component.ts'], presets },
    });

    it('accepts an entry with a valid presets map (T-29)', () => {
        expect(isValidRegistryShape(withPresets({
            core: [],
            writing: ['a/one', 'a/two'],
        }))).toBe(true);
    });

    it('accepts an entry with an empty presets map, and one with no presets at all (T-29)', () => {
        expect(isValidRegistryShape(withPresets({}))).toBe(true);
        expect(isValidRegistryShape({ a: { name: 'a', files: ['a/a.component.ts'] } })).toBe(true);
    });

    it('rejects presets that is an array rather than an object (T-29)', () => {
        expect(isValidRegistryShape(withPresets([]))).toBe(false);
        expect(isValidRegistryShape(withPresets(['writing']))).toBe(false);
    });

    it('rejects a preset whose value is not an array of strings (T-29)', () => {
        expect(isValidRegistryShape(withPresets({ writing: 'a/links' }))).toBe(false);
        expect(isValidRegistryShape(withPresets({ writing: [1, 2] }))).toBe(false);
        expect(isValidRegistryShape(withPresets({ writing: null }))).toBe(false);
    });

    it('rejects presets that is null (T-29)', () => {
        expect(isValidRegistryShape(withPresets(null))).toBe(false);
    });

    it('ignores unknown keys, so an old CLI keeps parsing a newer manifest (T-29)', () => {
        expect(isValidRegistryShape({
            a: {
                name: 'a',
                files: ['a/a.component.ts'],
                somethingInventedLater: { deeply: ['nested'] },
                anotherNewField: 42,
            },
        })).toBe(true);
    });
});
