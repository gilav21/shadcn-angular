import { execSync } from 'node:child_process';
import fs from 'fs-extra';
import path from 'node:path';
import { registry, type ComponentName } from '../registry/index.js';
import { getPrefix, type Config } from '../utils/config.js';
import { resolveProjectPath, aliasToProjectPath } from '../utils/paths.js';
import { resolveDependencies } from './resolve.js';
import { scanLayouts, type LayoutScan } from './layout.js';
import { rewriteImports } from './import-rewrite.js';
import { performInstall, type InstallResult } from './install.js';
import { detectConflicts, type AddOptions } from './plan.js';
import { readManifest, writeManifest, removeFiles, fileStatus, type Manifest } from './manifest.js';
import { loadBaselines, isPristine } from './baseline.js';

export interface MigrationPlan {
    /** Legacy (flat) components to convert to folder form (pristine closure). */
    structural: ComponentName[];
    /** Legacy components the consumer customized — left untouched, flagged. */
    customized: ComponentName[];
    /** Pristine legacy components deferred because they depend on a customized
     *  one (a folder component cannot import a still-flat dependency). */
    blocked: ComponentName[];
    /** Everything migrate writes: the dependency closure of `structural`. */
    writeSet: ComponentName[];
    /** writeSet members not currently installed — pulled fresh. */
    newDeps: ComponentName[];
    /** Already-folder deps of the migrated set — refreshed to a compatible version. */
    refreshed: ComponentName[];
    /** Installed folder components NOT needed by the migrated set — left as-is. */
    untouched: ComponentName[];
}

/**
 * Compute the migration plan from a layout scan (pure). Only legacy (flat)
 * components change structurally — their import paths move from
 * `<name>.component` to the `<name>` folder barrel — so they are the only
 * names whose consumer imports need rewriting. migrate writes the dependency
 * CLOSURE of the migrated set, so a freshly-written component never calls a
 * newer API on a stale dep; installed folder components it does NOT depend on
 * are left untouched (run `update` to refresh those).
 *
 * `customized` (legacy components the consumer edited) are NEVER overwritten: a
 * legacy component is migrated only when its entire dependency closure is
 * customization-free, because a folder component cannot import a still-flat
 * dependency. Edited components are left as-is and flagged; pristine components
 * that depend on an edited one are deferred (`blocked`).
 */
export function planMigration(
    scan: LayoutScan, customized: ReadonlySet<ComponentName> = new Set(),
): MigrationPlan {
    const customizedLegacy = scan.legacy.filter(n => customized.has(n));
    const customizedSet = new Set(customizedLegacy);
    const migratable = (n: ComponentName): boolean =>
        [...resolveDependencies([n])].every(d => !customizedSet.has(d));
    const structural = scan.legacy.filter(migratable);
    const blocked = scan.legacy.filter(n => !customizedSet.has(n) && !migratable(n));
    const installed = new Set<ComponentName>([...scan.legacy, ...scan.current]);
    const writeSet = [...resolveDependencies(structural)];
    const writeSetSet = new Set(writeSet);
    return {
        structural,
        customized: customizedLegacy,
        blocked,
        writeSet,
        newDeps: writeSet.filter(n => !installed.has(n)),
        refreshed: writeSet.filter(n => scan.current.includes(n)),
        untouched: scan.current.filter(n => !writeSetSet.has(n)),
    };
}

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.angular', 'coverage']);
// Only TS/JS carry ES import specifiers. HTML templates never do, so rewriting
// them is pure risk (a template string like `from './x.component'` could be
// mangled) for no benefit.
const SOURCE_EXT = new Set(['.ts', '.mts', '.cts', '.js', '.mjs']);

async function collectSourceFiles(root: string): Promise<string[]> {
    const out: string[] = [];
    const walk = async (dir: string): Promise<void> => {
        for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (!SKIP_DIRS.has(entry.name)) await walk(full);
            } else if (SOURCE_EXT.has(path.extname(entry.name))) {
                out.push(full);
            }
        }
    };
    await walk(root);
    return out;
}

/**
 * Rewrite migrated imports across project source files; return changed paths.
 * Every file (INCLUDING those under `uiDir`) is scanned, because a pre-existing
 * folder component can import a now-migrated sibling via the old flat path
 * (`../switch.component`) and must be fixed too. Each rewrite is scoped to
 * imports that actually resolve to `<uiDir>/<name>.component` (via `uiAlias` or
 * a relative path), so a component's own barrel self-reference
 * (`./switch.component` → resolves to `<uiDir>/switch/switch.component`, which
 * still exists) and a consumer file that merely shares a component name are
 * both left untouched.
 */
export async function rewriteProjectImports(
    projectRoot: string, migratedNames: ReadonlySet<string>,
    uiDir: string, uiAlias: string,
): Promise<string[]> {
    if (migratedNames.size === 0) return [];
    const resolvedUiDir = path.resolve(uiDir);
    const alias = uiAlias.replace(/\/{1,256}$/, '');
    const changed: string[] = [];
    for (const file of await collectSourceFiles(projectRoot)) {
        const source = await fs.readFile(file, 'utf-8');
        const result = rewriteImports(source, {
            migrated: migratedNames,
            uiAlias: alias,
            uiDir: resolvedUiDir,
            fileDir: path.dirname(file),
        });
        if (result.changed) {
            await fs.writeFile(file, result.content);
            changed.push(file);
        }
    }
    return changed;
}

// Only the component source migrate replaces. Deliberately NOT spec/stories —
// those are the consumer's own tests and must not be deleted (the folder layout
// doesn't reinstall them).
const LEGACY_SUFFIXES = ['.component.ts', '.component.html', '.component.css'];

/** Remove legacy flat files for each migrated component; return deleted rel paths. */
export async function deleteLegacyFiles(
    uiDir: string, structural: ComponentName[],
): Promise<string[]> {
    const deleted: string[] = [];
    for (const name of structural) {
        for (const suffix of LEGACY_SUFFIXES) {
            const rel = `${name}${suffix}`;
            const abs = path.join(uiDir, rel);
            if (await fs.pathExists(abs)) {
                await fs.remove(abs);
                deleted.push(rel);
            }
        }
    }
    return deleted;
}

/**
 * The current environment with every `GIT_*` variable removed, so a spawned git
 * resolves its repository from `cwd` alone.
 */
export function envWithoutGitVars(): NodeJS.ProcessEnv {
    return Object.fromEntries(
        Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))
    );
}

/**
 * Is the project's git working tree clean? False when git is unavailable / not
 * a repo.
 *
 * `GIT_DIR` and friends are dropped from the child's environment. Git gives
 * those precedence over `cwd`, so when the CLI runs from inside a git hook —
 * where git exports them — the question silently becomes "is the HOOK's
 * repository clean?" and the answer is about the wrong repository.
 */
export function gitTreeClean(cwd: string): boolean {
    try {
        // Scope to the project dir (`-- .`) so an unrelated dirty file elsewhere
        // in a monorepo doesn't refuse a clean app subdir.
        return execSync('git status --porcelain -- .', {
            cwd,
            encoding: 'utf-8',
            env: envWithoutGitVars(),
        }).trim() === '';
    } catch {
        // Not a git repo, or git is unavailable — treat as "not clean".
        return false;
    }
}

async function fileIsModified(manifest: Manifest, uiDir: string, rel: string): Promise<boolean> {
    const p = path.join(uiDir, rel);
    if (!await fs.pathExists(p)) return false;
    return fileStatus(manifest, rel, await fs.readFile(p, 'utf-8')) === 'modified';
}

async function folderComponentEdited(manifest: Manifest, uiDir: string, name: ComponentName): Promise<boolean> {
    for (const rel of registry[name].files) {
        if (await fileIsModified(manifest, uiDir, rel)) return true;
    }
    return false;
}

/**
 * Legacy (flat) components the consumer customized. A legacy install predates
 * `components.lock.json`, so we can't hash-diff against a recorded baseline;
 * instead we match each file against the known historical release hashes
 * (`isPristine`). A real edit matches none → flagged; an unreadable file is
 * treated conservatively as customized. These are NEVER overwritten.
 */
export async function detectCustomizedLegacy(
    uiDir: string, legacy: ComponentName[], prefix: string, utilsAlias: string,
): Promise<Set<ComponentName>> {
    const baselines = loadBaselines();
    const out = new Set<ComponentName>();
    for (const name of legacy) {
        const content = await fs.readFile(path.join(uiDir, `${name}.component.ts`), 'utf-8').catch(() => null);
        if (content === null || !isPristine(baselines, name, content, prefix, utilsAlias)) out.add(name);
    }
    return out;
}

/**
 * Already-folder deps the migrated set refreshes that have local edits vs the
 * manifest baseline. These ARE refreshed (a migrated component needs a current
 * dep), so we surface them as a non-blocking heads-up. Empty on a pure legacy
 * install (no manifest) — the clean-git guard is the backstop there.
 */
async function editedRefreshedDeps(
    cwd: string, uiDir: string, plan: MigrationPlan,
): Promise<ComponentName[]> {
    const manifest = await readManifest(cwd);
    const out: ComponentName[] = [];
    for (const name of plan.refreshed) {
        if (await folderComponentEdited(manifest, uiDir, name)) out.push(name);
    }
    return out;
}

/** A legacy component is safe to finalize only if it and all of its
 * in-writeSet dependencies are present (written or already up-to-date). */
export function closureWritten(name: ComponentName, plan: MigrationPlan, present: Set<ComponentName>): boolean {
    const inWriteSet = new Set(plan.writeSet);
    return [...resolveDependencies([name])].every(d => !inWriteSet.has(d) || present.has(d));
}

/** Remove any partially-written folder for a NEW component (structural or a
 * brand-new dep) that did not fully install, restoring the pre-migrate state. */
async function rollbackPartialNewFolders(
    uiDir: string, plan: MigrationPlan, installed: Set<ComponentName>,
): Promise<void> {
    for (const name of new Set<ComponentName>([...plan.structural, ...plan.newDeps])) {
        if (!installed.has(name)) await fs.remove(path.join(uiDir, name));
    }
}

/** The ui directory a project's components live in. */
export function migrationUiDir(cwd: string, config: Config): string {
    return resolveProjectPath(cwd, aliasToProjectPath(config.aliases.ui || 'src/components/ui'));
}

/** Scan the ui dir and compute the plan (no writes). */
export async function buildMigrationPlan(
    uiDir: string, config: Config,
): Promise<{ scan: LayoutScan; plan: MigrationPlan }> {
    const scan = await scanLayouts(uiDir, getPrefix(config));
    const customized = await detectCustomizedLegacy(uiDir, scan.legacy, getPrefix(config), config.aliases.utils);
    return { scan, plan: planMigration(scan, customized) };
}

/** What `runMigration` actually did — everything the CLI report and the MCP
 *  `migrate` tool response are rendered from. */
export interface MigrationExecution {
    result: InstallResult;
    /** Legacy components fully migrated (flat files removed, imports rewritten). */
    migrated: ComponentName[];
    /** Legacy components left as legacy because their closure didn't fully write. */
    failed: ComponentName[];
    /** Legacy flat files removed. */
    deleted: string[];
    /** Project files whose imports were rewritten. */
    rewritten: string[];
    /** Refreshed folder deps that carried local edits (non-blocking heads-up). */
    editedRefreshed: ComponentName[];
}

/** Execute a migration plan: install the write set, roll back partial folders,
 *  delete the finalized legacy files, and re-point project imports. */
export async function runMigration(
    plan: MigrationPlan, cwd: string, uiDir: string, config: Config, options: AddOptions,
): Promise<MigrationExecution> {
    // migrate writes the legacy set's dependency closure (plan.writeSet):
    // legacy components → folder, plus the deps they need (refreshed/installed)
    // so nothing calls a newer API on a stale dep. Precompute conflicts over
    // exactly this set so performInstall does NOT re-resolve and pull in
    // unrelated installed components. `overwrite: true` refreshes shared lib
    // files for the written set.
    const conflicts = await detectConflicts(
        new Set(plan.writeSet), uiDir, options, config.aliases.utils, getPrefix(config),
    );
    const result = await performInstall({
        components: plan.writeSet,
        overwrite: plan.writeSet,
        cwd, config,
        options: { ...options, overwrite: true },
        precomputedConflicts: conflicts,
    });
    const installed = new Set(result.installed);
    // "Present" = written this run OR skipped because already up-to-date. A
    // dependency that was identical is skipped (not in `installed`) yet is on
    // disk and fine, so it must count toward closure-consistency.
    const present = new Set<ComponentName>([...result.installed, ...result.skipped as ComponentName[]]);

    // Roll back partially-written NEW folders (legacy→folder + brand-new deps
    // that didn't fully write) so a mid-stream failure can't leave an orphan
    // folder with a dangling templateUrl. Pre-existing (refreshed) folders are
    // left to the git guard — we can't restore their prior content.
    await rollbackPartialNewFolders(uiDir, plan, installed);

    // Finalize (delete flat + rewrite imports) ONLY for legacy components whose
    // folder AND every in-writeSet dependency are present — otherwise the
    // working flat file and its imports are kept intact.
    const migrated = plan.structural.filter(n => closureWritten(n, plan, present));
    const failed = plan.structural.filter(n => !closureWritten(n, plan, present));

    const deleted = await deleteLegacyFiles(uiDir, migrated);
    const manifest = await readManifest(cwd);
    removeFiles(manifest, deleted);
    await writeManifest(cwd, manifest);

    // rewriteProjectImports scans every project file INCLUDING the ui dir,
    // because a pre-existing folder component can import a now-migrated sibling
    // via the old flat path (`../button.component`). Each rewrite is scoped to
    // specifiers that resolve to <uiDir>/<name>.component, so a component's own
    // barrel self-reference and a consumer file sharing a library name are both
    // left untouched.
    const rewritten = await rewriteProjectImports(cwd, new Set(migrated), uiDir, config.aliases.ui);
    const editedRefreshed = await editedRefreshedDeps(cwd, uiDir, plan);

    return { result, migrated, failed, deleted, rewritten, editedRefreshed };
}

/**
 * How `migrateCore` ended:
 * - `nothing-to-migrate`: no legacy (flat) components on disk.
 * - `dry-run`: plan only, nothing written.
 * - `nothing-migratable`: every legacy component is customized or depends on one.
 * - `unclean-tree`: refused — dirty/absent git tree and no `force`.
 * - `migrated`: the plan was executed (`execution` is populated).
 */
export type MigrateStatus =
    'nothing-to-migrate' | 'dry-run' | 'nothing-migratable' | 'unclean-tree' | 'migrated';

export interface MigrateOutcome {
    status: MigrateStatus;
    plan: MigrationPlan;
    execution?: MigrationExecution;
}

export interface MigrateHooks {
    /** Called once the plan is committed to and the writes are about to start
     *  (lets the CLI print the plan / start a spinner before any file moves). */
    onBeforeExecute?: (plan: MigrationPlan) => void;
}

/**
 * The whole `migrate` flow minus presentation: scan → plan → guard → execute.
 * Shared by the `migrate` CLI command and the MCP `migrate` tool so the two can
 * never diverge on which components are protected or when a dirty tree refuses.
 */
export async function migrateCore(
    cwd: string, config: Config, options: AddOptions, hooks: MigrateHooks = {},
): Promise<MigrateOutcome> {
    const uiDir = migrationUiDir(cwd, config);
    const { scan, plan } = await buildMigrationPlan(uiDir, config);

    if (scan.legacy.length === 0) return { status: 'nothing-to-migrate', plan };
    if (options.dryRun) return { status: 'dry-run', plan };
    if (plan.structural.length === 0) return { status: 'nothing-migratable', plan };
    if (!options.force && !gitTreeClean(cwd)) return { status: 'unclean-tree', plan };

    hooks.onBeforeExecute?.(plan);
    const execution = await runMigration(plan, cwd, uiDir, config, options);
    return { status: 'migrated', plan, execution };
}
