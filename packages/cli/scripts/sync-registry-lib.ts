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

export type ImportKind = 'own' | 'dependency' | 'deep-import';

export interface ImportClassification {
    readonly kind: ImportKind;
    /** Owning component — set for `dependency` and `deep-import`. */
    readonly owner?: string;
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

/** A cross-component import that reached another component's internal file. */
export interface DeepImport {
    /** The file containing the offending import. */
    readonly fromFile: string;
    /** The internal file it imported. */
    readonly importedFile: string;
    /** The component that owns the directory `importedFile` lives in. */
    readonly owner: string;
}

export interface WalkResult {
    readonly ownFiles: Set<string>;
    readonly discoveredDeps: Set<string>;
    readonly deepImports: DeepImport[];
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
    return { ownFiles, discoveredDeps, deepImports };
}
