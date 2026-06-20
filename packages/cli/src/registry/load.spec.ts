import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { loadRegistry } from './load.js';
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
        for (const key of Object.keys(mutable)) delete mutable[key];
        Object.assign(mutable, structuredClone(snapshot));
        __resetRegistryCaches();
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
