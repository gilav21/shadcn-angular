/** Module-specifier matcher: `from '...'`, `import('...')`, `require('...')`. */
const SPECIFIER_RE = /(\bfrom\s*|(?:\bimport|\brequire)\s*\(\s*)(['"])([^'"]+)\2/g;

/** A specifier's final path segment is `<name>.component` (optional `.ts`). */
const SEGMENT_RE = /(^|.*\/)([^/]+)\.component$/;

/**
 * Rewrite one module specifier ending in `/<name>.component` (for a migrated
 * `<name>`) to the folder barrel `/<name>`. Returns null when unchanged.
 */
export function rewriteSpecifier(spec: string, migrated: ReadonlySet<string>): string | null {
    const noExt = spec.endsWith('.ts') ? spec.slice(0, -3) : spec;
    const m = SEGMENT_RE.exec(noExt);
    if (!m) return null;
    const name = m[2];
    if (!migrated.has(name)) return null;
    return `${m[1]}${name}`;
}

/** Rewrite every migrated import specifier in a source file. */
export function rewriteImports(
    source: string, migrated: ReadonlySet<string>,
): { content: string; changed: boolean } {
    let changed = false;
    const content = source.replaceAll(SPECIFIER_RE, (full, prefix: string, quote: string, spec: string) => {
        const next = rewriteSpecifier(spec, migrated);
        if (next === null) return full;
        changed = true;
        return `${prefix}${quote}${next}${quote}`;
    });
    return { content, changed };
}
