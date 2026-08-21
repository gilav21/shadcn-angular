/**
 * Pure builders for `llms.txt` — the fetchable usage corpus an AI assistant
 * reads before generating shadcn-angular code.
 *
 * Two sources of truth, both already maintained for other reasons:
 *
 *   - `packages/components/registry.json` — names, categories, one-line
 *     descriptions, dependency closures, and the `files[]` list the import
 *     path is derived from.
 *   - `packages/components/api-docs.json` — the committed compodoc extract
 *     (`gen-api-docs.ts`): selectors, exported class names, inputs/outputs with
 *     their declared types, and whether the template projects content.
 *
 * Both inputs are committed, so a fresh generation is reproducible from git
 * alone and `gen-llms.ts --check` is a meaningful drift gate. Nothing here is
 * hand-maintained per component, so the corpus cannot drift.
 *
 * The hard constraint on every generated snippet is that it must COMPILE in a
 * consumer app. A corpus that teaches non-compiling code is worse than no
 * corpus, so a component whose required inputs cannot be satisfied with a
 * literal gets NO snippet and says why, rather than a plausible-looking one.
 */

import type { ApiClass, ApiDocs, ApiMember } from './gen-api-docs-lib.js';

export type { ApiClass, ApiDocs, ApiMember };

/** The subset of a registry entry this generator reads. */
export interface RegistryEntry {
    readonly name: string;
    readonly files: readonly string[];
    /** Extra component-root files installed alongside `files`. */
    readonly peerFiles?: readonly string[];
    /** Shared helpers installed from `packages/components/lib/`. */
    readonly libFiles?: readonly string[];
    readonly description?: string;
    readonly category?: string;
    readonly dependencies?: readonly string[];
    readonly npmDependencies?: readonly string[];
    readonly type?: string;
    readonly parent?: string;
}

export type RegistryJson = Readonly<Record<string, RegistryEntry>>;

/** One component's fully-resolved corpus entry. */
export interface LlmsEntry {
    readonly name: string;
    readonly description: string;
    readonly category: string;
    readonly importPath: string;
    readonly className: string | null;
    readonly selector: string | null;
    readonly dependencies: readonly string[];
    readonly npmDependencies: readonly string[];
    readonly inputs: readonly ApiMember[];
    readonly outputs: readonly ApiMember[];
    /** Compiling HTML usage, or `null` when one cannot be synthesized safely. */
    readonly snippet: string | null;
    /** Why `snippet` is null. Empty when a snippet was produced. */
    readonly snippetSkipReason: string;
}

/** The npm package name consumers install the CLI from. */
export const CLI_PACKAGE = '@gilav21/shadcn-angular';

/** Import alias the CLI's own `components.json` defaults to. */
export const UI_ALIAS = '@/components/ui';

const UI_SOURCE_ROOT = 'packages/components/ui/';

// ---------------------------------------------------------------------------
// Import path
// ---------------------------------------------------------------------------

/**
 * The module path a consumer imports the component from, derived from the
 * registry's `files[]` and nothing else. A folderized component exposes a
 * barrel (`button/index.ts` → `@/components/ui/button`); a flat directive has
 * no barrel, so its own file is the module (`confetti.directive.ts` →
 * `@/components/ui/confetti.directive`).
 */
export function importPathFor(entry: RegistryEntry): string {
    const barrel = entry.files.find(f => f === 'index.ts' || f.endsWith('/index.ts'));
    if (barrel) {
        const dir = barrel === 'index.ts' ? '' : barrel.slice(0, -'/index.ts'.length);
        return dir ? `${UI_ALIAS}/${dir}` : UI_ALIAS;
    }
    const primary = entry.files.find(f => f.endsWith('.ts')) ?? entry.files[0] ?? '';
    return `${UI_ALIAS}/${primary.replace(/\.ts$/, '')}`;
}

// ---------------------------------------------------------------------------
// Primary class resolution
// ---------------------------------------------------------------------------

/** Index the extract's classes by their repo-relative source file path. */
export function indexDocClasses(docs: ApiDocs): ReadonlyMap<string, readonly ApiClass[]> {
    const byFile = new Map<string, ApiClass[]>();
    for (const cls of docs.classes) {
        const bucket = byFile.get(cls.file);
        if (bucket) bucket.push(cls);
        else byFile.set(cls.file, [cls]);
    }
    return byFile;
}

function lastSegment(name: string): string {
    const parts = name.split('/');
    return parts[parts.length - 1];
}

/**
 * The class a consumer actually imports for this entry. Preference is the file
 * named after the component itself (`button/button.component.ts`,
 * `data-table/addons/export/export.directive.ts`); otherwise the first class in
 * a deterministic file order, so the output is stable across runs.
 */
export function primaryClassFor(
    entry: RegistryEntry,
    byFile: ReadonlyMap<string, readonly ApiClass[]>,
): ApiClass | null {
    const own = [...entry.files]
        .filter(f => f.endsWith('.ts'))
        .sort((a, b) => a.localeCompare(b))
        .flatMap(f => byFile.get(UI_SOURCE_ROOT + f) ?? []);
    if (own.length === 0) return null;

    const stem = lastSegment(entry.name);
    const preferred = own.find(cls => {
        const base = cls.file.split('/').pop() ?? '';
        return base === `${stem}.component.ts` || base === `${stem}.directive.ts`;
    });
    return preferred ?? own[0];
}

// ---------------------------------------------------------------------------
// Snippet synthesis
// ---------------------------------------------------------------------------

/** Split a type union on top-level `|`, ignoring `|` nested in <>, () or []. */
function splitUnion(type: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let current = '';
    for (const ch of type) {
        if (ch === '<' || ch === '(' || ch === '[' || ch === '{') depth++;
        else if (ch === '>' || ch === ')' || ch === ']' || ch === '}') depth--;
        if (ch === '|' && depth === 0) {
            parts.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }
    parts.push(current.trim());
    return parts.filter(p => p.length > 0);
}

/** Drop the `undefined` / `null` members a signal input's type usually carries. */
function meaningfulUnionMembers(type: string): string[] {
    return splitUnion(type).filter(p => p !== 'undefined' && p !== 'null');
}

/** A string-literal type member — TypeScript prints these single- or double-quoted. */
const STRING_LITERAL = /^'([^']*)'$|^"([^"]*)"$/;

/**
 * A template binding for one input, or `null` when no literal of the declared
 * type can be written inline. Attribute form (`variant="ghost"`) is used for
 * strings and string-literal unions because that is how a developer writes it;
 * everything else uses property form.
 */
export function bindingFor(input: ApiMember): string | null {
    const declared = input.type.trim();
    if (declared === '') return null;

    const members = meaningfulUnionMembers(declared);
    if (members.length === 0) return null;

    if (members.every(m => STRING_LITERAL.test(m))) {
        const first = STRING_LITERAL.exec(members[0]);
        const literal = first ? (first[1] ?? first[2]) : undefined;
        return literal === undefined ? null : `${input.name}="${literal}"`;
    }
    if (members.length > 1) return null;

    const single = members[0];
    if (single.endsWith('[]')) return `[${input.name}]="[]"`;
    if (single === 'string') return `${input.name}="text"`;
    if (single === 'number') return `[${input.name}]="0"`;
    if (single === 'boolean') return `[${input.name}]="true"`;
    return null;
}

/** The element name a selector applies to, or `null` for attribute selectors. */
function elementOf(selector: string): string | null {
    const first = selector.split(',')[0].trim();
    const bracket = first.indexOf('[');
    if (bracket === 0) return null;
    const tag = (bracket === -1 ? first : first.slice(0, bracket)).trim();
    return /^[a-z][\w-]*$/i.test(tag) ? tag : null;
}

/** Attribute names a selector requires on its host, e.g. `[uiRipple]` → uiRipple. */
function attributesOf(selector: string): string[] {
    const first = selector.split(',')[0].trim();
    return [...first.matchAll(/\[([\w-]+)]/g)].map(m => m[1]);
}

interface SnippetResult {
    readonly snippet: string | null;
    readonly reason: string;
}

/**
 * A minimal usage that compiles. Required inputs must all be bindable from a
 * literal — Angular reports an unbound required input as a template error, so
 * a snippet that omits one would teach code that does not build.
 */
export function snippetFor(cls: ApiClass | null): SnippetResult {
    if (!cls || cls.selector === '') {
        return { snippet: null, reason: 'no element or attribute selector in the registry source' };
    }
    const selector = cls.selector;
    const element = elementOf(selector);
    const attributes = attributesOf(selector);

    if (element && attributes.length > 0) {
        return {
            snippet: null,
            reason: `applies to <${element}>, so usage depends on that component's own required inputs`,
        };
    }

    const bindings: string[] = [];
    for (const input of cls.inputs.filter(i => i.required === true)) {
        const binding = bindingFor(input);
        if (!binding) {
            return {
                snippet: null,
                reason: `required input \`${input.name}: ${input.type}\` needs application data`,
            };
        }
        bindings.push(binding);
    }

    const host = element ?? 'div';
    const parts = [host, ...attributes, ...bindings];
    const open = parts.join(' ');
    const projects = cls.projectsContent;
    if (element && !projects && attributes.length === 0) {
        return { snippet: `<${open} />`, reason: '' };
    }
    const children = projects ? 'Content' : '';
    return { snippet: `<${open}>${children}</${host}>`, reason: '' };
}

// ---------------------------------------------------------------------------
// Entries
// ---------------------------------------------------------------------------

/**
 * Registry entries this corpus covers: components and addons.
 *
 * `type: 'block'` entries are excluded on purpose. Their sources live under
 * `packages/blocks/`, not `packages/components/ui/`, so the compodoc extract
 * has no class for them and the `@/components/ui/<name>` import path derived
 * from `files[]` would be wrong. Publishing an import that does not resolve is
 * exactly the failure mode this corpus exists to prevent.
 */
export function corpusNames(registry: RegistryJson): string[] {
    return Object.keys(registry)
        .filter(name => registry[name].type !== 'block')
        .sort((a, b) => a.localeCompare(b));
}

/** Resolve every corpus entry. Deterministic: sorted by name, no clock, no IO. */
export function buildEntries(registry: RegistryJson, docs: ApiDocs): LlmsEntry[] {
    const byFile = indexDocClasses(docs);
    return corpusNames(registry).map(name => {
        const entry = registry[name];
        const cls = primaryClassFor(entry, byFile);
        const { snippet, reason } = snippetFor(cls);
        return {
            name,
            description: entry.description ?? '',
            category: entry.category ?? 'utility',
            importPath: importPathFor(entry),
            className: cls?.name ?? null,
            selector: cls?.selector ?? null,
            dependencies: [...(entry.dependencies ?? [])].sort((a, b) => a.localeCompare(b)),
            npmDependencies: [...(entry.npmDependencies ?? [])].sort((a, b) => a.localeCompare(b)),
            inputs: cls?.inputs ?? [],
            outputs: cls?.outputs ?? [],
            snippet,
            snippetSkipReason: reason,
        };
    });
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function renderInput(input: ApiMember): string {
    const required = input.required === true ? ' (required)' : '';
    const value = input.default === undefined ? '' : ` = ${input.default}`;
    return `\`${input.name}: ${input.type}${value}\`${required}`;
}

function renderList(label: string, values: readonly string[]): string {
    const rendered = values.map(v => `\`${v}\``).join(', ');
    return `- ${label}: ${rendered === '' ? 'none' : rendered}`;
}

/** One `### <name>` section. Every fact on it comes from a generated source. */
export function renderEntry(entry: LlmsEntry): string {
    const lines: string[] = [`### ${entry.name}`, ''];
    if (entry.description) lines.push(entry.description, '');
    lines.push(`- Install: \`npx ${CLI_PACKAGE}@latest add ${entry.name}\``);
    if (entry.className) {
        lines.push(`- Import: \`import { ${entry.className} } from '${entry.importPath}';\``);
    } else {
        lines.push(`- Import: \`${entry.importPath}\``);
    }
    if (entry.selector) lines.push(`- Selector: \`${entry.selector}\``);
    lines.push(`- Category: ${entry.category}`);
    lines.push(renderList('Depends on', entry.dependencies));
    lines.push(renderList('npm dependencies', entry.npmDependencies));
    if (entry.inputs.length > 0) {
        lines.push(`- Inputs: ${entry.inputs.map(renderInput).join(', ')}`);
    }
    if (entry.outputs.length > 0) {
        const outs = entry.outputs.map(o => `\`${o.name}: ${o.type}\``).join(', ');
        lines.push(`- Outputs: ${outs}`);
    }
    lines.push('');
    if (entry.snippet) {
        lines.push('```html', entry.snippet, '```', '');
    } else {
        lines.push(`_No generated snippet: ${entry.snippetSkipReason}._`, '');
    }
    return lines.join('\n');
}

const PREAMBLE = `# shadcn-angular

> Copy-paste Angular component library. The CLI writes real source files into
> your project — there is no runtime package to depend on, so every component
> below is code you own and can edit.

## How to use this file

Every component section states the exact install command, the exact import, the
element selector, the full input/output surface with declared types, and a usage
snippet that compiles. Prefer these facts over anything you remember about
shadcn/ui for React: this is Angular, the selectors are \`ui-*\` elements, and
the APIs are Angular signal inputs, not React props.

Rules that hold for every component:

- Install with \`npx ${CLI_PACKAGE}@latest add <name>\` before importing it. The
  command also installs the component's dependency closure.
- Components are standalone. Import the class and list it in the consuming
  component's \`imports: []\` array. There is no NgModule.
- The import path shown is the default alias from \`components.json\`
  (\`${UI_ALIAS}\`). If a project configured a different \`ui\` alias, substitute it.
- Inputs are signal inputs. Bind them from a template exactly like any other
  Angular input; read them in TypeScript as \`comp.value()\`.
- Inputs marked \`(required)\` must be bound or the template will not compile.
- A section without a snippet says so explicitly; do not invent one.

`;

/** Assemble the whole corpus. Pure — same inputs always give the same bytes. */
export function renderLlmsTxt(entries: readonly LlmsEntry[]): string {
    const byCategory = new Map<string, LlmsEntry[]>();
    for (const entry of entries) {
        const bucket = byCategory.get(entry.category);
        if (bucket) bucket.push(entry);
        else byCategory.set(entry.category, [entry]);
    }
    const categories = [...byCategory.keys()].sort((a, b) => a.localeCompare(b));

    const index = entries
        .map(e => `- [${e.name}](#${e.name.replaceAll('/', '')}): ${e.description}`)
        .join('\n');

    const sections = categories
        .map(cat => `## ${cat}\n\n${(byCategory.get(cat) ?? []).map(renderEntry).join('\n')}`)
        .join('\n');

    return `${PREAMBLE}## Index (${entries.length} components)\n\n${index}\n\n${sections}`;
}

/** Registry + docs in, corpus text out. */
export function buildLlmsTxt(registry: RegistryJson, docs: ApiDocs): string {
    return renderLlmsTxt(buildEntries(registry, docs));
}

// ---------------------------------------------------------------------------
// Reading the corpus back
// ---------------------------------------------------------------------------

/** The machine-readable facts a consumer of `llms.txt` can act on. */
export interface ParsedEntry {
    readonly name: string;
    readonly importStatement: string | null;
    readonly snippet: string | null;
}

/**
 * Parse one `### <name>` section back out of the corpus. Used by the e2e gate
 * that compiles sampled entries: it may use ONLY what the file states, so it
 * reads the import statement and snippet from here rather than from the
 * registry, which is exactly what an assistant reading the file can see.
 */
export function parseEntry(corpus: string, name: string): ParsedEntry | null {
    const start = corpus.indexOf(`### ${name}\n`);
    if (start === -1) return null;
    const rest = corpus.slice(start);
    const nextHeading = rest.slice(1).search(/\n##+ /);
    const section = nextHeading === -1 ? rest : rest.slice(0, nextHeading + 1);

    const importLine = /- Import: `(import \{[^`]+)`/.exec(section);
    const snippetBlock = /```html\n([\s\S]*?)\n```/.exec(section);
    return {
        name,
        importStatement: importLine ? importLine[1] : null,
        snippet: snippetBlock ? snippetBlock[1] : null,
    };
}

/**
 * A deterministic, non-cherry-picked sample of entries that carry a snippet.
 * Seeded by a string so the same seed always yields the same components — the
 * compile gate must be reproducible, but it must not be hand-chosen either.
 */
export function sampleEntries(
    entries: readonly LlmsEntry[], count: number, seed: string,
): LlmsEntry[] {
    const usable = entries
        .filter(e => e.snippet !== null && e.className !== null)
        .map(e => e.name);
    const picked = new Set(pickDeterministic(usable, count, seed));
    return entries.filter(e => picked.has(e.name));
}

/** Every `### <name>` heading in the corpus, in document order. */
export function corpusEntryNames(corpus: string): string[] {
    return [...corpus.matchAll(/^### (.+)$/gm)].map(m => m[1]);
}

/**
 * The same deterministic sample as `sampleEntries`, but derived from the corpus
 * TEXT alone. The compile gate must judge the file as an assistant sees it, so
 * it may not consult the registry to decide what to test.
 */
export function sampleCorpusNames(corpus: string, count: number, seed: string): string[] {
    const usable = corpusEntryNames(corpus).filter(name => {
        const parsed = parseEntry(corpus, name);
        return parsed?.importStatement != null && parsed.snippet != null;
    });
    return pickDeterministic(usable, count, seed);
}

/**
 * Pick `count` names by seeded hash order. Reproducible for a given seed, but
 * not hand-chosen — rotating the seed is the cheapest way to widen the gate's
 * coverage of the corpus.
 */
function pickDeterministic(names: readonly string[], count: number, seed: string): string[] {
    return [...names]
        .map(name => ({ name, key: hash(`${seed}:${name}`) }))
        .sort((a, b) => (a.key - b.key) || a.name.localeCompare(b.name))
        .slice(0, count)
        .map(s => s.name);
}

/** FNV-1a. Small, dependency-free, and stable across Node versions. */
function hash(value: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < value.length; i++) {
        h ^= value.codePointAt(i) ?? 0;
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h;
}
