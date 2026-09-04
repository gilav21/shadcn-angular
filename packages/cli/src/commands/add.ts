import fs from 'fs-extra';
import path from 'node:path';
import prompts from 'prompts';
import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import { getConfig, getPrefix, getBlocksAlias, type Config } from '../utils/config.js';
import { registry, getComponentNames, type ComponentName } from '../registry/index.js';
import {
    resolveProjectPath,
    aliasToProjectPath,
} from '../utils/paths.js';
import {
    normalizeContent,
} from '../core/fetch.js';
import { resolveDependencies } from '../core/resolve.js';
import {
    detectConflicts,
    buildInstallSummary,
    type AddOptions,
    type ConflictCheckResult,
    type InstallSummary,
    type InstallSummaryGroup,
} from '../core/plan.js';
import { performInstall, expandForTests } from '../core/install.js';
import { resolvePreset, PresetError } from '../core/presets.js';
import { resolveTestInstall } from '../utils/test-runner.js';

export { fetchAndTransform } from '../core/fetch.js';
export { checkFileConflict, classifyComponent } from '../core/plan.js';
export { normalizeContent, resolveDependencies, detectConflicts, type AddOptions };

const onCancel = (): void => {
    console.log(chalk.dim('\nCancelled.'));
    process.exit(0);
};

// ---------------------------------------------------------------------------
// Component selection & dependency resolution
// ---------------------------------------------------------------------------

/** Top-level addable components — addons are surfaced via the addon prompt, not here. */
function selectableComponentNames(): ComponentName[] {
    return getComponentNames().filter(name => registry[name].type !== 'addon');
}

async function selectComponents(components: string[], options: AddOptions): Promise<ComponentName[]> {
    if (options.all) {
        return selectableComponentNames();
    }

    if (components.length === 0) {
        const { selected } = await prompts({
            type: 'multiselect',
            name: 'selected',
            message: 'Which components would you like to add?',
            choices: selectableComponentNames().map(name => ({
                title: name,
                value: name,
            })),
            hint: '- Space to select, Enter to confirm',
        }, { onCancel });
        return selected;
    }

    return components as ComponentName[];
}

function validateComponents(names: ComponentName[]): void {
    const invalid = names.filter(c => !(c in registry));
    if (invalid.length > 0) {
        console.log(chalk.red(`Invalid component(s): ${invalid.join(', ')}`));
        console.log(chalk.dim('Available components: ' + selectableComponentNames().join(', ')));
        process.exit(1);
    }
}

// ---------------------------------------------------------------------------
// Optional dependency prompt
// ---------------------------------------------------------------------------

interface OptionalChoice {
    readonly name: string;
    readonly description: string;
    readonly requestedBy: string;
}

export async function promptOptionalDependencies(
    resolved: Set<ComponentName>,
    options: AddOptions,
): Promise<ComponentName[]> {
    const seen = new Set<string>();
    const choices: OptionalChoice[] = [];

    for (const name of resolved) {
        const component = registry[name];
        if (!component.optionalDependencies) continue;

        for (const opt of component.optionalDependencies) {
            if (resolved.has(opt.name as ComponentName) || seen.has(opt.name)) continue;
            seen.add(opt.name);
            choices.push({ name: opt.name, description: opt.description, requestedBy: name });
        }
    }

    if (choices.length === 0) return [];
    if (options.yes) return [];
    if (options.all) return choices.map(c => c.name as ComponentName);

    const { selected } = await prompts({
        type: 'multiselect',
        name: 'selected',
        message: 'Optional companion components available:',
        choices: choices.map(c => ({
            title: c.name + ' ' + chalk.dim('- ' + c.description + ' (for ' + c.requestedBy + ')'),
            value: c.name,
        })),
        hint: '- Space to select, Enter to confirm (or press Enter to skip)',
    }, { onCancel });

    return selected ?? [];
}

// ---------------------------------------------------------------------------
// Addon prompt
// ---------------------------------------------------------------------------

interface AddonChoice {
    readonly name: string;
    readonly description: string;
    readonly parent: string;
}

/**
 * Match a single `--with` token to an addon. Requires the full `parent/addon`
 * key (the same form as `add parent/addon`) — a bare short name like
 * `context-menu` is rejected with a hint, since short names collide across
 * bases (e.g. a future `data-table/ai` vs `rich-text-editor/ai`).
 */
function matchAddonToken(token: string, choices: AddonChoice[]): ComponentName | null {
    const exact = choices.find(c => c.name === token);
    if (exact) return exact.name as ComponentName;

    const shortMatches = choices.filter(c => c.name.endsWith('/' + token));
    if (shortMatches.length > 0) {
        console.warn(chalk.yellow(`Use the full addon key for "${token}": ${shortMatches.map(c => c.name).join(' or ')}.`));
    } else {
        console.warn(chalk.yellow(`Unknown addon "${token}" — skipping. Available: ${choices.map(c => c.name).join(', ')}`));
    }
    return null;
}

/** Resolve a `--with` value (a comma list, or the token `all`) against the available addons. */
function selectAddonsByFlag(withValue: string, choices: AddonChoice[]): ComponentName[] {
    const tokens = withValue.split(',').map(t => t.trim()).filter(Boolean);
    if (tokens.includes('all')) return choices.map(c => c.name as ComponentName);

    const selected: ComponentName[] = [];
    for (const token of tokens) {
        const match = matchAddonToken(token, choices);
        if (match) selected.push(match);
    }
    return selected;
}

/**
 * Keep only preselected keys this registry actually offers. A stale live
 * manifest can name an addon that no longer exists; warn and continue rather
 * than failing the whole install over it.
 */
function offeredPreselection(
    preselected: readonly ComponentName[], choices: AddonChoice[], preset: string | undefined,
): ComponentName[] {
    const offered = new Set(choices.map(c => c.name));
    const kept: ComponentName[] = [];
    for (const key of preselected) {
        if (offered.has(key)) kept.push(key);
        else {
            console.warn(chalk.yellow(
                `Preset "${preset ?? ''}" lists ${key}, which this registry does not offer — skipping.`,
            ));
        }
    }
    return kept;
}

/** Union two addon lists, preserving first-seen order. */
function unionAddons(a: readonly ComponentName[], b: readonly ComponentName[]): ComponentName[] {
    return [...new Set([...a, ...b])];
}

/**
 * The non-interactive decision table for which addons to install. Returns
 * `null` when the developer must be asked (the interactive path).
 */
function selectAddons(
    options: AddOptions, choices: AddonChoice[], preselected: readonly ComponentName[],
): ComponentName[] | null {
    if (options.addons === false) return [];
    if (options.all) return choices.map(c => c.name as ComponentName);
    if (options.with !== undefined) {
        return unionAddons(preselected, selectAddonsByFlag(options.with, choices));
    }
    if (options.yes) return [...preselected];
    return null;
}

/**
 * Offer the addons declared by the resolved base components. Addons are opt-in
 * (lean by default): `--no-addons` installs none, `--with <list|all>` selects
 * non-interactively, `--all` includes every available addon, `--yes` takes
 * `preselected` (empty unless `--preset` named a bundle), and otherwise an
 * interactive multiselect opens with `preselected` ticked.
 */
export async function promptAddons(
    resolved: Set<ComponentName>,
    options: AddOptions,
    preselected: readonly ComponentName[] = [],
): Promise<ComponentName[]> {
    const seen = new Set<string>();
    const choices: AddonChoice[] = [];

    for (const name of resolved) {
        const component = registry[name];
        if (!component.addons) continue;

        for (const key of component.addons) {
            if (resolved.has(key as ComponentName) || seen.has(key)) continue;
            seen.add(key);
            choices.push({ name: key, description: registry[key as ComponentName]?.description ?? '', parent: name });
        }
    }

    if (choices.length === 0) return [];

    const offered = offeredPreselection(preselected, choices, options.preset);
    const decided = selectAddons(options, choices, offered);
    if (decided) return decided;

    const preselectedSet = new Set<string>(offered);
    const { selected } = await prompts({
        type: 'multiselect',
        name: 'selected',
        message: options.preset
            ? `Optional addons available (preset "${options.preset}" pre-selected):`
            : 'Optional addons available:',
        choices: choices.map(c => ({
            title: c.name + ' ' + chalk.dim('- ' + c.description + ' (for ' + c.parent + ')'),
            value: c.name,
            selected: preselectedSet.has(c.name),
        })),
        hint: '- Space to select, Enter to confirm (or press Enter to skip)',
    }, { onCancel });

    return selected ?? [];
}

// ---------------------------------------------------------------------------
// Post-install addon discoverability
// ---------------------------------------------------------------------------

/** An addon available for an installed base but not itself installed. */
export interface AddonHint {
    readonly addon: ComponentName;
    readonly parent: ComponentName;
    readonly description: string;
}

/**
 * Addons declared by the installed components that were not themselves
 * installed — surfaced after every `add` so a dev who skipped the prompt
 * (via `--yes`, `--no-addons`, CI, or just pressing Enter) still discovers them.
 */
export function collectAvailableAddons(installed: Set<ComponentName>): AddonHint[] {
    const seen = new Set<string>();
    const hints: AddonHint[] = [];
    for (const name of installed) {
        const component = registry[name];
        if (!component.addons) continue;
        for (const key of component.addons) {
            if (installed.has(key as ComponentName) || seen.has(key)) continue;
            seen.add(key);
            hints.push({ addon: key as ComponentName, parent: name, description: registry[key as ComponentName]?.description ?? '' });
        }
    }
    return hints;
}

/** Print a short, non-intrusive note about addons the dev can opt into later. */
function printAvailableAddons(hints: AddonHint[]): void {
    if (hints.length === 0) return;
    console.log('');
    console.log(chalk.cyan('Optional addons available (not installed):'));
    for (const h of hints) {
        console.log('  ' + chalk.bold(h.addon) + (h.description ? chalk.dim(' — ' + h.description) : ''));
    }
    console.log(chalk.dim(`  Wire one in with: npx @gilav21/shadcn-angular apply ${hints[0].addon}`));
}

// ---------------------------------------------------------------------------
// Overwrite prompt
// ---------------------------------------------------------------------------

function showConflictDiffs(
    conflicting: ComponentName[],
    targetDir: string,
    contentCache: Map<string, string>,
): void {
    for (const name of conflicting) {
        const component = registry[name];
        const changedFiles: string[] = [];

        for (const file of component.files) {
            const remote = contentCache.get(file);
            if (!remote) continue;
            const localPath = path.join(targetDir, file);
            if (!fs.existsSync(localPath)) continue;

            const local = normalizeContent(fs.readFileSync(localPath, 'utf-8'));
            if (local !== normalizeContent(remote)) {
                changedFiles.push(file);
            }
        }

        if (changedFiles.length > 0) {
            console.log(chalk.dim(`  ${name}: `) + chalk.yellow(changedFiles.join(', ')));
        }
    }
}

async function promptOverwrite(
    conflicting: ComponentName[],
    options: AddOptions,
    targetDir: string,
    contentCache: Map<string, string>,
): Promise<ComponentName[]> {
    if (conflicting.length === 0) return [];

    if (options.overwrite || options.yes) return conflicting;

    // `--dry-run` is supposed to be non-interactive — never block on the
    // overwrite prompt. Treat conflicts as "would skip"; the dry-run
    // summary still surfaces them so the user knows what was found.
    if (options.dryRun) return [];

    console.log(chalk.yellow(`\n${conflicting.length} component(s) have local changes or are different from remote:`));
    showConflictDiffs(conflicting, targetDir, contentCache);
    console.log(chalk.dim('\n  Use `npx @gilav21/shadcn-angular diff <component>` for full diffs.\n'));

    const { selected } = await prompts({
        type: 'multiselect',
        name: 'selected',
        message: 'Select components to OVERWRITE (Unselected will be skipped):',
        choices: conflicting.map(name => ({ title: name, value: name })),
        hint: '- Space to select, Enter to confirm',
    }, { onCancel });
    return selected ?? [];
}

// ---------------------------------------------------------------------------
// Peer file & summary helpers
// ---------------------------------------------------------------------------

function printNothingToInstall(toSkip: string[], declined: ComponentName[]): void {
    if (toSkip.length > 0 || declined.length > 0) {
        printSkipSummary(toSkip, declined);
    } else {
        console.log(chalk.dim('\nNo components to install.'));
    }
}

/** `1 file` / `7 files` — a count with its noun correctly pluralised. */
function plural(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/** `2 components, 7 files` — the parenthetical after a group heading. */
function groupCaption(group: InstallSummaryGroup): string {
    return `${plural(group.components.length, 'component')}, ${plural(group.files, 'file')}`;
}

/** One heading + one line per component. Empty groups print nothing (UC-6). */
function printSummaryGroup(heading: string, group: InstallSummaryGroup): void {
    if (group.components.length === 0) return;
    console.log('  ' + chalk.bold(`${heading} (${groupCaption(group)})`));
    for (const c of group.components) {
        console.log(chalk.dim('    + ') + chalk.cyan(c.name) + chalk.dim(` (${plural(c.files, 'file')})`));
    }
}

/**
 * The grouped block: what you asked for, what you chose, and the shared
 * primitives that came along — each with counts, then the `why` pointer.
 */
function printGroupedSummary(summary: InstallSummary): void {
    if (summary.totalFiles === 0 && summary.skipped.components.length === 0) return;
    printSummaryGroup('Requested', summary.requested);
    printSummaryGroup(
        summary.hasCompanions ? 'Addons & companions chosen' : 'Addons chosen',
        summary.addons,
    );
    printSummaryGroup(
        'Shared UI components other components reuse — not yet in your project',
        summary.shared,
    );
    printSummaryGroup('Already in your project — skipped', summary.skipped);
    if (summary.libFiles > 0) {
        console.log(chalk.dim(`  + ${summary.libFiles} shared lib files (utils, i18n, …)`));
    }
    console.log('\n  ' + chalk.dim('Why is a component here?  ')
        + chalk.cyan('npx @gilav21/shadcn-angular why <name>'));
}

/** The whole `--dry-run` report: plan headlines, grouped block, addon hints. */
function reportDryRun(input: {
    readonly toInstall: ComponentName[];
    readonly toOverwrite: ComponentName[];
    readonly toSkip: string[];
    readonly declined: ComponentName[];
    readonly grouping: { readonly requested: readonly string[]; readonly chosen: readonly string[] };
    readonly addonHints: AddonHint[];
}): void {
    const summary = buildInstallSummary({
        ...input.grouping,
        written: [...input.toInstall, ...input.toOverwrite],
        skipped: input.toSkip,
        declined: input.declined,
    });
    printDryRunSummary(input.toInstall, input.toOverwrite, input.toSkip, input.declined, summary);
    printAvailableAddons(input.addonHints);
}

function printDryRunSummary(
    toInstall: ComponentName[],
    toOverwrite: ComponentName[],
    toSkip: string[],
    declined: ComponentName[],
    summary: InstallSummary,
): void {
    console.log(chalk.bold('\n[Dry Run] No changes will be made.\n'));
    if (toInstall.length > 0) {
        // The grouped block below names every component with its file count, so
        // the old flat list would just repeat it — only the headline remains.
        console.log(chalk.green(`  Would install ${toInstall.length} component(s) — ${summary.totalFiles} files:`));
        console.log('');
    }
    if (toOverwrite.length > 0) {
        console.log(chalk.yellow(`  Would overwrite ${toOverwrite.length} component(s):`));
        for (const name of toOverwrite) console.log(chalk.dim('    ~ ') + chalk.yellow(name));
        console.log('');
    }
    printGroupedSummary(summary);
    printSkipSummary(toSkip, declined);
    console.log('');
}

function printSkipSummary(toSkip: string[], declined: ComponentName[]): void {
    if (toSkip.length > 0) {
        console.log('\n' + chalk.dim('Components skipped (up to date):'));
        for (const name of toSkip) console.log(chalk.dim('  - ') + chalk.gray(name));
    }
    if (declined.length > 0) {
        console.log('\n' + chalk.dim('Components skipped (kept local changes):'));
        for (const name of declined) console.log(chalk.dim('  - ') + chalk.yellow(name));
    }
}

/**
 * Resolve where component vs block files install. With a block in the set,
 * `--path` (or an interactive prompt) targets the block destination and
 * components fall back to `aliases.ui`. Without a block, `--path` keeps its
 * original component-target meaning.
 */
async function resolveBlockDestination(
    hasBlock: boolean, options: AddOptions, config: Config,
): Promise<{ componentPath?: string; blocksPath?: string }> {
    if (!hasBlock) return { componentPath: options.path };
    if (options.path) return { blocksPath: options.path };
    if (options.yes) return {};
    const { dest } = await prompts({
        type: 'text',
        name: 'dest',
        message: 'Where should blocks be installed?',
        initial: aliasToProjectPath(getBlocksAlias(config)),
    }, { onCancel });
    return { blocksPath: dest || undefined };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

function printInstallResult(
    result: { installed: ComponentName[]; warnings: string[]; skipped: string[]; declined: ComponentName[]; pruned: string[] },
    spinner: Ora,
    grouping: { readonly requested: readonly string[]; readonly chosen: readonly string[] },
): void {
    if (result.installed.length > 0) {
        const summary = buildInstallSummary({
            requested: grouping.requested,
            chosen: grouping.chosen,
            written: result.installed,
            skipped: result.skipped,
            declined: result.declined,
        });
        spinner.succeed(chalk.green(`Success! Added ${result.installed.length} component(s)`));
        console.log('\n' + chalk.dim(`Components added — ${summary.totalFiles} files:`));
        printGroupedSummary(summary);
    } else {
        spinner.info('No new components installed.');
    }
    if (result.pruned.length > 0) {
        console.log('\n' + chalk.dim('Pruned obsolete files:'));
        for (const rel of result.pruned) console.log(chalk.dim('  - ') + chalk.gray(rel));
    }
    for (const w of result.warnings) console.log(chalk.yellow('  ' + w));
    printSkipSummary(result.skipped, result.declined);
    console.log('');
}

/**
 * Resolve `--preset <name>` to the addon keys it pre-selects, or exit 1 with
 * the reason. Returns `[]` when no preset was named. `--no-addons` contradicts
 * `--preset`, so that combination is rejected before any prompt is shown.
 */
function resolvePresetOrExit(
    componentsToAdd: ComponentName[], options: AddOptions,
): ComponentName[] {
    if (options.preset === undefined) return [];
    if (options.addons === false) {
        console.log(chalk.red('--preset and --no-addons contradict each other — drop one.'));
        process.exit(1);
    }
    try {
        return resolvePreset(componentsToAdd, options.preset).addons;
    } catch (error) {
        if (!(error instanceof PresetError)) throw error;
        console.log(chalk.red(error.message));
        process.exit(1);
    }
}

async function resolveComponentsAndConflicts(
    componentsToAdd: ComponentName[], options: AddOptions, config: Config, cwd: string, includeTests: boolean,
    preselectedAddons: readonly ComponentName[] = [],
): Promise<{ allComponents: Set<ComponentName>; extraDeps: ComponentName[]; componentPath: string | undefined; blocksPath: string | undefined; conflicts: ConflictCheckResult }> {
    const resolvedComponents = resolveDependencies(componentsToAdd);
    const optionalChoices = await promptOptionalDependencies(resolvedComponents, options);
    const addonChoices = await promptAddons(resolvedComponents, options, preselectedAddons);
    const extras = [...optionalChoices, ...addonChoices];
    const closure = extras.length > 0
        ? resolveDependencies([...resolvedComponents, ...extras])
        : resolvedComponents;
    // With --include-tests, pull the spec-only sibling source too so the conflict
    // scan and install cover it; testsFor (which specs actually ship) is derived
    // independently in performInstall from the originally-requested closure.
    const { all: allComponents } = expandForTests(closure, includeTests);
    const hasBlock = [...allComponents].some(n => registry[n].type === 'block');
    const { componentPath, blocksPath } = await resolveBlockDestination(hasBlock, options, config);
     
    const uiBasePath = componentPath ?? aliasToProjectPath(config.aliases.ui || 'src/components/ui');
    const targetDir = resolveProjectPath(cwd, uiBasePath);
    const checkSpinner = ora('Checking for conflicts...').start();
    const conflicts = await detectConflicts(allComponents, targetDir, options, config.aliases.utils, getPrefix(config));
    checkSpinner.stop();
    return { allComponents, extraDeps: extras, componentPath, blocksPath, conflicts };
}

export async function add(components: string[], options: AddOptions): Promise<void> {
    const cwd = process.cwd();

    const config = await getConfig(cwd);
    if (!config) {
        console.log(chalk.red('Error: components.json not found.'));
        console.log(chalk.dim('Run `npx @gilav21/shadcn-angular init` first.'));
        process.exit(1);
    }

    if (!options.registry && config.registry) {
        options.registry = config.registry;
    }

    const componentsToAdd = await selectComponents(components, options);
    if (!componentsToAdd || componentsToAdd.length === 0) {
        console.log(chalk.dim('No components selected.'));
        return;
    }

    validateComponents(componentsToAdd);

    const preselectedAddons = resolvePresetOrExit(componentsToAdd, options);

    const { includeTests, runner } = await resolveTestInstall(config, options, cwd);

    const { allComponents, extraDeps, componentPath, blocksPath, conflicts } =
        await resolveComponentsAndConflicts(
            componentsToAdd, options, config, cwd, includeTests, preselectedAddons,
        );
    const { toInstall, toSkip, conflicting, contentCache } = conflicts;

    const toOverwrite = await promptOverwrite(conflicting, options,
        resolveProjectPath(cwd, componentPath ?? aliasToProjectPath(config.aliases.ui || 'src/components/ui')),  
        contentCache);
    const declined = conflicting.filter(c => !toOverwrite.includes(c));

    const addonHints = collectAvailableAddons(allComponents);
    const grouping = { requested: componentsToAdd, chosen: extraDeps };
    if (options.dryRun) {
        reportDryRun({ toInstall, toOverwrite, toSkip, declined, grouping, addonHints });
        return;
    }
    if (toInstall.length === 0 && toOverwrite.length === 0) { printNothingToInstall(toSkip, declined); printAvailableAddons(addonHints); return; }

    await runInstall({
        componentsToAdd, extraDeps, toOverwrite, cwd, config, options,
        componentPath, blocksPath, conflicts, includeTests, runner,
        grouping, addonHints,
    });
}

/** Execute the planned install and report it. Exits 1 on failure. */
async function runInstall(input: {
    readonly componentsToAdd: ComponentName[];
    readonly extraDeps: ComponentName[];
    readonly toOverwrite: ComponentName[];
    readonly cwd: string;
    readonly config: Config;
    readonly options: AddOptions;
    readonly componentPath: string | undefined;
    readonly blocksPath: string | undefined;
    readonly conflicts: ConflictCheckResult;
    readonly includeTests: boolean;
    readonly runner: 'vitest' | 'jest';
    readonly grouping: { readonly requested: readonly string[]; readonly chosen: readonly string[] };
    readonly addonHints: AddonHint[];
}): Promise<void> {
    const spinner = ora('Installing components...').start();
    try {
        const result = await performInstall({
            components: input.componentsToAdd, optionalDeps: input.extraDeps,
            // The overwrite set came from an explicit choice (the --overwrite flag
            // or the interactive overwrite prompt), so it's a whole-file clobber,
            // not a 3-way merge.
            overwrite: input.toOverwrite, forceOverwrite: true,
            cwd: input.cwd, config: input.config, options: input.options,
            path: input.componentPath, blocksPath: input.blocksPath,
            precomputedConflicts: input.conflicts,
            includeTests: input.includeTests, testRunner: input.runner,
        });
        printInstallResult(result, spinner, input.grouping);
        printAvailableAddons(input.addonHints);
    } catch (error) {
        spinner.fail('Failed to add components');
        console.error(error);
        process.exit(1);
    }
}
