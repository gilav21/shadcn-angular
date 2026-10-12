import chalk from 'chalk';
import { formatMergeSummary, hasUnresolvedConflicts, type MergeReport } from '../core/merge.js';
import type { UncheckedComponent } from '../core/plan.js';

/**
 * List the components whose upstream could not be fetched. They were not
 * compared, offered or written; the caller exits non-zero after its own report
 * (see {@link exitIfIncomplete}). Prints nothing for an empty list.
 */
export function printUnchecked(unchecked: readonly UncheckedComponent[]): void {
    if (unchecked.length === 0) return;
    console.log(chalk.red('\nCould not check (registry unreachable) — nothing was written for these:'));
    for (const u of unchecked) console.log(chalk.red(`  - ${u.name}: ${u.reason}`));
    console.log(chalk.red(`✖ ${unchecked.length} component(s) could not be checked.`));
}

/** What a finished run leaves unresolved; any non-empty field fails the command. */
export interface RunOutcome {
    readonly unchecked?: readonly UncheckedComponent[];
}

/** Exit 1 when the run did not fully complete. Call it after the run's own report is printed. */
export function exitIfIncomplete(outcome: RunOutcome): void {
    if ((outcome.unchecked?.length ?? 0) > 0) process.exit(1);
}

/**
 * Print the per-file merge summary (shared by `update` and `apply`). Returns
 * whether unresolved conflict markers were written — the caller fails the
 * command in non-interactive runs so a pipeline notices.
 */
export function reportMergeSummary(report: MergeReport): boolean {
    const lines = formatMergeSummary(report);
    if (lines.length > 0) {
        console.log(chalk.bold('\nMerge summary (files):'));
        for (const line of lines) {
            const color = line.includes('!') ? chalk.red : chalk.dim;
            console.log(color('  ' + line));
        }
    }
    if (hasUnresolvedConflicts(report)) {
        console.log(chalk.red('\n⚠ Conflict markers (<<<<<<< / ======= / >>>>>>>) were written — resolve them, then build.'));
        return true;
    }
    return false;
}
