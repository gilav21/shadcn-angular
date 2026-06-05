import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'fs-extra';
import chalk from 'chalk';
import ora from 'ora';
import { getConfig, getPrefix } from '../utils/config.js';
import { type ComponentName } from '../registry/index.js';
import { resolveProjectPath, aliasToProjectPath } from '../utils/paths.js';
import { scanLayouts } from '../core/layout.js';
import { planMigration, rewriteProjectImports, deleteLegacyFiles, type MigrationPlan } from '../core/migrate-core.js';
import { performInstall, type InstallResult } from '../core/install.js';
import { readManifest, fileStatus, removeFiles, writeManifest, type Manifest } from '../core/manifest.js';
import { detectConflicts, type AddOptions } from '../core/plan.js';

function gitTreeClean(cwd: string): boolean {
    try {
        // Scope to the project dir (`-- .`) so an unrelated dirty file elsewhere
        // in a monorepo doesn't refuse a clean app subdir.
        return execSync('git status --porcelain -- .', { cwd, encoding: 'utf-8' }).trim() === '';
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

async function fileIsModified(manifest: Manifest, uiDir: string, rel: string): Promise<boolean> {
    const p = path.join(uiDir, rel);
    if (!await fs.pathExists(p)) return false;
    return fileStatus(manifest, rel, await fs.readFile(p, 'utf-8')) === 'modified';
}

/**
 * Legacy components migrate would overwrite that have local edits vs the
 * manifest baseline. (Already-folder components are left untouched, so they
 * can't be clobbered.) Legacy consumers with no manifest yield none — the
 * clean-git guard is their backstop.
 */
async function customizedComponents(
    cwd: string, uiDir: string, structural: ComponentName[],
): Promise<ComponentName[]> {
    const manifest = await readManifest(cwd);
    const out: ComponentName[] = [];
    for (const name of structural) {
        if (await fileIsModified(manifest, uiDir, `${name}.component.ts`)) out.push(name);
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
    if (plan.newDeps.length) console.log(chalk.dim('  Install new dependencies: ') + plan.newDeps.join(', '));
    if (plan.refresh.length) {
        console.log(chalk.dim('  Left as-is (run `update` to refresh): ') + plan.refresh.join(', '));
    }
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

    // Only the legacy components (→ folder) and newly-required deps are written.
    // Already-folder components are deliberately left untouched. Precompute
    // conflicts over exactly this set so performInstall does NOT re-resolve the
    // dependency closure and overwrite installed components the user didn't ask
    // to change. `overwrite: true` still refreshes shared lib files for the
    // written set.
    const writeSet = [...new Set<ComponentName>([...plan.structural, ...plan.newDeps])];
    const conflicts = await detectConflicts(
        new Set(writeSet), uiDir, options, config.aliases.utils, getPrefix(config),
    );
    const result = await performInstall({
        components: writeSet,
        overwrite: writeSet,
        cwd, config,
        options: { ...options, overwrite: true },
        precomputedConflicts: conflicts,
    });

    const deleted = await deleteLegacyFiles(uiDir, plan.structural);
    const manifest = await readManifest(cwd);
    removeFiles(manifest, deleted);
    await writeManifest(cwd, manifest);

    // Rewrite consumer imports of the migrated components. rewriteProjectImports
    // skips uiDir (the components' own barrels) and is scoped so only imports
    // resolving to <uiDir>/<name>.component are touched.
    const rewritten = await rewriteProjectImports(cwd, plan.migratedNames, uiDir, config.aliases.ui);

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

    if (options.dryRun) {
        printMigrationPlan(plan);
        console.log(chalk.dim('\n[Dry Run] No changes written.'));
        return;
    }

    ensureCleanTreeOrExit(cwd, options);

    const customized = await customizedComponents(cwd, uiDir, plan.structural);
    if (customized.length > 0 && !options.yes) blockOnCustomized(customized);

    printMigrationPlan(plan);

    await executeMigration(plan, cwd, uiDir, config, options);
}
