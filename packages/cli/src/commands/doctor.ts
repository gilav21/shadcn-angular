import fs from 'fs-extra';
import path from 'node:path';
import chalk from 'chalk';
import { getConfig, getPrefix, type Config } from '../utils/config.js';
import { registry, getComponentNames, type ComponentName } from '../registry/index.js';
import { resolveProjectPath, aliasToProjectPath } from '../utils/paths.js';
import { detectConflicts, printBreakingChanges, type AddOptions } from '../core/plan.js';
import { readManifest, writeManifest, removeFiles, fileStatus, type FileStatus, type Manifest } from '../core/manifest.js';
import { scanLayouts } from '../core/layout.js';
import { performInstall } from '../core/install.js';
import { collectLibDrift, refreshLibFiles } from '../core/lib-reconcile.js';
import { printBreakingUsages } from '../core/breaking-scan.js';
import { collectStaleReport, rewriteMovedImports, type StaleEntry } from '../core/clean-reinstall.js';
import { installPackages } from '../utils/package-manager.js';

export interface DoctorReport {
    missingFiles: string[];
    /** Components whose installed files differ from the registry. */
    modified: string[];
    /** Subset of `modified` the user edited locally (drift from manifest baseline). */
    userEdited: string[];
    /** Subset of `modified` that simply has a newer registry version. */
    updateAvailable: string[];
    /** Folderized components installed in the legacy flat layout. */
    legacy: string[];
    missingNpmDeps: string[];
    /** Shared lib files behind the registry but safe to refresh. */
    libStale: string[];
    /** Shared lib files required by installed components but absent on disk. */
    libMissing: string[];
    /** Shared lib files that differ from the registry but are user-edited (protected). */
    libUserEdited: string[];
    /** Pristine ui files the registry no longer ships (prune / migrate / keep-warn). */
    stale: StaleEntry[];
    ok: boolean;
}

export interface DriftSplit {
    userEdited: string[];
    updateAvailable: string[];
}

/**
 * Split components that differ from the registry into "you edited it" vs "a
 * newer version exists", using each component's local-vs-manifest status.
 * Only a `modified` baseline status counts as a user edit; `clean` and
 * `untracked` (no baseline) are treated as an available update.
 */
export function classifyDrift(
    differsFromRegistry: string[], localStatus: Record<string, FileStatus>,
): DriftSplit {
    const userEdited: string[] = [];
    const updateAvailable: string[] = [];
    for (const name of differsFromRegistry) {
        if (localStatus[name] === 'modified') userEdited.push(name);
        else updateAvailable.push(name);
    }
    return { userEdited, updateAvailable };
}

/**
 * Components with at least one of their registry files present under the target
 * directory. Detecting by ANY file (not just `files[0]`) is deliberate: when a
 * component's file set changes across versions — its entry file renamed or
 * moved, files added — keying solely on the current `files[0]` makes a stale
 * older install invisible to `doctor`, so it is reported as neither
 * update-available nor missing and the consumer keeps shipping stale code with
 * a clean bill of health (report B6b). Detecting by any file makes the stale
 * install visible; `classifyComponent` then flags the missing/changed files for
 * reinstall.
 */
export async function installedComponents(targetDir: string): Promise<ComponentName[]> {
    const names: ComponentName[] = [];
    for (const name of getComponentNames()) {
        for (const file of registry[name].files) {
            if (await fs.pathExists(path.join(targetDir, file))) {
                names.push(name);
                break;
            }
        }
    }
    return names;
}

async function collectMissingNpmDeps(installed: ComponentName[], cwd: string): Promise<string[]> {
    const required = new Set<string>();
    for (const name of installed) {
        for (const dep of registry[name].npmDependencies ?? []) required.add(dep);
    }
    if (required.size === 0) return [];
    const pkgPath = path.join(cwd, 'package.json');
    if (!await fs.pathExists(pkgPath)) return [...required];
    const pkg = await fs.readJson(pkgPath) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
    };
    const have = { ...pkg.dependencies, ...pkg.devDependencies };
    return [...required].filter(d => !have[d]);
}

export async function collectDoctorReport(
    cwd: string, config: Config, options: AddOptions,
): Promise<DoctorReport> {
    const targetDir = resolveProjectPath(cwd, aliasToProjectPath(config.aliases.ui || 'src/components/ui'));
    const installed = await installedComponents(targetDir);

    const { conflicting, toInstall } = await detectConflicts(
        new Set(installed), targetDir, options, config.aliases.utils, getPrefix(config),
    );
    // Among installed components: "toInstall" means some files are missing
    // (partial install); "conflicting" means local files differ from remote.
    const missingFiles = installed.filter(c => toInstall.includes(c));
    const modified = installed.filter(c => conflicting.includes(c));
    const missingNpmDeps = await collectMissingNpmDeps(installed, cwd);

    const manifest = await readManifest(cwd);
    const localStatus: Record<string, FileStatus> = {};
    for (const name of modified) {
        localStatus[name] = await worstLocalStatus(manifest, targetDir, name);
    }
    const { userEdited, updateAvailable } = classifyDrift(modified, localStatus);
    const { legacy } = await scanLayouts(targetDir, getPrefix(config));

    const libDir = resolveProjectPath(cwd, aliasToProjectPath(config.aliases.utils));
    const lib = await collectLibDrift(libDir, installed, manifest, options);

    const { entries: stale } = await collectStaleReport(
        targetDir, cwd, getPrefix(config), config.aliases.utils, config.aliases.ui || 'src/components/ui',
    );
    const staleActionable = stale.some(e => e.action === 'prune' || e.action === 'migrate');

    const ok = missingFiles.length === 0 && modified.length === 0
        && missingNpmDeps.length === 0 && legacy.length === 0
        && lib.stale.length === 0 && lib.missing.length === 0 && !staleActionable;
    return {
        missingFiles, modified, userEdited, updateAvailable, legacy, missingNpmDeps,
        libStale: lib.stale, libMissing: lib.missing, libUserEdited: lib.userEdited, stale, ok,
    };
}

/** Worst local-vs-manifest status across a component's files (modified > untracked > clean). */
async function worstLocalStatus(
    manifest: Manifest, targetDir: string, name: ComponentName,
): Promise<FileStatus> {
    let worst: FileStatus = 'clean';
    for (const file of registry[name].files) {
        const p = path.join(targetDir, file);
        if (!await fs.pathExists(p)) continue;
        const status = fileStatus(manifest, file, await fs.readFile(p, 'utf-8'));
        if (status === 'modified') return 'modified';
        if (status === 'untracked') worst = 'untracked';
    }
    return worst;
}

export interface DoctorFixPlan {
    /** Components to re-install / overwrite from the registry. */
    reinstall: ComponentName[];
    /** npm packages to install. */
    npmDeps: string[];
    /** Components protected from auto-fix because the user edited them. */
    protected: string[];
    /** Legacy-layout components — fixing requires `migrate` (not run automatically). */
    legacy: string[];
    /** Shared lib files to refresh from the registry (missing or pristine-but-stale). */
    refreshLib: string[];
    /** Shared lib files protected from auto-fix because the user customized them. */
    libProtected: string[];
    /** Pristine stale ui files to delete (registry no longer ships them). */
    stalePrune: string[];
    /** Files relocated to a new component — install it, re-point imports, prune the old. */
    staleMigrate: StaleEntry[];
    /** Pristine stale files the consumer still imports but which have no declared move (manual). */
    staleKeepWarn: string[];
    /** True when the plan contains at least one automatic action. */
    hasActions: boolean;
}

/** Map a doctor report to the repair actions `--fix` would take. */
export function buildFixPlan(report: DoctorReport): DoctorFixPlan {
    const reinstall = [...new Set([...report.missingFiles, ...report.updateAvailable])] as ComponentName[];
    const refreshLib = [...new Set([...report.libMissing, ...report.libStale])];
    const stalePrune = report.stale.filter(e => e.action === 'prune').map(e => e.file);
    const staleMigrate = report.stale.filter(e => e.action === 'migrate');
    const staleKeepWarn = report.stale.filter(e => e.action === 'keep-warn').map(e => e.file);
    return {
        reinstall,
        npmDeps: report.missingNpmDeps,
        protected: report.userEdited,
        legacy: report.legacy,
        refreshLib,
        libProtected: report.libUserEdited,
        stalePrune,
        staleMigrate,
        staleKeepWarn,
        hasActions: reinstall.length > 0 || report.missingNpmDeps.length > 0 || refreshLib.length > 0
            || stalePrune.length > 0 || staleMigrate.length > 0,
    };
}

/**
 * Apply a fix plan: re-install missing/stale components (overwriting the stale
 * ones) and install missing npm dependencies. User-edited components are never
 * touched and legacy layouts are surfaced as a `migrate` action item rather
 * than migrated silently (migrate has its own git-clean safety guard).
 * Silent (no console output) so the MCP server can reuse it. Returns
 * human-readable descriptions of the actions taken.
 */
export async function doctorFixCore(
    cwd: string, config: Config, options: AddOptions, plan: DoctorFixPlan,
): Promise<string[]> {
    const actions: string[] = [];
    if (plan.reinstall.length > 0) {
        const result = await performInstall({
            components: plan.reinstall,
            overwrite: plan.reinstall,
            cwd, config,
            options: { ...options, yes: true },
        });
        actions.push(`Re-installed ${result.installed.length} component(s): ${result.installed.join(', ')}`);
        if (result.pruned.length > 0) actions.push(`Pruned ${result.pruned.length} obsolete file(s): ${result.pruned.join(', ')}`);
        for (const warning of result.warnings) actions.push(`Warning: ${warning}`);
    }
    if (plan.npmDeps.length > 0) {
        await installPackages(plan.npmDeps, { cwd });
        actions.push(`Installed npm dependencies: ${plan.npmDeps.join(', ')}`);
    }
    if (plan.refreshLib.length > 0) {
        const libDir = resolveProjectPath(cwd, aliasToProjectPath(config.aliases.utils));
        const { refreshed, warnings } = await refreshLibFiles(plan.refreshLib, libDir, cwd, options);
        if (refreshed.length > 0) actions.push(`Refreshed ${refreshed.length} lib file(s): ${refreshed.join(', ')}`);
        for (const warning of warnings) actions.push(`Warning: ${warning}`);
    }
    await applyStaleActions(cwd, config, options, actions);
    return actions;
}

/**
 * Migrate relocated components (install the new component, re-point consumer
 * imports, prune the old file) and delete pristine stale files the registry no
 * longer ships. Re-collects the stale report HERE — after the component
 * reinstalls above — so the import graph it classifies against is current (a
 * just-reinstalled component importing `sub/x` no longer protects the old `x`).
 * Stale files are removed from the manifest too so a later run doesn't re-detect
 * them.
 */
async function migrateOneMove(
    move: StaleEntry['move'], cwd: string, config: Config, options: AddOptions, targetDir: string, actions: string[],
): Promise<void> {
    if (!move) return;
    const result = await performInstall({
        components: [move.toComponent], overwrite: [move.toComponent],
        cwd, config, options: { ...options, yes: true, overwrite: true },
    });
    const rewritten = await rewriteMovedImports(cwd, move);
    await fs.remove(path.join(targetDir, move.fromFile));
    actions.push(
        `Migrated ${move.fromFile} → ${move.toComponent} component` +
        (result.installed.length ? ` (installed ${move.toComponent})` : '') +
        (rewritten.length ? `; re-pointed ${rewritten.length} import(s)` : '') +
        `; removed the old file.`,
    );
}

async function pruneStaleFiles(toPrune: string[], cwd: string, targetDir: string, actions: string[]): Promise<void> {
    if (toPrune.length === 0) return;
    const manifest = await readManifest(cwd);
    for (const file of toPrune) {
        await fs.remove(path.join(targetDir, file));
        removeFiles(manifest, [file]);
    }
    try {
        await writeManifest(cwd, manifest);
    } catch (err: unknown) {
        actions.push(`Warning: could not update components.lock.json: ${err instanceof Error ? err.message : String(err)}`);
    }
    actions.push(`Removed ${toPrune.length} stale file(s) the registry no longer ships: ${toPrune.join(', ')}`);
}

async function applyStaleActions(
    cwd: string, config: Config, options: AddOptions, actions: string[],
): Promise<void> {
    const targetDir = resolveProjectPath(cwd, aliasToProjectPath(config.aliases.ui || 'src/components/ui'));
    const uiAlias = config.aliases.ui || 'src/components/ui';
    const scan = (): ReturnType<typeof collectStaleReport> =>
        collectStaleReport(targetDir, cwd, getPrefix(config), config.aliases.utils, uiAlias);

    // Migrate moves first (they install + re-point imports), then re-scan so the
    // prune list reflects the post-migration import graph.
    let { entries } = await scan();
    for (const entry of entries.filter(e => e.action === 'migrate')) {
        await migrateOneMove(entry.move, cwd, config, options, targetDir, actions);
    }

    ({ entries } = await scan());
    await pruneStaleFiles(entries.filter(e => e.action === 'prune').map(e => e.file), cwd, targetDir, actions);
    for (const entry of entries.filter(e => e.action === 'keep-warn')) {
        actions.push(`Warning: ${entry.file} is a stale shadcn file you still import — update the import to its new location, then delete it.`);
    }
}

export interface RefreshLibInput {
    /** Specific lib file paths to refresh (default: all required by installed components + core). */
    files?: string[];
    /** Also overwrite lib files the user customized (normally protected). */
    force?: boolean;
    /** Report the target set without writing. */
    dryRun?: boolean;
}

export interface RefreshLibResult {
    refreshed: string[];
    /** Files that would be refreshed (always populated; equals `refreshed` unless dryRun). */
    targets: string[];
    /** Customized lib files left untouched (only when not forcing). */
    protectedFiles: string[];
    warnings: string[];
}

/**
 * Reconcile shared lib files with the registry. Without `files`, refreshes the
 * safe set (pristine-but-stale + missing) and, with `force`, also the customized
 * ones. An explicit `files` list is treated as user consent to overwrite exactly
 * those. Powers the `refresh_lib` MCP verb so the "lib file differs" warning is
 * actionable through the tooling (report B3).
 */
export async function refreshLibCore(
    cwd: string, config: Config, options: AddOptions, input: RefreshLibInput,
): Promise<RefreshLibResult> {
    const targetDir = resolveProjectPath(cwd, aliasToProjectPath(config.aliases.ui || 'src/components/ui'));
    const installed = await installedComponents(targetDir);
    const libDir = resolveProjectPath(cwd, aliasToProjectPath(config.aliases.utils));
    const manifest = await readManifest(cwd);
    const drift = await collectLibDrift(libDir, installed, manifest, options);

    let targets: string[];
    if (input.files && input.files.length > 0) {
        targets = input.files;
    } else {
        targets = [...new Set([...drift.stale, ...drift.missing, ...(input.force ? drift.userEdited : [])])];
    }
    const protectedFiles = input.files || input.force ? [] : drift.userEdited;

    if (input.dryRun) {
        return { refreshed: [], targets, protectedFiles, warnings: [] };
    }
    const { refreshed, warnings } = await refreshLibFiles(targets, libDir, cwd, options);
    return { refreshed, targets, protectedFiles, warnings };
}

function printSection(title: string, items: string[], colorFn: (s: string) => string): void {
    if (items.length === 0) return;
    console.log('\n' + chalk.bold(title) + chalk.gray(` (${items.length})`));
    for (const item of items) console.log('  ' + colorFn(item));
}

function printReport(report: DoctorReport): void {
    printSection('Partially installed (missing files):', report.missingFiles, chalk.yellow);
    printSection('Locally modified (your edits — `update` will 3-way merge upstream changes into them):', report.userEdited, chalk.yellow);
    printSection('Update available (newer registry version):', report.updateAvailable, chalk.cyan);
    printSection('Legacy single-file layout — run `migrate`:', report.legacy, chalk.magenta);
    printSection('Missing npm dependencies:', report.missingNpmDeps, chalk.red);
    printSection('Shared lib files behind the registry:', report.libStale, chalk.cyan);
    printSection('Shared lib files missing:', report.libMissing, chalk.yellow);
    printSection('Shared lib files you customized (protected):', report.libUserEdited, chalk.yellow);
    printSection('Stale files the registry no longer ships (will be removed):',
        report.stale.filter(e => e.action === 'prune').map(e => e.file), chalk.cyan);
    printSection('Relocated to a new component (will be migrated):',
        report.stale.filter(e => e.action === 'migrate').map(e => `${e.file} → ${e.move?.toComponent}`), chalk.cyan);
    printSection('Stale files you still import (update the import, then delete):',
        report.stale.filter(e => e.action === 'keep-warn').map(e => e.file), chalk.yellow);
    printBreakingChanges(report.updateAvailable as ComponentName[]);
    console.log('');
}

function printFixPlan(plan: DoctorFixPlan): void {
    printSection('Would re-install from the registry:', plan.reinstall, chalk.cyan);
    printSection('Would install npm dependencies:', plan.npmDeps, chalk.cyan);
    printSection('Would refresh shared lib files:', plan.refreshLib, chalk.cyan);
    printSection('Would remove stale files:', plan.stalePrune, chalk.cyan);
    printSection('Would migrate relocated components:', plan.staleMigrate.map(e => `${e.file} → ${e.move?.toComponent}`), chalk.cyan);
    printSection('Protected (your edits — review with `diff <name>`):', plan.protected, chalk.yellow);
    printSection('Protected lib files (your edits):', plan.libProtected, chalk.yellow);
    printSection('Stale files you still import (manual):', plan.staleKeepWarn, chalk.yellow);
    printSection('Legacy layout — run `npx @gilav21/shadcn-angular migrate`:', plan.legacy, chalk.magenta);
    console.log('');
}

/** Healthy apart from user edits (which `--fix` deliberately never repairs). */
function cleanExceptUserEdits(report: DoctorReport): boolean {
    return report.missingFiles.length === 0 && report.updateAvailable.length === 0
        && report.missingNpmDeps.length === 0 && report.legacy.length === 0
        && report.libStale.length === 0 && report.libMissing.length === 0
        && !report.stale.some(e => e.action === 'prune' || e.action === 'migrate');
}

export interface DoctorOptions extends AddOptions {
    fix?: boolean;
}

async function runFix(
    cwd: string, config: Config, options: DoctorOptions, plan: DoctorFixPlan,
): Promise<void> {
    if (!plan.hasActions) {
        if (plan.legacy.length === 0) {
            console.log(chalk.green('\nNothing to repair — only locally modified components remain (protected).'));
            printFixPlan(plan);
            return;
        }
        console.log(chalk.yellow('\nNothing doctor --fix can repair automatically.'));
        printFixPlan(plan);
        process.exit(1);
    }
    const actions = await doctorFixCore(cwd, config, options, plan);
    for (const action of actions) console.log(chalk.green('  ✔ ') + action);

    const after = await collectDoctorReport(cwd, config, options);
    if (cleanExceptUserEdits(after)) {
        console.log(chalk.green('\nAll repairable issues fixed.'));
        if (after.userEdited.length > 0) {
            printSection('Still locally modified (protected):', after.userEdited, chalk.yellow);
            console.log('');
        }
        return;
    }
    console.log(chalk.red('\nSome issues remain after fixing:'));
    printReport(after);
    process.exit(1);
}

export async function doctor(options: DoctorOptions): Promise<void> {
    const cwd = process.cwd();
    const config = await getConfig(cwd);
    if (!config) {
        console.log(chalk.red('Error: components.json not found.'));
        console.log(chalk.dim('Run `npx @gilav21/shadcn-angular init` first.'));
        process.exit(1);
    }
    if (!options.registry && config.registry) options.registry = config.registry;

    const report = await collectDoctorReport(cwd, config, options);

    if (report.ok) {
        console.log(chalk.green('\nAll installed components are healthy.'));
        return;
    }
    if (options.dryRun) {
        console.log(chalk.bold('\nDry run — doctor --fix would do the following:'));
        printFixPlan(buildFixPlan(report));
        return;
    }
    if (options.fix) {
        await runFix(cwd, config, options, buildFixPlan(report));
        return;
    }
    printReport(report);
    const managed = [config.aliases.ui, config.aliases.blocks]
        .filter((a): a is string => Boolean(a))
        .map(a => resolveProjectPath(cwd, aliasToProjectPath(a)));
    await printBreakingUsages(report.updateAvailable as ComponentName[], cwd, managed);
    process.exit(1);
}
