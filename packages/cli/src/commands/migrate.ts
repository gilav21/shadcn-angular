import chalk from 'chalk';
import ora from 'ora';
import { getConfig } from '../utils/config.js';
import { type ComponentName } from '../registry/index.js';
import {
    migrateCore,
    gitTreeClean,
    type MigrationExecution,
    type MigrationPlan,
} from '../core/migrate-core.js';
import { type AddOptions } from '../core/plan.js';

export { closureWritten } from '../core/migrate-core.js';

/** Warm, customer-first listing of components migrate protected or deferred. */
function printProtectedGroups(plan: MigrationPlan): void {
    if (plan.customized.length) {
        console.log(chalk.cyan('\nWe spotted changes you made and kept these exactly as they are:'));
        for (const n of plan.customized) console.log(chalk.cyan('  • ') + n);
        console.log(chalk.dim(
            `  When you're ready, migrate one at your own pace — back it up, run\n` +
            `  \`npx @gilav21/shadcn-angular add <name> --overwrite\`, then re-apply your tweaks.`,
        ));
    }
    if (plan.blocked.length) {
        console.log(chalk.cyan('\nHeld back for now (these build on a component you customized):'));
        for (const n of plan.blocked) console.log(chalk.cyan('  • ') + n);
        console.log(chalk.dim('  They\'ll migrate cleanly once you\'ve migrated the component above.'));
    }
}

function printMigrationPlan(plan: MigrationPlan): void {
    if (plan.structural.length === 0) return; // nothing-migratable is reported separately
    console.log(chalk.bold('\nMigration plan:'));
    console.log(chalk.dim('  Convert to folder layout: ') + plan.structural.join(', '));
    if (plan.newDeps.length) console.log(chalk.dim('  Install new dependencies: ') + plan.newDeps.join(', '));
    if (plan.refreshed.length) console.log(chalk.dim('  Refresh required deps: ') + plan.refreshed.join(', '));
    if (plan.untouched.length) {
        console.log(chalk.dim('  Left as-is (run `update` to refresh): ') + plan.untouched.join(', '));
    }
}

function printReport(execution: MigrationExecution, plan: MigrationPlan): void {
    const { result, deleted, rewritten, editedRefreshed } = execution;
    console.log(chalk.green(`\n✓ Migrated ${result.installed.length} component(s) to the folder layout.`));
    console.log(chalk.dim(`  Updated imports in ${rewritten.length} file(s); removed ${deleted.length} legacy file(s).`));
    if (plan.newDeps.length) console.log(chalk.dim(`  Pulled new dependencies: ${plan.newDeps.join(', ')}`));
    printProtectedGroups(plan);
    if (editedRefreshed.length) {
        console.log(chalk.yellow('\nRefreshed these shared dependencies — if you tweaked them, re-check after:'));
        for (const n of editedRefreshed) console.log(chalk.yellow('  • ') + n);
    }
    for (const w of result.warnings) console.log(chalk.yellow('  ' + w));
    console.log(chalk.cyan('\nAll set. Next: review with `git diff`, then `ng build` to confirm.'));
}

function printFailed(failed: ComponentName[]): void {
    if (failed.length === 0) return;
    console.log(chalk.red(`\n${failed.length} component(s) could not be migrated and were left as legacy: ${failed.join(', ')}`));
    console.log(chalk.dim('Their flat files and imports are untouched. Fix the errors above and re-run `migrate`.'));
}

/** First-migration heads-up: the lock file only exists AFTER this run, so the
 *  clean-git tree is the safety net for anything our hashes can't recognize. */
function printBackupNotice(): void {
    console.log(chalk.bold('\nBefore we start:'));
    console.log(chalk.dim(
        '  We use our published release fingerprints to recognize the components you\n' +
        '  customized and leave them untouched. We also require a clean git tree, so every\n' +
        '  change here lands as one reviewable, revertible diff — your safety net.',
    ));
}

/** Nothing could be auto-migrated (every legacy component is customized or
 *  depends on one). Reassure and point at the manual path — never an error. */
function reportNothingMigratable(plan: MigrationPlan): void {
    console.log(chalk.green('\nEverything here is yours — nothing to migrate automatically.'));
    printProtectedGroups(plan);
    console.log(chalk.cyan('\nMigrate any of the above whenever you like; your code is left exactly as-is.'));
}

function printForceNotice(): void {
    console.log(chalk.yellow('\n--force: proceeding on an unclean working tree.'));
    console.log(chalk.dim('Uncommitted changes to migrated files have no git backstop and may be overwritten.'));
}

function reportUncleanTree(): void {
    console.log(chalk.red('\nYour git working tree is not clean (or this is not a git repo).'));
    console.log(chalk.dim('Commit or stash first so the migration is one reviewable diff, or pass --force.'));
    process.exit(1);
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

    const spinner = ora();
    const outcome = await migrateCore(cwd, config, options, {
        onBeforeExecute: (plan) => {
            if (options.force && !gitTreeClean(cwd)) printForceNotice();
            printBackupNotice();
            printMigrationPlan(plan);
            spinner.start('Migrating...');
        },
    });
    spinner.stop();

    if (outcome.status === 'nothing-to-migrate') {
        console.log(chalk.green('Nothing to migrate — no legacy single-file components found.'));
        return;
    }
    if (outcome.status === 'dry-run') {
        printMigrationPlan(outcome.plan);
        printProtectedGroups(outcome.plan);
        console.log(chalk.dim('\n[Dry Run] No changes written.'));
        return;
    }
    if (outcome.status === 'nothing-migratable') {
        reportNothingMigratable(outcome.plan);
        return;
    }
    if (outcome.status === 'unclean-tree') {
        reportUncleanTree();
        return;
    }
    if (outcome.execution) {
        printReport(outcome.execution, outcome.plan);
        printFailed(outcome.execution.failed);
    }
}
