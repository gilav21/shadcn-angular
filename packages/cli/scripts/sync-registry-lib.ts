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
import { existsSync, statSync, readFileSync } from 'node:fs';
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
}

/**
 * Parse registry entries from the `index.ts` source. Entries are identified by
 * their `name:` value (not the object key), so addon entries keyed
 * `parent/addon` — whose `name` contains a `/` — are recognised.
 */
export function parseRegistrySource(source: string): RegistryEntry[] {
    const entries: RegistryEntry[] = [];

    const blockRegex = /['"]?([\w/-]{1,256})['"]?\s{0,4096}:\s{0,4096}\{[^}]{0,100000}name:\s{0,4096}['"]([^'"]{1,256})['"][^}]{0,100000}files:\s{0,4096}\[([^\]]{0,100000})\]/g;
    let match: RegExpExecArray | null;

    while ((match = blockRegex.exec(source)) !== null) {
        const name = match[2];
        const filesRaw = match[3];
        const files = [...filesRaw.matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1]);

        const matchStart = match.index ?? 0;
        const blockEnd = source.indexOf('},', matchStart + match[0].length);
        const fullBlock = blockEnd === -1 ? source.slice(matchStart) : source.slice(matchStart, blockEnd);
        const libFilesMatch = /libFiles:\s*\[([\s\S]*?)\]/.exec(fullBlock);
        const libFiles = libFilesMatch
            ? [...libFilesMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1])
            : [];

        const depsMatch = /dependencies:\s*\[([\s\S]*?)\]/.exec(fullBlock);
        const dependencies = depsMatch
            ? [...depsMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1])
            : [];

        const isBlock = /type:\s*['"]block['"]/.test(fullBlock);

        entries.push({ name, files, libFiles, dependencies, isBlock });
    }

    return entries;
}
