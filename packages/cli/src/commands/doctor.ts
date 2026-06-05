import fs from 'fs-extra';
import path from 'node:path';
import chalk from 'chalk';
import { getConfig, getPrefix, type Config } from '../utils/config.js';
import { registry, getComponentNames, type ComponentName } from '../registry/index.js';
import { resolveProjectPath, aliasToProjectPath } from '../utils/paths.js';
import { detectConflicts, type AddOptions } from '../core/plan.js';
import { readManifest, fileStatus, type FileStatus, type Manifest } from '../core/manifest.js';
import { scanLayouts } from '../core/layout.js';

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

async function installedComponents(targetDir: string): Promise<ComponentName[]> {
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
    const { legacy } = await scanLayouts(targetDir);

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

function printSection(title: string, items: string[], colorFn: (s: string) => string): void {
    if (items.length === 0) return;
    console.log('\n' + chalk.bold(title) + chalk.gray(` (${items.length})`));
    for (const item of items) console.log('  ' + colorFn(item));
}

export async function doctor(options: AddOptions): Promise<void> {
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
    printSection('Partially installed (missing files):', report.missingFiles, chalk.yellow);
    printSection('Locally modified (your edits — back them up before update):', report.userEdited, chalk.yellow);
    printSection('Update available (newer registry version):', report.updateAvailable, chalk.cyan);
    printSection('Legacy single-file layout — run `migrate`:', report.legacy, chalk.magenta);
    printSection('Missing npm dependencies:', report.missingNpmDeps, chalk.red);
    console.log('');
    process.exit(1);
}
