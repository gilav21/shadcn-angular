/**
 * Pure, unit-testable helpers for `sync-registry.ts`.
 *
 * Kept separate from the script so that import resolution, decorator-asset
 * discovery, and component-boundary classification can be exercised directly
 * by vitest without invoking the whole registry sync.
 *
 * The `validate-registry.mjs` hook has a parallel `.mjs` helper module
 * (`.claude/hooks/registry-classify.mjs`); the two cannot be merged because
 * the hook runs under plain `node` and this script runs under `tsx`.
 */
import { existsSync, statSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/** Matches `from '...'` / `from "..."` for relative specifiers only. */
export const IMPORT_REGEX = /from\s+['"](\.[^'"]+)['"]/g;

const TEMPLATE_URL_REGEX = /\btemplateUrl\s*:\s*['"]([^'"]+)['"]/g;
const STYLE_URL_REGEX = /\bstyleUrl\s*:\s*['"]([^'"]+)['"]/g;
const STYLE_URLS_REGEX = /\bstyleUrls\s*:\s*\[([^\]]*)\]/g;
const QUOTED_STRING_REGEX = /['"]([^'"]+)['"]/g;

function toComponentsRelative(absPath: string, componentsRoot: string): string {
    return path.relative(componentsRoot, absPath).replaceAll('\\', '/');
}

/**
 * Resolve a relative import specifier to a path relative to `componentsRoot`.
 * Mirrors Node/TypeScript resolution: an explicit `.ts` file wins, and a bare
 * specifier pointing at a directory resolves to that directory's barrel
 * `index.ts` — never the directory itself.
 *
 * Returns null when nothing resolves (e.g. a directory with no barrel).
 */
export function resolveImport(
    importPath: string,
    fromFile: string,
    componentsRoot: string,
): string | null {
    const fromDir = path.dirname(path.join(componentsRoot, fromFile));
    const base = path.resolve(fromDir, importPath);

    const asTsFile = `${base}.ts`;
    if (existsSync(asTsFile)) return toComponentsRelative(asTsFile, componentsRoot);

    if (!existsSync(base)) return null;

    if (statSync(base).isDirectory()) {
        const barrel = path.join(base, 'index.ts');
        return existsSync(barrel) ? toComponentsRelative(barrel, componentsRoot) : null;
    }

    return toComponentsRelative(base, componentsRoot);
}

/**
 * Resolve a decorator asset reference (`templateUrl` / `styleUrl`) — which
 * always carries an explicit extension — to a path relative to
 * `componentsRoot`. Returns null when the asset does not exist on disk.
 */
export function resolveAsset(
    assetPath: string,
    fromFile: string,
    componentsRoot: string,
): string | null {
    const fromDir = path.dirname(path.join(componentsRoot, fromFile));
    const resolved = path.resolve(fromDir, assetPath);
    return existsSync(resolved) ? toComponentsRelative(resolved, componentsRoot) : null;
}

/**
 * Extract every `templateUrl`, `styleUrl`, and `styleUrls` asset reference
 * declared in a component source file. These are leaf files — they carry no
 * imports of their own — so the caller adds them without recursing.
 */
export function parseDecoratorUrls(content: string): string[] {
    const urls: string[] = [];
    for (const m of content.matchAll(TEMPLATE_URL_REGEX)) urls.push(m[1]);
    for (const m of content.matchAll(STYLE_URL_REGEX)) urls.push(m[1]);
    for (const m of content.matchAll(STYLE_URLS_REGEX)) {
        for (const s of m[1].matchAll(QUOTED_STRING_REGEX)) urls.push(s[1]);
    }
    return urls;
}

/**
 * Build a `directory → owning components` map from the registry's entry
 * files. A directory with exactly one owner is "single-owner" — a declared
 * signal used to classify cross-component imports deterministically.
 */
export function buildDirOwners(
    entryFileToComponent: Map<string, string>,
): Map<string, Set<string>> {
    const dirOwners = new Map<string, Set<string>>();
    for (const [file, component] of entryFileToComponent) {
        const dir = path.posix.dirname(file);
        const owners = dirOwners.get(dir) ?? new Set<string>();
        owners.add(component);
        dirOwners.set(dir, owners);
    }
    return dirOwners;
}

/** Boundary information needed to classify a resolved import. */
export interface BoundaryContext {
    /** `ui/`-relative entry file → component name. */
    readonly entryFileToComponent: Map<string, string>;
    /** `ui/`-relative directory → the components whose entry file lives there. */
    readonly dirOwners: Map<string, Set<string>>;
}

export type ImportKind = 'own' | 'dependency' | 'deep-import' | 'addon-boundary';

export interface ImportClassification {
    readonly kind: ImportKind;
    /**
     * Owning component — set for `dependency` and `deep-import`. For
     * `addon-boundary` it is the addon key (`parent/addon`) the base reached into.
     */
    readonly owner?: string;
}

/**
 * If a base component (`currentComponent` has no `/`) reaches a file inside its
 * own `addons/` subtree, return the addon key (`parent/addon`) it reached into;
 * otherwise null. This is the one-directional boundary: addons depend on the
 * base, never the reverse.
 */
function addonReachedFromBase(resolvedFile: string, currentComponent: string): string | null {
    if (currentComponent.includes('/')) return null;
    const prefix = `ui/${currentComponent}/addons/`;
    if (!resolvedFile.startsWith(prefix)) return null;
    const addonName = resolvedFile.slice(prefix.length).split('/')[0];
    return addonName ? `${currentComponent}/${addonName}` : null;
}

/**
 * Classify a resolved import relative to the component currently being walked:
 *  - `own`         — part of the current component's own tree; keep walking;
 *  - `dependency`  — another component's barrel/entry file; stop and record;
 *  - `deep-import` — another component's *internal* file reached without
 *                    going through its barrel — a boundary violation that the
 *                    sync reports as a warning.
 */
export function classifyImport(
    resolvedFile: string,
    currentComponent: string,
    ctx: BoundaryContext,
): ImportClassification {
    const addon = addonReachedFromBase(resolvedFile, currentComponent);
    if (addon) return { kind: 'addon-boundary', owner: addon };

    const entryOwner = ctx.entryFileToComponent.get(resolvedFile);
    if (entryOwner) {
        return entryOwner === currentComponent
            ? { kind: 'own' }
            : { kind: 'dependency', owner: entryOwner };
    }

    const owners = ctx.dirOwners.get(path.posix.dirname(resolvedFile));
    if (owners?.size === 1) {
        const [owner] = owners;
        if (owner !== currentComponent) {
            return { kind: 'deep-import', owner };
        }
    }

    return { kind: 'own' };
}

/**
 * Pick a registry entry's walk entry file. Prefers the component's own barrel
 * `<name>/index.ts`; a foreign `other/index.ts` that leaked into `files[]`
 * mid-migration must never be treated as the entry. Falls back to the
 * `<name>.component.ts` / `<name>.directive.ts` convention, then `files[0]`.
 */
export function getEntryFile(name: string, files: readonly string[]): string {
    const baseName = name.split('/').at(-1) ?? name;

    if (name.includes('/')) {
        const addonBarrel = files.find(f => f.endsWith(`addons/${baseName}/index.ts`));
        if (addonBarrel) return addonBarrel;
    }

    const barrel = files.find(f => f === `${baseName}/index.ts`);
    if (barrel) return barrel;

    const conventionFile = files.find(f =>
        f.endsWith(`${baseName}.component.ts`) || f.endsWith(`${baseName}.directive.ts`),
    );
    return conventionFile ?? files[0];
}

/** A cross-component import that reached another component's internal file. */
export interface DeepImport {
    /** The file containing the offending import. */
    readonly fromFile: string;
    /** The internal file it imported. */
    readonly importedFile: string;
    /** The component that owns the directory `importedFile` lives in. */
    readonly owner: string;
}

/**
 * A base component reaching into its own `addons/` subtree — the
 * one-directional boundary violation. The base must never import or re-export
 * an addon (addons depend on the base, never the reverse).
 */
export interface AddonBoundary {
    /** The base file containing the offending import/re-export. */
    readonly fromFile: string;
    /** The addon file it reached into. */
    readonly importedFile: string;
    /** The addon key (`parent/addon`) that was reached into. */
    readonly addon: string;
}

export interface WalkResult {
    readonly ownFiles: Set<string>;
    readonly discoveredDeps: Set<string>;
    readonly deepImports: DeepImport[];
    readonly addonViolations: AddonBoundary[];
}

/**
 * Walk a component's import tree from its entry file, stopping at other
 * components' boundaries, and return the files that belong to this component.
 *
 * `templateUrl` / `styleUrl` assets are discovered as leaf files. Deep
 * cross-component imports are recorded but still walked — rerouting them would
 * change the registry, and Phase 1 tooling must stay backward-compatible.
 */
export function walkTree(
    entryFile: string,
    componentName: string,
    ctx: BoundaryContext,
    componentsRoot: string,
): WalkResult {
    const ownFiles = new Set<string>();
    const discoveredDeps = new Set<string>();
    const deepImports: DeepImport[] = [];
    const addonViolations: AddonBoundary[] = [];

    function addAssets(file: string, content: string): void {
        if (!file.endsWith('.component.ts')) return;
        for (const url of parseDecoratorUrls(content)) {
            const asset = resolveAsset(url, file, componentsRoot);
            if (asset) ownFiles.add(asset);
        }
    }

    function follow(fromFile: string, importPath: string): void {
        const resolved = resolveImport(importPath, fromFile, componentsRoot);
        if (!resolved) return;

        const { kind, owner } = classifyImport(resolved, componentName, ctx);
        if (kind === 'dependency' && owner) {
            discoveredDeps.add(owner);
            return;
        }
        if (kind === 'addon-boundary' && owner) {
            addonViolations.push({ fromFile, importedFile: resolved, addon: owner });
            return;
        }
        if (kind === 'deep-import' && owner) {
            deepImports.push({ fromFile, importedFile: resolved, owner });
        }
        collect(resolved);
    }

    function collect(file: string): void {
        if (ownFiles.has(file)) return;
        ownFiles.add(file);

        const fullPath = path.join(componentsRoot, file);
        if (!existsSync(fullPath)) return;

        const content = readFileSync(fullPath, 'utf-8');
        addAssets(file, content);

        for (const match of content.matchAll(IMPORT_REGEX)) {
            follow(file, match[1]);
        }
    }

    collect(entryFile);
    return { ownFiles, discoveredDeps, deepImports, addonViolations };
}

// ── Block import walking ─────────────────────────────────────────────────

/** True when `abs` lives inside `dir` (not the directory itself, not outside). */
function isUnder(dir: string, abs: string): boolean {
    const rel = path.relative(dir, abs);
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * Resolve a relative specifier to an absolute file, mirroring Node/TS
 * resolution (`.ts` wins, a directory resolves to its `index.ts` barrel).
 * Root-agnostic — used for block walks that cross from packages/blocks into
 * packages/components. Returns null when nothing resolves.
 */
function resolveAbsolute(importPath: string, fromAbsFile: string): string | null {
    const base = path.resolve(path.dirname(fromAbsFile), importPath);
    const asTsFile = `${base}.ts`;
    if (existsSync(asTsFile)) return asTsFile;
    if (!existsSync(base)) return null;
    if (statSync(base).isDirectory()) {
        const barrel = path.join(base, 'index.ts');
        return existsSync(barrel) ? barrel : null;
    }
    return base;
}

export interface BlockWalkResult {
    /** Block-root-relative files belonging to the block (e.g. 'login/index.ts'). */
    readonly ownFiles: Set<string>;
    /** Component names the block depends on (imported from packages/components/ui). */
    readonly dependencies: Set<string>;
    /** Lib-root-relative files the block imports directly (e.g. 'utils.ts'). */
    readonly libFiles: Set<string>;
    /** Cross-boundary imports that bypassed a component's barrel. */
    readonly deepImports: DeepImport[];
}

/**
 * Walk a block's import tree from its entry file. Unlike a component, a block
 * lives under `blocksRoot` and imports *across* into `componentsRoot`, so each
 * resolved import is categorized by which root it falls under:
 *  - inside the block        → an own file (recurse), plus its decorator assets;
 *  - under components/ui/     → a component dependency (recorded via the shared
 *                               boundary `ctx`; not recursed into);
 *  - under components/lib/    → a lib file (leaf; not recursed into).
 * Component `category`/`description`/`tags` are authored by hand — this only
 * derives `files` / `dependencies` / `libFiles`, exactly the drift-prone parts.
 */
interface BlockWalkState {
    ownFiles: Set<string>;
    dependencies: Set<string>;
    libFiles: Set<string>;
    deepImports: DeepImport[];
    uiDir: string;
    libDir: string;
    blocksRoot: string;
    ownPrefix: string;
    ctx: BoundaryContext;
}

function toBlockRel(blocksRoot: string, abs: string): string {
    return path.relative(blocksRoot, abs).replaceAll('\\', '/');
}

function recordBlockDependency(state: BlockWalkState, resolvedAbs: string, fromBlockRelFile: string): void {
    const uiRel = 'ui/' + path.relative(state.uiDir, resolvedAbs).replaceAll('\\', '/');
    const { kind, owner } = classifyImport(uiRel, '', state.ctx);
    if (!owner) return;
    state.dependencies.add(owner);
    if (kind === 'deep-import') {
        state.deepImports.push({ fromFile: fromBlockRelFile, importedFile: uiRel, owner });
    }
}

function categorizeBlockImport(state: BlockWalkState, resolvedAbs: string, fromBlockRelFile: string): void {
    if (isUnder(state.uiDir, resolvedAbs)) { recordBlockDependency(state, resolvedAbs, fromBlockRelFile); return; }
    if (isUnder(state.libDir, resolvedAbs)) {
        state.libFiles.add(path.relative(state.libDir, resolvedAbs).replaceAll('\\', '/'));
        return;
    }
    const blockRel = toBlockRel(state.blocksRoot, resolvedAbs);
    if (isUnder(state.blocksRoot, resolvedAbs) && blockRel.startsWith(state.ownPrefix)) collectBlockFile(state, blockRel);
}

function collectBlockFile(state: BlockWalkState, blockRelFile: string): void {
    if (state.ownFiles.has(blockRelFile)) return;
    state.ownFiles.add(blockRelFile);
    const abs = path.join(state.blocksRoot, blockRelFile);
    if (!existsSync(abs)) return;
    const content = readFileSync(abs, 'utf-8');
    if (blockRelFile.endsWith('.component.ts')) {
        for (const url of parseDecoratorUrls(content)) {
            const assetAbs = path.resolve(path.dirname(abs), url);
            if (existsSync(assetAbs) && isUnder(state.blocksRoot, assetAbs)) state.ownFiles.add(toBlockRel(state.blocksRoot, assetAbs));
        }
    }
    for (const match of content.matchAll(IMPORT_REGEX)) {
        const resolved = resolveAbsolute(match[1], abs);
        if (resolved) categorizeBlockImport(state, resolved, blockRelFile);
    }
}

export function walkBlockTree(
    entryFile: string,
    blocksRoot: string,
    componentsRoot: string,
    ctx: BoundaryContext,
): BlockWalkResult {
    const state: BlockWalkState = {
        ownFiles: new Set<string>(),
        dependencies: new Set<string>(),
        libFiles: new Set<string>(),
        deepImports: [],
        uiDir: path.join(componentsRoot, 'ui'),
        libDir: path.join(componentsRoot, 'lib'),
        blocksRoot,
        ownPrefix: `${entryFile.split('/')[0]}/`,
        ctx,
    };
    collectBlockFile(state, entryFile);
    return { ownFiles: state.ownFiles, dependencies: state.dependencies, libFiles: state.libFiles, deepImports: state.deepImports };
}

// ── Registry source parsing ─────────────────────────────────────────────

/** A registry entry's drift-prone arrays, extracted from the index.ts source. */
export interface RegistryEntry {
    name: string;
    files: string[];
    libFiles: string[];
    dependencies: string[];
    isBlock: boolean;
    /** `type:` value (e.g. `'addon'`), when declared. */
    type?: string;
    /** `parent:` value — the base a `type:'addon'` entry attaches to. */
    parent?: string;
    /** `attach.import` value (`"Symbol from './ui/…'"`), when declared. */
    attachImport?: string;
    /** `attach.selector` value (the marker attribute), when declared. */
    attachSelector?: string;
    /** Declared `testFiles:` array, when present. */
    testFiles: string[];
    /** Declared `testDependencies:` array, when present. */
    testDependencies: string[];
}

/** Skip a string literal starting at `start` (a quote); returns the index after the closing quote. */
function skipStringLiteral(source: string, start: number): number {
    const quote = source[start];
    let i = start + 1;
    while (i < source.length) {
        if (source[i] === '\\') i += 2;
        else if (source[i] === quote) return i + 1;
        else i += 1;
    }
    return i;
}

/** Skip a line or block comment starting at `start`; returns the index after it (or `start` if not a comment). */
function skipComment(source: string, start: number): number {
    if (source[start] !== '/') return start;
    if (source[start + 1] === '/') {
        const nl = source.indexOf('\n', start);
        return nl === -1 ? source.length : nl + 1;
    }
    if (source[start + 1] === '*') {
        const close = source.indexOf('*/', start + 2);
        return close === -1 ? source.length : close + 2;
    }
    return start;
}

/**
 * Extract the balanced `{…}` object literal starting at `open` (the index of
 * the `{`), skipping string literals and comments so braces inside them never
 * unbalance the scan. Returns the literal including both braces, or null if
 * the source ends before it balances.
 */
function extractObjectLiteral(source: string, open: number): string | null {
    let depth = 0;
    let i = open;
    while (i < source.length) {
        const ch = source[i];
        if (ch === "'" || ch === '"' || ch === '`') {
            i = skipStringLiteral(source, i);
            continue;
        }
        if (ch === '/') {
            const next = skipComment(source, i);
            if (next !== i) {
                i = next;
                continue;
            }
        }
        if (ch === '{') depth += 1;
        if (ch === '}') {
            depth -= 1;
            if (depth === 0) return source.slice(open, i + 1);
        }
        i += 1;
    }
    return null;
}

/**
 * Split an object literal (including its braces) into its top-level
 * `key: value` properties. Nested objects/arrays and string/comment content
 * are treated as opaque value text.
 */
function topLevelProperties(objectLiteral: string): Map<string, string> {
    const props = new Map<string, string>();
    const body = objectLiteral.slice(1, -1);
    let depth = 0;
    let segmentStart = 0;
    let i = 0;

    const commit = (end: number): void => {
        const segment = stripLeadingComments(body.slice(segmentStart, end));
        const colon = segment.indexOf(':');
        if (colon !== -1) {
            const key = segment.slice(0, colon).trim().replaceAll(/^['"]|['"]$/g, '');
            if (key) props.set(key, segment.slice(colon + 1).trim());
        }
        segmentStart = end + 1;
    };

    while (i < body.length) {
        const ch = body[i];
        if (ch === "'" || ch === '"' || ch === '`') {
            i = skipStringLiteral(body, i);
            continue;
        }
        if (ch === '/') {
            const next = skipComment(body, i);
            if (next !== i) {
                i = next;
                continue;
            }
        }
        if (ch === '{' || ch === '[' || ch === '(') depth += 1;
        if (ch === '}' || ch === ']' || ch === ')') depth = Math.max(0, depth - 1);
        if (ch === ',' && depth === 0) commit(i);
        i += 1;
    }
    commit(body.length);
    return props;
}

/** Strip leading whitespace and line/block comments from a property segment. */
function stripLeadingComments(segment: string): string {
    let rest = segment;
    for (;;) {
        const trimmed = rest.trimStart();
        if (trimmed.startsWith('//')) {
            const nl = trimmed.indexOf('\n');
            if (nl === -1) return '';
            rest = trimmed.slice(nl + 1);
        } else if (trimmed.startsWith('/*')) {
            const close = trimmed.indexOf('*/');
            if (close === -1) return '';
            rest = trimmed.slice(close + 2);
        } else {
            return trimmed;
        }
    }
}

/**
 * All quoted strings in a raw value snippet (e.g. the contents of a flat
 * array). Comments inside the snippet are not stripped — a quoted word in a
 * comment would be extracted — matching the previous parser's behavior; the
 * generated registry never contains comments inside arrays.
 */
function quotedStrings(raw: string | undefined): string[] {
    if (!raw) return [];
    return [...raw.matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1]);
}

/**
 * Parse registry entries from the `index.ts` source. Entries are identified by
 * their `name:` value (not the object key), so addon entries keyed
 * `parent/addon` — whose `name` contains a `/` — are recognised.
 *
 * Object literals are extracted with a brace-balanced, string-aware scan and
 * split into top-level properties, so nested object fields (`breaking`,
 * `attach`, `shortcutDefinitions`, `optionalDependencies`) never corrupt the
 * parse regardless of where they sit relative to `files:`. A candidate block
 * without both a top-level `name` and `files` is not an entry and is skipped
 * (its interior is still scanned, so nothing is missed).
 *
 * Known limitations, fine for the machine-generated registry source: the
 * candidate-key scan itself is not string-aware (a string literal containing
 * `key: {` starts a balanced scan mid-string — the name/files gate filters
 * any ghost), and template-literal interpolation / regex literals are not
 * tokenized.
 */
/**
 * The content of the first complete string literal in `raw`, matching the
 * opening quote to its OWN closing quote so an embedded quote of the other kind
 * survives (the attach import is `"Symbol from '…'"`, single quotes inside).
 */
function firstStringLiteral(raw: string | undefined): string | undefined {
    if (!raw) return undefined;
    const trimmed = raw.trimStart();
    const quote = trimmed[0];
    if (quote !== '"' && quote !== "'") return undefined;
    let out = '';
    for (let i = 1; i < trimmed.length; i++) {
        const ch = trimmed[i];
        if (ch === '\\') { out += trimmed[i + 1] ?? ''; i += 1; continue; }
        if (ch === quote) return out;
        out += ch;
    }
    return undefined;
}

/** Pull `import` / `selector` out of an `attach: { … }` nested object literal. */
function parseAttachProps(attachRaw: string | undefined): { import?: string; selector?: string } {
    if (!attachRaw?.trimStart().startsWith('{')) return {};
    const inner = topLevelProperties(attachRaw.trimStart());
    return {
        import: firstStringLiteral(inner.get('import')),
        selector: firstStringLiteral(inner.get('selector')),
    };
}

export function parseRegistrySource(source: string): RegistryEntry[] {
    const entries: RegistryEntry[] = [];
    const keyRegex = /['"]?[\w/-]{1,256}['"]?\s{0,64}:\s{0,64}\{/g;
    let match: RegExpExecArray | null;

    while ((match = keyRegex.exec(source)) !== null) {
        const open = match.index + match[0].length - 1;
        const block = extractObjectLiteral(source, open);
        if (!block) continue;

        const props = topLevelProperties(block);
        const name = quotedStrings(props.get('name'))[0];
        const filesRaw = props.get('files');
        if (!name || !filesRaw) continue;

        const type = quotedStrings(props.get('type'))[0];
        const attach = parseAttachProps(props.get('attach'));
        entries.push({
            name,
            files: quotedStrings(filesRaw),
            libFiles: quotedStrings(props.get('libFiles')),
            dependencies: quotedStrings(props.get('dependencies')),
            isBlock: type === 'block',
            type,
            parent: quotedStrings(props.get('parent'))[0],
            attachImport: attach.import,
            attachSelector: attach.selector,
            testFiles: quotedStrings(props.get('testFiles')),
            testDependencies: quotedStrings(props.get('testDependencies')),
        });
        keyRegex.lastIndex = open + block.length;
    }

    return entries;
}

// ── Registry sync core ──────────────────────────────────────────────────
//
// Everything below is the load-bearing body of `sync-registry.ts`: deriving
// each entry's files / libFiles / dependencies from the import tree, diffing
// that against what the registry declares, validating the result against disk,
// and rewriting the registry source. It lives here (not in the script) so it is
// importable — and therefore testable and measurable by coverage. The script is
// a thin entry: argv, I/O, printing, exit code.

/** utils.ts is always installed during init — not a component libFile. */
export const BASELINE_LIB_FILES: ReadonlySet<string> = new Set(['utils.ts']);

/** Filesystem roots the sync walks. Injected so tests can point at a fixture. */
export interface SyncRoots {
    /** Absolute path to `packages/components`. */
    readonly componentsRoot: string;
    /** Absolute path to `packages/blocks`. */
    readonly blocksRoot: string;
}

/** The drift-prone arrays a sync re-derives for one registry entry. */
export interface ComponentUpdate {
    readonly name: string;
    readonly files: string[];
    readonly libFiles: string[];
    readonly dependencies: string[];
    /** Portable specs to ship — only set for components verified in portable-tests.json. */
    readonly testFiles?: string[];
    /** Spec-only sibling component deps — only set alongside `testFiles`. */
    readonly testDependencies?: string[];
}

/** What changed between the registry's declared arrays and the derived ones. */
export interface EntryDiff {
    readonly addedFiles: string[];
    readonly removedFiles: string[];
    readonly addedLibs: string[];
    readonly addedDeps: string[];
    readonly removedDeps: string[];
}

function byLocale(a: string, b: string): number {
    return a.localeCompare(b);
}

/**
 * Split a walk's discovered files into `ui/`-relative and `lib/`-relative
 * halves, dropping the `lib/` baseline files that init always installs. Files
 * under neither prefix are not owned by the registry and are discarded.
 */
export function splitFiles(allFiles: Iterable<string>): { uiFiles: string[]; libFiles: string[] } {
    const uiFiles: string[] = [];
    const libFiles: string[] = [];

    for (const file of allFiles) {
        if (file.startsWith('ui/')) {
            uiFiles.push(file.slice(3));
        } else if (file.startsWith('lib/')) {
            const libName = file.slice(4);
            if (!BASELINE_LIB_FILES.has(libName)) {
                libFiles.push(libName);
            }
        }
    }

    uiFiles.sort(byLocale);
    libFiles.sort(byLocale);
    return { uiFiles, libFiles };
}

/** Map each component's entry file (`ui/`-relative) to the component name. */
export function buildBoundaryMap(entries: readonly RegistryEntry[]): Map<string, string> {
    const map = new Map<string, string>();
    for (const entry of entries) {
        map.set('ui/' + getEntryFile(entry.name, entry.files), entry.name);
    }
    return map;
}

/**
 * Diff an entry's declared arrays against the derived ones.
 *
 * Note the deliberate asymmetry: there is no `removedLibs`. libFiles are MERGED
 * (see `mergeLibFiles`), never replaced, so a libFile that is no longer
 * reachable from the import tree is NOT reported and NOT pruned — it survives in
 * the registry until a human deletes it. Only files and dependencies are pruned
 * on removal.
 */
export function diffEntry(
    entry: RegistryEntry,
    files: readonly string[],
    discoveredLibs: readonly string[],
    dependencies: readonly string[],
): EntryDiff {
    return {
        addedFiles: files.filter(f => !entry.files.includes(f)),
        removedFiles: entry.files.filter(f => !files.includes(f)),
        addedLibs: discoveredLibs.filter(f => !entry.libFiles.includes(f)),
        addedDeps: dependencies.filter(d => !entry.dependencies.includes(d)),
        removedDeps: entry.dependencies.filter(d => !dependencies.includes(d)),
    };
}

/** True when the diff carries any drift at all. */
export function hasDrift(diff: EntryDiff): boolean {
    return diff.addedFiles.length > 0
        || diff.removedFiles.length > 0
        || diff.addedLibs.length > 0
        || diff.addedDeps.length > 0
        || diff.removedDeps.length > 0;
}

/**
 * Union the entry's declared libFiles with the discovered ones. Merge, not
 * replace: a lib file can be pulled in by a path the walker cannot see (a
 * runtime `import()`, an addon's hand-authored entry), so the sync never drops
 * one on its own. The cost is that a genuinely stale libFile is never
 * auto-pruned — `validateRegistryFiles` is what eventually catches it, and only
 * once the file is gone from disk entirely.
 */
export function mergeLibFiles(declared: readonly string[], discovered: readonly string[]): string[] {
    return [...new Set([...declared, ...discovered])].sort(byLocale);
}

/** Human-readable drift lines for one entry, exactly as the script prints them. */
export function formatDriftLines(name: string, diff: EntryDiff, isBlock = false): string[] {
    const suffix = isBlock ? ' (block)' : '';
    const lines = [`  ${name}${suffix}:`];
    for (const f of diff.addedFiles) lines.push(`    + files: ${f}`);
    for (const f of diff.removedFiles) lines.push(`    - files: ${f}`);
    for (const f of diff.addedLibs) lines.push(`    + libFiles: ${f}`);
    for (const d of diff.addedDeps) lines.push(`    + dependencies: ${d}`);
    for (const d of diff.removedDeps) lines.push(`    - dependencies: ${d}`);
    return lines;
}

export interface ComponentAnalysis {
    readonly update: ComponentUpdate;
    readonly diff: EntryDiff;
    readonly deepImports: DeepImport[];
    readonly addonViolations: AddonBoundary[];
}

/**
 * Re-derive a component entry's files / libFiles / dependencies by walking its
 * import tree from its entry file, stopping at other components' boundaries.
 */
export function analyzeComponent(
    entry: RegistryEntry,
    ctx: BoundaryContext,
    roots: SyncRoots,
): ComponentAnalysis {
    const entryFile = 'ui/' + getEntryFile(entry.name, entry.files);
    const { ownFiles, discoveredDeps, deepImports, addonViolations } =
        walkTree(entryFile, entry.name, ctx, roots.componentsRoot);
    const { uiFiles, libFiles: discoveredLibs } = splitFiles(ownFiles);
    const dependencies = [...discoveredDeps].sort(byLocale);

    return {
        update: {
            name: entry.name,
            files: uiFiles,
            libFiles: mergeLibFiles(entry.libFiles, discoveredLibs),
            dependencies,
        },
        diff: diffEntry(entry, uiFiles, discoveredLibs, dependencies),
        deepImports,
        addonViolations,
    };
}

export interface BlockAnalysis {
    readonly update: ComponentUpdate;
    readonly diff: EntryDiff;
    readonly deepImports: DeepImport[];
}

/**
 * Re-derive a block entry's drift-prone arrays — files (block-relative),
 * dependencies (ui components it imports), and libFiles — by walking its import
 * tree across packages/blocks → packages/components. The block's hand-authored
 * type/category/description/tags are untouched. Mirrors `analyzeComponent`'s
 * shape so blocks share the apply/report flow.
 */
export function analyzeBlock(
    entry: RegistryEntry,
    ctx: BoundaryContext,
    roots: SyncRoots,
): BlockAnalysis {
    const entryFile = getEntryFile(entry.name, entry.files);
    const { ownFiles, dependencies, libFiles, deepImports } =
        walkBlockTree(entryFile, roots.blocksRoot, roots.componentsRoot, ctx);

    const files = [...ownFiles].sort(byLocale);
    const discoveredLibs = [...libFiles].filter(f => !BASELINE_LIB_FILES.has(f)).sort(byLocale);
    const deps = [...dependencies].sort(byLocale);

    return {
        update: {
            name: entry.name,
            files,
            libFiles: mergeLibFiles(entry.libFiles, discoveredLibs),
            dependencies: deps,
        },
        diff: diffEntry(entry, files, discoveredLibs, deps),
        deepImports,
    };
}

export interface AnalysisResult {
    readonly updates: ComponentUpdate[];
    readonly blockUpdates: ComponentUpdate[];
    readonly deepImports: DeepImport[];
    readonly addonViolations: AddonBoundary[];
    /** Drift report lines, in scan order — empty when everything is in sync. */
    readonly driftLines: string[];
    readonly hasChanges: boolean;
}

/** Analyze every component and block entry, accumulating updates and reports. */
export function analyzeAllEntries(
    entries: readonly RegistryEntry[],
    blockEntries: readonly RegistryEntry[],
    ctx: BoundaryContext,
    roots: SyncRoots,
): AnalysisResult {
    const updates: ComponentUpdate[] = [];
    const blockUpdates: ComponentUpdate[] = [];
    const deepImports: DeepImport[] = [];
    const addonViolations: AddonBoundary[] = [];
    const driftLines: string[] = [];
    let hasChanges = false;

    for (const entry of entries) {
        const result = analyzeComponent(entry, ctx, roots);
        if (hasDrift(result.diff)) {
            hasChanges = true;
            driftLines.push(...formatDriftLines(entry.name, result.diff));
        }
        updates.push(result.update);
        deepImports.push(...result.deepImports);
        addonViolations.push(...result.addonViolations);
    }

    for (const entry of blockEntries) {
        const result = analyzeBlock(entry, ctx, roots);
        if (hasDrift(result.diff)) {
            hasChanges = true;
            driftLines.push(...formatDriftLines(entry.name, result.diff, true));
        }
        blockUpdates.push(result.update);
        deepImports.push(...result.deepImports);
    }

    return { updates, blockUpdates, deepImports, addonViolations, driftLines, hasChanges };
}

// ── Boundary-violation reports ──────────────────────────────────────────

function dedupeBy<T>(items: readonly T[], key: (item: T) => string): T[] {
    const seen = new Set<string>();
    const unique: T[] = [];
    for (const item of items) {
        const k = key(item);
        if (seen.has(k)) continue;
        seen.add(k);
        unique.push(item);
    }
    return unique;
}

/**
 * Deep cross-component imports reach into another component's folder instead of
 * going through its barrel — boundary detection can then absorb that
 * component's files. A non-fatal, report-mode-only warning.
 *
 * Multiple walks rediscover the same offender (the importing file's own
 * component, then any component that transitively walks through it), so the
 * report dedupes on `fromFile + importedFile`. Returns [] when there is nothing
 * to warn about.
 */
export function formatDeepImportReport(deepImports: readonly DeepImport[]): string[] {
    if (deepImports.length === 0) return [];
    const lines = ['\nWarning: deep cross-component imports detected (bypass a barrel):'];
    for (const di of dedupeBy(deepImports, d => `${d.fromFile}\0${d.importedFile}`)) {
        lines.push(
            `  ${di.fromFile}`,
            `    reaches into the '${di.owner}' component folder: ${di.importedFile}`,
        );
    }
    lines.push("Import the owning component through its barrel ('../<name>') instead.");
    return lines;
}

/**
 * A base component reaching into its own addons/ folder breaks the
 * one-directional boundary (addons depend on the base, never the reverse) and
 * would fold the addon's opt-in files back into the always-installed base.
 * Unlike deep imports this is a hard error: it aborts the sync in both modes.
 */
export function formatAddonViolationReport(violations: readonly AddonBoundary[]): string[] {
    if (violations.length === 0) return [];
    const lines = ['\nError: base component reaches into its own addons/ folder (boundary violation):'];
    for (const v of dedupeBy(violations, x => `${x.fromFile}\0${x.importedFile}`)) {
        lines.push(
            `  ${v.fromFile}`,
            `    reaches into the '${v.addon}' addon: ${v.importedFile}`,
        );
    }
    lines.push('A base must never import or re-export an addon. Remove the import/barrel re-export.');
    return lines;
}

// ── Composite ("<base>/full") generation ────────────────────────────────
//
// A `<base>/full` addon is a *composition* addon: it owns no directive of its
// own. Instead every sibling addon directive gains an extra selector clause so
// it ALSO matches under the composite's marker attribute, and the composite's
// barrel exports a flat array of all those directive classes. Both the selector
// clauses and the barrel are MACHINE-MAINTAINED here, so adding a fourteenth
// addon automatically joins the bundle — no hand edits, no drift guard.

/** One generated/edited source file backing a composite addon. */
export interface CompositeFileEdit {
    /** Absolute path of the file to write. */
    readonly path: string;
    /** The full new content. */
    readonly content: string;
    /** Whether this edits a sibling's selector or (re)writes the barrel. */
    readonly kind: 'selector' | 'barrel';
    /** `ui/`-relative label for drift reporting. */
    readonly label: string;
}

export interface CompositeAnalysis {
    readonly edits: CompositeFileEdit[];
    /** Drift report lines, in scan order — empty when every composite is in sync. */
    readonly driftLines: string[];
    readonly hasDrift: boolean;
    /** Non-fatal warnings (e.g. a sibling whose class file could not be located). */
    readonly warnings: string[];
}

const COMPOSITE_HEADER =
    '// AUTO-GENERATED by sync-registry — do not edit; new addons join automatically.';

interface CompositeSibling {
    /** Short addon name (`emoji`) — the sort key and the `'../<short>'` specifier. */
    readonly short: string;
    /** The directive class the addon's `attach.import` names. */
    readonly className: string;
    /** `ui/`-relative source file that declares the class (the selector to edit). */
    readonly sourceFile: string;
}

/** The imported symbol in an `attach.import` value (`"Symbol from './ui/…'"`). */
function attachSymbol(attachImport: string): string {
    const idx = attachImport.indexOf(' from ');
    return (idx === -1 ? attachImport : attachImport.slice(0, idx)).trim();
}

/** Locate the `ui/`-relative file in `entry.files` that declares `class`. */
function findClassFile(entry: RegistryEntry, className: string, componentsRoot: string): string | null {
    const needle = `export class ${className}`;
    for (const file of entry.files) {
        if (!file.endsWith('.ts')) continue;
        const abs = path.join(componentsRoot, 'ui', file);
        if (existsSync(abs) && readFileSync(abs, 'utf-8').includes(needle)) return file;
    }
    return null;
}

/**
 * The `selector: '…'` string-literal span for the directive whose class is
 * `className`, found as the last `selector:` before `export class <className>`.
 * Returns the literal's quote char and inner text (without the quotes), plus the
 * absolute offsets of the inner text, or null when not found.
 */
function findSelectorLiteral(
    content: string, className: string,
): { quote: string; inner: string; innerStart: number; innerEnd: number } | null {
    const classAt = content.indexOf(`export class ${className}`);
    if (classAt === -1) return null;
    const before = content.slice(0, classAt);
    const selRegex = /selector\s*:\s*(['"])/g;
    let last: { quote: string; open: number } | null = null;
    let m: RegExpExecArray | null;
    while ((m = selRegex.exec(before)) !== null) {
        last = { quote: m[1], open: m.index + m[0].length };
    }
    if (!last) return null;
    const close = content.indexOf(last.quote, last.open);
    if (close === -1) return null;
    return { quote: last.quote, inner: content.slice(last.open, close), innerStart: last.open, innerEnd: close };
}

/**
 * Ensure the directive's selector literal contains a `<tag>[<marker>]` clause
 * (the tag reused from its existing first clause). Returns the rewritten file
 * content, or null when the clause is already present (no edit needed).
 */
function ensureMarkerClause(content: string, className: string, marker: string): string | null {
    const literal = findSelectorLiteral(content, className);
    if (!literal) return null;
    if (literal.inner.includes(`[${marker}]`)) return null;
    const tag = literal.inner.slice(0, literal.inner.indexOf('['));
    const newInner = `${literal.inner}, ${tag}[${marker}]`;
    return content.slice(0, literal.innerStart) + newInner + content.slice(literal.innerEnd);
}

/** SCREAMING_SNAKE fallback array name for a base with no existing barrel. */
function deriveArrayName(base: string): string {
    return `${base.replaceAll(/[^a-zA-Z0-9]+/g, '_').toUpperCase()}_FULL`;
}

/**
 * The exported array name, resolved from the strongest source of truth first so
 * a from-scratch regeneration is reproducible:
 *  1. the composite's `attach.import` symbol — the exact name the `apply` command
 *     imports into consumer code, so the barrel MUST export it;
 *  2. an existing barrel's `export const <NAME>` (covers a `/full` entry with no
 *     attach yet);
 *  3. a SCREAMING_SNAKE default derived from the base name.
 */
function resolveArrayName(composite: RegistryEntry, indexAbs: string): string {
    if (composite.attachImport) {
        const symbol = attachSymbol(composite.attachImport);
        if (symbol) return symbol;
    }
    if (existsSync(indexAbs)) {
        const found = /export const (\w+)\s*=/.exec(readFileSync(indexAbs, 'utf-8'));
        if (found) return found[1];
    }
    return deriveArrayName(composite.parent ?? '');
}

/**
 * Render the fully-generated barrel content for a composite addon: the sibling
 * directive classes are imported (for the array) AND re-exported — Angular's AOT
 * reference emitter resolves a directive used in a standalone `imports: [ARRAY]`
 * through the array's own module, so each class must be exported from here or a
 * consumer build fails with NG3004 ("not exported from …/full").
 */
export function renderCompositeBarrel(arrayName: string, siblings: readonly CompositeSibling[]): string {
    const imports = siblings.map(s => `import { ${s.className} } from '../${s.short}';`);
    const reexports = siblings.map(s => `    ${s.className},`);
    const members = siblings.map(s => `    ${s.className},`);
    return [
        COMPOSITE_HEADER,
        '',
        ...imports,
        '',
        'export {',
        ...reexports,
        '};',
        '',
        `export const ${arrayName} = [`,
        ...members,
        '] as const;',
        '',
    ].join('\n');
}

/** Resolve a composite's sibling addons (same parent, sorted by short name). */
function resolveCompositeSiblings(
    composite: RegistryEntry,
    entries: readonly RegistryEntry[],
    componentsRoot: string,
    warnings: string[],
): CompositeSibling[] {
    const siblings: CompositeSibling[] = [];
    for (const entry of entries) {
        if (entry.type !== 'addon' || entry.parent !== composite.parent || entry.name === composite.name) continue;
        if (!entry.attachImport) continue;
        const className = attachSymbol(entry.attachImport);
        const sourceFile = findClassFile(entry, className, componentsRoot);
        if (!sourceFile) {
            warnings.push(`  composite '${composite.name}': could not locate a file declaring '${className}' for '${entry.name}'`);
            continue;
        }
        siblings.push({ short: entry.name.split('/').at(-1) ?? entry.name, className, sourceFile });
    }
    return siblings.sort((a, b) => byLocale(a.short, b.short));
}

/** Analyze one composite entry into the selector + barrel edits it needs. */
function analyzeComposite(
    composite: RegistryEntry,
    entries: readonly RegistryEntry[],
    componentsRoot: string,
    warnings: string[],
): { edits: CompositeFileEdit[]; driftLines: string[] } {
    const marker = composite.attachSelector;
    if (!marker || !composite.parent) return { edits: [], driftLines: [] };

    const siblings = resolveCompositeSiblings(composite, entries, componentsRoot, warnings);
    const edits: CompositeFileEdit[] = [];
    const driftLines: string[] = [];

    for (const sibling of siblings) {
        const abs = path.join(componentsRoot, 'ui', sibling.sourceFile);
        const rewritten = ensureMarkerClause(readFileSync(abs, 'utf-8'), sibling.className, marker);
        if (rewritten !== null) {
            edits.push({ path: abs, content: rewritten, kind: 'selector', label: sibling.sourceFile });
            driftLines.push(`  ${composite.name}: ${sibling.sourceFile} selector missing '[${marker}]' clause`);
        }
    }

    const indexRel = `${composite.parent}/addons/full/index.ts`;
    const indexAbs = path.join(componentsRoot, 'ui', indexRel);
    const content = renderCompositeBarrel(resolveArrayName(composite, indexAbs), siblings);
    const current = existsSync(indexAbs) ? readFileSync(indexAbs, 'utf-8') : null;
    if (current !== content) {
        edits.push({ path: indexAbs, content, kind: 'barrel', label: indexRel });
        driftLines.push(`  ${composite.name}: ${indexRel} is ${current === null ? 'missing' : 'out of date'}`);
    }

    return { edits, driftLines };
}

/**
 * Find every `<base>/full` composite addon and derive the source edits that keep
 * it in lock-step with its sibling addons: the marker selector clause on each
 * sibling directive, and the generated barrel array. Pure except for reading the
 * component tree; the caller writes the returned edits in `--fix` mode.
 */
export function analyzeComposites(
    entries: readonly RegistryEntry[],
    roots: SyncRoots,
): CompositeAnalysis {
    const edits: CompositeFileEdit[] = [];
    const driftLines: string[] = [];
    const warnings: string[] = [];

    for (const entry of entries) {
        if (entry.type !== 'addon' || !entry.parent || entry.name !== `${entry.parent}/full`) continue;
        const result = analyzeComposite(entry, entries, roots.componentsRoot, warnings);
        edits.push(...result.edits);
        driftLines.push(...result.driftLines);
    }

    return { edits, driftLines, hasDrift: driftLines.length > 0, warnings };
}

/** Report lines for composite drift found in check mode. */
export function formatCompositeReport(analysis: CompositeAnalysis): string[] {
    if (!analysis.hasDrift) return [];
    return [
        '\nComposite addon(s) out of sync (marker selector clause or generated barrel):',
        ...analysis.driftLines,
        'Run with --fix to regenerate.',
    ];
}

// ── Registry source rewriting ───────────────────────────────────────────

function findNamePos(source: string, name: string): number {
    const singleQuote = source.indexOf(`name: '${name}'`);
    if (singleQuote >= 0) return singleQuote;
    return source.indexOf(`name: "${name}"`);
}

/** The source slice covering one entry's object literal, from its `name:` on. */
function entryBlock(source: string, name: string, namePos: number): string {
    const nextNamePos = source.indexOf('name: ', namePos + name.length + 8);
    return source.slice(namePos, nextNamePos === -1 ? source.length : nextNamePos);
}

/** Replace the entry's `files: [...]` contents with `filesArrayStr`. */
export function replaceFilesArray(source: string, name: string, filesArrayStr: string): string {
    const namePos = findNamePos(source, name);
    if (namePos === -1) return source;

    const filesStart = source.indexOf('files: [', namePos);
    if (filesStart === -1) return source;
    const filesEnd = source.indexOf(']', filesStart + 8);
    if (filesEnd === -1) return source;

    return source.slice(0, filesStart + 8) + filesArrayStr + source.slice(filesEnd);
}

/** Replace the entry's `libFiles: [...]`, inserting the key after `files` if absent. */
export function updateLibFiles(source: string, name: string, libArrayStr: string): string {
    const updatedNamePos = findNamePos(source, name);
    if (updatedNamePos === -1) return source;
    const blockSlice = entryBlock(source, name, updatedNamePos);

    const libOffset = blockSlice.indexOf('libFiles: [');
    if (libOffset >= 0) {
        const absLibStart = updatedNamePos + libOffset;
        const libEnd = source.indexOf(']', absLibStart + 11);
        return source.slice(0, absLibStart + 11) + libArrayStr + source.slice(libEnd);
    }

    const absFilesStart = source.indexOf('files: [', updatedNamePos);
    const absFilesEnd = source.indexOf(']', absFilesStart + 8);
    return source.slice(0, absFilesEnd + 1) + `,\n    libFiles: [${libArrayStr}]` + source.slice(absFilesEnd + 1);
}

/** Replace the entry's `dependencies: [...]`, inserting the key after libFiles/files if absent. */
export function updateDependencies(source: string, name: string, depsArrayStr: string): string {
    const updatedNamePos = findNamePos(source, name);
    if (updatedNamePos === -1) return source;
    const blockSlice = entryBlock(source, name, updatedNamePos);

    const depsOffset = blockSlice.indexOf('dependencies: [');
    if (depsOffset >= 0) {
        const absDepsStart = updatedNamePos + depsOffset;
        const depsEnd = source.indexOf(']', absDepsStart + 15);
        return source.slice(0, absDepsStart + 15) + depsArrayStr + source.slice(depsEnd);
    }

    const libOffset = blockSlice.indexOf('libFiles: [');
    if (libOffset >= 0) {
        const absLibStart = updatedNamePos + libOffset;
        const libEnd = source.indexOf(']', absLibStart + 11);
        return source.slice(0, libEnd + 1) + `,\n    dependencies: [${depsArrayStr}]` + source.slice(libEnd + 1);
    }

    const absFilesStart = source.indexOf('files: [', updatedNamePos);
    const absFilesEnd = source.indexOf(']', absFilesStart + 8);
    return source.slice(0, absFilesEnd + 1) + `,\n    dependencies: [${depsArrayStr}]` + source.slice(absFilesEnd + 1);
}

/** Drop the entry's `dependencies: [...]` key entirely (used when it derives to empty). */
export function removeDependencies(source: string, name: string): string {
    const namePos = findNamePos(source, name);
    if (namePos === -1) return source;
    const blockSlice = entryBlock(source, name, namePos);

    const depsRegex = /,?\s{0,4096}dependencies:\s{0,4096}\[[^\]]{0,100000}\]/;
    const depsMatch = depsRegex.exec(blockSlice);
    if (!depsMatch) return source;

    const absStart = namePos + depsMatch.index;
    const absEnd = absStart + depsMatch[0].length;
    return source.slice(0, absStart) + source.slice(absEnd);
}

function quoted(values: readonly string[]): string {
    return values.map(v => `'${v}'`).join(', ');
}

/**
 * Replace the entry's `<key>: [...]` contents, inserting the key after the
 * first present anchor key when absent. Keys are camelCase-distinct
 * (`testFiles` never collides with `files: [` and `testDependencies` never
 * collides with `dependencies: [` — the embedded capital letter breaks the
 * lowercase marker match), so plain `indexOf` markers stay unambiguous.
 */
export function updateEntryArray(
    source: string,
    name: string,
    key: string,
    arrayStr: string,
    insertAfter: readonly string[],
): string {
    const namePos = findNamePos(source, name);
    if (namePos === -1) return source;
    const blockSlice = entryBlock(source, name, namePos);

    const marker = `${key}: [`;
    const offset = blockSlice.indexOf(marker);
    if (offset >= 0) {
        const absStart = namePos + offset + marker.length;
        const end = source.indexOf(']', absStart);
        return source.slice(0, absStart) + arrayStr + source.slice(end);
    }

    for (const anchor of insertAfter) {
        const anchorMarker = `${anchor}: [`;
        const anchorOffset = blockSlice.indexOf(anchorMarker);
        if (anchorOffset >= 0) {
            const end = source.indexOf(']', namePos + anchorOffset + anchorMarker.length);
            return source.slice(0, end + 1) + `,\n    ${key}: [${arrayStr}]` + source.slice(end + 1);
        }
    }
    return source;
}

/** Drop the entry's `<key>: [...]` property entirely (used when it derives to empty). */
export function removeEntryArray(source: string, name: string, key: string): string {
    const namePos = findNamePos(source, name);
    if (namePos === -1) return source;
    const blockSlice = entryBlock(source, name, namePos);

    const keyRegex = new RegExp(String.raw`,?\s{0,4096}\b${key}:\s{0,4096}\[[^\]]{0,100000}\]`);
    const keyMatch = keyRegex.exec(blockSlice);
    if (!keyMatch) return source;

    const absStart = namePos + keyMatch.index;
    return source.slice(0, absStart) + source.slice(absStart + keyMatch[0].length);
}

const TEST_FILES_ANCHORS = ['dependencies', 'libFiles', 'files'] as const;
const TEST_DEPS_ANCHORS = ['testFiles', ...TEST_FILES_ANCHORS] as const;

function applyTestArrays(source: string, update: ComponentUpdate): string {
    let out = source;
    if (update.testFiles !== undefined) {
        out = update.testFiles.length > 0
            ? updateEntryArray(out, update.name, 'testFiles', quoted(update.testFiles), TEST_FILES_ANCHORS)
            : removeEntryArray(out, update.name, 'testFiles');
    }
    if (update.testDependencies !== undefined) {
        out = update.testDependencies.length > 0
            ? updateEntryArray(out, update.name, 'testDependencies', quoted(update.testDependencies), TEST_DEPS_ANCHORS)
            : removeEntryArray(out, update.name, 'testDependencies');
    }
    return out;
}

/** Apply every update to the registry `index.ts` source, returning the new source. */
export function applyUpdatesToSource(source: string, updates: readonly ComponentUpdate[]): string {
    let out = source;
    for (const update of updates) {
        out = replaceFilesArray(out, update.name, quoted(update.files));

        if (update.libFiles.length > 0) {
            out = updateLibFiles(out, update.name, quoted(update.libFiles));
        }

        if (update.dependencies.length > 0) {
            out = updateDependencies(out, update.name, quoted(update.dependencies));
        } else {
            out = removeDependencies(out, update.name);
        }

        out = applyTestArrays(out, update);
    }
    return out;
}

// ── Validation ──────────────────────────────────────────────────────────

function findMissingFiles(
    label: string,
    componentName: string,
    files: readonly string[],
    rootDir: string,
): string[] {
    const problems: string[] = [];
    for (const file of files) {
        const fullPath = path.join(rootDir, file);
        if (!existsSync(fullPath)) {
            problems.push(`  ${componentName}: ${label} entry '${file}' -> ${fullPath} does not exist`);
        }
    }
    return problems;
}

/**
 * Verify that every files / libFiles path the registry will hold resolves to a
 * real file on disk — one problem line per missing file, however many.
 */
export function validateRegistryFiles(updates: readonly ComponentUpdate[], roots: SyncRoots): string[] {
    const uiDir = path.join(roots.componentsRoot, 'ui');
    const libDir = path.join(roots.componentsRoot, 'lib');
    const problems: string[] = [];
    for (const update of updates) {
        problems.push(
            ...findMissingFiles('files', update.name, update.files, uiDir),
            ...findMissingFiles('libFiles', update.name, update.libFiles, libDir),
            ...findMissingFiles('testFiles', update.name, update.testFiles ?? [], uiDir),
        );
    }
    return problems;
}

/**
 * A block's own files live under packages/blocks; its libFiles (if any) live
 * under packages/components/lib. `analyzeBlock` re-derives both by walking the
 * block's imports, but a stale hand-authored libFile survives the merge, so
 * every declared path is validated against disk before a write.
 */
export function validateBlockFiles(blocks: readonly ComponentUpdate[], roots: SyncRoots): string[] {
    const libDir = path.join(roots.componentsRoot, 'lib');
    const problems: string[] = [];
    for (const block of blocks) {
        problems.push(
            ...findMissingFiles('block file', block.name, block.files, roots.blocksRoot),
            ...findMissingFiles('libFiles', block.name, block.libFiles, libDir),
        );
    }
    return problems;
}

/**
 * A block's source lives in packages/blocks/<name>/, and the component
 * import-walker never visits it — so a block folder with no matching registry
 * entry would be silently absent from every install. Such orphans are reported
 * as a non-fatal warning: a new block legitimately exists on disk before its
 * entry is hand-authored.
 */
export function detectOrphanBlockFolders(blocks: readonly RegistryEntry[], blocksRoot: string): string[] {
    if (!existsSync(blocksRoot)) return [];
    const claimed = new Set(blocks.flatMap(b => b.files.map(f => f.split('/')[0])));
    return readdirSync(blocksRoot, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && !claimed.has(entry.name))
        .map(entry => entry.name);
}

// ── Portable test collection (`add --include-tests`) ────────────────────
//
// Spec files are invisible to the import walk (production code never imports
// them), so shipping them is an explicit, gated concern: only components
// listed in `packages/components/portable-tests.json` get a `testFiles[]`
// array, and every listed component's specs are hard-validated for
// portability (plain vitest jsdom AND jest via the vitest-compat shim) before
// the sync writes anything.

/** Checked-in gate file: which components' specs are verified portable. */
export const PORTABLE_TESTS_FILENAME = 'portable-tests.json';

const BROWSER_SPEC_SUFFIX = '.browser.spec.ts';

export interface CoverageException {
    /** Line-coverage floor (percent) accepted for this component under jsdom. */
    readonly lines: number;
    /** Why full coverage is unreachable outside a real browser. */
    readonly reason: string;
}

export interface PortableTestsConfig {
    readonly verified: readonly string[];
    readonly coverageExceptions?: Readonly<Record<string, CoverageException>>;
}

/** Load and shape-check `portable-tests.json`; absent file means nothing verified. */
export function loadPortableTestsConfig(componentsRoot: string): PortableTestsConfig {
    const file = path.join(componentsRoot, PORTABLE_TESTS_FILENAME);
    if (!existsSync(file)) return { verified: [] };
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf-8'));
    const record = parsed as Record<string, unknown>;
    if (typeof parsed !== 'object' || parsed === null
        || !Array.isArray(record['verified'])
        || !record['verified'].every((v: unknown) => typeof v === 'string')) {
        throw new Error(`${PORTABLE_TESTS_FILENAME} must contain a "verified" string array`);
    }
    return parsed as PortableTestsConfig;
}

function isPortableSpecName(fileName: string): boolean {
    return fileName.endsWith('.spec.ts') && !fileName.endsWith(BROWSER_SPEC_SUFFIX);
}

/**
 * Collect the portable specs an entry owns: every non-`.browser` spec sitting
 * in a directory its `files[]` occupy. Root-level entries (flat directives)
 * only claim the spec matching their own basename — the `ui/` root is shared,
 * so directory ownership would over-collect there.
 */
export function collectPortableSpecs(
    files: readonly string[],
    uiDir: string,
): string[] {
    const specs = new Set<string>();
    for (const dir of new Set(files.map(f => path.posix.dirname(f)))) {
        if (dir === '.') collectRootSpecs(files, uiDir, specs);
        else collectDirSpecs(dir, uiDir, specs);
    }
    return [...specs].sort(byLocale);
}

/** Root-level (flat directive) entries claim only their own `<basename>.spec.ts`. */
function collectRootSpecs(files: readonly string[], uiDir: string, specs: Set<string>): void {
    for (const file of files) {
        if (path.posix.dirname(file) !== '.') continue;
        const spec = file.replace(/\.ts$/, '.spec.ts');
        if (isPortableSpecName(spec) && existsSync(path.join(uiDir, spec))) specs.add(spec);
    }
}

/** A folder-owned entry claims every portable spec in its directories. */
function collectDirSpecs(dir: string, uiDir: string, specs: Set<string>): void {
    const dirPath = path.join(uiDir, dir);
    if (!existsSync(dirPath)) return;
    for (const name of readdirSync(dirPath)) {
        if (isPortableSpecName(name)) specs.add(path.posix.join(dir, name));
    }
}

const VITEST_IMPORT_RE = /from\s+['"]vitest['"]/;
const VI_UNSHIMMABLE_RE = /\bvi\.(mock|doMock|unmock|doUnmock|hoisted|importActual|importMock)\s*\(/;
const FAKE_TIMER_OPTIONS_RE = /\bvi\.useFakeTimers\s*\(\s*\{/;

/**
 * Portability lint for one spec's content. Everything reported here would
 * break a consumer runner: `vi.mock`-family calls cannot be shimmed for jest
 * (hoisting), fake-timer option objects diverge between runners, and a spec
 * without an explicit vitest import relies on `globals: true`, which a jest
 * consumer (and a strict vitest config) does not provide.
 */
export function lintPortableSpec(specFile: string, content: string): string[] {
    const problems: string[] = [];
    if (!VITEST_IMPORT_RE.test(content)) {
        problems.push(`  ${specFile}: missing an explicit \`from 'vitest'\` import (globals reliance breaks jest consumers)`);
    }
    const unshimmable = VI_UNSHIMMABLE_RE.exec(content);
    if (unshimmable) {
        problems.push(`  ${specFile}: vi.${unshimmable[1]}() cannot be shimmed for jest — refactor to DI/vi.spyOn or rename to *${BROWSER_SPEC_SUFFIX}`);
    }
    if (FAKE_TIMER_OPTIONS_RE.test(content)) {
        problems.push(`  ${specFile}: vi.useFakeTimers(options) is not portable — call it without options`);
    }
    return problems;
}

export interface SpecImportScan {
    /** Sibling components whose source the spec imports. */
    readonly deps: Set<string>;
    readonly errors: string[];
}

/**
 * Classify one spec's relative imports: sibling component barrels become
 * test-dependency candidates; anything a consumer install would not have on
 * disk (an unshipped own file, a foreign internal file, an unknown lib file)
 * is a hard error.
 */
interface SpecImportVerdict {
    readonly dep?: string;
    readonly error?: string;
}

interface SpecScanContext {
    readonly specFile: string;
    readonly entryName: string;
    readonly shipped: ReadonlySet<string>;
    readonly libAllow: ReadonlySet<string>;
    readonly ctx: BoundaryContext;
    readonly componentsRoot: string;
}

function libImportVerdict(resolved: string, scan: SpecScanContext): SpecImportVerdict {
    const libName = resolved.slice(4);
    if (BASELINE_LIB_FILES.has(libName) || scan.libAllow.has(libName)) return {};
    return { error: `  ${scan.specFile}: imports lib/${libName}, which the component does not ship — add it to libFiles` };
}

function uiImportVerdict(resolved: string, scan: SpecScanContext): SpecImportVerdict {
    const classified = classifyImport(resolved, scan.entryName, scan.ctx);
    if (classified.kind === 'dependency' && classified.owner) {
        return { dep: classified.owner };
    }
    if (classified.kind === 'deep-import' && classified.owner) {
        return { error: `  ${scan.specFile}: deep-imports ${resolved} (internal to '${classified.owner}') — import its barrel instead` };
    }
    if (classified.kind === 'addon-boundary' && classified.owner) {
        return { error: `  ${scan.specFile}: reaches into addon '${classified.owner}' — addon specs belong to the addon entry` };
    }
    if (!scan.shipped.has(resolved.slice(3))) {
        return { error: `  ${scan.specFile}: imports ${resolved}, which is not shipped with '${scan.entryName}'` };
    }
    return {};
}

function specImportVerdict(importPath: string, scan: SpecScanContext): SpecImportVerdict {
    const resolved = resolveImport(importPath, `ui/${scan.specFile}`, scan.componentsRoot);
    if (!resolved) return { error: `  ${scan.specFile}: import '${importPath}' does not resolve` };
    if (resolved.startsWith('lib/')) return libImportVerdict(resolved, scan);
    return uiImportVerdict(resolved, scan);
}

export function analyzeSpecImports(
    specFile: string,
    content: string,
    entryName: string,
    shipped: ReadonlySet<string>,
    libAllow: ReadonlySet<string>,
    ctx: BoundaryContext,
    componentsRoot: string,
): SpecImportScan {
    const scan: SpecScanContext = { specFile, entryName, shipped, libAllow, ctx, componentsRoot };
    const deps = new Set<string>();
    const errors: string[] = [];

    for (const match of content.matchAll(IMPORT_REGEX)) {
        const verdict = specImportVerdict(match[1], scan);
        if (verdict.dep) deps.add(verdict.dep);
        if (verdict.error) errors.push(verdict.error);
    }
    return { deps, errors };
}

/** Transitive runtime dependency closure over the freshly-derived updates. */
export function dependencyClosure(name: string, depsByName: ReadonlyMap<string, readonly string[]>): Set<string> {
    const closure = new Set<string>();
    const queue = [...(depsByName.get(name) ?? [])];
    while (queue.length > 0) {
        const dep = queue.pop();
        if (dep === undefined || closure.has(dep)) continue;
        closure.add(dep);
        queue.push(...(depsByName.get(dep) ?? []));
    }
    return closure;
}

export interface PortableTestsAnalysis {
    /** Per verified component: the arrays to merge into its ComponentUpdate. */
    readonly updates: Map<string, { testFiles: string[]; testDependencies: string[] }>;
    readonly errors: string[];
    readonly driftLines: string[];
    readonly hasChanges: boolean;
}

interface VerifiedScanResult {
    readonly testFiles: string[];
    readonly testDependencies: string[];
    readonly errors: string[];
}

function scanVerifiedComponent(
    name: string,
    update: ComponentUpdate,
    depsByName: ReadonlyMap<string, readonly string[]>,
    ctx: BoundaryContext,
    uiDir: string,
    componentsRoot: string,
): VerifiedScanResult {
    const testFiles = collectPortableSpecs(update.files, uiDir);
    if (testFiles.length === 0) {
        return { testFiles, testDependencies: [], errors: [`  ${name}: verified in ${PORTABLE_TESTS_FILENAME} but has no portable specs on disk`] };
    }

    const errors: string[] = [];
    const shipped = new Set([...update.files, ...testFiles]);
    const libAllow = new Set(update.libFiles);
    const closure = dependencyClosure(name, depsByName);
    const specDeps = new Set<string>();

    for (const spec of testFiles) {
        const content = readFileSync(path.join(uiDir, spec), 'utf-8');
        errors.push(...lintPortableSpec(spec, content));
        const scan = analyzeSpecImports(spec, content, name, shipped, libAllow, ctx, componentsRoot);
        errors.push(...scan.errors);
        for (const dep of scan.deps) specDeps.add(dep);
    }

    const testDependencies = [...specDeps].filter(d => d !== name && !closure.has(d)).sort(byLocale);
    return { testFiles, testDependencies, errors };
}

function testDriftLines(entry: RegistryEntry, testFiles: readonly string[], testDependencies: readonly string[]): string[] {
    const lines: string[] = [];
    for (const f of testFiles.filter(f => !entry.testFiles.includes(f))) lines.push(`    + testFiles: ${f}`);
    for (const f of entry.testFiles.filter(f => !testFiles.includes(f))) lines.push(`    - testFiles: ${f}`);
    for (const d of testDependencies.filter(d => !entry.testDependencies.includes(d))) lines.push(`    + testDependencies: ${d}`);
    for (const d of entry.testDependencies.filter(d => !testDependencies.includes(d))) lines.push(`    - testDependencies: ${d}`);
    return lines;
}

/**
 * Derive `testFiles` / `testDependencies` for every component verified in
 * `portable-tests.json`, hard-validating spec portability, and derive removal
 * updates for entries whose verification was revoked. Runs after
 * `analyzeAllEntries` so it sees the freshly-derived files/libFiles/deps.
 */
export function analyzePortableTests(
    entries: readonly RegistryEntry[],
    updates: readonly ComponentUpdate[],
    config: PortableTestsConfig,
    ctx: BoundaryContext,
    roots: SyncRoots,
): PortableTestsAnalysis {
    const uiDir = path.join(roots.componentsRoot, 'ui');
    const entriesByName = new Map(entries.map(e => [e.name, e]));
    const updatesByName = new Map(updates.map(u => [u.name, u]));
    const depsByName = new Map(updates.map(u => [u.name, u.dependencies]));

    const result = new Map<string, { testFiles: string[]; testDependencies: string[] }>();
    const errors: string[] = [];
    const driftLines: string[] = [];

    for (const name of config.verified) {
        const entry = entriesByName.get(name);
        const update = updatesByName.get(name);
        if (!entry || !update) {
            errors.push(`  ${name}: listed in ${PORTABLE_TESTS_FILENAME} but is not a component registry entry`);
            continue;
        }
        const scan = scanVerifiedComponent(name, update, depsByName, ctx, uiDir, roots.componentsRoot);
        errors.push(...scan.errors);
        result.set(name, { testFiles: scan.testFiles, testDependencies: scan.testDependencies });

        const drift = testDriftLines(entry, scan.testFiles, scan.testDependencies);
        if (drift.length > 0) driftLines.push(`  ${name}:`, ...drift);
    }

    const verified = new Set(config.verified);
    for (const entry of entries) {
        if (verified.has(entry.name) || entry.testFiles.length === 0) continue;
        result.set(entry.name, { testFiles: [], testDependencies: [] });
        driftLines.push(`  ${entry.name}:`, ...testDriftLines(entry, [], []));
    }

    return { updates: result, errors, driftLines, hasChanges: driftLines.length > 0 };
}

/** Serialize the registry object to the data-only manifest the live CLI fetches. */
export function serializeRegistryJson(registry: unknown): string {
    return JSON.stringify(registry, null, 2) + '\n';
}

/**
 * Import the TS registry fresh, bypassing the ESM module cache, so the returned
 * object reflects edits `--fix` has just written to `registry/index.ts`.
 *
 * Lives here rather than in the script on purpose: a template-literal dynamic
 * `import()` in a file that also carries a `#!` shebang makes vite's transform
 * mis-slice the source (the hashbang strip shifts its offsets), which silently
 * drops the whole file from the v8 coverage report. The lib has no shebang, so
 * the same call is harmless here.
 */
export async function loadRegistryFresh(): Promise<unknown> {
    const mod: { registry: unknown } = await import(`../src/registry/index.js?t=${process.hrtime.bigint()}`);
    return mod.registry;
}
