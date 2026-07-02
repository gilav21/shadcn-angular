import chalk from 'chalk';
import { formatMergeSummary, hasUnresolvedConflicts, type MergeReport } from '../core/merge.js';

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
