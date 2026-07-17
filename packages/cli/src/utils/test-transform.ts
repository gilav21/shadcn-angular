import type { TestRunner } from './config.js';

/**
 * Module specifier (relative to the utils alias) of the installed
 * vitest→jest compatibility shim. Combined with the consumer's utils alias
 * (e.g. `@/components/lib`) this yields the import a jest-targeted spec uses.
 */
export const VITEST_COMPAT_SUBPATH = 'testing/vitest-compat';

/** The lib-relative file the shim is fetched/written as. */
export const VITEST_COMPAT_LIB_FILE = 'testing/vitest-compat.ts';

/** The import specifier a jest spec resolves `vitest` to, given the utils alias. */
export function vitestCompatSpecifier(utilsAlias: string): string {
    return `${utilsAlias}/${VITEST_COMPAT_SUBPATH}`;
}

/** Matches an `import … from 'vitest'` / `from "vitest"` module specifier. */
const VITEST_IMPORT_RE = /(\bfrom\s+['"])vitest(['"])/g;

function compatImportRe(utilsAlias: string): RegExp {
    const escaped = vitestCompatSpecifier(utilsAlias).replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
    return new RegExp(String.raw`(\bfrom\s+['"])${escaped}(['"])`, 'g');
}

/**
 * Rewrite a spec's `from 'vitest'` imports to the compat shim. Idempotent —
 * an already-rewritten spec is unchanged (its specifier no longer reads
 * `vitest`). Only the module specifier is touched; the imported bindings and
 * everything else are left byte-for-byte.
 */
export function rewriteVitestToShim(source: string, utilsAlias: string): string {
    return source.replaceAll(VITEST_IMPORT_RE, `$1${vitestCompatSpecifier(utilsAlias)}$2`);
}

/**
 * Inverse of {@link rewriteVitestToShim}: rewrite the compat-shim import back
 * to `vitest`. Idempotent — a spec already importing `vitest` is unchanged.
 */
export function rewriteShimToVitest(source: string, utilsAlias: string): string {
    return source.replaceAll(compatImportRe(utilsAlias), '$1vitest$2');
}

/** Apply the spec transform for the target runner (`vitest` is a no-op). */
export function transformSpecForRunner(source: string, runner: TestRunner, utilsAlias: string): string {
    return runner === 'jest' ? rewriteVitestToShim(source, utilsAlias) : source;
}
