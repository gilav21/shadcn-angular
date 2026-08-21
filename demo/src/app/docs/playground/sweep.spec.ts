// T-7 from `specs/stackblitz-playground-spec.md` §2.1 — the whole-registry sweep.
//
// UC-7 is that a new component gets a working playground with no per-component
// authoring. That only holds if every entry either yields a project or records
// why it cannot; an entry that silently does neither is a playground that will
// be quietly missing from the docs.
import { describe, it, expect, beforeAll } from 'vitest';
import { resolveClosure, type PlaygroundRegistry } from './closure';

interface DocEntry {
    readonly name: string;
    readonly snippet: string | null;
    readonly snippetSkipReason: string | null;
    readonly importStatement: string | null;
}

describe('T-7 every registry component yields a playground or a reason', () => {
    let registry: PlaygroundRegistry;
    let docs: readonly DocEntry[];

    beforeAll(async () => {
        const [registryResponse, docsResponse] = await Promise.all([
            fetch('/packages/components/registry.json'),
            fetch('/demo/public/component-docs.json'),
        ]);
        registry = (await registryResponse.json()) as PlaygroundRegistry;
        docs = ((await docsResponse.json()) as { components: DocEntry[] }).components;
    });

    it('covers a realistic number of components', () => {
        // Positive control: a query that matched nothing would pass every
        // assertion below while proving nothing at all.
        expect(docs.length).toBeGreaterThan(150);
    });

    it('gives every component either a runnable snippet or a stated reason', () => {
        const silent = docs
            .filter(d => !d.snippet && !d.snippetSkipReason)
            .map(d => d.name);
        expect(silent).toEqual([]);
    });

    it('gives every component with a snippet something to import', () => {
        const unimportable = docs
            .filter(d => d.snippet && !d.importStatement)
            .map(d => d.name);
        expect(unimportable).toEqual([]);
    });

    it('resolves a complete closure for every buildable component', () => {
        const broken: Record<string, readonly string[]> = {};
        for (const doc of docs) {
            if (!doc.snippet || !doc.importStatement) continue;
            const closure = resolveClosure(registry, doc.name);
            if (closure.missing.length > 0) broken[doc.name] = closure.missing;
            // A closure with no files would generate an empty project.
            expect(closure.files.length).toBeGreaterThan(0);
        }
        expect(broken).toEqual({});
    });

    it('builds for the overwhelming majority of the registry', () => {
        const buildable = docs.filter(d => d.snippet && d.importStatement);
        // 158/165 at the time of writing. A sharp drop means a generator or
        // snippet regression rather than a deliberate change.
        expect(buildable.length).toBeGreaterThanOrEqual(150);
    });
});
