import fs from 'fs-extra';
import path from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { getConfig, type Config } from '../utils/config.js';
import { registry, getComponentNames, isComponentName, type ComponentName } from '../registry/index.js';
import { resolveProjectPath, aliasToProjectPath } from '../utils/paths.js';
import { diffComponentFiles } from '../core/diff-core.js';
import { performInstall } from '../core/install.js';
import { type AddOptions } from '../core/plan.js';

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

export async function update(names: string[], options: AddOptions): Promise<void> {
    const cwd = process.cwd();
    const config = await getConfig(cwd);
    if (!config) {
        console.log(chalk.red('Error: components.json not found.'));
        console.log(chalk.dim('Run `npx @gilav21/shadcn-angular init` first.'));
        process.exit(1);
    }
    if (!options.registry && config.registry) options.registry = config.registry;

    let targets: ComponentName[];
    try {
        targets = await resolveUpdateTargets(names, cwd, config);
    } catch (e: unknown) {
        console.log(chalk.red(e instanceof Error ? e.message : String(e)));
        process.exit(1);
    }
    if (targets.length === 0) {
        console.log(chalk.dim('No installed components to update.'));
        return;
    }

    const targetDir = resolveProjectPath(cwd, aliasToProjectPath(config.aliases.ui || 'src/components/ui'));
    const utilsAlias = config.aliases.utils;

    const spinner = ora('Checking for updates...').start();
    const changed: ComponentName[] = [];
    for (const name of targets) {
        const cd = await diffComponentFiles(name, targetDir, options, utilsAlias);
        if (cd.hasChanges) changed.push(name);
    }
    spinner.stop();

    if (changed.length === 0) {
        console.log(chalk.green('Everything is up to date.'));
        return;
    }

    console.log(chalk.bold(`\n${changed.length} component(s) have updates:`));
    for (const name of changed) console.log(chalk.yellow('  ~ ') + name);

    if (options.dryRun) {
        console.log(chalk.dim('\n[Dry Run] No changes written.'));
        return;
    }

    const result = await performInstall({
        components: changed,
        overwrite: changed,
        cwd, config,
        options: { ...options, overwrite: true },
    });
    console.log(chalk.green(`\nUpdated ${result.installed.length} component(s).`));
    for (const w of result.warnings) console.log(chalk.yellow('  ' + w));
}
