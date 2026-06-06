import path from 'node:path';

/** Module-specifier matcher: `from '...'`, `import('...')`, `require('...')`. */
const SPECIFIER_RE = /(\bfrom\s*|(?:\bimport|\brequire)\s*\(\s*)(['"])([^'"]+)\2/g;

/** A specifier's final path segment is `<name>.component` (optional `.ts`). */
const SEGMENT_RE = /^(.*\/)?([^/]+)\.component$/;

export interface RewriteScope {
    /** Migrated component names (those whose flat file is being folderized). */
    readonly migrated: ReadonlySet<string>;
    /** Configured ui alias, no trailing slash (e.g. `@/components/ui`). */
    readonly uiAlias: string;
    /** Absolute path to the ui component directory. */
    readonly uiDir: string;
    /** Absolute directory of the file whose imports are being rewritten. */
    readonly fileDir: string;
}

/**
 * Only rewrite a specifier that ACTUALLY points at the migrated component's
 * deleted flat file (`<uiDir>/<name>.component`), via the ui alias or a
 * relative path that resolves into the ui dir. This is the critical guard
 * against corrupting a consumer's own `foo/card.component` that merely shares a
 * library component name.
 */
function pointsAtUiComponent(noExt: string, name: string, scope: RewriteScope): boolean {
    if (noExt === `${scope.uiAlias}/${name}.component`) return true;
    if (noExt.startsWith('.')) {
        const resolved = path.resolve(scope.fileDir, noExt);
        return resolved === path.join(scope.uiDir, `${name}.component`);
    }
    return false;
}

/**
 * Rewrite one module specifier ending in `/<name>.component` (for a migrated
 * `<name>` that resolves into the ui dir) to the folder barrel `/<name>`.
 * Returns null when unchanged.
 */
export function rewriteSpecifier(spec: string, scope: RewriteScope): string | null {
    const noExt = spec.endsWith('.ts') ? spec.slice(0, -3) : spec;
    const m = SEGMENT_RE.exec(noExt);
    if (!m) return null;
    const prefix = m[1] ?? '';
    const name = m[2];
    if (!scope.migrated.has(name)) return null;
    if (!pointsAtUiComponent(noExt, name, scope)) return null;
    return `${prefix}${name}`;
}

/** Rewrite every in-scope migrated import specifier in a source file. */
export function rewriteImports(
    source: string, scope: RewriteScope,
): { content: string; changed: boolean } {
    let changed = false;
    const content = source.replaceAll(SPECIFIER_RE, (full, prefix: string, quote: string, spec: string) => {
        const next = rewriteSpecifier(spec, scope);
        if (next === null) return full;
        changed = true;
        return `${prefix}${quote}${next}${quote}`;
    });
    return { content, changed };
}
