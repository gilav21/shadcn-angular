import fs from 'fs-extra';
import path from 'node:path';
import chalk from 'chalk';
import { getConfig, getPrefix, type Config } from '../utils/config.js';
import { registry, getComponentNames, type ComponentName } from '../registry/index.js';
import { resolveProjectPath, aliasToProjectPath } from '../utils/paths.js';
import { detectConflicts, type AddOptions } from '../core/plan.js';
import { readManifest, fileStatus, type FileStatus, type Manifest } from '../core/manifest.js';
import { scanLayouts } from '../core/layout.js';
import { performInstall } from '../core/install.js';
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

/** Components whose entry file exists under the target directory. */
export async function installedComponents(targetDir: string): Promise<ComponentName[]> {
    const names: ComponentName[] = [];
    for (const name of getComponentNames()) {
        if (await fs.pathExists(path.join(targetDir, registry[name].files[0]))) {
            names.push(name);
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

    const ok = missingFiles.length === 0 && modified.length === 0
        && missingNpmDeps.length === 0 && legacy.length === 0;
    return { missingFiles, modified, userEdited, updateAvailable, legacy, missingNpmDeps, ok };
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
    /** True when the plan contains at least one automatic action. */
    hasActions: boolean;
}

/** Map a doctor report to the repair actions `--fix` would take. */
export function buildFixPlan(report: DoctorReport): DoctorFixPlan {
    const reinstall = [...new Set([...report.missingFiles, ...report.updateAvailable])] as ComponentName[];
    return {
        reinstall,
        npmDeps: report.missingNpmDeps,
        protected: report.userEdited,
        legacy: report.legacy,
        hasActions: reinstall.length > 0 || report.missingNpmDeps.length > 0,
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
        for (const warning of result.warnings) actions.push(`Warning: ${warning}`);
    }
    if (plan.npmDeps.length > 0) {
        await installPackages(plan.npmDeps, { cwd });
        actions.push(`Installed npm dependencies: ${plan.npmDeps.join(', ')}`);
    }
    return actions;
}

function printSection(title: string, items: string[], colorFn: (s: string) => string): void {
    if (items.length === 0) return;
    console.log('\n' + chalk.bold(title) + chalk.gray(` (${items.length})`));
    for (const item of items) console.log('  ' + colorFn(item));
}

function printReport(report: DoctorReport): void {
    printSection('Partially installed (missing files):', report.missingFiles, chalk.yellow);
    printSection('Locally modified (your edits — back them up before update):', report.userEdited, chalk.yellow);
    printSection('Update available (newer registry version):', report.updateAvailable, chalk.cyan);
    printSection('Legacy single-file layout — run `migrate`:', report.legacy, chalk.magenta);
    printSection('Missing npm dependencies:', report.missingNpmDeps, chalk.red);
    console.log('');
}

function printFixPlan(plan: DoctorFixPlan): void {
    printSection('Would re-install from the registry:', plan.reinstall, chalk.cyan);
    printSection('Would install npm dependencies:', plan.npmDeps, chalk.cyan);
    printSection('Protected (your edits — review with `diff <name>`):', plan.protected, chalk.yellow);
    printSection('Legacy layout — run `npx shadcn-angular migrate`:', plan.legacy, chalk.magenta);
    console.log('');
}

/** Healthy apart from user edits (which `--fix` deliberately never repairs). */
function cleanExceptUserEdits(report: DoctorReport): boolean {
    return report.missingFiles.length === 0 && report.updateAvailable.length === 0
        && report.missingNpmDeps.length === 0 && report.legacy.length === 0;
}

export interface DoctorOptions extends AddOptions {
    fix?: boolean;
}

async function runFix(
    cwd: string, config: Config, options: DoctorOptions, plan: DoctorFixPlan,
): Promise<void> {
    if (!plan.hasActions) {
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
    process.exit(1);
}
