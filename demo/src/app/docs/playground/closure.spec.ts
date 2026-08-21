// T-1, T-2, T-6 from `specs/stackblitz-playground-spec.md` §2.1.
//
// The closure walk decides what source ends up in a generated playground. Get
// it wrong and the project either misses a file and fails to compile, or drags
// in the whole registry.
import { describe, it, expect, beforeAll } from 'vitest';
import { resolveClosure, type PlaygroundRegistry } from './closure';

const REGISTRY: PlaygroundRegistry = {
    button: {
        name: 'button',
        files: ['button/button.component.ts', 'button/index.ts'],
        libFiles: ['utils.ts'],
        dependencies: ['ripple'],
        npmDependencies: ['class-variance-authority'],
    },
    ripple: {
        name: 'ripple',
        files: ['ripple.directive.ts'],
        libFiles: ['utils.ts'],
    },
    card: {
        name: 'card',
        files: ['card/card.component.ts', 'card/index.ts'],
        dependencies: ['button'],
        libFiles: ['utils.ts', 'a11y.ts'],
    },
    lonely: {
        name: 'lonely',
        files: ['lonely/lonely.component.ts'],
    },
    // A deliberate cycle: the walk must terminate rather than recurse forever.
    ping: { name: 'ping', files: ['ping.ts'], dependencies: ['pong'] },
    pong: { name: 'pong', files: ['pong.ts'], dependencies: ['ping'] },
    // Depends on something the registry does not contain.
    orphaned: { name: 'orphaned', files: ['orphaned.ts'], dependencies: ['nope'] },
};

describe('T-1 the closure covers the component and every transitive dependency', () => {
    it('walks dependencies to their end', () => {
        const closure = resolveClosure(REGISTRY, 'card');
        expect(closure.components).toEqual(['button', 'card', 'ripple']);
    });

    it('collects the files of every component in the closure', () => {
        const closure = resolveClosure(REGISTRY, 'card');
        expect(closure.files).toEqual([
            'button/button.component.ts',
            'button/index.ts',
            'card/card.component.ts',
            'card/index.ts',
            'ripple.directive.ts',
        ]);
    });

    it('is just the component itself when it depends on nothing', () => {
        expect(resolveClosure(REGISTRY, 'lonely').components).toEqual(['lonely']);
    });
});

describe('T-2 lib files are collected across the closure and de-duplicated', () => {
    it('lists each lib file once however many components need it', () => {
        // `utils.ts` is claimed by all three; it must appear exactly once.
        const closure = resolveClosure(REGISTRY, 'card');
        expect(closure.libFiles).toEqual(['a11y.ts', 'utils.ts']);
    });

    it('collects npm dependencies across the closure', () => {
        expect(resolveClosure(REGISTRY, 'card').npmDependencies)
            .toEqual(['class-variance-authority']);
    });

    it('returns empty lists rather than undefined when nothing is declared', () => {
        const closure = resolveClosure(REGISTRY, 'lonely');
        expect(closure.libFiles).toEqual([]);
        expect(closure.npmDependencies).toEqual([]);
    });
});

describe('T-6 the walk terminates and reports what it could not resolve', () => {
    it('terminates on a dependency cycle', () => {
        const closure = resolveClosure(REGISTRY, 'ping');
        expect(closure.components).toEqual(['ping', 'pong']);
        expect(closure.files).toEqual(['ping.ts', 'pong.ts']);
    });

    it('reports a dependency missing from the registry instead of silently dropping it', () => {
        const closure = resolveClosure(REGISTRY, 'orphaned');
        expect(closure.missing).toEqual(['nope']);
        // The rest still resolves, so the caller can decide whether to proceed.
        expect(closure.components).toEqual(['orphaned']);
    });

    it('has nothing missing for a fully resolvable closure', () => {
        expect(resolveClosure(REGISTRY, 'card').missing).toEqual([]);
    });

    it('throws when the requested component is not in the registry at all', () => {
        expect(() => resolveClosure(REGISTRY, 'ghost')).toThrow(/ghost/);
    });
});

/**
 * The fixture above is hand-written, so it can drift from the manifest the app
 * actually fetches. This resolves against the REAL `registry.json` — the same
 * file the CLI installs from — so a shape change fails here rather than at a
 * reader's click.
 */
describe('the resolver works against the committed registry', () => {
    let registry: PlaygroundRegistry;

    beforeAll(async () => {
        const response = await fetch('/packages/components/registry.json');
        registry = (await response.json()) as PlaygroundRegistry;
    });

    it('reads the manifest in the shape the resolver expects', () => {
        expect(Object.keys(registry).length).toBeGreaterThan(150);
        expect(Array.isArray(registry['button'].files)).toBe(true);
    });

    it('resolves a real component and pulls in its declared dependencies', () => {
        const closure = resolveClosure(registry, 'button');
        for (const dep of registry['button'].dependencies ?? []) {
            expect(closure.components).toContain(dep);
        }
        expect(closure.components).toContain('button');
        expect(closure.files.length).toBeGreaterThan(registry['button'].files.length);
    });

    it('resolves every component in the registry without missing anything', () => {
        const unresolved: Record<string, readonly string[]> = {};
        for (const name of Object.keys(registry)) {
            const closure = resolveClosure(registry, name);
            if (closure.missing.length > 0) unresolved[name] = closure.missing;
        }
        // A dependency naming something absent from the registry is a registry
        // bug that would produce a playground that cannot compile.
        expect(unresolved).toEqual({});
    });
});
