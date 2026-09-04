/**
 * Staging library for the compiled npm packages — the bridge between the CLI's
 * registry (the single source of truth for "what a component is made of") and
 * the ng-packagr projects that compile a frozen snapshot of one closure.
 *
 * ── Why generate the sources instead of pointing ng-packagr at the repo? ──
 * ng-packagr compiles everything reachable from the entry point AND everything
 * the tsconfig `include`s, so aiming it at `packages/components/` would sweep in
 * `.spec.ts` / `.stories.ts` siblings and would let a future `export *` silently
 * grow the package. Copying an explicit, registry-derived file list makes the
 * package contents a TESTABLE fact (`stagedFiles`, `auditStagedImports`) rather
 * than a convention. The generated tree is disposable and git-ignored.
 *
 * Everything here is a pure value→value function except `stagePackage`, which is
 * the one filesystem entry point.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { resolveDependencies } from '../src/core/resolve.js';
import { registry, type ComponentName } from '../src/registry/index.js';
import { getStylesTemplate } from '../src/templates/styles.js';

export const PACKAGE_IDS = ['rte', 'data-table'] as const;
export type PackageId = (typeof PACKAGE_IDS)[number];

/**
 * The closure roots of each package. `rich-text-editor/full` pulls in all 13
 * addons transitively, so the RTE package is "the editor with everything on".
 */
export const PACKAGE_ROOTS: Readonly<Record<PackageId, readonly string[]>> = {
    rte: ['rich-text-editor', 'rich-text-editor/full'],
    'data-table': [
        'data-table',
        'data-table/context-menu',
        'data-table/export',
        'data-table/pivot',
    ],
};

export const PACKAGE_NAMES: Readonly<Record<PackageId, string>> = {
    rte: '@gilav21/shadcn-angular-rte',
    'data-table': '@gilav21/shadcn-angular-data-table',
};

/** Folder (relative to the repo root) holding each package's committed config. */
export function packageDir(id: PackageId): string {
    return `packages/${id}-package`;
}

export function isPackageId(value: string): value is PackageId {
    return (PACKAGE_IDS as readonly string[]).includes(value);
}

/**
 * `lib/utils.ts` is a BASELINE lib file: `init` writes it for every project, so
 * no registry entry declares it, yet every component's `cn()` import needs it.
 * Staging it explicitly is what keeps the compiled package self-contained.
 */
const BASELINE_LIB_FILES = ['utils.ts'] as const;

/** Files that exist beside the sources but must never ship in a package. */
const EXCLUDED = /(\.spec\.ts|\.stories\.ts)$|__screenshots__/;

/**
 * Whether a registry file path must be kept out of a published package.
 *
 * Today no registry entry lists a `.spec.ts` / `.stories.ts` — `sync-registry`
 * does not put them in `files[]` (verified: 0 of 1029 file entries match) — so
 * this is a GUARD against a future registry that does, not a filter with live
 * work to do. It is exported so the guard itself is testable: driving it only
 * through `stagedFiles` would assert nothing, because the inputs that would
 * trip it never occur.
 */
export function isPackageExcluded(file: string): boolean {
    return EXCLUDED.test(file);
}

export function computeClosure(id: PackageId): ReadonlySet<ComponentName> {
    return resolveDependencies([...PACKAGE_ROOTS[id]] as ComponentName[]);
}

/** One staged file: repo-relative source → package-`src`-relative destination. */
export interface StagedFile {
    readonly src: string;
    readonly dest: string;
}

/**
 * The exact file set of a package: the union of every closure member's `files[]`
 * (under `ui/`) and `libFiles[]` (under `lib/`), plus the baseline lib files.
 * Sorted and duplicate-free so the output is reproducible.
 */
export function stagedFiles(id: PackageId): readonly StagedFile[] {
    const ui = new Set<string>();
    const lib = new Set<string>();
    for (const name of computeClosure(id)) {
        for (const file of registry[name].files ?? []) ui.add(file);
        for (const file of registry[name].libFiles ?? []) lib.add(file);
    }
    for (const file of BASELINE_LIB_FILES) lib.add(file);

    const out: StagedFile[] = [];
    for (const file of ui) {
        if (isPackageExcluded(file)) continue;
        out.push({ src: `packages/components/ui/${file}`, dest: `ui/${file}` });
    }
    for (const file of lib) {
        if (isPackageExcluded(file)) continue;
        out.push({ src: `packages/components/lib/${file}`, dest: `lib/${file}` });
    }
    return out.sort((a, b) => a.dest.localeCompare(b.dest));
}

// ── Public API generation ──────────────────────────────────────────────────

/**
 * Barrel path of a closure member, derived from its own `files[]` — never
 * hand-listed, so a component that moves its barrel cannot silently drop out of
 * the package's public API.
 */
function barrelOf(name: ComponentName): string | null {
    const barrel = (registry[name].files ?? []).find((f) => f.endsWith('/index.ts'));
    return barrel ? `ui/${barrel.slice(0, -'/index.ts'.length)}` : null;
}

/**
 * The closure members whose barrels become the package's public API: the
 * declared roots plus the addons those roots pull in.
 *
 * `rich-text-editor/full` is a composite marker whose 13 addons are transitive
 * dependencies, so roots alone would export none of them and a consumer could
 * not name `RichTextMentionsDirective` or its types. Everything else in the
 * closure (button, badge, …) stays an implementation detail: it is compiled into
 * the package but must not be re-exported, or the package would start colliding
 * with a consumer's CLI-copied components.
 */
function publicApiMembers(id: PackageId): ReadonlySet<ComponentName> {
    const out = new Set<ComponentName>();
    for (const root of PACKAGE_ROOTS[id]) {
        out.add(root as ComponentName);
        // An addon's registry key is "<base>/<addon>" — the base component of
        // this package is always PACKAGE_ROOTS[id][0].
        const addonPrefix = `${PACKAGE_ROOTS[id][0]}/`;
        for (const dep of registry[root as ComponentName]?.dependencies ?? []) {
            if (dep.startsWith(addonPrefix)) out.add(dep as ComponentName);
        }
    }
    return out;
}

/**
 * `export *` for the package root's barrel, then every addon barrel in the
 * closure. `addons/full` goes LAST: it re-exports the 13 directive classes by
 * name, and that named block is what keeps `imports: [RTE_FULL]` free of NG3004
 * in a consumer's AOT build.
 */
export function renderPublicApi(id: PackageId): string {
    const exported = publicApiMembers(id);
    const base: string[] = [];
    const addons: string[] = [];
    let full: string | null = null;

    for (const name of [...exported].sort((a, b) => a.localeCompare(b))) {
        const barrel = barrelOf(name);
        if (!barrel) continue;
        if (barrel.endsWith('/addons/full')) full = barrel;
        else if (barrel.includes('/addons/')) addons.push(barrel);
        else base.push(barrel);
    }

    const sortedAddons = [...addons].sort((a, b) => a.localeCompare(b));
    const ordered = [...base, ...sortedAddons, ...(full ? [full] : [])];
    const command = `\`npm run stage:package -- ${id}\``;
    const header = `// AUTO-GENERATED by stage-package — do not edit; regenerate with ${command}.`;
    const body = ordered.map((b) => `export * from './${b}';`).join('\n');
    return `${header}\n${body}\n`;
}

// ── Theme ──────────────────────────────────────────────────────────────────

/**
 * Turns the CLI's `tailwind.css` template into a package theme asset.
 *
 * The template is written for a consumer's own stylesheet: it imports Tailwind
 * and declares `@source "../src/**"` globs. Both are wrong inside a package —
 * the consumer already imports Tailwind, and the globs would resolve to
 * `node_modules/<pkg>/../src`. Everything else (the `:root` / `.dark` tokens,
 * `@theme inline`, `@layer base`) is exactly what the package must ship.
 *
 * `templates/styles.ts` is deliberately NOT edited: it is bundled CLI code, and
 * changing it would force a CLI publish.
 */
export function toPackageTheme(stylesTemplate: string): string {
    const kept = stylesTemplate
        .split('\n')
        .filter((line) => {
            const trimmed = line.trim();
            if (trimmed.startsWith('@import "tailwindcss"')) return false;
            if (trimmed.startsWith('@source ')) return false;
            return !trimmed.startsWith('/* Tell Tailwind');
        })
        .join('\n');
    return `${kept.replace(/^\n+/, '').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}

/**
 * The CSS a consumer must add. This exact string is written into both package
 * READMEs and into the e2e fixture, so the documented contract and the tested
 * contract cannot drift.
 */
export function consumerCssSnippet(ids: readonly PackageId[]): string {
    const lines = ['@import "tailwindcss";'];
    for (const id of ids) lines.push(`@source "../node_modules/${PACKAGE_NAMES[id]}";`);
    for (const id of ids) lines.push(`@import "${PACKAGE_NAMES[id]}/theme.css";`);
    return lines.join('\n');
}

// ── Import exactness audit ─────────────────────────────────────────────────

const IMPORT_RE = /(?:from\s*|import\s*\(\s*)['"](\.[^'"]*)['"]/g;

function walkTsFiles(dir: string, out: string[] = []): string[] {
    if (!existsSync(dir)) return out;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walkTsFiles(full, out);
        else if (entry.name.endsWith('.ts')) out.push(full);
    }
    return out;
}

function resolves(fromFile: string, specifier: string): boolean {
    const base = path.resolve(path.dirname(fromFile), specifier);
    const candidates = [
        base,
        `${base}.ts`,
        base.replace(/\.js$/, '.ts'),
        path.join(base, 'index.ts'),
    ];
    return candidates.some((c) => existsSync(c) && statSync(c).isFile());
}

/**
 * Every relative import inside the staged tree — static AND dynamic `import()` —
 * must resolve to a file inside the staged tree. This is what proves the closure
 * is EXACT: too few files and the package fails to compile; the audit catches it
 * before ng-packagr does, naming the offender.
 *
 * Dynamic imports matter most: the ~17 parser files reachable only through the
 * three lazy `import()`s in the file-import addon are never statically imported,
 * so nothing else in the pipeline would notice them missing.
 */
export function auditStagedImports(srcRoot: string): string[] {
    const unresolved: string[] = [];
    for (const file of walkTsFiles(srcRoot)) {
        const source = readFileSync(file, 'utf-8');
        for (const match of source.matchAll(IMPORT_RE)) {
            const specifier = match[1];
            if (resolves(file, specifier)) continue;
            unresolved.push(`${path.relative(srcRoot, file)} → ${specifier}`);
        }
    }
    return unresolved.sort((a, b) => a.localeCompare(b));
}

// ── Staging ────────────────────────────────────────────────────────────────

export interface StageResult {
    readonly written: number;
    readonly removed: number;
}

function countFiles(dir: string): number {
    return walkAll(dir).length;
}

function walkAll(dir: string, out: string[] = []): string[] {
    if (!existsSync(dir)) return out;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walkAll(full, out);
        else out.push(full);
    }
    return out;
}

/**
 * Regenerates `<pkgRoot>/src` and `<pkgRoot>/theme.css` from the registry.
 *
 * `src/` is wiped first rather than merged: a component that leaves the closure
 * must leave the package too, and a stale file would otherwise keep compiling
 * into the published bundle forever.
 */
export function stagePackage(id: PackageId, repoRoot: string, pkgRoot?: string): StageResult {
    const root = pkgRoot ?? path.join(repoRoot, packageDir(id));
    const srcRoot = path.join(root, 'src');

    const removed = countFiles(srcRoot);
    rmSync(srcRoot, { recursive: true, force: true });

    const files = stagedFiles(id);
    for (const file of files) {
        const from = path.join(repoRoot, file.src);
        if (!existsSync(from)) {
            throw new Error(
                `[stage-package] ${id}: registry lists "${file.src}" but it does not exist on disk.`,
            );
        }
        const to = path.join(srcRoot, file.dest);
        mkdirSync(path.dirname(to), { recursive: true });
        cpSync(from, to);
    }

    writeFileSync(path.join(srcRoot, 'public-api.ts'), renderPublicApi(id));
    mkdirSync(root, { recursive: true });
    writeFileSync(path.join(root, 'theme.css'), toPackageTheme(getStylesTemplate()));

    return { written: files.length + 1, removed };
}

// ── CLI outcome ────────────────────────────────────────────────────────────

/**
 * What the `stage:package` entry must print and exit with. Separating the
 * DECISION from the printing is what makes the entry testable in process: a
 * subprocess test sees the contract but contributes no v8 coverage, and the
 * interesting cases (bad id, escaped imports) are decisions, not I/O.
 */
export interface StageOutcome {
    readonly status: number;
    readonly stdout: readonly string[];
    readonly stderr: readonly string[];
}

export function stageUsage(): string {
    return `Usage: npm run stage:package -- <${PACKAGE_IDS.join('|')}>`;
}

/**
 * Validates the argv package id, returning either the narrowed id or the exact
 * failure the entry must print.
 *
 * The two failures are worded differently on purpose: a maintainer who omitted
 * the argument needs the usage line, while one who typoed an id needs the typo
 * echoed back to spot it.
 */
export function resolveStageId(raw: string | undefined): { id: PackageId } | StageOutcome {
    if (!raw) return { status: 1, stdout: [], stderr: ['Missing package id.', stageUsage()] };
    if (!isPackageId(raw)) {
        return { status: 1, stdout: [], stderr: [`Unknown package "${raw}".`, stageUsage()] };
    }
    return { id: raw };
}

/** Whether {@link resolveStageId} returned a failure rather than an id. */
export function isStageFailure(result: { id: PackageId } | StageOutcome): result is StageOutcome {
    return 'status' in result;
}

/** The staging side effects, as an injected port so the flow is drivable without a repo. */
export interface StageEffects {
    readonly stage: (id: PackageId) => StageResult;
    /** The escaped-import audit; see {@link auditStagedImports}. */
    readonly audit: (id: PackageId) => readonly string[];
    /** The staged `src` path as printed, relative to the repo root. */
    readonly srcRootLabel: (id: PackageId) => string;
}

/**
 * Composes the real {@link StageEffects} from a repo root.
 *
 * The staged tree is always `<repoRoot>/<packageDir>/src`, and the printed
 * label is that path made repo-relative — derived here so both the audit target
 * and the message agree by construction.
 */
export function nodeStageEffects(repoRoot: string): StageEffects {
    const srcRoot = (id: PackageId): string => path.join(repoRoot, packageDir(id), 'src');
    return {
        stage: (id) => stagePackage(id, repoRoot),
        audit: (id) => auditStagedImports(srcRoot(id)),
        srcRootLabel: (id) => path.relative(repoRoot, srcRoot(id)),
    };
}

/**
 * The whole `stage:package` flow as argv → outcome. Validate, stage, audit,
 * report — the audit runs AFTER staging because it inspects what was written.
 */
export function runStage(argv: readonly string[], fx: StageEffects): StageOutcome {
    const resolved = resolveStageId(argv[0]);
    if (isStageFailure(resolved)) return resolved;

    const { id } = resolved;
    return stageOutcome(id, fx.stage(id), fx.audit(id), fx.srcRootLabel(id));
}

/**
 * The outcome of a completed staging run.
 *
 * A non-empty `unresolved` is fatal: the closure is only useful if it is EXACT,
 * and an import escaping the staged tree means a file the registry never
 * declared. Failing here names every offender; letting it through would surface
 * minutes later as a far less obvious ng-packagr error.
 */
export function stageOutcome(
    id: PackageId,
    result: StageResult,
    unresolved: readonly string[],
    srcRootLabel: string,
): StageOutcome {
    if (unresolved.length > 0) {
        return {
            status: 1,
            stdout: [],
            stderr: [
                `[stage-package] ${id}: ${unresolved.length} import(s) escape the staged tree:`,
                ...unresolved.map((entry) => `  ${entry}`),
            ],
        };
    }
    return {
        status: 0,
        stdout: [
            `[stage-package] ${id}: staged ${result.written} files (removed ${result.removed} stale).`,
            `[stage-package] ${id}: ${srcRootLabel} + theme.css`,
        ],
        stderr: [],
    };
}
