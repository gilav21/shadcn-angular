/**
 * Pure, zero-IO, git-independent line-based 3-way merge.
 *
 * Each side's changes (relative to `base`) are computed independently as a list
 * of change *hunks* in base coordinates. Hunks from `ours` and `theirs` that do
 * NOT overlap in base coordinates are applied independently (so adjacent or
 * interleaved disjoint edits merge cleanly); only hunks that actually overlap —
 * i.e. both sides touch the same base lines — produce standard git conflict
 * markers (`<<<<<<< ours` / `=======` / `>>>>>>> theirs`) and bump the conflict
 * count. Vendored (no `git`, no npm diff dependency) so the default update path
 * never requires an external tool.
 */

const MARKER_OURS = '<<<<<<< ours';
const MARKER_SEP = '=======';
const MARKER_THEIRS = '>>>>>>> theirs';

/** A maximal changed region: base range `[baseStart, baseEnd)` replaced by side range `[sideStart, sideEnd)`. */
interface Hunk {
    readonly baseStart: number;
    readonly baseEnd: number;
    readonly sideStart: number;
    readonly sideEnd: number;
}

/** Mutable cursor state threaded through the merge walk. */
interface MergeState {
    bp: number; // base line pointer
    op: number; // ours line pointer
    tp: number; // theirs line pointer
    oi: number; // ours hunk index
    ti: number; // theirs hunk index
    conflicts: number;
    readonly out: string[];
}

export interface Merge3Result {
    readonly content: string;
    readonly conflicts: number;
}

/**
 * Longest-common-subsequence matched index pairs `[ai, bi]` (strictly
 * increasing in both), via a classic DP table + backtrack. O(n·m) — fine for
 * source files of a few thousand lines.
 */
function lcsMatches(a: readonly string[], b: readonly string[]): Array<[number, number]> {
    const n = a.length;
    const m = b.length;
    const dp: number[][] = new Array(n + 1);
    for (let i = 0; i <= n; i++) dp[i] = new Array(m + 1).fill(0) as number[];
    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            dp[i][j] = a[i] === b[j]
                ? dp[i + 1][j + 1] + 1
                : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
    }
    const out: Array<[number, number]> = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
        if (a[i] === b[j]) {
            out.push([i, j]);
            i++;
            j++;
        } else if (dp[i + 1][j] >= dp[i][j + 1]) {
            i++;
        } else {
            j++;
        }
    }
    return out;
}

/**
 * The change hunks of `side` relative to `base`, in base order. The gaps
 * between consecutive LCS-matched (stable) lines — and the leading/trailing
 * gaps — are the changed regions; matched lines themselves are stable and
 * excluded.
 */
function changeHunks(base: readonly string[], side: readonly string[]): Hunk[] {
    const boundaries: Array<[number, number]> = [...lcsMatches(base, side), [base.length, side.length]];
    const hunks: Hunk[] = [];
    let prevB = 0;
    let prevS = 0;
    for (const [bi, si] of boundaries) {
        if (bi > prevB || si > prevS) {
            hunks.push({ baseStart: prevB, baseEnd: bi, sideStart: prevS, sideEnd: si });
        }
        prevB = bi + 1;
        prevS = si + 1;
    }
    return hunks;
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
    return a.length === b.length && a.every((v, k) => v === b[k]);
}

/** Two hunks interact when their base ranges intersect or are co-located (same start — covers insertions). */
function hunksOverlap(oh: Hunk, th: Hunk): boolean {
    return oh.baseStart === th.baseStart || (oh.baseStart < th.baseEnd && th.baseStart < oh.baseEnd);
}

/** Emit a stable region `[bp, upto)` (identical across all three) and advance all cursors. */
function emitStable(st: MergeState, base: readonly string[], upto: number): void {
    const len = upto - st.bp;
    for (let k = st.bp; k < upto; k++) st.out.push(base[k]);
    st.bp = upto;
    st.op += len;
    st.tp += len;
}

/** Apply a one-sided `ours` hunk (theirs is stable across its base range). */
function emitOurs(st: MergeState, ours: readonly string[], h: Hunk): void {
    for (let k = h.sideStart; k < h.sideEnd; k++) st.out.push(ours[k]);
    st.tp += h.baseEnd - h.baseStart;
    st.bp = h.baseEnd;
    st.op = h.sideEnd;
    st.oi++;
}

/** Apply a one-sided `theirs` hunk (ours is stable across its base range). */
function emitTheirs(st: MergeState, theirs: readonly string[], h: Hunk): void {
    for (let k = h.sideStart; k < h.sideEnd; k++) st.out.push(theirs[k]);
    st.op += h.baseEnd - h.baseStart;
    st.bp = h.baseEnd;
    st.tp = h.sideEnd;
    st.ti++;
}

/**
 * Resolve a region where ours and theirs hunks overlap. Grows the region to
 * absorb any further hunks (on either side) that reach into it, then compares
 * the two sides' content: identical → clean (both made the same change),
 * otherwise → git conflict markers.
 */
function emitConflict(st: MergeState, ours: readonly string[], theirs: readonly string[], oursHunks: Hunk[], theirsHunks: Hunk[]): void {
    let re = st.bp;
    let lastOursBase = st.bp;
    let lastOursSide = st.op;
    let lastTheirsBase = st.bp;
    let lastTheirsSide = st.tp;
    let advanced = true;
    while (advanced) {
        advanced = false;
        const oh = oursHunks[st.oi];
        if (oh && oh.baseStart <= re) {
            lastOursBase = oh.baseEnd;
            lastOursSide = oh.sideEnd;
            re = Math.max(re, oh.baseEnd);
            st.oi++;
            advanced = true;
        }
        const th = theirsHunks[st.ti];
        if (th && th.baseStart <= re) {
            lastTheirsBase = th.baseEnd;
            lastTheirsSide = th.sideEnd;
            re = Math.max(re, th.baseEnd);
            st.ti++;
            advanced = true;
        }
    }
    const oursEnd = lastOursSide + (re - lastOursBase);
    const theirsEnd = lastTheirsSide + (re - lastTheirsBase);
    const oursLines = ours.slice(st.op, oursEnd);
    const theirsLines = theirs.slice(st.tp, theirsEnd);
    if (arraysEqual(oursLines, theirsLines)) {
        st.out.push(...oursLines);
    } else {
        st.out.push(MARKER_OURS, ...oursLines, MARKER_SEP, ...theirsLines, MARKER_THEIRS);
        st.conflicts++;
    }
    st.bp = re;
    st.op = oursEnd;
    st.tp = theirsEnd;
}

export function merge3(base: string, ours: string, theirs: string): Merge3Result {
    const B = base.split('\n');
    const O = ours.split('\n');
    const T = theirs.split('\n');
    const oursHunks = changeHunks(B, O);
    const theirsHunks = changeHunks(B, T);
    const st: MergeState = { bp: 0, op: 0, tp: 0, oi: 0, ti: 0, conflicts: 0, out: [] };

    while (st.oi < oursHunks.length || st.ti < theirsHunks.length) {
        const oh = oursHunks[st.oi];
        const th = theirsHunks[st.ti];
        const oStart = oh ? oh.baseStart : Infinity;
        const tStart = th ? th.baseStart : Infinity;
        const nextStart = Math.min(oStart, tStart);
        if (st.bp < nextStart) {
            emitStable(st, B, nextStart);
        } else if (oh && th && hunksOverlap(oh, th)) {
            emitConflict(st, O, T, oursHunks, theirsHunks);
        } else if (oh && oStart <= tStart) {
            emitOurs(st, O, oh);
        } else if (th) {
            emitTheirs(st, T, th);
        }
    }
    if (st.bp < B.length) st.out.push(...B.slice(st.bp));

    return { content: st.out.join('\n'), conflicts: st.conflicts };
}
