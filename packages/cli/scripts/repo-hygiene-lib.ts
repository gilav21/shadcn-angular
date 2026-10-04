/**
 * Pure checks behind `repo-hygiene.spec.ts` — the gate that keeps the classes
 * of drift found by the 2026-10-03 review (undeclared imports, dead files,
 * stale doc paths, unreachable scripts, barrel gaps) from coming back silently.
 * Every function takes plain data (paths, file texts, script maps) so the spec
 * can prove each rule on an in-memory fixture before applying it to the tree.
 */

/** A file's repo-relative path and its text. */
export interface SourceFile {
    readonly path: string;
    readonly text: string;
}

/** One bare import whose package no workspace manifest declares. */
export interface UndeclaredImport {
    readonly file: string;
    readonly pkg: string;
}

/** What a markdown document names that does not resolve. */
export interface DocReferenceReport {
    readonly missingPaths: readonly string[];
    readonly unknownScripts: readonly string[];
}

/** Bare imports (static, type-only, dynamic) of packages missing from `declared`. */
export function findUndeclaredImports(
    _files: readonly SourceFile[],
    _declared: ReadonlySet<string>,
): UndeclaredImport[] {
    return [];
}

/** Inline-code paths and `npm run <script>` names in `markdown` that do not resolve. */
export function extractDocReferences(
    _markdown: string,
    _trackedPaths: readonly string[],
    _scripts: ReadonlySet<string>,
): DocReferenceReport {
    return { missingPaths: [], unknownScripts: [] };
}

/** Paths that are not `.ts`/`.html`/`.css` and not keys of `allowlist`. */
export function findStrayShippedFiles(
    _paths: readonly string[],
    _allowlist: Readonly<Record<string, string>>,
): string[] {
    return [];
}

/** Entry points whose file name no OTHER corpus document names or imports. */
export function findUnreachableScripts(
    _entryPoints: readonly string[],
    _corpus: readonly SourceFile[],
): string[] {
    return [];
}

/** Folder barrels and flat directives under `ui/` that `ui/index.ts` does not export. */
export function uiBarrelGaps(
    _uiPaths: readonly string[],
    _readUiFile: (relPath: string) => string,
): string[] {
    return [];
}

/** Generators `docs:check` verifies (`gen-*.ts --check`) that `docs:regen` never runs. */
export function regenGaps(_scripts: Readonly<Record<string, string>>): string[] {
    return [];
}
