import type { PathRect } from '../pdf-parser';
import type { ClassifyContext } from './readable-classify';
import type { Line, TableBlock, TableCellModel, Word } from './readable-types';
import { detectDirection } from './readable-words';

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
    /** Lines on the top-row baseline just outside the grid on the leading
     *  side — a form's row label, rendered beside the table. */
    readonly leadingLabel?: Line[];
}

/**
 * Finds the first table inside a vertical band of lines. Ruled grids (drawn
 * separators) are matched first; otherwise consecutive multi-segment rows
 * whose segment edges snap to shared column positions are reconstructed as
 * an unruled table. Returns null when the band holds no table.
 */
export interface TableDetectionModes {
    /** Detect ruled (drawn-grid) tables. Default true. */
    readonly ruled?: boolean;
    /**
     * Detect unruled (edge-aligned) tables. Default true. At PAGE level use
     * 'strict' — before column splitting a two-column text layout is nearly
     * indistinguishable from an unruled table, so only unmistakably cellular
     * rows (uniformly short segments) may be claimed there; everything else
     * gets its chance at region level after columns are resolved.
     */
    readonly unruled?: boolean | 'strict';
}

export function findTableInBand(
    band: readonly Line[],
    rects: readonly PathRect[],
    pageIndex: number,
    ctx: ClassifyContext,
    modes: TableDetectionModes = {},
): BandTableSplit | null {
    const rows = groupByBaseline(band);
    const ruled = (modes.ruled ?? true) ? findRuledTable(band, rows, rects, pageIndex) : null;
    if (ruled) return applyTableSpan(ruled, ctx);
    const unruled = modes.unruled ?? true;
    if (unruled === false) return null;
    const measureWidth = Math.max(1, ctx.pageBounds.x1 - ctx.pageBounds.x0);
    const sectionRules = rects.filter(r => r.width >= measureWidth * SECTION_RULE_RATIO);
    const split = findUnruledTable(rows, pageIndex, ctx, unruled === 'strict', sectionRules);
    return split ? applyTableSpan(split, ctx, rects) : null;
}

/** Only a rule spanning most of the measure divides sections; narrower rules
 *  inside a run are the table's own row styling. */
const SECTION_RULE_RATIO = 0.85;

/** Distinct baselines of thin horizontal rules strictly inside the rows' y-range. */
function interiorRuleYs(lines: readonly Line[], rects: readonly PathRect[]): number[] {
    const ys = lines.map(l => l.y);
    const top = Math.max(...ys);
    const bottom = Math.min(...ys);
    const found: number[] = [];
    for (const rect of rects) {
        const isRule = rect.height <= SEPARATOR_THICKNESS && rect.width > 20;
        if (!isRule || rect.y >= top || rect.y <= bottom) continue;
        if (!found.some(y => Math.abs(y - rect.y) <= 2)) found.push(rect.y);
    }
    return found;
}

/** Stamps the table's x-extent share of the measure so emission can render a
 *  near-full-span data table at full width like the original, and records
 *  whether the PDF drew rules between the table's rows. */
function applyTableSpan(
    split: BandTableSplit,
    ctx: ClassifyContext,
    rects: readonly PathRect[] = [],
): BandTableSplit {
    const lines = split.table.rows.flat().flatMap(cell => cell.lines);
    if (lines.length === 0) return split;
    const x0 = Math.min(...lines.map(l => l.x));
    const span = Math.max(...lines.map(l => l.endX)) - x0;
    const measure = Math.max(1, ctx.pageBounds.x1 - ctx.pageBounds.x0);
    const startsAtMeasure = x0 - ctx.pageBounds.x0 <= measure * TABLE_START_SLACK_RATIO;
    split.table.spanRatio = startsAtMeasure ? Math.min(1, span / measure) : 0;
    split.table.rowRules = split.table.ruled || hasInteriorRowRules(lines, rects);
    return split;
}

/** A table starting further than this share into the measure is positioned
 *  content (a header card beside a logo), never stretched to full width. */
const TABLE_START_SLACK_RATIO = 0.15;

/** True when thin horizontal rules repeat between the table's text rows —
 *  drawn row separators. A single crossing rule is a section divider (handled
 *  by {@link splitRowsAtSectionRule}), not row styling. */
function hasInteriorRowRules(lines: readonly Line[], rects: readonly PathRect[]): boolean {
    return interiorRuleYs(lines, rects).length >= 2;
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
    const separators = bandScopedRects(band, rects).filter(isSeparatorRect);
    const components = connectedComponents(separators)
        .sort((a, b) => componentTop(b) - componentTop(a));
    for (const component of components) {
        const split = ruledTableFromComponent(band, component, pageIndex);
        if (split) return split;
    }
    return null;
}

/**
 * Builds a table from one spatially-cohesive cluster of separator rects. A
 * page can carry several disjoint bordered regions (e.g. a details box above a
 * data grid); clustering first keeps each its own grid instead of fusing them
 * into a single page-spanning table with the overflow dumped out of order.
 */
function ruledTableFromComponent(
    band: readonly Line[],
    component: readonly PathRect[],
    pageIndex: number,
): BandTableSplit | null {
    const grid = detectRuledGrid(component);
    if (!grid) return null;

    const inGrid = band.filter(line => lineInGrid(line, grid));
    if (groupByBaseline(inGrid).length < MIN_ROWS) return null;

    const cells = buildRuledCells(inGrid, grid);
    if (!cells) return null;
    if (cellFillRatio(cells) < MIN_CELL_FILL) return null;
    if (isRtlTable([inGrid])) for (const row of cells) row.reverse();

    const consumed = new Set(inGrid);
    const yTop = Math.max(...grid.ys);
    const leads = (line: Line): boolean => leadsTopRow(line, grid, yTop);
    const leadingLabel = band.filter(line => !consumed.has(line) && line.y <= yTop && leads(line));
    return {
        before: band.filter(line => !consumed.has(line) && line.y > yTop),
        table: makeTableBlock(cells, true, pageIndex),
        after: band.filter(line => !consumed.has(line) && line.y <= yTop && !leads(line)),
        usedRects: new Set(grid.sources),
        ...(leadingLabel.length > 0 ? { leadingLabel } : {}),
    };
}

/**
 * A line on the table's top-row baseline sitting horizontally OUTSIDE the grid
 * is the row's leading label (an RTL form writes "סובל מ" just right of the
 * diagnosis grid) — it renders beside the table, not after it. Lines beside
 * lower rows or below the grid (captions) keep their after position.
 */
function leadsTopRow(line: Line, grid: RuledGrid, yTop: number): boolean {
    const ysDescending = [...grid.ys].sort((a, b) => b - a);
    const rowFloor = ysDescending.length > 1 ? ysDescending[1] : yTop;
    if (line.y > yTop || line.y <= rowFloor) return false;
    return line.endX <= Math.min(...grid.xs) || line.x >= Math.max(...grid.xs);
}

/** Whether a rect is a grid separator (thin line or stroked cell box). */
function isSeparatorRect(rect: PathRect): boolean {
    const isHorizontalLine = rect.height <= SEPARATOR_THICKNESS && rect.width > 20;
    const isVerticalLine = rect.width <= SEPARATOR_THICKNESS && rect.height > 8;
    const isCellBox = rect.stroked && rect.width > 20 && rect.height > 8;
    return isHorizontalLine || isVerticalLine || isCellBox;
}

/** Vertical gap (pt) within which two separators are treated as one grid. */
const COMPONENT_GAP = 4;

/**
 * Groups separator rects into connected components — clusters whose inflated
 * bounding boxes touch. Rects in different components belong to different
 * tables and must not share a grid.
 */
function connectedComponents(rects: readonly PathRect[]): PathRect[][] {
    const parent = rects.map((_, i) => i);
    const find = (i: number): number => {
        let root = i;
        while (parent[root] !== root) root = parent[root];
        while (parent[i] !== root) { const next = parent[i]; parent[i] = root; i = next; }
        return root;
    };
    for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
            if (rectsTouch(rects[i], rects[j])) parent[find(i)] = find(j);
        }
    }
    const groups = new Map<number, PathRect[]>();
    for (let i = 0; i < rects.length; i++) {
        const root = find(i);
        const group = groups.get(root) ?? [];
        group.push(rects[i]);
        groups.set(root, group);
    }
    return [...groups.values()];
}

function rectsTouch(a: PathRect, b: PathRect): boolean {
    return a.x - COMPONENT_GAP <= b.x + b.width && b.x - COMPONENT_GAP <= a.x + a.width &&
        a.y - COMPONENT_GAP <= b.y + b.height && b.y - COMPONENT_GAP <= a.y + a.height;
}

function componentTop(component: readonly PathRect[]): number {
    return Math.max(...component.map(rect => rect.y + rect.height));
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
    strict = false,
    rects: readonly PathRect[] = [],
): BandTableSplit | null {
    const run = findMultiSegmentRun(rows, ctx.bodyLeading);
    if (!run) return null;
    capRunAtSectionRule(run, rows, rects);
    const runRows = rows.slice(run.start, run.end);

    const rtl = isRtlTable(runRows);
    const columns = clusterColumns(runRows, ctx.bodyFontSize, rtl);
    if (!columns) return null;
    if (!looksCellular(runRows, columns.positions.length, strict)) return null;

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
 * A SINGLE full-width rule crossing the run is a section divider (a form's
 * header separator), so rows below it must not fold into the table above —
 * the run ends at the rule and the tail flows normally. Repeated rules
 * between rows are the table's own row styling and leave the run intact.
 */
function capRunAtSectionRule(
    run: { start: number; end: number },
    rows: readonly Line[][],
    rects: readonly PathRect[],
): void {
    const runLines = rows.slice(run.start, run.end).flat();
    if (runLines.length === 0) return;
    const ruleYs = interiorRuleYs(runLines, rects);
    if (ruleYs.length !== 1) return;
    for (let i = run.start; i < run.end; i++) {
        if (rows[i][0].y < ruleYs[0]) {
            if (i > run.start) run.end = i;
            return;
        }
    }
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
function looksCellular(rows: readonly Line[][], columnCount: number, strict = false): boolean {
    const segments = rows.flat();
    const bandX0 = Math.min(...segments.map(l => l.x));
    const bandX1 = Math.max(...segments.map(l => l.endX));
    const bandWidth = bandX1 - bandX0;
    if (bandWidth <= 0) return false;
    const widths = segments.map(l => l.endX - l.x).sort((a, b) => a - b);
    const median = widths[Math.floor(widths.length / 2)];
    const maxRatio = columnCount >= 3 ? 0.4 : 0.3;
    if (median / bandWidth > maxRatio) return false;
    if (!strict) return true;
    const widest = widths.at(-1) ?? 0;
    return widest / bandWidth <= 0.35;
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

/** Column positions plus the metric used to assign lines to them. */
interface ColumnModel {
    readonly positions: number[];
    readonly byCenter: boolean;
}

/** Largest fragment (as a fraction of band width) allowed for center clustering. */
const SHORT_FRAGMENT_RATIO = 0.35;
/** Most fragments a row may hold to qualify for center clustering. */
const MAX_CENTER_FRAGMENTS = 3;
/**
 * Center-alignment tolerance, in em. Looser than the edge tolerance because a
 * centered label and its value are typeset independently and their midpoints
 * drift by up to ~1 em; columns sit far enough apart that this never merges
 * two of them.
 */
const CENTER_CLUSTER_EM = 1.05;

/**
 * Clusters candidate rows into column positions. Start-edge alignment (right
 * edges for RTL) is tried first; when that fails but the rows are short,
 * few-per-row fragments — the shape of a centered label/value grid such as a
 * signature block whose cells share neither left nor right edge — their
 * midpoints are clustered instead. Accepts only when at least {@link SNAP_RATE}
 * of segments snap to a cluster supported by two or more distinct rows.
 */
function clusterColumns(
    rows: readonly Line[][],
    bodyFontSize: number,
    rtl: boolean,
): ColumnModel | null {
    const tolerance = Math.max(3, bodyFontSize * EDGE_CLUSTER_EM);
    const byEdge = clusterPositionsWithSupport(rows, tolerance, line => edgeOf(line, rtl));
    if (byEdge) {
        byEdge.sort((a, b) => a - b);
        return { positions: byEdge, byCenter: false };
    }
    if (!rowsAreShortFragments(rows)) return null;
    const centerTolerance = Math.max(3, bodyFontSize * CENTER_CLUSTER_EM);
    const byCenter = clusterPositionsWithSupport(rows, centerTolerance, centerOf);
    if (!byCenter) return null;
    byCenter.sort((a, b) => (rtl ? b - a : a - b));
    return { positions: byCenter, byCenter: true };
}

function clusterPositionsWithSupport(
    rows: readonly Line[][],
    tolerance: number,
    positionOf: (line: Line) => number,
): number[] | null {
    const edges = rows.flatMap((row, rowIdx) =>
        row.map(line => ({ value: positionOf(line), rowIdx })));
    const clusters = clusterWithSupport(edges, tolerance);
    const supported = clusters.filter(c => c.rows.size >= MIN_ROWS);
    if (supported.length < MIN_COLS) return null;
    const snapped = edges.filter(edge =>
        supported.some(c => Math.abs(edge.value - c.center) <= tolerance)).length;
    if (snapped / edges.length < SNAP_RATE) return null;
    return supported.map(c => c.center);
}

/** True when every row holds few, short fragments — never prose columns. */
function rowsAreShortFragments(rows: readonly Line[][]): boolean {
    const segments = rows.flat();
    const bandX0 = Math.min(...segments.map(l => l.x));
    const bandX1 = Math.max(...segments.map(l => l.endX));
    const bandWidth = bandX1 - bandX0;
    if (bandWidth <= 0) return false;
    if (rows.some(row => row.length > MAX_CENTER_FRAGMENTS)) return false;
    return segments.every(line => line.endX - line.x <= bandWidth * SHORT_FRAGMENT_RATIO);
}

function edgeOf(line: Line, rtl: boolean): number {
    return rtl ? -line.endX : line.x;
}

function centerOf(line: Line): number {
    return (line.x + line.endX) / 2;
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
    columns: ColumnModel,
    rtl: boolean,
): TableCellModel[] {
    const cells: Line[][] = columns.positions.map(() => []);
    for (const line of row) {
        const value = columns.byCenter ? centerOf(line) : edgeOf(line, rtl);
        cells[nearestColumnIndex(value, columns.positions)].push(line);
    }
    return cells.map(cellLines => ({ lines: cellLines }));
}

// ── Multi-line prose columns ────────────────────────────────────────────

/** Each column of a prose column-zone must span at least this many baselines. */
const COLUMN_ZONE_MIN_ROWS = 3;
/** A line must overhang the gutter by more than this (pt) to be a split candidate. */
const GUTTER_SPLIT_TOLERANCE = 2;
/** Split a straddling line only at an internal gap this wide, in em. */
const GUTTER_GAP_EM = 0.6;
/** Places the gutter threshold this far (pt) left of the second column's edge,
 *  inside the gap, so a right-column start exactly on the edge classifies right. */
const GUTTER_INSET = 2;

export interface ColumnZoneSplit {
    readonly before: Line[];
    readonly columns: Line[][];
    readonly after: Line[];
}

/**
 * Detects a multi-line, multi-column PROSE region — e.g. a CV's Summary
 * paragraph beside a Core-Skills list — that the unruled-table pass would
 * mis-claim as a sparse 6×2 table or collapse into interleaved full-width
 * text. A long left-column line abutting the right column (only a small gap
 * between them) is split at the gutter first so the whole region is seen. The
 * region is returned as ordered column line-groups plus the rows above/below,
 * or null when the band is not a clean multi-line column zone. Short-cell
 * (cellular) runs are left to the table detector — only wide prose columns,
 * each spanning several baselines, are returned here.
 */
export function findColumnZone(
    band: readonly Line[],
    ctx: ClassifyContext,
): ColumnZoneSplit | null {
    const tolerance = Math.max(3, ctx.bodyFontSize * EDGE_CLUSTER_EM);
    const gutter = detectSecondaryGutter(groupByBaseline(band), tolerance);
    if (gutter === null) return null;

    const rows = groupByBaseline(splitStraddlingLines(band, gutter));
    const zone = gutterZoneBounds(rows, gutter);
    if (!zone) return null;

    const zoneRows = rows.slice(zone.start, zone.end);
    const rtl = isRtlTable(zoneRows);
    const columns = clusterColumns(zoneRows, ctx.bodyFontSize, rtl);
    if (!columns || columns.positions.length < MIN_COLS) return null;
    if (looksCellular(zoneRows, columns.positions.length, true)) return null;

    const groups = zoneColumnGroups(zoneRows, columns, rtl);
    if (groups.length < MIN_COLS) return null;
    if (groups.some(group => distinctBaselines(group) < COLUMN_ZONE_MIN_ROWS)) return null;
    return {
        before: rows.slice(0, zone.start).flat(),
        columns: groups,
        after: rows.slice(zone.end).flat(),
    };
}

/**
 * The x of the strongest inner column start — a second column's left edge
 * shared by at least {@link COLUMN_ZONE_MIN_ROWS} rows. Only non-leftmost
 * segments count, so the page margin never qualifies. Returns null for a
 * single-column band.
 */
function detectSecondaryGutter(rows: readonly Line[][], tolerance: number): number | null {
    const innerStarts: Array<{ value: number; rowIdx: number }> = [];
    rows.forEach((row, rowIdx) => {
        const sorted = [...row].sort((a, b) => a.x - b.x);
        for (let i = 1; i < sorted.length; i++) innerStarts.push({ value: sorted[i].x, rowIdx });
    });
    if (innerStarts.length < COLUMN_ZONE_MIN_ROWS) return null;
    const clusters = clusterWithSupport(innerStarts, tolerance);
    let best: { center: number; rows: Set<number> } | null = null;
    for (const cluster of clusters) {
        if (!best || cluster.rows.size > best.rows.size) best = cluster;
    }
    return best && best.rows.size >= COLUMN_ZONE_MIN_ROWS ? best.center - GUTTER_INSET : null;
}

/** Splits lines that overhang the gutter with a real internal gap; leaves
 *  genuine full-width spanners (no wide gap at the gutter) intact. */
function splitStraddlingLines(band: readonly Line[], gutter: number): Line[] {
    const result: Line[] = [];
    for (const line of band) {
        const straddles = line.x < gutter - GUTTER_SPLIT_TOLERANCE &&
            line.endX > gutter + GUTTER_SPLIT_TOLERANCE;
        if (straddles) {
            result.push(...splitLineAtGutter(line, gutter));
        } else {
            result.push(line);
        }
    }
    return result;
}

function splitLineAtGutter(line: Line, gutter: number): Line[] {
    const sorted = [...line.words].sort((a, b) => a.x - b.x);
    const minGap = line.fontSize * GUTTER_GAP_EM;
    const hasColumnGap = sorted.some((word, i) =>
        i > 0 && sorted[i - 1].endX <= gutter && word.x >= gutter &&
        word.x - sorted[i - 1].endX >= minGap);
    if (!hasColumnGap) return [line];
    const left = line.words.filter(w => (w.x + w.endX) / 2 < gutter);
    const right = line.words.filter(w => (w.x + w.endX) / 2 >= gutter);
    if (left.length === 0 || right.length === 0) return [line];
    return [lineFromWords(left, line), lineFromWords(right, line)];
}

function lineFromWords(words: Word[], source: Line): Line {
    return {
        words,
        x: Math.min(...words.map(w => w.x)),
        endX: Math.max(...words.map(w => w.endX)),
        y: source.y,
        fontSize: source.fontSize,
        dir: detectDirection(words),
        page: source.page,
    };
}

interface RowSides {
    readonly left: boolean;
    readonly right: boolean;
    readonly spanner: boolean;
}

function classifyRowSides(row: readonly Line[], gutter: number): RowSides {
    let left = false;
    let right = false;
    let spanner = false;
    for (const line of row) {
        if (line.x < gutter - GUTTER_SPLIT_TOLERANCE && line.endX > gutter + GUTTER_SPLIT_TOLERANCE) {
            spanner = true;
        } else if ((line.x + line.endX) / 2 >= gutter) {
            right = true;
        } else {
            left = true;
        }
    }
    return { left, right, spanner };
}

/**
 * The topmost contiguous, spanner-free run of rows that carries both columns,
 * trimmed to the first and last rows holding right-column content (interior
 * left-only continuation rows are kept). Returns null when no such run has
 * enough rows on both sides.
 */
function gutterZoneBounds(
    rows: readonly Line[][],
    gutter: number,
): { start: number; end: number } | null {
    const sides = rows.map(row => classifyRowSides(row, gutter));
    let i = 0;
    while (i < sides.length) {
        if (sides[i].spanner) { i++; continue; }
        let j = i;
        while (j < sides.length && !sides[j].spanner) j++;
        const bounds = trimToColumnRows(sides, i, j);
        if (bounds) return bounds;
        i = j;
    }
    return null;
}

function trimToColumnRows(
    sides: readonly RowSides[],
    windowStart: number,
    windowEnd: number,
): { start: number; end: number } | null {
    let firstRight = -1;
    let lastRight = -1;
    for (let k = windowStart; k < windowEnd; k++) {
        if (sides[k].right) {
            if (firstRight < 0) firstRight = k;
            lastRight = k;
        }
    }
    if (firstRight < 0) return null;
    let rightRows = 0;
    let leftRows = 0;
    for (let k = firstRight; k <= lastRight; k++) {
        if (sides[k].right) rightRows++;
        if (sides[k].left) leftRows++;
    }
    if (rightRows < COLUMN_ZONE_MIN_ROWS || leftRows < COLUMN_ZONE_MIN_ROWS) return null;
    return { start: firstRight, end: lastRight + 1 };
}

/** Groups a zone's lines into columns (reading order) by their column edge. */
function zoneColumnGroups(
    zoneRows: readonly Line[][],
    columns: ColumnModel,
    rtl: boolean,
): Line[][] {
    const groups: Line[][] = columns.positions.map(() => []);
    for (const line of zoneRows.flat()) {
        const value = columns.byCenter ? centerOf(line) : edgeOf(line, rtl);
        groups[nearestColumnIndex(value, columns.positions)].push(line);
    }
    const filled = groups.filter(group => group.length > 0);
    filled.sort((a, b) => Math.min(...a.map(l => l.x)) - Math.min(...b.map(l => l.x)));
    return rtl ? [...filled].reverse() : filled;
}

function nearestColumnIndex(value: number, positions: readonly number[]): number {
    let bestIdx = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let i = 0; i < positions.length; i++) {
        const dist = Math.abs(value - positions[i]);
        if (dist < bestDist) { bestDist = dist; bestIdx = i; }
    }
    return bestIdx;
}

function distinctBaselines(lines: readonly Line[]): number {
    const sorted = [...lines].sort((a, b) => b.y - a.y);
    const tolerance = (sorted[0]?.fontSize ?? 12) * 0.5;
    let count = 0;
    let last = Number.POSITIVE_INFINITY;
    for (const line of sorted) {
        if (last - line.y > tolerance) {
            count++;
            last = line.y;
        }
    }
    return count;
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
            border: '',
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
