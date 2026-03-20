import fs from 'fs-extra';
import path from 'node:path';
import chalk from 'chalk';
import { getConfig } from '../utils/config.js';
import { registry, getComponentNames, type ComponentName } from '../registry/index.js';
import { resolveProjectPath, aliasToProjectPath } from '../utils/paths.js';
import { fetchAndTransform, normalizeContent } from './add.js';

interface DiffOptions {
    branch: string;
    remote?: boolean;
    registry?: string;
}

function formatLineDiff(localLine: string | undefined, remoteLine: string | undefined): string[] {
    if (localLine !== undefined && remoteLine !== undefined) {
        return [chalk.red(`- ${localLine}`), chalk.green(`+ ${remoteLine}`)];
    }
    if (localLine === undefined) {
        return [chalk.green(`+ ${remoteLine}`)];
    }
    return [chalk.red(`- ${localLine}`)];
}

export function formatUnifiedDiff(fileName: string, localContent: string, remoteContent: string): string {
    const localLines = localContent.split('\n');
    const remoteLines = remoteContent.split('\n');
    const output: string[] = [
        chalk.bold(`--- local/${fileName}`),
        chalk.bold(`+++ remote/${fileName}`),
    ];

    const maxLines = Math.max(localLines.length, remoteLines.length);
    let diffFound = false;

    for (let i = 0; i < maxLines; i++) {
        const localLine = localLines[i];
        const remoteLine = remoteLines[i];

        if (localLine === remoteLine) continue;

        diffFound = true;
        output.push(chalk.cyan(`@@ line ${i + 1} @@`), ...formatLineDiff(localLine, remoteLine));
    }

    return diffFound ? output.join('\n') : '';
}

async function diffFile(
    file: string,
    targetDir: string,
    options: DiffOptions,
    utilsAlias: string,
): Promise<string | null> {
    const targetPath = path.join(targetDir, file);
    if (!await fs.pathExists(targetPath)) return null;

    try {
        const localContent = normalizeContent(await fs.readFile(targetPath, 'utf-8'));
        const remoteContent = normalizeContent(
            await fetchAndTransform(file, { branch: options.branch, remote: options.remote, registry: options.registry }, utilsAlias),
        );

        if (localContent === remoteContent) return null;

        const diffOutput = formatUnifiedDiff(file, localContent, remoteContent);
        return diffOutput || null;
    } catch {
        return chalk.yellow(`  Could not fetch remote version of ${file}`);
    }
}

async function diffComponent(
    name: ComponentName,
    targetDir: string,
    options: DiffOptions,
    utilsAlias: string,
): Promise<string[]> {
    const component = registry[name];
    const fileDiffs: string[] = [];

    for (const file of component.files) {
        const result = await diffFile(file, targetDir, options, utilsAlias);
        if (result) fileDiffs.push(result);
    }

    return fileDiffs;
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

        const fileDiffs = await diffComponent(name, targetDir, options, utilsAlias);
        if (fileDiffs.length > 0) {
            totalDiffs++;
            console.log(chalk.bold.cyan(`\n${name}:`));
            for (const d of fileDiffs) console.log(d);
        }
    }

    if (totalDiffs === 0) {
        console.log(chalk.green('\nAll installed components are up to date.'));
    } else {
        console.log(chalk.dim(`\n${totalDiffs} component(s) have differences.`));
    }
}
