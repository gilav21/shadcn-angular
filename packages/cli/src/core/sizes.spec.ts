/**
 * Install-size accounting — the data behind UC-7.
 *
 * The number `why` prints is the one a developer weighs before typing `add`,
 * so the two ways it could lie both get a test: double-counting shared lib
 * files (which would inflate it), and silently dropping files the manifest has
 * no entry for (which would deflate it).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    formatBytes,
    loadFileSizes,
    summarizeInstallSize,
    __resetFileSizesCache,
    type FileSizes,
} from './sizes.js';
import { registry, type ComponentName } from '../registry/index.js';
import { resolveDependencies } from './resolve.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const committed = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'packages/components/file-sizes.json'), 'utf-8'),
) as FileSizes;

beforeEach(() => {
    __resetFileSizesCache();
});

describe('formatBytes', () => {
    it('keeps small files in bytes', () => {
        expect(formatBytes(0)).toBe('0 B');
        expect(formatBytes(1023)).toBe('1023 B');
    });

    it('switches to KB and MB at the right thresholds', () => {
        expect(formatBytes(1024)).toBe('1.0 KB');
        expect(formatBytes(1536)).toBe('1.5 KB');
        expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    });
});

describe('summarizeInstallSize', () => {
    const fake: FileSizes = {
        version: 1,
        ui: {
            'a/a.component.ts': { bytes: 100, lines: 10 },
            'b/b.component.ts': { bytes: 200, lines: 20 },
        },
        lib: { 'utils.ts': { bytes: 50, lines: 5 } },
        blocks: {},
    };

    it('reports nothing when no manifest could be loaded', () => {
        expect(summarizeInstallSize(['button'], null))
            .toEqual({ bytes: 0, lines: 0, files: 0, unmeasured: 0 });
    });

    it('counts a shared lib file once, not once per component', () => {
        const shared = new Set<string>();
        for (const name of resolveDependencies(['button', 'card'])) {
            for (const file of registry[name].libFiles ?? []) shared.add(file);
        }
        expect(shared.size).toBeGreaterThan(0);

        const both = summarizeInstallSize(['button', 'card'], committed);
        const separate = summarizeInstallSize(['button'], committed).files
            + summarizeInstallSize(['card'], committed).files;
        expect(both.files).toBeLessThan(separate);
    });

    it('includes the transitive closure, not just the component itself', () => {
        const own = registry['button'].files.length
            + (registry['button'].libFiles?.length ?? 0);
        const summary = summarizeInstallSize(['button'], committed);
        expect(summary.files).toBeGreaterThan(own);
        expect([...resolveDependencies(['button'])].length).toBeGreaterThan(1);
    });

    it('flags files the manifest has no entry for instead of under-reporting', () => {
        const summary = summarizeInstallSize(['button'], fake);
        expect(summary.bytes).toBe(0);
        expect(summary.unmeasured).toBe(summary.files);
    });

    it('sums bytes and lines from the manifest', () => {
        const measured = summarizeInstallSize(['button'], committed);
        expect(measured.bytes).toBeGreaterThan(1000);
        expect(measured.lines).toBeGreaterThan(100);
        expect(measured.unmeasured).toBe(0);
    });

    it('grows monotonically as more components are asked for', () => {
        const one = summarizeInstallSize(['button'], committed);
        const two = summarizeInstallSize(['button', 'data-table'], committed);
        expect(two.bytes).toBeGreaterThan(one.bytes);
        expect(two.files).toBeGreaterThan(one.files);
    });

    it('measures every component in the registry — no gaps in the manifest', () => {
        const gaps: string[] = [];
        for (const name of Object.keys(registry) as ComponentName[]) {
            if (summarizeInstallSize([name], committed).unmeasured > 0) gaps.push(name);
        }
        expect(gaps).toEqual([]);
    });
});

describe('loadFileSizes', () => {
    it('reads the manifest from the local monorepo checkout', async () => {
        const sizes = await loadFileSizes();
        expect(sizes?.version).toBe(1);
        expect(Object.keys(sizes?.ui ?? {}).length).toBeGreaterThan(100);
    });

    it('caches per source, so repeated calls do not refetch', async () => {
        const first = await loadFileSizes();
        expect(await loadFileSizes()).toBe(first);
    });

    it('returns null rather than throwing when the fetch fails', async () => {
        const spy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
        expect(await loadFileSizes({ remote: true })).toBeNull();
        spy.mockRestore();
    });

    it('returns null on a non-OK response', async () => {
        const spy = vi.spyOn(globalThis, 'fetch')
            .mockResolvedValue(new Response('nope', { status: 404 }));
        expect(await loadFileSizes({ remote: true })).toBeNull();
        spy.mockRestore();
    });

    it('rejects a payload that is not a size manifest', async () => {
        const spy = vi.spyOn(globalThis, 'fetch')
            .mockResolvedValue(new Response(JSON.stringify({ nope: true }), { status: 200 }));
        expect(await loadFileSizes({ remote: true })).toBeNull();
        spy.mockRestore();
    });

    it('fetches from the branch it would install the sources from', async () => {
        const spy = vi.spyOn(globalThis, 'fetch')
            .mockResolvedValue(new Response('{}', { status: 200 }));
        await loadFileSizes({ remote: true, branch: 'some-branch' });
        const url = String(spy.mock.calls[0]?.[0]);
        expect(url).toContain('/some-branch/packages/components/file-sizes.json');
        expect(url).not.toContain('/ui/');
        spy.mockRestore();
    });
});
