import fs from 'fs-extra';
import path from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';
import { getConfig, getPrefix, type Config, type TestRunner } from '../utils/config.js';
import { registry, getComponentNames, isComponentName, type ComponentName } from '../registry/index.js';
import { resolveProjectPath, aliasToProjectPath } from '../utils/paths.js';
import { resolveDependencies } from '../core/resolve.js';
import {
    detectConflicts, collectBreakingChanges, collectSuggestedAddons, printBreakingChanges,
    type AddOptions, type ConflictCheckResult,
} from '../core/plan.js';
import { performInstall, previewComponentMerges, type InstallResult, type MergePreview } from '../core/install.js';
import { resolveTestInstall } from '../utils/test-runner.js';
import { printBreakingUsages } from '../core/breaking-scan.js';
import { scanLayouts } from '../core/layout.js';
import { readManifest, fileStatus, getComponentRef, type Manifest } from '../core/manifest.js';
import { reportMergeSummary } from './merge-report.js';
import { apply } from './apply.js';

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

function onCancel(): never {
    console.log(chalk.dim('Cancelled.'));
    process.exit(0);
}

/**
 * Whether to interactively offer `apply <addon>`. Suppressed under `--yes` and
 * on a non-TTY stdin (piped input / CI): a non-interactive run can't be asked,
 * and `prompts` would otherwise auto-accept the `initial: true` confirm and
 * silently install the addon — the opposite of the conservative default.
 * Installing an addon (new files, new template wiring) is a bigger action than
 * the file merge `update` already performs, so when we can't ask, we don't.
 */
export function shouldOfferAddonApply(env: { readonly yes?: boolean; readonly isTTY: boolean }): boolean {
    return !env.yes && env.isTTY;
}

const applyLaterHint = (addonName: string): string =>
    chalk.dim(`Skipped — run \`npx @gilav21/shadcn-angular apply ${addonName}\` later.`);

/**
 * Offer to run `apply <addon>` for any breaking change that names one. When the
 * offer is suppressed (see {@link shouldOfferAddonApply}) the addons are left
 * uninstalled and the "apply later" hint is printed for each.
 *
 * Deliberately calls the *interactive* `apply()` (not the silent, non-prompting
 * `core/apply-core.ts` `applyCore()`): once the user has opted in here, they
 * still get `apply`'s own per-usage target-selection prompt. This only runs on
 * the interactive path (never `--yes`), so `apply`'s internal
 * `process.exit(hadConflicts && options.yes)` guard can't fire.
 */
async function promptApplyAddons(addons: readonly string[], options: AddOptions): Promise<void> {
    if (!shouldOfferAddonApply({ yes: options.yes, isTTY: !!process.stdin.isTTY })) {
        for (const addonName of addons) console.log(applyLaterHint(addonName));
        return;
    }
    for (const addonName of addons) {
        const { run } = await prompts({
            type: 'confirm',
            name: 'run',
            message: `Run \`apply ${addonName}\` now to fix this?`,
            initial: true,
        }, { onCancel });
        if (run) await apply(addonName, [], options);
        else console.log(applyLaterHint(addonName));
    }
}

/**
 * Drop addons already installed on disk (their first registry file exists) so
 * the post-update offer doesn't re-nag about a fix the user has already applied.
 * `exists` receives the addon's first registry-relative file path.
 */
export async function filterUninstalledAddons(
    addons: readonly string[], exists: (registryFile: string) => Promise<boolean>,
): Promise<string[]> {
    const result: string[] = [];
    for (const name of addons) {
        const first = isComponentName(name) ? registry[name].files[0] : undefined;
        if (!first || !(await exists(first))) result.push(name);
    }
    return result;
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

interface CustomizedBuckets {
    readonly overwrite: ComponentName[];
    readonly merge: ComponentName[];
    readonly noBaseline: ComponentName[];
}

/**
 * Classify customized components by the advice `update` can honestly give:
 * `--overwrite` replaces every one whole-file; otherwise a component with a
 * recorded baseline is 3-way merged, while one WITHOUT a baseline cannot be
 * merged (its edits are kept and warned — no merge is promised).
 */
export function classifyCustomized(
    customized: readonly ComponentName[], overwrite: boolean, hasRef: (n: ComponentName) => boolean,
): CustomizedBuckets {
    if (overwrite) return { overwrite: [...customized], merge: [], noBaseline: [] };
    const merge: ComponentName[] = [];
    const noBaseline: ComponentName[] = [];
    for (const n of customized) (hasRef(n) ? merge : noBaseline).push(n);
    return { overwrite: [], merge, noBaseline };
}

function printCustomizedAdvice(buckets: CustomizedBuckets): void {
    if (buckets.overwrite.length > 0) {
        console.log(chalk.yellow('\nThese components have local edits — --overwrite will replace them whole-file (no merge):'));
        for (const n of buckets.overwrite) console.log(chalk.yellow('  ~ ') + n);
    }
    if (buckets.merge.length > 0) {
        console.log(chalk.yellow('\nThese components have local edits — update will 3-way merge the upstream changes into them:'));
        for (const n of buckets.merge) console.log(chalk.yellow('  ~ ') + n);
        console.log(chalk.dim('Conflicts (if any) are written as <<<<<<< markers; re-run with --overwrite to take upstream whole-file instead.'));
    }
    if (buckets.noBaseline.length > 0) {
        console.log(chalk.yellow('\nThese components have local edits but no recorded baseline — your edited files will be kept and warned:'));
        for (const n of buckets.noBaseline) console.log(chalk.yellow('  ~ ') + n);
        console.log(chalk.dim('Use --overwrite to take the upstream version whole-file instead.'));
    }
}

async function warnCustomized(
    modified: ComponentName[], cwd: string, targetDir: string, options: AddOptions,
): Promise<void> {
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
    printCustomizedAdvice(classifyCustomized(
        customized, !!options.overwrite, n => getComponentRef(manifest, n) !== undefined,
    ));
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

const PREVIEW_LABELS: Readonly<Partial<Record<MergePreview['outcome'], string>>> = {
    'merged-clean': 'would merge cleanly',
    'merged-conflict': 'WOULD CONFLICT (<<<<<<< markers)',
    'fellback-kept': 'would keep your file (no baseline)',
    overwritten: 'would overwrite (local edits discarded)',
    refreshed: 'would refresh (unedited)',
    skipped: 'already up to date',
    created: 'would add',
};

/** Print `update --dry-run`'s per-file merge prediction for edited components. */
function printMergePreview(previews: MergePreview[]): void {
    if (previews.length === 0) return;
    console.log(chalk.bold('\nDry-run merge preview (files):'));
    for (const p of previews) {
        const label = PREVIEW_LABELS[p.outcome] ?? p.outcome;
        const color = p.outcome === 'merged-conflict' ? chalk.red : chalk.dim;
        console.log(color(`  ${label}: ${p.file}`));
    }
}

async function applyUpdates(
    universe: Set<ComponentName>, conflicts: ConflictCheckResult,
    cwd: string, config: Config, options: AddOptions,
    tests: { includeTests: boolean; runner: TestRunner },
): Promise<InstallResult> {
    // The write set is the `universe` (precomputedConflicts is computed over
    // exactly that set — no re-resolution). Edited files 3-way merge against
    // their recorded baseline by default; `--overwrite` (preserved in `options`)
    // clobbers whole-file instead. Pristine shared lib files refresh either way.
    const result = await performInstall({
        components: [...universe],
        overwrite: [...universe],
        cwd, config,
        options,
        precomputedConflicts: conflicts,
        includeTests: tests.includeTests,
        testRunner: tests.runner,
    });
    console.log(chalk.green(`\nUpdated ${result.installed.length} component(s).`));
    for (const w of result.warnings) console.log(chalk.yellow('  ' + w));
    return result;
}

export async function update(names: string[], options: AddOptions): Promise<void> {
    const cwd = process.cwd();
    const config = await getConfig(cwd);
    if (!config) abortConfig();
    if (!options.registry && config.registry) options.registry = config.registry;
    options.overwrite ??= config.update?.overwrite;
    const tests = await resolveTestInstall(config, options, cwd);

    const targetDir = resolveProjectPath(cwd, aliasToProjectPath(config.aliases.ui || 'src/components/ui'));
    const scan = await scanLayouts(targetDir, getPrefix(config));
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

    const touched = [...conflicts.conflicting, ...conflicts.toInstall];
    printUpdatePlan(conflicts.conflicting, conflicts.toInstall);
    await warnCustomized(conflicts.conflicting, cwd, targetDir, options);
    printBreakingChanges(touched);
    const managed = [config.aliases.ui, config.aliases.blocks]
        .filter((a): a is string => Boolean(a))
        .map(a => resolveProjectPath(cwd, aliasToProjectPath(a)));
    await printBreakingUsages(touched, cwd, managed);

    if (options.dryRun) {
        printMergePreview(await previewComponentMerges(
            conflicts.conflicting, conflicts, { components: [...universe], cwd, config, options },
        ));
        console.log(chalk.dim('\n[Dry Run] No changes written.'));
        return;
    }

    const result = await applyUpdates(universe, conflicts, cwd, config, options, tests);
    const hadConflicts = reportMergeSummary(result.mergeReport);

    const suggestedAddons = collectSuggestedAddons(collectBreakingChanges(touched));
    const uninstalledAddons = await filterUninstalledAddons(
        suggestedAddons, f => fs.pathExists(path.join(targetDir, f)),
    );
    await promptApplyAddons(uninstalledAddons, options);

    // In non-interactive runs (CI / --yes) a written conflict must fail the
    // command so a pipeline notices the unresolved markers.
    if (hadConflicts && options.yes) process.exit(1);
}
