import type { PathRect } from '../pdf-parser';
import type { ClassifyContext } from './readable-classify';
import type { Line, TableBlock, TableCellModel } from './readable-types';

const MIN_ROWS = 2;
const MIN_COLS = 2;
/** Minimum fraction of filled cells for an unruled grid to count as a table. */
const MIN_CELL_FILL = 0.5;
const SNAP_RATE = 0.8;
const EDGE_CLUSTER_EM = 0.5;
const SEPARATOR_THICKNESS = 3;
const ROW_TOLERANCE_EM = 0.35;

export interface BandTableSplit {
    readonly before: Line[];
    readonly table: TableBlock;
    readonly after: Line[];
    /** Separator rects consumed by a ruled grid — excluded from later rule/hr detection. */
    readonly usedRects: ReadonlySet<PathRect>;
}

/**
 * Finds the first table inside a vertical band of lines. Ruled grids (drawn
 * separators) are matched first; otherwise consecutive multi-segment rows
 * whose segment edges snap to shared column positions are reconstructed as
 * an unruled table. Returns null when the band holds no table.
 */
export function findTableInBand(
    band: readonly Line[],
    rects: readonly PathRect[],
    pageIndex: number,
    ctx: ClassifyContext,
): BandTableSplit | null {
    const rows = groupByBaseline(band);
    return findRuledTable(band, rows, rects, pageIndex) ??
        findUnruledTable(rows, pageIndex, ctx);
}

function groupByBaseline(band: readonly Line[]): Line[][] {
    const sorted = [...band].sort((a, b) => b.y - a.y || a.x - b.x);
    const rows: Line[][] = [];
    for (const line of sorted) {
        const current = rows.at(-1);
        const anchor = current?.[0];
        if (anchor && Math.abs(anchor.y - line.y) <= anchor.fontSize * ROW_TOLERANCE_EM) {
            current.push(line);
        } else {
            rows.push([line]);
        }
    }
    return rows;
}

// ── Ruled tables ────────────────────────────────────────────────────────

interface RuledGrid {
    readonly xs: number[];
    readonly ys: number[];
    readonly sources: PathRect[];
}

function findRuledTable(
    band: readonly Line[],
    rows: readonly Line[][],
    rects: readonly PathRect[],
    pageIndex: number,
): BandTableSplit | null {
    const grid = detectRuledGrid(bandScopedRects(band, rects));
    if (!grid) return null;

    const inGrid = band.filter(line => lineInGrid(line, grid));
    const gridRows = groupByBaseline(inGrid);
    if (gridRows.length < MIN_ROWS) return null;

    const cells = buildRuledCells(inGrid, grid);
    if (!cells) return null;
    if (cellFillRatio(cells) < MIN_CELL_FILL) return null;

    const consumed = new Set(inGrid);
    const yTop = Math.max(...grid.ys);
    return {
        before: band.filter(line => !consumed.has(line) && line.y > yTop),
        table: makeTableBlock(cells, true, pageIndex),
        after: band.filter(line => !consumed.has(line) && line.y <= yTop),
        usedRects: new Set(grid.sources),
    };
}

/** Restricts grid detection to rects vertically overlapping this band. */
function bandScopedRects(band: readonly Line[], rects: readonly PathRect[]): PathRect[] {
    if (band.length === 0) return [];
    const margin = band[0].fontSize * 2;
    const yTop = Math.max(...band.map(l => l.y)) + margin;
    const yBottom = Math.min(...band.map(l => l.y)) - margin;
    return rects.filter(rect => rect.y <= yTop && rect.y + rect.height >= yBottom);
}

/** Clusters separator-rect positions into grid line coordinates. */
function detectRuledGrid(rects: readonly PathRect[]): RuledGrid | null {
    const xCandidates: number[] = [];
    const yCandidates: number[] = [];
    const sources: PathRect[] = [];
    for (const rect of rects) {
        if (collectGridCandidates(rect, xCandidates, yCandidates)) sources.push(rect);
    }
    const xs = clusterPositions(xCandidates, 2);
    const ys = clusterPositions(yCandidates, 2);
    if (xs.length < MIN_COLS + 1 || ys.length < MIN_ROWS + 1) return null;
    return { xs, ys, sources };
}

function collectGridCandidates(rect: PathRect, xs: number[], ys: number[]): boolean {
    const isHorizontalLine = rect.height <= SEPARATOR_THICKNESS && rect.width > 20;
    const isVerticalLine = rect.width <= SEPARATOR_THICKNESS && rect.height > 8;
    const isCellBox = rect.stroked && rect.width > 20 && rect.height > 8;
    if (isHorizontalLine) ys.push(rect.y + rect.height / 2);
    if (isVerticalLine) xs.push(rect.x + rect.width / 2);
    if (isCellBox) {
        xs.push(rect.x, rect.x + rect.width);
        ys.push(rect.y, rect.y + rect.height);
    }
    return isHorizontalLine || isVerticalLine || isCellBox;
}

function clusterPositions(values: readonly number[], tolerance: number): number[] {
    const sorted = [...values].sort((a, b) => a - b);
    const clusters: number[] = [];
    for (const value of sorted) {
        const last = clusters.at(-1);
        if (last === undefined || value - last > tolerance) {
            clusters.push(value);
        }
    }
    return clusters;
}

function lineInGrid(line: Line, grid: RuledGrid): boolean {
    const x0 = Math.min(...grid.xs);
    const x1 = Math.max(...grid.xs);
    const y0 = Math.min(...grid.ys);
    const y1 = Math.max(...grid.ys);
    const midX = (line.x + line.endX) / 2;
    return midX >= x0 && midX <= x1 && line.y >= y0 && line.y <= y1;
}

function buildRuledCells(lines: readonly Line[], grid: RuledGrid): TableCellModel[][] | null {
    const xs = [...grid.xs].sort((a, b) => a - b);
    const ys = [...grid.ys].sort((a, b) => b - a);
    const rowCount = ys.length - 1;
    const colCount = xs.length - 1;

    const cells: Line[][][] = Array.from({ length: rowCount },
        () => Array.from({ length: colCount }, () => []));
    let placed = 0;
    for (const line of lines) {
        const row = bandIndex(ys, line.y);
        const col = columnIndex(xs, (line.x + line.endX) / 2);
        if (row < 0 || col < 0) continue;
        cells[row][col].push(line);
        placed++;
    }
    if (placed === 0) return null;
    return cells.map(row => row.map(cellLines => {
        cellLines.sort((a, b) => b.y - a.y || a.x - b.x);
        return { lines: cellLines };
    }));
}

function bandIndex(descendingYs: readonly number[], y: number): number {
    for (let i = 0; i < descendingYs.length - 1; i++) {
        if (y <= descendingYs[i] && y >= descendingYs[i + 1]) return i;
    }
    return -1;
}

function columnIndex(ascendingXs: readonly number[], x: number): number {
    for (let i = 0; i < ascendingXs.length - 1; i++) {
        if (x >= ascendingXs[i] && x <= ascendingXs[i + 1]) return i;
    }
    return -1;
}

// ── Unruled tables ──────────────────────────────────────────────────────

function findUnruledTable(
    rows: readonly Line[][],
    pageIndex: number,
    ctx: ClassifyContext,
): BandTableSplit | null {
    const run = findMultiSegmentRun(rows, ctx.bodyLeading);
    if (!run) return null;
    const runRows = rows.slice(run.start, run.end);

    const rtl = isRtlTable(runRows);
    const columns = clusterColumnEdges(runRows, ctx.bodyFontSize, rtl);
    if (!columns) return null;
    if (!looksCellular(runRows, columns.length)) return null;

    const cells = runRows.map(row => rowToCells(row, columns, rtl));
    if (cellFillRatio(cells) < MIN_CELL_FILL) return null;
    return {
        before: rows.slice(0, run.start).flat(),
        table: makeTableBlock(cells, false, pageIndex),
        after: rows.slice(run.end).flat(),
        usedRects: new Set<PathRect>(),
    };
}

/**
 * Fraction of grid cells that hold text. A genuine table fills most of its
 * grid; scattered key/value prose snapped onto shared edges leaves most cells
 * empty, and is more readable as flowing paragraphs than a ragged sparse grid.
 */
function cellFillRatio(cells: readonly TableCellModel[][]): number {
    let filled = 0;
    let total = 0;
    for (const row of cells) {
        for (const cell of row) {
            total++;
            if (cell.lines.length > 0) filled++;
        }
    }
    return total > 0 ? filled / total : 0;
}

/**
 * Distinguishes tabular rows from multi-column prose: table cells are short
 * relative to the band width, while prose columns fill roughly half of it.
 * Two-column candidates get the stricter bound since they are the ambiguous
 * case; without this, every two-column page would collapse into a table.
 */
function looksCellular(rows: readonly Line[][], columnCount: number): boolean {
    const segments = rows.flat();
    const bandX0 = Math.min(...segments.map(l => l.x));
    const bandX1 = Math.max(...segments.map(l => l.endX));
    const bandWidth = bandX1 - bandX0;
    if (bandWidth <= 0) return false;
    const widths = segments.map(l => l.endX - l.x).sort((a, b) => a - b);
    const median = widths[Math.floor(widths.length / 2)];
    const maxRatio = columnCount >= 3 ? 0.4 : 0.3;
    return median / bandWidth <= maxRatio;
}

/**
 * Longest run of consecutive rows that each fragment into two or more
 * segments. Single-segment rows end a run — which means multi-line cells in
 * UNRULED tables are not merged (a continuation line reads as prose and
 * terminates the table). This is a conscious v1 limitation; ruled tables
 * support multi-line cells via grid bands.
 */
function findMultiSegmentRun(
    rows: readonly Line[][],
    bodyLeading: number,
): { start: number; end: number } | null {
    let best: { start: number; end: number } | null = null;
    let start = -1;
    for (let i = 0; i <= rows.length; i++) {
        const qualifies = i < rows.length && rows[i].length >= MIN_COLS &&
            (start < 0 || i === start || rowGap(rows, i) <= bodyLeading * 3);
        if (qualifies && start < 0) start = i;
        if (!qualifies && start >= 0) {
            if (i - start >= MIN_ROWS && (!best || i - start > best.end - best.start)) {
                best = { start, end: i };
            }
            start = -1;
        }
    }
    return best;
}

function rowGap(rows: readonly Line[][], index: number): number {
    return rows[index - 1][0].y - rows[index][0].y;
}

/**
 * Clusters segment start-edges (right edges for RTL) across the candidate
 * rows into column positions. Accepts only when at least {@link SNAP_RATE}
 * of segments snap to a cluster supported by two or more distinct rows.
 */
function clusterColumnEdges(
    rows: readonly Line[][],
    bodyFontSize: number,
    rtl: boolean,
): number[] | null {
    const tolerance = Math.max(3, bodyFontSize * EDGE_CLUSTER_EM);
    const edges = rows.flatMap((row, rowIdx) =>
        row.map(line => ({ value: edgeOf(line, rtl), rowIdx })));
    const clusters = clusterWithSupport(edges, tolerance);

    const supported = clusters.filter(c => c.rows.size >= MIN_ROWS);
    if (supported.length < MIN_COLS) return null;
    const snapped = edges.filter(edge =>
        supported.some(c => Math.abs(edge.value - c.center) <= tolerance)).length;
    if (snapped / edges.length < SNAP_RATE) return null;
    return supported.map(c => c.center).sort((a, b) => a - b);
}

function edgeOf(line: Line, rtl: boolean): number {
    return rtl ? -line.endX : line.x;
}

function isRtlTable(rows: ReadonlyArray<readonly Line[]>): boolean {
    const lines = rows.flat();
    return lines.filter(l => l.dir === 'rtl').length * 2 > lines.length;
}

function clusterWithSupport(
    edges: ReadonlyArray<{ value: number; rowIdx: number }>,
    tolerance: number,
): Array<{ center: number; count: number; rows: Set<number> }> {
    const sorted = [...edges].sort((a, b) => a.value - b.value);
    const clusters: Array<{ center: number; count: number; rows: Set<number> }> = [];
    for (const edge of sorted) {
        const last = clusters.at(-1);
        if (last && edge.value - last.center <= tolerance) {
            last.center = (last.center * last.count + edge.value) / (last.count + 1);
            last.count++;
            last.rows.add(edge.rowIdx);
        } else {
            clusters.push({ center: edge.value, count: 1, rows: new Set([edge.rowIdx]) });
        }
    }
    return clusters;
}

function rowToCells(
    row: readonly Line[],
    columns: readonly number[],
    rtl: boolean,
): TableCellModel[] {
    const cells: Line[][] = columns.map(() => []);
    for (const line of row) {
        const edge = edgeOf(line, rtl);
        let bestIdx = 0;
        let bestDist = Number.POSITIVE_INFINITY;
        for (let i = 0; i < columns.length; i++) {
            const dist = Math.abs(edge - columns[i]);
            if (dist < bestDist) {
                bestDist = dist;
                bestIdx = i;
            }
        }
        cells[bestIdx].push(line);
    }
    return cells.map(cellLines => ({ lines: cellLines }));
}

// ── Shared ──────────────────────────────────────────────────────────────

function makeTableBlock(
    cells: TableCellModel[][],
    ruled: boolean,
    pageIndex: number,
): TableBlock {
    const allLines = cells.flat().flatMap(cell => cell.lines);
    const rtl = allLines.filter(l => l.dir === 'rtl').length * 2 > allLines.length;
    return {
        kind: 'table',
        rows: cells,
        ruled,
        headerRow: firstRowIsHeader(cells),
        page: pageIndex,
        style: {
            align: '',
            indentStart: 0,
            textIndent: 0,
            lineHeight: 0,
            marginTop: 0,
            dir: rtl ? 'rtl' : '',
            background: '',
        },
    };
}

function firstRowIsHeader(cells: readonly TableCellModel[][]): boolean {
    const firstRow = cells[0];
    if (!firstRow) return false;
    const words = firstRow.flatMap(cell => cell.lines.flatMap(l => l.words));
    if (words.length === 0) return false;
    return words.every(w => w.style.bold);
}
