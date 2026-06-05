import fs from 'fs-extra';
import path from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { getConfig, getPrefix, type Config } from '../utils/config.js';
import { registry, getComponentNames, isComponentName, type ComponentName } from '../registry/index.js';
import { resolveProjectPath, aliasToProjectPath } from '../utils/paths.js';
import { resolveDependencies } from '../core/resolve.js';
import { detectConflicts, type AddOptions, type ConflictCheckResult } from '../core/plan.js';
import { performInstall } from '../core/install.js';
import { scanLayouts } from '../core/layout.js';
import { readManifest, fileStatus, type Manifest } from '../core/manifest.js';

export async function resolveUpdateTargets(
    names: string[], cwd: string, config: Config,
): Promise<ComponentName[]> {
    if (names.length > 0) {
        const invalid = names.filter(n => !isComponentName(n));
        if (invalid.length) throw new Error(`Unknown component(s): ${invalid.join(', ')}`);
        return names as ComponentName[];
    }
    const targetDir = resolveProjectPath(cwd, aliasToProjectPath(config.aliases.ui || 'src/components/ui'));
    const installed: ComponentName[] = [];
    for (const name of getComponentNames()) {
        if (await fs.pathExists(path.join(targetDir, registry[name].files[0]))) installed.push(name);
    }
    return installed;
}

export interface ClosurePartition {
    alreadyInstalled: ComponentName[];
    newlyRequired: ComponentName[];
}

/** Split a dependency closure into already-installed vs newly-required deps. */
export function partitionClosure(
    targets: ComponentName[], installed: Set<ComponentName>, closure: Set<ComponentName>,
): ClosurePartition {
    const targetSet = new Set(targets);
    const alreadyInstalled: ComponentName[] = [];
    const newlyRequired: ComponentName[] = [];
    for (const name of closure) {
        if (targetSet.has(name) || installed.has(name)) alreadyInstalled.push(name);
        else newlyRequired.push(name);
    }
    return { alreadyInstalled, newlyRequired };
}

function abortConfig(): never {
    console.log(chalk.red('Error: components.json not found.'));
    console.log(chalk.dim('Run `npx @gilav21/shadcn-angular init` first.'));
    process.exit(1);
}

async function resolveTargetsOrExit(
    names: string[], cwd: string, config: Config,
): Promise<ComponentName[]> {
    try {
        return await resolveUpdateTargets(names, cwd, config);
    } catch (e: unknown) {
        console.log(chalk.red(e instanceof Error ? e.message : String(e)));
        process.exit(1);
    }
}

/**
 * Route to `migrate` when any component in the closure is installed in the
 * legacy flat layout: the new folder versions import sibling components via
 * their folder barrel (`../button`), which won't resolve while a dependency is
 * still a flat `button.component.ts`. Patching in place would break the build
 * or write a duplicate folder copy.
 */
function abortIfLegacy(legacyInClosure: ComponentName[]): void {
    if (legacyInClosure.length === 0) return;
    console.log(chalk.yellow('\nThis project has components in the legacy single-file layout.'));
    console.log(chalk.yellow(`Affected: ${legacyInClosure.join(', ')}`));
    console.log(chalk.dim('`update` cannot safely patch the new folder layout in place.'));
    console.log(chalk.dim('Run `npx @gilav21/shadcn-angular migrate` first.'));
    process.exit(1);
}

function abortIfNewDepsWithoutConsent(newlyRequired: ComponentName[], options: AddOptions): void {
    if (newlyRequired.length === 0 || options.yes) return;
    console.log(chalk.yellow('\nThese updates require new dependencies not yet installed:'));
    for (const n of newlyRequired) console.log(chalk.yellow('  + ') + n);
    console.log(chalk.dim('\nRe-run with --yes to install them (skipping would break the build).'));
    process.exit(1);
}

function printUpdatePlan(modified: ComponentName[], created: ComponentName[]): void {
    console.log(chalk.bold('\nUpdate plan:'));
    for (const n of modified) console.log(chalk.yellow('  ~ ') + n + chalk.dim(' (modified)'));
    for (const n of created) console.log(chalk.green('  + ') + n + chalk.dim(' (new dependency)'));
}

/** Components (among `names`) with at least one locally-modified file vs the baseline. */
export function customizedAmong(
    names: ComponentName[], manifest: Manifest,
    localContent: Map<string, string>, filesOf: (n: ComponentName) => readonly string[],
): ComponentName[] {
    return names.filter(n =>
        filesOf(n).some(f => {
            const local = localContent.get(f);
            return local !== undefined && fileStatus(manifest, f, local) === 'modified';
        }),
    );
}

async function warnCustomized(modified: ComponentName[], cwd: string, targetDir: string): Promise<void> {
    if (modified.length === 0) return;
    const manifest = await readManifest(cwd);
    const localContent = new Map<string, string>();
    for (const name of modified) {
        for (const file of registry[name].files) {
            const p = path.join(targetDir, file);
            if (await fs.pathExists(p)) localContent.set(file, await fs.readFile(p, 'utf-8'));
        }
    }
    const customized = customizedAmong(modified, manifest, localContent, n => registry[n].files);
    if (customized.length === 0) return;
    console.log(chalk.yellow('\nThese components have local edits that update will overwrite:'));
    for (const n of customized) console.log(chalk.yellow('  ~ ') + n);
    console.log(chalk.dim('Review with `git diff` after updating and re-apply your changes.'));
}

async function detectUpdates(
    universe: Set<ComponentName>, targetDir: string, options: AddOptions, config: Config,
): Promise<ConflictCheckResult> {
    const spinner = ora('Checking for updates...').start();
    const conflicts = await detectConflicts(
        universe, targetDir, options, config.aliases.utils, getPrefix(config),
    );
    spinner.stop();
    return conflicts;
}

async function applyUpdates(
    universe: Set<ComponentName>, conflicts: ConflictCheckResult,
    cwd: string, config: Config, options: AddOptions,
): Promise<void> {
    // `overwrite: true` refreshes shared lib files (utils, i18n, touch) for the
    // updated set; the write set stays bounded to `universe` because
    // precomputedConflicts is computed over exactly that set (no re-resolution).
    const result = await performInstall({
        components: [...universe],
        overwrite: [...universe],
        cwd, config,
        options: { ...options, overwrite: true },
        precomputedConflicts: conflicts,
    });
    console.log(chalk.green(`\nUpdated ${result.installed.length} component(s).`));
    for (const w of result.warnings) console.log(chalk.yellow('  ' + w));
}

export async function update(names: string[], options: AddOptions): Promise<void> {
    const cwd = process.cwd();
    const config = await getConfig(cwd);
    if (!config) abortConfig();
    if (!options.registry && config.registry) options.registry = config.registry;

    const targetDir = resolveProjectPath(cwd, aliasToProjectPath(config.aliases.ui || 'src/components/ui'));
    const scan = await scanLayouts(targetDir);
    const targets = await resolveTargetsOrExit(names, cwd, config);

    if (targets.length === 0) {
        console.log(chalk.dim('No installed components to update.'));
        return;
    }

    const closure = resolveDependencies(targets);
    abortIfLegacy([...closure].filter(c => scan.legacy.includes(c)));

    const installedSet = new Set<ComponentName>([...scan.current, ...targets]);
    const { alreadyInstalled, newlyRequired } = partitionClosure(targets, installedSet, closure);
    abortIfNewDepsWithoutConsent(newlyRequired, options);

    const universe = new Set<ComponentName>([...alreadyInstalled, ...(options.yes ? newlyRequired : [])]);
    const conflicts = await detectUpdates(universe, targetDir, options, config);

    if (conflicts.toInstall.length === 0 && conflicts.conflicting.length === 0) {
        console.log(chalk.green('Everything is up to date.'));
        return;
    }

    printUpdatePlan(conflicts.conflicting, conflicts.toInstall);
    await warnCustomized(conflicts.conflicting, cwd, targetDir);

    if (options.dryRun) {
        console.log(chalk.dim('\n[Dry Run] No changes written.'));
        return;
    }

    await applyUpdates(universe, conflicts, cwd, config, options);
}
