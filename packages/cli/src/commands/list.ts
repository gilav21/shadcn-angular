import fs from 'fs-extra';
import path from 'node:path';
import chalk from 'chalk';
import { getConfig, getBlocksAlias } from '../utils/config.js';
import { registry, getComponentNames, type ComponentName } from '../registry/index.js';
import { resolveProjectPath, aliasToProjectPath } from '../utils/paths.js';

interface ComponentStatus {
    readonly name: string;
    readonly installed: boolean;
}

async function buildStatuses(names: readonly ComponentName[], targetDir: string): Promise<ComponentStatus[]> {
    const statuses: ComponentStatus[] = [];
    for (const name of names) {
        statuses.push({ name, installed: await allFilesExist(registry[name].files, targetDir) });
    }
    return statuses;
}

/** Dim `(addon of <parent>)` suffix for addon entries; '' for everything else. */
function addonSuffix(name: string): string {
    const def = registry[name as ComponentName];
    if (def?.type !== 'addon') return '';
    return chalk.dim(` (addon of ${def.parent})`);
}

function printStatusGroup(heading: string, statuses: ComponentStatus[]): void {
    const installed = statuses.filter(s => s.installed).sort((a, b) => a.name.localeCompare(b.name));
    const notInstalled = statuses.filter(s => !s.installed).sort((a, b) => a.name.localeCompare(b.name));

    console.log(chalk.bold(`\n${heading} — installed (${installed.length}):`));
    if (installed.length === 0) {
        console.log(chalk.dim('  None'));
    } else {
        for (const s of installed) console.log(chalk.green('  ✓ ') + s.name + addonSuffix(s.name));
    }

    console.log(chalk.bold(`\n${heading} — available (${notInstalled.length}):`));
    for (const s of notInstalled) console.log(chalk.dim('  - ') + s.name + addonSuffix(s.name));
}

export async function list(): Promise<void> {
    const cwd = process.cwd();

    const config = await getConfig(cwd);
    if (!config) {
        console.log(chalk.red('Error: components.json not found.'));
        console.log(chalk.dim('Run `npx @gilav21/shadcn-angular init` first.'));
        process.exit(1);
    }

    const componentDir = resolveProjectPath(cwd, aliasToProjectPath(config.aliases.ui || 'src/components/ui'));
    const blocksDir = resolveProjectPath(cwd, aliasToProjectPath(getBlocksAlias(config)));

    const allNames = getComponentNames();
    const componentNames = allNames.filter(n => registry[n].type !== 'block');
    const blockNames = allNames.filter(n => registry[n].type === 'block');

    printStatusGroup('Components', await buildStatuses(componentNames, componentDir));
    if (blockNames.length > 0) {
        printStatusGroup('Blocks', await buildStatuses(blockNames, blocksDir));
    }

    console.log('');
}

async function allFilesExist(files: readonly string[], targetDir: string): Promise<boolean> {
    for (const file of files) {
        if (!await fs.pathExists(path.join(targetDir, file))) {
            return false;
        }
    }
    return true;
}
