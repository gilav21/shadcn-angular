import chalk from 'chalk';
import { formatMergeSummary, hasUnresolvedConflicts, type MergeReport } from '../core/merge.js';
import type { InstallFailure } from '../core/install.js';
import type { UncheckedComponent } from '../core/plan.js';

/**
 * Print the per-file merge summary (shared by `add`, `update` and `apply`).
 * Returns whether unresolved conflict markers were written — the caller fails
 * the command in non-interactive runs so a pipeline notices.
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

/**
 * `add` reports a merge only when one actually happened (merged, merged with
 * conflicts, or kept an edited file): a plain install would otherwise print an
 * "Added: N" block after every run.
 */
export function reportMergeIfMerged(report: MergeReport): void {
    if (report.mergedClean.length + report.mergedConflicted.length + report.fellBack.length === 0) return;
    reportMergeSummary(report);
}

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

const PROJECT_WIDE_LABEL: Readonly<Record<string, string>> = {
    npm: 'npm install',
    lockfile: 'components.lock.json',
};

const FILE_STAGES: ReadonlySet<string> = new Set(['component', 'peer', 'test']);

/** What a failure is about, for the report: its file, else the project-wide step. */
function failureLabel(failure: InstallFailure): string {
    return failure.file ?? PROJECT_WIDE_LABEL[failure.stage] ?? failure.stage;
}

/** List every recorded failure. Prints nothing for an empty list. */
export function printFailures(failures: readonly InstallFailure[]): void {
    if (failures.length === 0) return;
    console.log(chalk.red('\nFailed:'));
    for (const f of failures) console.log(chalk.red(`  - ${failureLabel(f)} — ${f.message}`));
    if (failures.some(f => FILE_STAGES.has(f.stage))) {
        console.log(chalk.red('These components were NOT recorded as updated; re-run when the cause is fixed.'));
    }
}

/**
 * Nobody can resolve a prompt or a conflict marker when the run is unattended:
 * `--yes`, or stdin that is not a terminal (piped / CI).
 */
export function isNonInteractive(env: { readonly yes?: boolean; readonly isTTY: boolean }): boolean {
    return env.yes === true || !env.isTTY;
}

/** What a finished run leaves unresolved; any problem fails the command. */
export interface RunOutcome {
    readonly unchecked?: readonly UncheckedComponent[];
    readonly failures?: readonly InstallFailure[];
    /** The run wrote conflict markers. Only fatal when unattended. */
    readonly hadConflicts?: boolean;
}

/**
 * Exit 1 when the run did not fully complete: a component could not be
 * checked, a file/lib/npm/lockfile step failed, or conflict markers were
 * written with nobody there to see them. Call it after the run's own report is
 * printed. An interactive run that merely wrote markers keeps exit 0 — the
 * developer saw the red warning and can resolve them.
 */
export function exitIfIncomplete(outcome: RunOutcome, options: { readonly yes?: boolean } = {}): void {
    const incomplete = (outcome.unchecked?.length ?? 0) > 0 || (outcome.failures?.length ?? 0) > 0;
    const unattendedMarkers = outcome.hadConflicts === true
        && isNonInteractive({ yes: options.yes, isTTY: !!process.stdin.isTTY });
    if (incomplete || unattendedMarkers) process.exit(1);
}
