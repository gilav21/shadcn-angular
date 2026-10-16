/**
 * Pure checks behind `repo-hygiene.spec.ts` — the gate that keeps the classes
 * of drift found by the 2026-10-03 review (undeclared imports, dead files,
 * stale doc paths, unreachable scripts, barrel gaps) from coming back silently.
 * Every function takes plain data (paths, file texts, script maps) so the spec
 * can prove each rule on an in-memory fixture before applying it to the tree.
 */
import { builtinModules } from 'node:module';
import path from 'node:path';
import ts from 'typescript';

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

const BUILTINS = new Set(builtinModules);

/**
 * Every module specifier a file names — static, type-only, re-export and
 * dynamic `import()`. A scanner, not a regex: prose in comments that looks
 * like an import is not one.
 */
function specifiersOf(text: string): string[] {
    return ts.preProcessFile(text, true, true).importedFiles.map((f) => f.fileName);
}

/** Module specifiers of `export … from '…'` declarations only — a plain `import` re-exports nothing. */
function reExportSpecifiersOf(text: string): string[] {
    return ts.createSourceFile('barrel.ts', text, ts.ScriptTarget.Latest).statements.flatMap((statement) =>
        ts.isExportDeclaration(statement) && statement.moduleSpecifier !== undefined
            && ts.isStringLiteral(statement.moduleSpecifier)
            ? [statement.moduleSpecifier.text]
            : []);
}

/**
 * The npm package a specifier resolves to, or `undefined` when it is not a
 * package: relative/absolute paths, the `@/` alias, `#` subpath imports,
 * scheme specifiers (`node:`, `virtual:`, `data:`) and node builtins.
 */
function packageOf(specifier: string): string | undefined {
    if (/^(?:\.|\/|@\/|#)/.test(specifier) || specifier.includes(':')) return undefined;
    const [bare = ''] = specifier.split('?');
    const parts = bare.split('/');
    const name = bare.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? '');
    return BUILTINS.has(name) ? undefined : name;
}

/**
 * Bare imports (static, type-only, dynamic) of packages missing from `declared`.
 * A declared `@types/x` does NOT declare `x`: the runtime package would still
 * resolve only through hoisting, which is the exact class this check exists for.
 */
export function findUndeclaredImports(
    files: readonly SourceFile[],
    declared: ReadonlySet<string>,
): UndeclaredImport[] {
    return files.flatMap((file) => {
        const missing = new Set<string>();
        for (const specifier of specifiersOf(file.text)) {
            const pkg = packageOf(specifier);
            if (pkg !== undefined && !declared.has(pkg)) missing.add(pkg);
        }
        return [...missing].map((pkg) => ({ file: file.path, pkg }));
    });
}

const PLACEHOLDER = /[<>*{}…]|\.{3}/;
const NOT_A_PATH = /[\s'"()[\]=,;:$`]/;
const FILE_EXTENSION = /\.(?:ts|mts|cts|mjs|cjs|js|json|md|mdc|css|scss|html|ya?ml|txt|ttf|pdf|properties)$/;
const NPM_RUN = /\bnpm run ([\w:.-]*[\w:-])/g;

/** Inline code spans outside fenced code blocks. */
function inlineCodeSpans(markdown: string): string[] {
    const spans: string[] = [];
    let fenced = false;
    for (const line of markdown.split('\n')) {
        if (/^\s*(?:```|~~~)/.test(line)) {
            fenced = !fenced;
            continue;
        }
        if (fenced) continue;
        for (const match of line.matchAll(/`([^`]+)`/g)) spans.push(match[1] ?? '');
    }
    return spans;
}

/**
 * Whether an inline-code token is a repo path worth checking: no placeholder,
 * no code punctuation, not relative, and either a directory (`x/`) or a file
 * with a known extension. A bare token starting with `.` (`.stories.ts`,
 * `.css`) names a suffix, not a file; extension-less dotfiles (`.env`,
 * `.tree-hash`) are generated or secret and never tracked. A tracked dotfile
 * config with a real extension (`demo/.postcssrc.json`) IS checked.
 */
function isCheckablePath(token: string): boolean {
    if (PLACEHOLDER.test(token) || NOT_A_PATH.test(token) || token.startsWith('./') || token.startsWith('../')) {
        return false;
    }
    if (token.endsWith('/')) return token.length > 1;
    if (token.startsWith('.') && !token.includes('/')) return false;
    const basename = path.posix.basename(token);
    const extension = basename.startsWith('.') ? basename.slice(basename.indexOf('.', 1)) : basename;
    return FILE_EXTENSION.test(extension);
}

/**
 * Resolution against tracked paths. A path whose first segment is a tracked
 * top-level directory is ROOTED and must exist exactly; any other path with a
 * slash is a SUFFIX of some tracked path (docs write `registry/load.ts`); a
 * bare name must be the basename of some tracked file.
 */
function makeResolver(trackedPaths: readonly string[]): (token: string) => boolean {
    const tracked = new Set(trackedPaths);
    const basenames = new Set(trackedPaths.map((p) => path.posix.basename(p)));
    const topDirs = new Set(trackedPaths.filter((p) => p.includes('/')).map((p) => p.split('/')[0]));
    return (token) => {
        const rooted = token.includes('/') && topDirs.has(token.split('/')[0]);
        if (token.endsWith('/')) {
            return trackedPaths.some((p) => p.startsWith(token) || (!rooted && p.includes(`/${token}`)));
        }
        if (rooted) return tracked.has(token);
        if (token.includes('/')) return trackedPaths.some((p) => p.endsWith(`/${token}`));
        return basenames.has(token);
    };
}

/** Inline-code paths and `npm run <script>` names in `markdown` that do not resolve. */
export function extractDocReferences(
    markdown: string,
    trackedPaths: readonly string[],
    scripts: ReadonlySet<string>,
): DocReferenceReport {
    const resolves = makeResolver(trackedPaths);
    const missingPaths = new Set(inlineCodeSpans(markdown).filter((t) => isCheckablePath(t) && !resolves(t)));
    const unknownScripts = new Set(
        [...markdown.matchAll(NPM_RUN)].map((m) => m[1] ?? '').filter((name) => !scripts.has(name)),
    );
    return { missingPaths: [...missingPaths], unknownScripts: [...unknownScripts] };
}

/** Paths that are not `.ts`/`.html`/`.css` and not keys of `allowlist`. */
export function findStrayShippedFiles(
    paths: readonly string[],
    allowlist: Readonly<Record<string, string>>,
): string[] {
    return paths.filter((p) => !/\.(?:ts|html|css)$/.test(p) && !Object.hasOwn(allowlist, p));
}

function escapeRegExp(text: string): string {
    return text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

/** Entry points whose file name no OTHER corpus document names or imports. */
export function findUnreachableScripts(
    entryPoints: readonly string[],
    corpus: readonly SourceFile[],
): string[] {
    return entryPoints.filter((entry) => {
        const base = path.posix.basename(entry);
        const stem = base.replace(/\.[^.]+$/, '');
        const named = new RegExp(String.raw`(?:^|[^\w.-])${escapeRegExp(base)}(?![\w-]|\.\w)`);
        const imported = new RegExp(String.raw`/${escapeRegExp(stem)}(?:\.js)?['"]`);
        return !corpus.some((doc) => doc.path !== entry && (named.test(doc.text) || imported.test(doc.text)));
    });
}

/** Folder barrels and flat directives under `ui/` that `ui/index.ts` does not export. */
export function uiBarrelGaps(
    uiPaths: readonly string[],
    readUiFile: (relPath: string) => string,
): string[] {
    const present = new Set(uiPaths);
    const required = uiPaths.filter((p) => /^[^/]+\/index\.ts$/.test(p) || /^[^/]+\.directive\.ts$/.test(p));
    const isRequired = new Set(required);
    const exportsOf = (file: string): string[] =>
        reExportSpecifiersOf(readUiFile(file)).flatMap((spec) => {
            const target = path.posix.join(path.posix.dirname(file), spec);
            const found = [`${target}/index.ts`, `${target}.ts`].find((c) => present.has(c));
            return found === undefined ? [] : [found];
        });
    const exported = new Set<string>();
    for (const target of exportsOf('index.ts')) {
        exported.add(target);
        // One level of aggregator files (`export * from './x.directive'`) still counts.
        if (!isRequired.has(target)) for (const nested of exportsOf(target)) exported.add(nested);
    }
    return required.filter((r) => !exported.has(r));
}

/** The text of an npm script plus every script it runs through `npm run`, cycles cut. */
function expandScript(name: string, scripts: Readonly<Record<string, string>>, seen: Set<string>): string {
    if (seen.has(name)) return '';
    seen.add(name);
    const body = scripts[name] ?? '';
    const nested = [...body.matchAll(NPM_RUN)].map((m) => expandScript(m[1] ?? '', scripts, seen));
    return [body, ...nested].join('\n');
}

/** Generators `docs:check` verifies (`gen-*.ts --check`) that `docs:regen` never runs. */
export function regenGaps(scripts: Readonly<Record<string, string>>): string[] {
    const checked = generatorsIn(scripts['docs:check'] ?? '', true);
    // A regen chain that ends by running `docs:check` must not count those
    // `--check` runs as regenerating anything.
    const regenerated = new Set(generatorsIn(expandScript('docs:regen', scripts, new Set()), false));
    return checked.filter((generator) => !regenerated.has(generator));
}

/**
 * Generator file names in a script body, one `&&`/newline-separated command at
 * a time, keeping only the commands that do (`checking`) or do not pass
 * `--check` — a flag between the file and `--check` still counts.
 */
function generatorsIn(body: string, checking: boolean): string[] {
    return body.split(/&&|\n/)
        .filter((command) => /\s--check\b/.test(command) === checking)
        .flatMap((command) => /(?:^|[\s/])(gen-[\w-]+\.ts)\b/.exec(command)?.[1] ?? []);
}
