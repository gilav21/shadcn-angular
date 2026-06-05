import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'fs-extra';
import chalk from 'chalk';
import ora from 'ora';
import { getConfig } from '../utils/config.js';
import { type ComponentName } from '../registry/index.js';
import { resolveProjectPath, aliasToProjectPath } from '../utils/paths.js';
import { scanLayouts } from '../core/layout.js';
import { planMigration, rewriteProjectImports, deleteLegacyFiles, type MigrationPlan } from '../core/migrate-core.js';
import { performInstall, type InstallResult } from '../core/install.js';
import { readManifest, fileStatus, removeFiles, writeManifest } from '../core/manifest.js';
import { type AddOptions } from '../core/plan.js';

function gitTreeClean(cwd: string): boolean {
    try {
        return execSync('git status --porcelain', { cwd, encoding: 'utf-8' }).trim() === '';
    } catch {
        // Not a git repo, or git is unavailable — treat as "not clean".
        return false;
    }
}

function ensureCleanTreeOrExit(cwd: string, options: AddOptions): void {
    if (options.force || gitTreeClean(cwd)) return;
    console.log(chalk.red('\nYour git working tree is not clean (or this is not a git repo).'));
    console.log(chalk.dim('Commit or stash first so the migration is one reviewable diff, or pass --force.'));
    process.exit(1);
}

/** Structural components whose legacy flat file was edited vs the manifest baseline. */
async function customizedComponents(
    cwd: string, uiDir: string, structural: ComponentName[],
): Promise<ComponentName[]> {
    const manifest = await readManifest(cwd);
    const out: ComponentName[] = [];
    for (const name of structural) {
        const legacy = `${name}.component.ts`;
        const p = path.join(uiDir, legacy);
        if (!await fs.pathExists(p)) continue;
        if (fileStatus(manifest, legacy, await fs.readFile(p, 'utf-8')) === 'modified') out.push(name);
    }
    return out;
}

function blockOnCustomized(customized: ComponentName[]): void {
    console.log(chalk.yellow('\nThese components have local edits and would be overwritten:'));
    for (const n of customized) console.log(chalk.yellow('  ~ ') + n);
    console.log(chalk.dim('\nBack them up, then re-run with --yes to proceed.'));
    process.exit(1);
}

function printMigrationPlan(plan: MigrationPlan): void {
    console.log(chalk.bold('\nMigration plan:'));
    console.log(chalk.dim('  Convert to folder layout: ') + plan.structural.join(', '));
    if (plan.refresh.length) console.log(chalk.dim('  Refresh: ') + plan.refresh.join(', '));
    if (plan.newDeps.length) console.log(chalk.dim('  New dependencies: ') + plan.newDeps.join(', '));
}

function printReport(
    result: InstallResult, deleted: string[], rewritten: string[], plan: MigrationPlan,
): void {
    console.log(chalk.green(`\nMigrated ${result.installed.length} component(s).`));
    console.log(chalk.dim(`  Deleted ${deleted.length} legacy file(s).`));
    console.log(chalk.dim(`  Rewrote imports in ${rewritten.length} file(s).`));
    if (plan.newDeps.length) console.log(chalk.dim(`  Installed deps: ${plan.newDeps.join(', ')}`));
    for (const w of result.warnings) console.log(chalk.yellow('  ' + w));
    console.log(chalk.cyan('\nNext: run `ng build` to verify, then review with `git diff`.'));
}

async function executeMigration(
    plan: MigrationPlan, cwd: string, uiDir: string,
    config: NonNullable<Awaited<ReturnType<typeof getConfig>>>, options: AddOptions,
): Promise<void> {
    const spinner = ora('Migrating...').start();

    const writeSet = [...new Set<ComponentName>([...plan.structural, ...plan.refresh, ...plan.newDeps])];
    const result = await performInstall({
        components: writeSet,
        overwrite: writeSet,
        cwd, config,
        options: { ...options, overwrite: true },
    });

    const deleted = await deleteLegacyFiles(uiDir, plan.structural);
    const manifest = await readManifest(cwd);
    removeFiles(manifest, deleted);
    await writeManifest(cwd, manifest);

    const rewritten = await rewriteProjectImports(cwd, plan.migratedNames);

    spinner.stop();
    printReport(result, deleted, rewritten, plan);
}

export async function migrate(options: AddOptions): Promise<void> {
    const cwd = process.cwd();
    const config = await getConfig(cwd);
    if (!config) {
        console.log(chalk.red('Error: components.json not found.'));
        console.log(chalk.dim('Run `npx @gilav21/shadcn-angular init` first.'));
        process.exit(1);
    }
    if (!options.registry && config.registry) options.registry = config.registry;

    const uiDir = resolveProjectPath(cwd, aliasToProjectPath(config.aliases.ui || 'src/components/ui'));
    const plan = planMigration(await scanLayouts(uiDir));

    if (plan.structural.length === 0) {
        console.log(chalk.green('Nothing to migrate — no legacy single-file components found.'));
        return;
    }

    if (!options.dryRun) ensureCleanTreeOrExit(cwd, options);

    const customized = await customizedComponents(cwd, uiDir, plan.structural);
    if (customized.length > 0 && !options.yes) blockOnCustomized(customized);

    printMigrationPlan(plan);
    if (options.dryRun) {
        console.log(chalk.dim('\n[Dry Run] No changes written.'));
        return;
    }

    await executeMigration(plan, cwd, uiDir, config, options);
}
