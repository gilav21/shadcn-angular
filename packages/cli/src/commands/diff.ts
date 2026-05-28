import chalk from 'chalk';
import { getConfig } from '../utils/config.js';
import { registry, getComponentNames, type ComponentName } from '../registry/index.js';
import { resolveProjectPath, aliasToProjectPath } from '../utils/paths.js';
import { diffComponentFiles } from '../core/diff-core.js';

interface DiffOptions {
    branch: string;
    remote?: boolean;
    registry?: string;
}

/** Re-apply the CLI's colors to the plain unified diff produced by core. */
function colorizeDiff(diff: string): string {
    return diff.split('\n').map(line => {
        if (line.startsWith('--- ') || line.startsWith('+++ ')) return chalk.bold(line);
        if (line.startsWith('@@')) return chalk.cyan(line);
        if (line.startsWith('-')) return chalk.red(line);
        if (line.startsWith('+')) return chalk.green(line);
        return line;
    }).join('\n');
}

export async function diff(components: string[], options: DiffOptions) {
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

    const uiBasePath = aliasToProjectPath(config.aliases.ui || 'src/components/ui');
    const targetDir = resolveProjectPath(cwd, uiBasePath);
    const utilsAlias = config.aliases.utils;

    const names = components.length > 0
        ? components as ComponentName[]
        : getComponentNames();

    let totalDiffs = 0;

    for (const name of names) {
        if (!(name in registry)) {
            console.log(chalk.red(`Unknown component: ${name}`));
            continue;
        }

        const cd = await diffComponentFiles(
            name, targetDir,
            { branch: options.branch, remote: options.remote, registry: options.registry },
            utilsAlias,
        );

        if (cd.hasChanges) {
            totalDiffs++;
            console.log(chalk.bold.cyan(`\n${name}:`));
            for (const f of cd.files) {
                if (f.diff) console.log(colorizeDiff(f.diff));
                if (f.error) console.log(chalk.yellow(`  Could not fetch remote version of ${f.file}`));
            }
        }
    }

    if (totalDiffs === 0) {
        console.log(chalk.green('\nAll installed components are up to date.'));
    } else {
        console.log(chalk.dim(`\n${totalDiffs} component(s) have differences.`));
    }
}
