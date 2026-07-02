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
    type AddOptions,
    type ConflictCheckResult,
} from '../core/plan.js';
import { performInstall } from '../core/install.js';

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
 * Offer the addons declared by the resolved base components. Addons are opt-in
 * (lean by default): `--no-addons`/`--yes` install none, `--with <list|all>`
 * selects non-interactively, `--all` includes every available addon, and
 * otherwise an interactive multiselect is shown (nothing selected by default).
 */
export async function promptAddons(
    resolved: Set<ComponentName>,
    options: AddOptions,
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
    if (options.addons === false) return [];
    if (options.with !== undefined) return selectAddonsByFlag(options.with, choices);
    if (options.yes) return [];
    if (options.all) return choices.map(c => c.name as ComponentName);

    const { selected } = await prompts({
        type: 'multiselect',
        name: 'selected',
        message: 'Optional addons available:',
        choices: choices.map(c => ({
            title: c.name + ' ' + chalk.dim('- ' + c.description + ' (for ' + c.parent + ')'),
            value: c.name,
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
    console.log(chalk.dim('\n  Use `npx shadcn-angular diff <component>` for full diffs.\n'));

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

function printDryRunSummary(
    toInstall: ComponentName[],
    toOverwrite: ComponentName[],
    toSkip: string[],
    declined: ComponentName[],
): void {
    console.log(chalk.bold('\n[Dry Run] No changes will be made.\n'));
    if (toInstall.length > 0) {
        console.log(chalk.green(`  Would install ${toInstall.length} component(s):`));
        for (const name of toInstall) console.log(chalk.dim('    + ') + chalk.cyan(name));
    }
    if (toOverwrite.length > 0) {
        console.log(chalk.yellow(`  Would overwrite ${toOverwrite.length} component(s):`));
        for (const name of toOverwrite) console.log(chalk.dim('    ~ ') + chalk.yellow(name));
    }
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

function printInstallResult(result: { installed: ComponentName[]; warnings: string[]; skipped: string[]; declined: ComponentName[]; pruned: string[] }, spinner: Ora): void {
    if (result.installed.length > 0) {
        spinner.succeed(chalk.green(`Success! Added ${result.installed.length} component(s)`));
        console.log('\n' + chalk.dim('Components added:'));
        for (const name of result.installed) console.log(chalk.dim('  - ') + chalk.cyan(name));
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

async function resolveComponentsAndConflicts(
    componentsToAdd: ComponentName[], options: AddOptions, config: Config, cwd: string,
): Promise<{ allComponents: Set<ComponentName>; extraDeps: ComponentName[]; componentPath: string | undefined; blocksPath: string | undefined; conflicts: ConflictCheckResult }> {
    const resolvedComponents = resolveDependencies(componentsToAdd);
    const optionalChoices = await promptOptionalDependencies(resolvedComponents, options);
    const addonChoices = await promptAddons(resolvedComponents, options);
    const extras = [...optionalChoices, ...addonChoices];
    const allComponents = extras.length > 0
        ? resolveDependencies([...resolvedComponents, ...extras])
        : resolvedComponents;
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

    const { allComponents, extraDeps, componentPath, blocksPath, conflicts } =
        await resolveComponentsAndConflicts(componentsToAdd, options, config, cwd);
    const { toInstall, toSkip, conflicting, contentCache } = conflicts;

    const toOverwrite = await promptOverwrite(conflicting, options,
        resolveProjectPath(cwd, componentPath ?? aliasToProjectPath(config.aliases.ui || 'src/components/ui')),  
        contentCache);
    const declined = conflicting.filter(c => !toOverwrite.includes(c));

    const addonHints = collectAvailableAddons(allComponents);
    if (options.dryRun) { printDryRunSummary(toInstall, toOverwrite, toSkip, declined); printAvailableAddons(addonHints); return; }
    if (toInstall.length === 0 && toOverwrite.length === 0) { printNothingToInstall(toSkip, declined); printAvailableAddons(addonHints); return; }

    const spinner = ora('Installing components...').start();
    try {
        const result = await performInstall({
            components: componentsToAdd, optionalDeps: extraDeps,
            // The overwrite set came from an explicit choice (the --overwrite flag
            // or the interactive overwrite prompt), so it's a whole-file clobber,
            // not a 3-way merge.
            overwrite: toOverwrite, forceOverwrite: true, cwd, config, options,
            path: componentPath, blocksPath, precomputedConflicts: conflicts,
        });
        printInstallResult(result, spinner);
        printAvailableAddons(addonHints);
    } catch (error) {
        spinner.fail('Failed to add components');
        console.error(error);
        process.exit(1);
    }
}
