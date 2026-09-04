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

/**
 * Every identifier that appears inside a backtick code span in the guide,
 * including each identifier within a compound span like
 * `saveSelection() / restoreSelection()`. Checking membership here rather than
 * a bare `guide.includes(name)` is what stops a short member name such as
 * `compact` from being "documented" by an incidental word in the prose.
 */
function codeSpanIdentifiers(guide: string): Set<string> {
    // Drop fenced blocks first: their ``` delimiters otherwise pair with the
    // inline spans around them and swallow whole sections.
    const prose = guide.replaceAll(/```[\s\S]*?```/g, '\n');
    const out = new Set<string>();
    for (const span of prose.matchAll(/`([^`\n]+)`/g)) {
        for (const ident of span[1].matchAll(/[A-Za-z][\w-]*/g)) out.add(ident[0]);
    }
    return out;
}

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
    it('names every abstract member of RichTextEditorAddonHost in code style', () => {
        const spans = codeSpanIdentifiers(read(GUIDE));
        const missing = hostMembers().filter(m => !spans.has(m));
        expect(missing).toEqual([]);
    });

    it('calls out all eight register* hooks', () => {
        const hooks = hostMembers().filter(m => m.startsWith('register'));
        expect(hooks).toHaveLength(8);
        const guide = read(GUIDE);
        // Each hook must appear with its call signature, not just its name.
        for (const hook of hooks) expect(guide, hook).toContain(`${hook}(`);
    });

    it('names every rich-text addon in code style', () => {
        const spans = codeSpanIdentifiers(read(GUIDE));
        const missing = addonShortNames().filter(a => !spans.has(a));
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

    it('draws every addon directive it declares from that one statement', () => {
        const stmt = /import \{([^}]*)\} from '[^']*rich-text-editor\/addons\/full';/.exec(demo());
        expect(stmt).not.toBeNull();
        const fromFull = new Set(
            (stmt as RegExpExecArray)[1].split(',').map(n => n.trim()).filter(Boolean),
        );
        const declared = /imports: \[([^\]]*)\]/.exec(demo()) as RegExpExecArray;
        const addonDirectives = declared[1]
            .split(',')
            .map(n => n.trim())
            .filter(n => /^RichText\w+Directive$/.test(n));
        // Twelve addon directives on this page, every one of them a named
        // re-export of the single `addons/full` import above.
        expect(addonDirectives.length).toBeGreaterThanOrEqual(11);
        expect(addonDirectives.filter(n => !fromFull.has(n))).toEqual([]);
    });
});
