import fs from 'fs-extra';
import path from 'node:path';
import { fetchAndTransform, normalizeContent, type FetchOptions } from './fetch.js';
import { registry, type ComponentName } from '../registry/index.js';
import { DEFAULT_PREFIX } from '../utils/prefix.js';

export interface SymbolDiff {
    /** Public symbols (inputs/outputs/models/methods) present in remote, absent locally. */
    added: string[];
    /** Public symbols present locally, absent in remote. */
    removed: string[];
}

export interface FileDiff {
    file: string;
    /** Unified-style diff text, or null when identical / not installed / summary mode. */
    diff: string | null;
    /** Changed public symbols — populated in summary mode. */
    summary?: SymbolDiff;
    error?: string;
}

export interface ComponentDiff {
    name: string;
    files: FileDiff[];
    hasChanges: boolean;
}

export type DiffMode = 'full' | 'summary';

type EditTag = 'eq' | 'del' | 'add';
interface EditOp {
    tag: EditTag;
    line: string;
}

/**
 * LCS-based line edit script. Unlike a positional zip-and-compare, equal lines
 * re-synchronize after an insertion, so an inserted block stays a single run of
 * additions instead of cascading every following line into a change. The DP
 * table is a flat Int32Array to keep large files within memory.
 */
function lcsOps(a: string[], b: string[]): EditOp[] {
    const n = a.length;
    const m = b.length;
    const width = m + 1;
    const dp = new Int32Array((n + 1) * width);
    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            dp[i * width + j] = a[i] === b[j]
                ? dp[(i + 1) * width + (j + 1)] + 1
                : Math.max(dp[(i + 1) * width + j], dp[i * width + (j + 1)]);
        }
    }
    const ops: EditOp[] = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
        if (a[i] === b[j]) {
            ops.push({ tag: 'eq', line: a[i] });
            i++; j++;
        } else if (dp[(i + 1) * width + j] >= dp[i * width + (j + 1)]) {
            ops.push({ tag: 'del', line: a[i] });
            i++;
        } else {
            ops.push({ tag: 'add', line: b[j] });
            j++;
        }
    }
    while (i < n) ops.push({ tag: 'del', line: a[i++] });
    while (j < m) ops.push({ tag: 'add', line: b[j++] });
    return ops;
}

/** Group changed ops into hunk ranges (op-index spans) with `context` lines of padding, merging overlaps. */
function hunkRanges(ops: EditOp[], context: number): Array<[number, number]> {
    const ranges: Array<[number, number]> = [];
    for (let idx = 0; idx < ops.length; idx++) {
        if (ops[idx].tag === 'eq') continue;
        const start = Math.max(0, idx - context);
        const end = Math.min(ops.length - 1, idx + context);
        const last = ranges[ranges.length - 1];
        if (last && start <= last[1] + 1) last[1] = Math.max(last[1], end);
        else ranges.push([start, end]);
    }
    return ranges;
}

/** Running count of old/new lines consumed before each op (prefix sums). */
function linePositions(ops: EditOp[]): { aPos: number[]; bPos: number[] } {
    const aPos = new Array<number>(ops.length + 1);
    const bPos = new Array<number>(ops.length + 1);
    aPos[0] = 0;
    bPos[0] = 0;
    for (let i = 0; i < ops.length; i++) {
        aPos[i + 1] = aPos[i] + (ops[i].tag === 'add' ? 0 : 1);
        bPos[i + 1] = bPos[i] + (ops[i].tag === 'del' ? 0 : 1);
    }
    return { aPos, bPos };
}

function opPrefix(tag: EditTag): string {
    if (tag === 'del') return '-';
    if (tag === 'add') return '+';
    return ' ';
}

function renderHunk(ops: EditOp[], range: [number, number], aPos: number[], bPos: number[]): string {
    const [start, end] = range;
    const oldCount = aPos[end + 1] - aPos[start];
    const newCount = bPos[end + 1] - bPos[start];
    const oldStart = oldCount === 0 ? aPos[start] : aPos[start] + 1;
    const newStart = newCount === 0 ? bPos[start] : bPos[start] + 1;
    const lines = [`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`];
    for (let i = start; i <= end; i++) {
        lines.push(opPrefix(ops[i].tag) + ops[i].line);
    }
    return lines.join('\n');
}

/**
 * Real unified diff: hunks with `@@ -a,b +c,d @@` headers and `context` lines of
 * surrounding context, produced from an LCS alignment. Returns `''` when the two
 * inputs are identical.
 */
export function unifiedDiff(fileName: string, local: string, remote: string, context = 3): string {
    if (local === remote) return '';
    const ops = lcsOps(local.split('\n'), remote.split('\n'));
    const ranges = hunkRanges(ops, context);
    if (ranges.length === 0) return '';
    const { aPos, bPos } = linePositions(ops);
    const body = ranges.map(range => renderHunk(ops, range, aPos, bPos)).join('\n');
    return `--- local/${fileName}\n+++ remote/${fileName}\n${body}`;
}

// `name = input<...>` / `output(...)` / `model.required<...>` — capture the
// property name. Anchored at line start (these are member declarations) and a
// `.`/`<`/`(` right after the keyword anchors the tail, so there is no
// ambiguous backtracking.
const SYMBOL_RE = /^[ \t]*([a-zA-Z_]\w*) *= *(?:input|output|model)[.<(]/gm;
// Member declarations: indentation, an optional single access/async modifier
// (a fixed keyword alternation), then the method name and its `(`.
const METHOD_RE = /^[ \t]{2,8}(?:(?:public|private|protected|readonly|static|async|override|get|set) )?([a-zA-Z_]\w*)\(/gm;

/** Public surface of a component source: input/output/model property names + method names. */
function extractSymbols(src: string): Set<string> {
    const names = new Set<string>();
    for (let m = SYMBOL_RE.exec(src); m !== null; m = SYMBOL_RE.exec(src)) names.add(m[1]);
    for (let m = METHOD_RE.exec(src); m !== null; m = METHOD_RE.exec(src)) {
        if (!RESERVED.has(m[1])) names.add(m[1] + '()');
    }
    return names;
}

const RESERVED = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'constructor']);

/** Symbols added/removed between two sources, for summary mode. */
export function symbolDiff(local: string, remote: string): SymbolDiff {
    const localSyms = extractSymbols(local);
    const remoteSyms = extractSymbols(remote);
    const added = [...remoteSyms].filter(s => !localSyms.has(s)).sort((a, b) => a.localeCompare(b));
    const removed = [...localSyms].filter(s => !remoteSyms.has(s)).sort((a, b) => a.localeCompare(b));
    return { added, removed };
}

async function diffOneFile(
    file: string, targetDir: string, options: FetchOptions, utilsAlias: string, prefix: string, mode: DiffMode,
): Promise<FileDiff> {
    const targetPath = path.join(targetDir, file);
    if (!await fs.pathExists(targetPath)) return { file, diff: null };
    try {
        const local = normalizeContent(await fs.readFile(targetPath, 'utf-8'));
        // Apply the project's configured selector prefix so a custom-prefix
        // install doesn't read as "changed" against the default-prefix remote.
        const remote = normalizeContent(await fetchAndTransform(file, options, utilsAlias, prefix));
        if (local === remote) return { file, diff: null };
        if (mode === 'summary') return { file, diff: null, summary: symbolDiff(local, remote) };
        return { file, diff: unifiedDiff(file, local, remote) };
    } catch (err: unknown) {
        return { file, diff: null, error: err instanceof Error ? err.message : String(err) };
    }
}

export async function diffComponentFiles(
    name: ComponentName, targetDir: string, options: FetchOptions, utilsAlias: string,
    prefix: string = DEFAULT_PREFIX, mode: DiffMode = 'full',
): Promise<ComponentDiff> {
    const files: FileDiff[] = [];
    for (const file of registry[name].files) {
        files.push(await diffOneFile(file, targetDir, options, utilsAlias, prefix, mode));
    }
    // A component "has changes" if any file differs OR could not be fetched —
    // the latter preserves the original CLI's "Could not fetch remote version"
    // report (and its inclusion in the diff count).
    const hasChanges = files.some(f =>
        f.diff !== null || f.error !== undefined
        || (f.summary !== undefined && (f.summary.added.length > 0 || f.summary.removed.length > 0)),
    );
    return { name, files, hasChanges };
}
