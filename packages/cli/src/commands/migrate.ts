import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'fs-extra';
import chalk from 'chalk';
import ora from 'ora';
import { getConfig, getPrefix } from '../utils/config.js';
import { registry, type ComponentName } from '../registry/index.js';
import { resolveProjectPath, aliasToProjectPath } from '../utils/paths.js';
import { scanLayouts } from '../core/layout.js';
import { resolveDependencies } from '../core/resolve.js';
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
    if (gitTreeClean(cwd)) return;
    if (options.force) {
        console.log(chalk.yellow('\n--force: proceeding on an unclean working tree.'));
        console.log(chalk.dim('Uncommitted changes to migrated files have no git backstop and may be overwritten.'));
        return;
    }
    console.log(chalk.red('\nYour git working tree is not clean (or this is not a git repo).'));
    console.log(chalk.dim('Commit or stash first so the migration is one reviewable diff, or pass --force.'));
    process.exit(1);
}

async function fileIsModified(manifest: Manifest, uiDir: string, rel: string): Promise<boolean> {
    const p = path.join(uiDir, rel);
    if (!await fs.pathExists(p)) return false;
    return fileStatus(manifest, rel, await fs.readFile(p, 'utf-8')) === 'modified';
}

async function folderComponentEdited(manifest: Manifest, uiDir: string, name: ComponentName): Promise<boolean> {
    for (const rel of registry[name].files) {
        if (await fileIsModified(manifest, uiDir, rel)) return true;
    }
    return false;
}

/**
 * Components migrate would overwrite that have local edits vs the manifest
 * baseline: legacy components (flat `<name>.component.ts`) and the already-
 * folder deps it refreshes. Legacy consumers with no manifest yield none — the
 * clean-git guard is their backstop.
 */
async function customizedComponents(
    cwd: string, uiDir: string, plan: MigrationPlan,
): Promise<ComponentName[]> {
    const manifest = await readManifest(cwd);
    const out: ComponentName[] = [];
    for (const name of plan.structural) {
        if (await fileIsModified(manifest, uiDir, `${name}.component.ts`)) out.push(name);
    }
    for (const name of plan.refreshed) {
        if (await folderComponentEdited(manifest, uiDir, name)) out.push(name);
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
    if (plan.refreshed.length) console.log(chalk.dim('  Refresh required deps: ') + plan.refreshed.join(', '));
    if (plan.untouched.length) {
        console.log(chalk.dim('  Left as-is (run `update` to refresh): ') + plan.untouched.join(', '));
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

    // migrate writes the legacy set's dependency closure (plan.writeSet):
    // legacy components → folder, plus the deps they need (refreshed/installed)
    // so nothing calls a newer API on a stale dep. Precompute conflicts over
    // exactly this set so performInstall does NOT re-resolve and pull in
    // unrelated installed components. `overwrite: true` refreshes shared lib
    // files for the written set.
    const conflicts = await detectConflicts(
        new Set(plan.writeSet), uiDir, options, config.aliases.utils, getPrefix(config),
    );
    const result = await performInstall({
        components: plan.writeSet,
        overwrite: plan.writeSet,
        cwd, config,
        options: { ...options, overwrite: true },
        precomputedConflicts: conflicts,
    });
    const installed = new Set(result.installed);
    // "Present" = written this run OR skipped because already up-to-date. A
    // dependency that was identical is skipped (not in `installed`) yet is on
    // disk and fine, so it must count toward closure-consistency.
    const present = new Set<ComponentName>([...result.installed, ...result.skipped as ComponentName[]]);

    // Roll back partially-written NEW folders (legacy→folder + brand-new deps
    // that didn't fully write) so a mid-stream failure can't leave an orphan
    // folder with a dangling templateUrl. Pre-existing (refreshed) folders are
    // left to the git guard — we can't restore their prior content.
    await rollbackPartialNewFolders(uiDir, plan, installed);

    // Finalize (delete flat + rewrite imports) ONLY for legacy components whose
    // folder AND every in-writeSet dependency are present — otherwise the
    // working flat file and its imports are kept intact.
    const migratedOk = plan.structural.filter(n => closureWritten(n, plan, present));
    const failed = plan.structural.filter(n => !closureWritten(n, plan, present));

    const deleted = await deleteLegacyFiles(uiDir, migratedOk);
    const manifest = await readManifest(cwd);
    removeFiles(manifest, deleted);
    await writeManifest(cwd, manifest);

    // rewriteProjectImports scans every project file INCLUDING the ui dir,
    // because a pre-existing folder component can import a now-migrated sibling
    // via the old flat path (`../button.component`). Each rewrite is scoped to
    // specifiers that resolve to <uiDir>/<name>.component, so a component's own
    // barrel self-reference and a consumer file sharing a library name are both
    // left untouched.
    const rewritten = await rewriteProjectImports(cwd, new Set(migratedOk), uiDir, config.aliases.ui);

    spinner.stop();
    printReport(result, deleted, rewritten, plan);
    if (failed.length > 0) {
        console.log(chalk.red(`\n${failed.length} component(s) could not be migrated and were left as legacy: ${failed.join(', ')}`));
        console.log(chalk.dim('Their flat files and imports are untouched. Fix the errors above and re-run `migrate`.'));
    }
}

/** A legacy component is safe to finalize only if it and all of its
 * in-writeSet dependencies are present (written or already up-to-date). */
export function closureWritten(name: ComponentName, plan: MigrationPlan, present: Set<ComponentName>): boolean {
    const inWriteSet = new Set(plan.writeSet);
    return [...resolveDependencies([name])].every(d => !inWriteSet.has(d) || present.has(d));
}

/** Remove any partially-written folder for a NEW component (structural or a
 * brand-new dep) that did not fully install, restoring the pre-migrate state. */
async function rollbackPartialNewFolders(
    uiDir: string, plan: MigrationPlan, installed: Set<ComponentName>,
): Promise<void> {
    for (const name of new Set<ComponentName>([...plan.structural, ...plan.newDeps])) {
        if (!installed.has(name)) await fs.remove(path.join(uiDir, name));
    }
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
    const plan = planMigration(await scanLayouts(uiDir, getPrefix(config)));

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

    const customized = await customizedComponents(cwd, uiDir, plan);
    if (customized.length > 0 && !options.yes) blockOnCustomized(customized);

    printMigrationPlan(plan);

    await executeMigration(plan, cwd, uiDir, config, options);
}
