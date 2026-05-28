import fs from 'fs-extra';
import path from 'node:path';
import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
import { getConfig, getPrefix } from '../utils/config.js';
import { registry, getComponentNames, type ComponentName } from '../registry/index.js';
import {
    resolveProjectPath,
    aliasToProjectPath,
} from '../utils/paths.js';
import {
    fetchAndTransform,
    normalizeContent,
} from '../core/fetch.js';
import { resolveDependencies } from '../core/resolve.js';
import {
    checkFileConflict,
    classifyComponent,
    detectConflicts,
    type AddOptions,
} from '../core/plan.js';
import { performInstall } from '../core/install.js';

export { fetchAndTransform, normalizeContent, resolveDependencies, checkFileConflict, classifyComponent, detectConflicts, type AddOptions };

const onCancel = () => {
    console.log(chalk.dim('\nCancelled.'));
    process.exit(0);
};

// ---------------------------------------------------------------------------
// Component selection & dependency resolution
// ---------------------------------------------------------------------------

async function selectComponents(components: string[], options: AddOptions): Promise<ComponentName[]> {
    if (options.all) {
        return getComponentNames();
    }

    if (components.length === 0) {
        const { selected } = await prompts({
            type: 'multiselect',
            name: 'selected',
            message: 'Which components would you like to add?',
            choices: getComponentNames().map(name => ({
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
        console.log(chalk.dim('Available components: ' + getComponentNames().join(', ')));
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

    return selected || [];
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
    return selected || [];
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

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function add(components: string[], options: AddOptions) {
    const cwd = process.cwd();

    const config = await getConfig(cwd);
    if (!config) {
        console.log(chalk.red('Error: components.json not found.'));
        console.log(chalk.dim('Run `npx @gilav21/shadcn-angular init` first.'));
        process.exit(1);
    }

    // CLI flag takes priority over components.json
    if (!options.registry && config.registry) {
        options.registry = config.registry;
    }

    const componentsToAdd = await selectComponents(components, options);
    if (!componentsToAdd || componentsToAdd.length === 0) {
        console.log(chalk.dim('No components selected.'));
        return;
    }

    validateComponents(componentsToAdd);

    const resolvedComponents = resolveDependencies(componentsToAdd);
    const optionalChoices = await promptOptionalDependencies(resolvedComponents, options);
    const allComponents = optionalChoices.length > 0
        ? resolveDependencies([...resolvedComponents, ...optionalChoices])
        : resolvedComponents;
    const uiBasePath = options.path ?? aliasToProjectPath(config.aliases.ui || 'src/components/ui');
    const targetDir = resolveProjectPath(cwd, uiBasePath);
    const utilsAlias = config.aliases.utils;
    const prefix = getPrefix(config);

    const checkSpinner = ora('Checking for conflicts...').start();
    const conflicts = await detectConflicts(allComponents, targetDir, options, utilsAlias, prefix);
    const { toInstall, toSkip, conflicting, contentCache } = conflicts;
    checkSpinner.stop();

    const toOverwrite = await promptOverwrite(conflicting, options, targetDir, contentCache);
    const declined = conflicting.filter(c => !toOverwrite.includes(c));

    if (options.dryRun) {
        printDryRunSummary(toInstall, toOverwrite, toSkip, declined);
        return;
    }

    if (toInstall.length === 0 && toOverwrite.length === 0) {
        printNothingToInstall(toSkip, declined);
        return;
    }

    const spinner = ora('Installing components...').start();

    try {
        const result = await performInstall({
            components: componentsToAdd,
            optionalDeps: optionalChoices,
            overwrite: toOverwrite,
            cwd, config, options, path: options.path,
            precomputedConflicts: conflicts,
        });

        if (result.installed.length > 0) {
            spinner.succeed(chalk.green(`Success! Added ${result.installed.length} component(s)`));
            console.log('\n' + chalk.dim('Components added:'));
            for (const name of result.installed) console.log(chalk.dim('  - ') + chalk.cyan(name));
        } else {
            spinner.info('No new components installed.');
        }

        for (const w of result.warnings) console.log(chalk.yellow('  ' + w));
        printSkipSummary(result.skipped, result.declined);
        console.log('');
    } catch (error) {
        spinner.fail('Failed to add components');
        console.error(error);
        process.exit(1);
    }
}
