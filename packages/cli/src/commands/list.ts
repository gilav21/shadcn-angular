import fs from 'fs-extra';
import path from 'node:path';
import chalk from 'chalk';
import { getConfig } from '../utils/config.js';
import { registry, getComponentNames } from '../registry/index.js';
import { resolveProjectPath, aliasToProjectPath } from '../utils/paths.js';

type Status = 'installed' | 'not installed';

interface ComponentStatus {
    readonly name: string;
    readonly status: Status;
}

export async function list() {
    const cwd = process.cwd();

    const config = await getConfig(cwd);
    if (!config) {
        console.log(chalk.red('Error: components.json not found.'));
        console.log(chalk.dim('Run `npx @gilav21/shadcn-angular init` first.'));
        process.exit(1);
    }

    const uiBasePath = aliasToProjectPath(config.aliases.ui || 'src/components/ui');
    const targetDir = resolveProjectPath(cwd, uiBasePath);

    const statuses: ComponentStatus[] = [];

    for (const name of getComponentNames()) {
        const component = registry[name];
        const allPresent = await allFilesExist(component.files, targetDir);
        statuses.push({
            name,
            status: allPresent ? 'installed' : 'not installed',
        });
    }

    const installed = statuses.filter(s => s.status === 'installed').sort((a, b) => a.name.localeCompare(b.name));
    const notInstalled = statuses.filter(s => s.status === 'not installed').sort((a, b) => a.name.localeCompare(b.name));

    console.log(chalk.bold(`\nInstalled (${installed.length}):`));
    if (installed.length === 0) {
        console.log(chalk.dim('  None'));
    } else {
        for (const s of installed) {
            console.log(chalk.green('  ✓ ') + s.name);
        }
    }

    console.log(chalk.bold(`\nAvailable (${notInstalled.length}):`));
    for (const s of notInstalled) {
        console.log(chalk.dim('  - ') + s.name);
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
