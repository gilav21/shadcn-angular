/**
 * T-1 / T-2 from `specs/dx-distribution-spec.md` §2.1, plus the unit coverage
 * for the pieces they depend on.
 *
 * The two headline tests run against the REAL committed inputs
 * (`registry.json` + `api-docs.json`) and the REAL committed output
 * (`demo/public/llms.txt`), because a drift gate that runs on fixtures proves
 * nothing about the file that actually ships.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    bindingFor,
    buildEntries,
    buildLlmsTxt,
    corpusEntryNames,
    corpusNames,
    sampleCorpusNames,
    importPathFor,
    parseEntry,
    primaryClassFor,
    indexDocClasses,
    renderEntry,
    sampleEntries,
    snippetFor,
    type LlmsEntry,
    type RegistryEntry,
    type RegistryJson,
} from './gen-llms-lib.js';
import type { ApiClass, ApiDocs, ApiMember } from './gen-api-docs-lib.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function readJson<T>(relative: string): T {
    return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relative), 'utf-8')) as T;
}

const registry = readJson<RegistryJson>('packages/components/registry.json');
const apiDocs = readJson<ApiDocs>('packages/components/api-docs.json');
const committedCorpus = fs.readFileSync(path.join(REPO_ROOT, 'demo/public/llms.txt'), 'utf-8');

// ---------------------------------------------------------------------------
// Fixtures for the edge cases in spec §2.3
// ---------------------------------------------------------------------------

function member(over: Partial<ApiMember> & { name: string }): ApiMember {
    return { type: 'unknown', description: '', ...over };
}

function apiClass(over: Partial<ApiClass> & { name: string; file: string }): ApiClass {
    return {
        kind: 'component',
        selector: '',
        description: '',
        methods: [],
        projectsContent: false,
        inputs: [],
        outputs: [],
        ...over,
    };
}

const FIXTURE_DOCS: ApiDocs = {
    version: 2,
    classes: [
        apiClass({
            name: 'PlainComponent',
            file: 'packages/components/ui/plain/plain.component.ts',
            selector: 'ui-plain',
        }),
        apiClass({
            name: 'BoxComponent',
            file: 'packages/components/ui/box/box.component.ts',
            selector: 'ui-box',
            projectsContent: true,
            inputs: [
                member({ name: 'variant', type: "'a' | 'b'", default: "'a'" }),
                member({ name: 'label', type: 'string', required: true }),
            ],
            outputs: [member({ name: 'closed', type: 'void' })],
        }),
        apiClass({
            name: 'FlashDirective',
            file: 'packages/components/ui/flash.directive.ts',
            kind: 'directive',
            selector: '[uiFlash]',
        }),
        apiClass({
            name: 'GridComponent',
            file: 'packages/components/ui/grid/grid.component.ts',
            selector: 'ui-grid',
            inputs: [member({ name: 'rows', type: 'RowDef<T>[]', required: true })],
        }),
        apiClass({
            name: 'PickerComponent',
            file: 'packages/components/ui/picker/picker.component.ts',
            selector: 'ui-picker',
            inputs: [member({ name: 'filter', type: 'FilterGroup', required: true })],
        }),
        apiClass({
            name: 'ExportDirective',
            file: 'packages/components/ui/grid/addons/export/export.directive.ts',
            kind: 'directive',
            selector: '[uiGridExport]',
        }),
    ],
};

function entry(over: Partial<RegistryEntry> & { name: string }): RegistryEntry {
    return { files: [], ...over };
}

const FIXTURE_REGISTRY: RegistryJson = {
    plain: entry({
        name: 'plain', files: ['plain/index.ts', 'plain/plain.component.ts'],
        description: 'A plain thing.', category: 'utility',
    }),
    box: entry({
        name: 'box', files: ['box/index.ts', 'box/box.component.ts'],
        description: 'A box.', category: 'layout', dependencies: ['plain'],
        npmDependencies: ['zod'],
    }),
    flash: entry({ name: 'flash', files: ['flash.directive.ts'], category: 'utility' }),
    grid: entry({ name: 'grid', files: ['grid/index.ts', 'grid/grid.component.ts'] }),
    picker: entry({ name: 'picker', files: ['picker/index.ts', 'picker/picker.component.ts'] }),
    'grid/export': entry({
        name: 'grid/export', type: 'addon', parent: 'grid',
        files: ['grid/addons/export/index.ts', 'grid/addons/export/export.directive.ts'],
    }),
    login: entry({ name: 'login', type: 'block', files: ['login/index.ts'] }),
};

// ---------------------------------------------------------------------------
// T-1
// ---------------------------------------------------------------------------

describe('T-1: llms.txt lists every registry component exactly once', () => {
    it('has one section per non-block registry entry, and no extras', () => {
        // Sections are grouped by category, so compare as sorted sets.
        const headings = [...committedCorpus.matchAll(/^### (.+)$/gm)]
            .map(m => m[1])
            .sort((a, b) => a.localeCompare(b));
        expect(headings).toEqual(corpusNames(registry));
    });

    it('never repeats a heading', () => {
        const headings = [...committedCorpus.matchAll(/^### (.+)$/gm)].map(m => m[1]);
        expect(new Set(headings).size).toBe(headings.length);
    });

    it('covers every registry entry that is not a block', () => {
        const byName = (a: string, b: string): number => a.localeCompare(b);
        const expected = [...Object.keys(registry).filter(n => registry[n].type !== 'block')]
            .sort(byName);
        expect([...corpusNames(registry)].sort(byName)).toEqual(expected);
        expect(corpusNames(registry).length).toBeGreaterThan(100);
    });

    it('excludes blocks, whose sources are not under packages/components/ui', () => {
        const blocks = Object.keys(registry).filter(n => registry[n].type === 'block');
        expect(blocks.length).toBeGreaterThan(0);
        for (const block of blocks) {
            expect(committedCorpus).not.toContain(`### ${block}\n`);
        }
    });

    it('gives every listed component an install command and an import', () => {
        for (const entryDef of buildEntries(registry, apiDocs)) {
            const section = parseEntry(committedCorpus, entryDef.name);
            expect(section, entryDef.name).not.toBeNull();
            expect(committedCorpus).toContain(`add ${entryDef.name}\``);
        }
    });
});

// ---------------------------------------------------------------------------
// T-2
// ---------------------------------------------------------------------------

describe('T-2: llms.txt regenerates identically from the registry (no drift)', () => {
    it('matches a fresh generation from the committed inputs, byte for byte', () => {
        expect(buildLlmsTxt(registry, apiDocs)).toBe(committedCorpus);
    });

    it('is deterministic — two builds of the same inputs are identical', () => {
        expect(buildLlmsTxt(registry, apiDocs)).toBe(buildLlmsTxt(registry, apiDocs));
    });

    it('does not depend on registry key order', () => {
        const reversed = Object.fromEntries(
            Object.entries(registry).reverse(),
        ) as unknown as RegistryJson;
        expect(buildLlmsTxt(reversed, apiDocs)).toBe(committedCorpus);
    });

    it('changes when the registry changes, so the gate cannot pass vacuously', () => {
        const mutated: RegistryJson = {
            ...registry,
            button: { ...registry['button'], description: 'A different description.' },
        };
        expect(buildLlmsTxt(mutated, apiDocs)).not.toBe(committedCorpus);
    });
});

// ---------------------------------------------------------------------------
// Import paths
// ---------------------------------------------------------------------------

describe('importPathFor', () => {
    it('uses the barrel folder for a folderized component', () => {
        expect(importPathFor(FIXTURE_REGISTRY['box'])).toBe('@/components/ui/box');
    });

    it('uses the file itself for a flat directive with no barrel', () => {
        expect(importPathFor(FIXTURE_REGISTRY['flash'])).toBe('@/components/ui/flash.directive');
    });

    it('handles an addon whose name contains a slash', () => {
        expect(importPathFor(FIXTURE_REGISTRY['grid/export']))
            .toBe('@/components/ui/grid/addons/export');
    });

    it('matches what the e2e harness actually imports for real components', () => {
        expect(importPathFor(registry['button'])).toBe('@/components/ui/button');
        expect(importPathFor(registry['data-table/export']))
            .toBe('@/components/ui/data-table/addons/export');
        expect(importPathFor(registry['confetti'])).toBe('@/components/ui/confetti.directive');
    });
});

// ---------------------------------------------------------------------------
// Primary class
// ---------------------------------------------------------------------------

describe('primaryClassFor', () => {
    const byFile = indexDocClasses(FIXTURE_DOCS);

    it('prefers the file named after the component', () => {
        expect(primaryClassFor(FIXTURE_REGISTRY['box'], byFile)?.name).toBe('BoxComponent');
    });

    it('resolves an addon from its last name segment', () => {
        expect(primaryClassFor(FIXTURE_REGISTRY['grid/export'], byFile)?.name)
            .toBe('ExportDirective');
    });

    it('returns null when no class belongs to the entry', () => {
        expect(primaryClassFor(FIXTURE_REGISTRY['login'], byFile)).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// Bindings and snippets
// ---------------------------------------------------------------------------

describe('bindingFor', () => {
    it('writes a string-literal union as an attribute', () => {
        expect(bindingFor(member({ name: 'variant', type: "'a' | 'b'" }))).toBe('variant="a"');
    });

    it('accepts double-quoted literal unions, which is how TypeScript prints them', () => {
        expect(bindingFor(member({ name: 'type', type: '"button" | "submit"' })))
            .toBe('type="button"');
    });

    it('writes primitives with the form a developer would use', () => {
        expect(bindingFor(member({ name: 'label', type: 'string' }))).toBe('label="text"');
        expect(bindingFor(member({ name: 'count', type: 'number' }))).toBe('[count]="0"');
        expect(bindingFor(member({ name: 'open', type: 'boolean' }))).toBe('[open]="true"');
    });

    it('writes any array type as an empty array, which type-checks for any element', () => {
        expect(bindingFor(member({ name: 'rows', type: 'RowDef<T>[]' }))).toBe('[rows]="[]"');
        expect(bindingFor(member({ name: 'grid', type: 'Cell[][]' }))).toBe('[grid]="[]"');
    });

    it('ignores the undefined/null members a signal input type carries', () => {
        expect(bindingFor(member({ name: 'label', type: 'string | undefined' })))
            .toBe('label="text"');
    });

    it('refuses a type it cannot write a literal for', () => {
        expect(bindingFor(member({ name: 'filter', type: 'FilterGroup' }))).toBeNull();
        expect(bindingFor(member({ name: 'mixed', type: 'string | number' }))).toBeNull();
        expect(bindingFor(member({ name: 'nothing', type: '' }))).toBeNull();
    });

    it('does not split a union nested inside generics', () => {
        expect(bindingFor(member({ name: 'rows', type: 'Array<A | B>' }))).toBeNull();
    });
});

describe('snippetFor', () => {
    const byName = (name: string): ApiClass =>
        FIXTURE_DOCS.classes.find(c => c.name === name) as ApiClass;

    it('self-closes a component that projects no content', () => {
        expect(snippetFor(byName('PlainComponent')).snippet).toBe('<ui-plain />');
    });

    it('emits an open/close pair for a component that projects content', () => {
        expect(snippetFor(byName('BoxComponent')).snippet)
            .toBe('<ui-box label="text">Content</ui-box>');
    });

    it('hosts an attribute-selector directive on a div', () => {
        expect(snippetFor(byName('FlashDirective')).snippet).toBe('<div uiFlash></div>');
    });

    it('binds a required array input so the template compiles', () => {
        expect(snippetFor(byName('GridComponent')).snippet).toBe('<ui-grid [rows]="[]" />');
    });

    it('emits no snippet when a required input needs application data', () => {
        const result = snippetFor(byName('PickerComponent'));
        expect(result.snippet).toBeNull();
        expect(result.reason).toContain('filter: FilterGroup');
    });

    it('emits no snippet for a class with no selector', () => {
        expect(snippetFor(apiClass({ name: 'X', file: 'f.ts' })).snippet).toBeNull();
    });

    it('emits no snippet for a directive scoped to another component', () => {
        const scoped = apiClass({
            name: 'S', file: 'f.ts', kind: 'directive', selector: 'ui-tree[uiTreeMenu]',
        });
        expect(snippetFor(scoped).snippet).toBeNull();
        expect(snippetFor(scoped).reason).toContain('<ui-tree>');
    });

    it('emits no snippet for a null class', () => {
        expect(snippetFor(null).snippet).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// Rendering + parsing round trip
// ---------------------------------------------------------------------------

describe('renderEntry / parseEntry', () => {
    const entries = buildEntries(FIXTURE_REGISTRY, FIXTURE_DOCS);
    const corpus = buildLlmsTxt(FIXTURE_REGISTRY, FIXTURE_DOCS);

    it('renders inputs with type and default, marking required ones', () => {
        const box = entries.find(e => e.name === 'box') as LlmsEntry;
        const text = renderEntry(box);
        expect(text).toContain("`variant: 'a' | 'b' = 'a'`");
        expect(text).toContain('`label: string` (required)');
        expect(text).toContain('`closed: void`');
    });

    it('sorts dependency lists so the corpus does not churn on registry order', () => {
        const churny: RegistryJson = {
            box: entry({
                name: 'box', files: ['box/index.ts', 'box/box.component.ts'],
                dependencies: ['zeta', 'alpha'], npmDependencies: ['zod', 'clsx'],
            }),
        };
        const rendered = renderEntry(buildEntries(churny, FIXTURE_DOCS)[0]);
        expect(rendered).toContain('- Depends on: `alpha`, `zeta`');
        expect(rendered).toContain('- npm dependencies: `clsx`, `zod`');
    });

    it('renders a component with no inputs without an Inputs line', () => {
        const plain = entries.find(e => e.name === 'plain') as LlmsEntry;
        expect(renderEntry(plain)).not.toContain('- Inputs:');
    });

    it('states why a snippet is missing rather than inventing one', () => {
        const picker = entries.find(e => e.name === 'picker') as LlmsEntry;
        expect(renderEntry(picker)).toContain('_No generated snippet:');
    });

    it('round-trips the import statement and snippet back out of the corpus', () => {
        const parsed = parseEntry(corpus, 'box');
        expect(parsed?.importStatement)
            .toBe("import { BoxComponent } from '@/components/ui/box';");
        expect(parsed?.snippet).toBe('<ui-box label="text">Content</ui-box>');
    });

    it('does not bleed the next section into a parsed entry', () => {
        const parsed = parseEntry(corpus, 'flash');
        expect(parsed?.snippet).toBe('<div uiFlash></div>');
    });

    it('returns null for a name that is not in the corpus', () => {
        expect(parseEntry(corpus, 'nope')).toBeNull();
    });

    it('reports no snippet for an entry that has none', () => {
        expect(parseEntry(corpus, 'picker')?.snippet).toBeNull();
    });

    it('round-trips every real entry that claims a snippet', () => {
        for (const real of buildEntries(registry, apiDocs)) {
            const parsed = parseEntry(committedCorpus, real.name);
            expect(parsed?.snippet, real.name).toBe(real.snippet);
        }
    });
});

// ---------------------------------------------------------------------------
// Sampling (feeds the T-3 compile gate)
// ---------------------------------------------------------------------------

describe('sampleEntries', () => {
    const entries = buildEntries(registry, apiDocs);

    it('is stable for a given seed', () => {
        expect(sampleEntries(entries, 3, 'seed').map(e => e.name))
            .toEqual(sampleEntries(entries, 3, 'seed').map(e => e.name));
    });

    it('varies with the seed, so the gate is not pinned to one lucky trio', () => {
        const a = sampleEntries(entries, 3, 'alpha').map(e => e.name);
        const b = sampleEntries(entries, 3, 'omega').map(e => e.name);
        expect(a).not.toEqual(b);
    });

    it('only ever samples entries that carry a snippet and a class', () => {
        for (const sampled of sampleEntries(entries, 25, 'wide')) {
            expect(sampled.snippet).not.toBeNull();
            expect(sampled.className).not.toBeNull();
        }
    });

    it('returns everything usable when asked for more than exist', () => {
        const usable = entries.filter(e => e.snippet !== null && e.className !== null);
        expect(sampleEntries(entries, usable.length + 10, 's')).toHaveLength(usable.length);
    });
});

describe('sampleCorpusNames', () => {
    it('finds every section heading in the corpus', () => {
        expect(corpusEntryNames(committedCorpus)).toHaveLength(corpusNames(registry).length);
    });

    it('picks the same components as the registry-driven sampler', () => {
        const fromRegistry = sampleEntries(buildEntries(registry, apiDocs), 3, 'wave-0')
            .map(e => e.name);
        expect([...sampleCorpusNames(committedCorpus, 3, 'wave-0')].sort((a, b) => a.localeCompare(b)))
            .toEqual([...fromRegistry].sort((a, b) => a.localeCompare(b)));
    });

    it('only picks entries that state both an import and a snippet', () => {
        for (const name of sampleCorpusNames(committedCorpus, 40, 'wide')) {
            const parsed = parseEntry(committedCorpus, name);
            expect(parsed?.importStatement, name).toBeTruthy();
            expect(parsed?.snippet, name).toBeTruthy();
        }
    });

    it('offers enough usable entries for the compile gate', () => {
        expect(sampleCorpusNames(committedCorpus, 3, 'wave-0')).toHaveLength(3);
    });
});
