import fs from 'fs-extra';
import path from 'node:path';
import chalk from 'chalk';
import { getConfig, getPrefix, type Config } from '../utils/config.js';
import { registry, getComponentNames, type ComponentName } from '../registry/index.js';
import { resolveProjectPath, aliasToProjectPath } from '../utils/paths.js';
import { detectConflicts, type AddOptions } from '../core/plan.js';

export interface DoctorReport {
    missingFiles: string[];
    modified: string[];
    missingNpmDeps: string[];
    ok: boolean;
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

    const ok = missingFiles.length === 0 && modified.length === 0 && missingNpmDeps.length === 0;
    return { missingFiles, modified, missingNpmDeps, ok };
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
    printSection('Modified locally (drift from registry):', report.modified, chalk.yellow);
    printSection('Missing npm dependencies:', report.missingNpmDeps, chalk.red);
    console.log('');
    process.exit(1);
}
