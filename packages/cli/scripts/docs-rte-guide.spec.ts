import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { registry } from '../src/registry/index.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const GUIDE = path.join(REPO_ROOT, 'docs/rich-text-editor.md');
const HOST = path.join(
    REPO_ROOT,
    'packages/components/ui/rich-text-editor/rich-text-editor.host.ts',
);
const EXAMPLE = path.join(
    REPO_ROOT,
    'demo/src/app/demos/inputs/rich-text-insert-date.directive.ts',
);
const DEMO_MAIN = path.join(
    REPO_ROOT,
    'demo/src/app/demos/inputs/rich-text-editor-demo.component.ts',
);
const README = path.join(REPO_ROOT, 'README.md');

const read = (file: string): string => readFileSync(file, 'utf-8');

/** Every abstract member declared on `RichTextEditorAddonHost`, in source order. */
function hostMembers(): string[] {
    const names: string[] = [];
    for (const line of read(HOST).split('\n')) {
        const found = /^\s+abstract (?:readonly )?(\w+)/.exec(line);
        if (found) names.push(found[1]);
    }
    return names;
}

/** Every rich-text addon registry key's short name (`emoji`, `tables`, …). */
function addonShortNames(): string[] {
    return Object.values(registry)
        .filter(def => def.parent === 'rich-text-editor')
        .map(def => def.name.split('/').at(-1) as string);
}

/**
 * The example directive's body — from its first `const ICON` line to EOF, with
 * the demo app's relative import rewritten to the consumer's `@/` alias so it
 * can be compared against the guide's fenced block verbatim.
 */
function exampleBody(): string {
    const source = read(EXAMPLE);
    const start = source.indexOf('const ICON');
    expect(start, 'example directive has no `const ICON` line').toBeGreaterThan(-1);
    return source
        .slice(start)
        .replace(
            /'(?:\.\.\/)+packages\/components\/ui\/rich-text-editor'/g,
            "'@/components/ui/rich-text-editor'",
        )
        .trimEnd();
}

/**
 * T-16 — `docs/rich-text-editor.md` is the only teacher for writing an addon
 * (the alternative was reverse-engineering a 317-line abstract class). A
 * hand-written guide rots silently, so this test fails the moment a host member
 * is added without documenting it, an addon ships undocumented, or the embedded
 * example drifts from the file the demo actually runs.
 */
describe('docs/rich-text-editor.md drift', () => {
    it('names every abstract member of RichTextEditorAddonHost', () => {
        const guide = read(GUIDE);
        const missing = hostMembers().filter(m => !guide.includes(m));
        expect(missing).toEqual([]);
    });

    it('calls out all eight register* hooks', () => {
        const hooks = hostMembers().filter(m => m.startsWith('register'));
        expect(hooks).toHaveLength(8);
        const guide = read(GUIDE);
        for (const hook of hooks) expect(guide, hook).toContain(hook);
    });

    it('names every rich-text addon', () => {
        const guide = read(GUIDE);
        const missing = addonShortNames().filter(a => !guide.includes(a));
        expect(missing).toEqual([]);
    });

    it('embeds the worked example verbatim (alias-normalized)', () => {
        expect(read(GUIDE)).toContain(exampleBody());
    });

    it('documents the toolbar slot shape and the base/addon boundary', () => {
        const guide = read(GUIDE);
        expect(guide).toContain('RichTextToolbarSlot');
        expect(guide).toContain('toolbarSlots.register');
        expect(guide).toContain('addons/full');
    });

    // T-17
    it('is linked from the README', () => {
        expect(read(README)).toContain('docs/rich-text-editor.md');
    });
});

/**
 * T-18 — UC-2: the main demo proves the one-import claim. It used to carry 12
 * separate addon-barrel import statements; a consumer reading it would conclude
 * they must know the folder layout to use the editor.
 */
describe('rich-text-editor demo imports', () => {
    const demo = () => read(DEMO_MAIN);

    it('imports its addon directives through exactly one addons/full statement', () => {
        const fullImports = demo().match(/from '[^']*rich-text-editor\/addons\/full'/g) ?? [];
        expect(fullImports).toHaveLength(1);
    });

    it('has no value import from an individual addon barrel', () => {
        // `import type { … }` from an addon barrel stays legal — the generated
        // full barrel re-exports directive CLASSES only, by design (NG3004).
        const valueImports = (demo().match(/^import (?!type )[\s\S]*?from '[^']*\/addons\/[^']*';$/gm) ?? [])
            .filter(stmt => !stmt.includes('/addons/full'));
        expect(valueImports).toEqual([]);
    });

    it('still declares RTE_FULL among its component imports', () => {
        expect(demo()).toContain('RTE_FULL');
    });
});
