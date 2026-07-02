import fs from 'fs-extra';
import path from 'node:path';
import { merge3 } from './merge3.js';
import { fetchAtRef } from './ref.js';
import { type FetchOptions, type SourceKind } from './fetch.js';
import {
    fileStatus, recordFile, getComponentRef, hashContent, type Manifest,
} from './manifest.js';

/**
 * The per-file write decision at the heart of non-destructive update. Each file
 * the CLI is about to write in an overwrite-capable path runs through
 * {@link classifyMerge}: unedited files fast-path to the upstream version,
 * edited files 3-way merge against their recorded baseline, and when no
 * baseline is available it falls back to today's keep/overwrite behavior.
 */

export type MergeOutcome =
    | 'created' // file was absent → wrote THEIRS
    | 'skipped' // OURS already equals THEIRS
    | 'refreshed' // unedited (OURS == BASE) → wrote THEIRS, no edits to lose
    | 'overwritten' // forced whole-file write of an edited file (--overwrite)
    | 'merged-clean' // 3-way merged, no conflicts
    | 'merged-conflict' // 3-way merged WITH git conflict markers
    | 'fellback-kept'; // edited + no BASE + not forced → kept OURS, warn

export interface MergeInputs {
    /** Current on-disk content, or `null` when the file does not exist. */
    readonly ours: string | null;
    /** The version we want to bring the file up to (current branch/ref). */
    readonly theirs: string;
    /** Content at the recorded ref, or `null` when unavailable (→ fallback). */
    readonly base: string | null;
    /** OURS is byte-identical to the recorded baseline (unedited). */
    readonly isClean: boolean;
    /** `--overwrite`: bypass the merge and write THEIRS whole-file. */
    readonly forceWholeFile: boolean;
}

export interface MergeDecision {
    /** Content to write, or `null` to leave the file untouched (skipped / kept). */
    readonly content: string | null;
    readonly outcome: MergeOutcome;
    readonly conflicts: number;
}

export function classifyMerge(inputs: MergeInputs): MergeDecision {
    const { ours, theirs, base, isClean, forceWholeFile } = inputs;
    if (ours === null) return { content: theirs, outcome: 'created', conflicts: 0 };
    if (hashContent(ours) === hashContent(theirs)) return { content: null, outcome: 'skipped', conflicts: 0 };
    if (isClean) return { content: theirs, outcome: 'refreshed', conflicts: 0 };
    if (forceWholeFile) return { content: theirs, outcome: 'overwritten', conflicts: 0 };
    if (base === null) return { content: null, outcome: 'fellback-kept', conflicts: 0 };
    const { content, conflicts } = merge3(base, ours, theirs);
    return { content, outcome: conflicts > 0 ? 'merged-conflict' : 'merged-clean', conflicts };
}

/** Accumulated per-file outcomes for the post-update summary + exit code. */
export interface MergeReport {
    mergedClean: string[];
    mergedConflicted: string[];
    overwritten: string[];
    skipped: string[];
    fellBack: string[];
}

export function emptyMergeReport(): MergeReport {
    return { mergedClean: [], mergedConflicted: [], overwritten: [], skipped: [], fellBack: [] };
}

/** True when a file was written with unresolved conflict markers (drives a non-zero exit in CI). */
export function hasUnresolvedConflicts(report: MergeReport): boolean {
    return report.mergedConflicted.length > 0;
}

/** Plain-text summary lines for the post-update report (the caller adds color). */
export function formatMergeSummary(report: MergeReport): string[] {
    const lines: string[] = [];
    if (report.mergedClean.length > 0) lines.push(`Merged cleanly: ${report.mergedClean.length}`);
    if (report.mergedConflicted.length > 0) {
        lines.push(`Merged with conflicts (resolve the <<<<<<< markers): ${report.mergedConflicted.length}`);
        for (const f of report.mergedConflicted) lines.push(`  ! ${f}`);
    }
    if (report.overwritten.length > 0) lines.push(`Updated: ${report.overwritten.length}`);
    if (report.skipped.length > 0) lines.push(`Already up to date: ${report.skipped.length}`);
    if (report.fellBack.length > 0) {
        lines.push(`Skipped (locally edited, no baseline to merge — re-run with --overwrite to take upstream): ${report.fellBack.length}`);
        for (const f of report.fellBack) lines.push(`  ~ ${f}`);
    }
    return lines;
}

function tally(report: MergeReport, file: string, outcome: MergeOutcome): void {
    if (outcome === 'merged-clean') report.mergedClean.push(file);
    else if (outcome === 'merged-conflict') report.mergedConflicted.push(file);
    else if (outcome === 'skipped') report.skipped.push(file);
    else if (outcome === 'fellback-kept') report.fellBack.push(file);
    else report.overwritten.push(file); // created | refreshed | overwritten
}

/**
 * Whether a component's recorded ref may advance to the current version.
 * The ref is per-component but outcomes are per-file, so advancing while ANY
 * file fell back (kept its old version) would record a ref the fell-back file
 * isn't actually at — a later update would then compute BASE at the wrong ref
 * and could silently swallow interim upstream changes. So advance only when at
 * least one file was written and NONE fell back (per-file refs would lift this
 * conservatism — see the spec's ref-granularity open decision).
 */
export function shouldAdvanceRef(outcomes: readonly MergeOutcome[]): boolean {
    return outcomes.length > 0 && !outcomes.includes('fellback-kept');
}

export interface MergeWriteContext {
    readonly targetDir: string;
    readonly component: string;
    /** Resolved current content (THEIRS) — already fetched/transformed and cached. */
    readonly theirs: string;
    readonly options: FetchOptions;
    readonly utilsAlias: string;
    readonly prefix: string;
    readonly kind: SourceKind;
    readonly manifest: Manifest;
    readonly forceWholeFile: boolean;
    readonly report: MergeReport;
}

/** True when OURS's dominant EOL is CRLF (more CRLF pairs than lone LFs); a tie favors LF. */
function prefersCrlf(ours: string): boolean {
    const crlf = ours.split('\r\n').length - 1;
    const totalLf = ours.split('\n').length - 1;
    return crlf > totalLf - crlf;
}

/** Rewrite an LF-bodied string to CRLF (collapse any stray CRLF first so we never emit CR CR LF). */
function toCrlf(content: string): string {
    return content.replaceAll('\r\n', '\n').replaceAll('\n', '\r\n');
}

/**
 * Restore OURS's line-ending convention on merged output. merge3 always emits
 * LF; a CRLF-dominant OURS would otherwise have every line silently rewritten.
 * Only the 3-way-merge outcomes get this — created/refreshed/overwritten take
 * THEIRS verbatim, so they keep upstream's (LF) endings.
 */
function restoreOursEol(content: string, ours: string | null, outcome: MergeOutcome): string {
    const merged = outcome === 'merged-clean' || outcome === 'merged-conflict';
    return merged && ours !== null && prefersCrlf(ours) ? toCrlf(content) : content;
}

/** Obtain BASE (recorded-ref content) only when an actual merge is needed. */
async function resolveBase(file: string, ctx: MergeWriteContext): Promise<string | null> {
    const ref = getComponentRef(ctx.manifest, ctx.component);
    if (!ref) return null;
    return fetchAtRef(file, ref, ctx.options, ctx.utilsAlias, ctx.prefix, ctx.kind);
}

/**
 * Apply the per-file decision for one file and perform the resulting write +
 * manifest updates. Returns the outcome (also tallied into `ctx.report`).
 */
export async function mergeWriteFile(file: string, ctx: MergeWriteContext): Promise<MergeOutcome> {
    const targetPath = path.join(ctx.targetDir, file);
    const exists = await fs.pathExists(targetPath);
    const ours = exists ? await fs.readFile(targetPath, 'utf-8') : null;
    const isClean = ours !== null && fileStatus(ctx.manifest, file, ours) === 'clean';
    const upToDate = ours !== null && hashContent(ours) === hashContent(ctx.theirs);

    // BASE is only needed for an actual 3-way merge: an edited file that isn't
    // already current, isn't being force-overwritten, and isn't an unedited
    // fast-path. Every other branch short-circuits without a fetch.
    const needsBase = ours !== null && !upToDate && !isClean && !ctx.forceWholeFile;
    const base = needsBase ? await resolveBase(file, ctx) : null;

    const decision = classifyMerge({ ours, theirs: ctx.theirs, base, isClean, forceWholeFile: ctx.forceWholeFile });

    if (decision.content !== null) {
        await fs.ensureDir(path.dirname(targetPath));
        await fs.writeFile(targetPath, restoreOursEol(decision.content, ours, decision.outcome));
    }
    // Record the baseline as THEIRS — the pristine upstream the file was brought
    // up to at the now-advanced ref — NOT the (possibly merged) disk content. If
    // we recorded the merged result, the next update would see the file as
    // `clean` (== baseline) and fast-path-overwrite the user's merged edits.
    // `fellback-kept` keeps its old baseline (the ref didn't advance).
    if (decision.outcome !== 'fellback-kept') {
        recordFile(ctx.manifest, file, ctx.theirs, ctx.component);
    }
    tally(ctx.report, file, decision.outcome);
    return decision.outcome;
}
