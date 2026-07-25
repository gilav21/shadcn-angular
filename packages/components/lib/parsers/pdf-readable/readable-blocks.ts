import type { ImageItem, PathRect } from '../pdf-parser';
import { classifyGroup, hasListMarker, type ClassifyContext, type GroupKind } from './readable-classify';
import { resolveBlockStyle, type ColumnBounds } from './readable-styles';
import { findColumnZone, findTableInBand } from './readable-tables';
import type {
    BlockStyle,
    ColumnsBlock,
    DocBlock,
    HeadingBlock,
    ImageBlock,
    Line,
    PageExtract,
    ParagraphBlock,
    RuleBlock,
    TableBlock,
} from './readable-types';

const PARAGRAPH_GAP_FACTOR = 1.8;
const FONT_SIZE_CHANGE_RATIO = 1.2;
/**
 * Font-size ratio between a bullet line and an adjacent non-bullet line above
 * which the non-bullet line is treated as an interleaved subheading rather than
 * a wrapped list continuation. Below the {@link FONT_SIZE_CHANGE_RATIO}
 * paragraph split so only list boundaries are affected; above the 0.5pt font
 * rounding so same-size continuations never trip it.
 */
const LIST_SUBHEADING_RATIO = 1.05;
const MAX_CUT_DEPTH = 4;
const MIN_COLUMN_LINES = 2;
const UNDERLINE_MAX_HEIGHT = 2.5;
const RULE_MAX_HEIGHT = 3;
/** Rules within this vertical distance (pt) collapse to one separator. */
const RULE_MERGE_GAP = 4;

/**
 * Converts one page's lines (top-to-bottom) into typed, ordered blocks:
 * recursive XY-cut into columns/regions, paragraph grouping, classification
 * (headings/lists/blockquotes), underline flagging from drawn rects,
 * horizontal rules, and image anchoring with float detection.
 */
export function buildPageBlocks(
    lines: Line[],
    page: PageExtract,
    includeImages: boolean,
    docCtx: Omit<ClassifyContext, 'pageBounds'>,
): DocBlock[] {
    const ctx: ClassifyContext = {
        ...docCtx,
        pageBounds: lines.length > 0 ? boundsOfLines(lines) : { x0: 0, x1: page.width },
    };
    const usedRects = applyUnderlines(lines, page.rects);
    const tableRects = page.rects.filter(rect => !usedRects.has(rect));
    const blocks = linesToBlocks(lines, tableRects, page.index, ctx, usedRects);
    applyFillBackgrounds(blocks, page.rects);
    const withRules = interleaveByTop(blocks, detectRules(page, usedRects, lines));
    if (!includeImages || page.images.length === 0) return withRules;
    const images = page.images.filter(img => !isBackgroundDecoration(img, page.width * page.height));
    if (images.length === 0) return withRules;
    const consumed = applyButtonBoxes(withRules, images);
    const remaining = consumed.size > 0 ? images.filter(img => !consumed.has(img)) : images;
    return remaining.length > 0 ? interleaveImages(withRules, remaining, page.index) : withRules;
}

/** A stroked outline outside this size band is a frame/panel, not a button. */
const BUTTON_MIN_W = 24;
const BUTTON_MAX_W = 320;
const BUTTON_MIN_H = 10;
const BUTTON_MAX_H = 60;
/** A button label is at most this many words on one line. */
const BUTTON_MAX_WORDS = 4;

/**
 * Reconstructs a bordered button. A PDF draws a button as an unfilled stroked
 * rounded-rect outline plus an independent text label; a flow layout cannot
 * overlap them, so they render as an empty box stacked above a loose label.
 * When a button-sized outline geometrically contains exactly one short
 * single-line text block, that block takes the outline as a CSS border and the
 * outline image — plus any identical fill twin painted behind it — is withheld
 * from image interleaving. Ambiguous outlines (zero or several contained
 * labels) are left untouched so panels and framed paragraphs never collapse.
 */
function applyButtonBoxes(blocks: readonly DocBlock[], images: readonly ImageItem[]): Set<ImageItem> {
    const consumed = new Set<ImageItem>();
    for (const outline of images) {
        if (!isButtonOutline(outline)) continue;
        const label = singleContainedLabel(blocks, outline);
        if (!label) continue;
        const width = outline.svgStrokeWidth && outline.svgStrokeWidth > 0 ? outline.svgStrokeWidth : 1;
        label.style.border = `${width.toFixed(1)}pt solid ${outline.svgStrokeColor}`;
        consumed.add(outline);
        for (const twin of images) {
            if (twin !== outline && sameBox(twin, outline)) consumed.add(twin);
        }
    }
    return consumed;
}

function isButtonOutline(img: ImageItem): boolean {
    if (!img.svgStrokeColor) return false;
    const w = img.renderWidth;
    const h = img.renderHeight;
    return w >= BUTTON_MIN_W && w <= BUTTON_MAX_W && h >= BUTTON_MIN_H && h <= BUTTON_MAX_H && w > h;
}

function sameBox(a: ImageItem, b: ImageItem): boolean {
    return Math.abs(a.x - b.x) <= 2 && Math.abs(a.y - b.y) <= 2
        && Math.abs(a.renderWidth - b.renderWidth) <= 2
        && Math.abs(a.renderHeight - b.renderHeight) <= 2;
}

/** The lone short single-line label whose centre sits inside the outline, or
 *  null when zero or several blocks qualify (ambiguous). */
function singleContainedLabel(
    blocks: readonly DocBlock[],
    outline: ImageItem,
): ParagraphBlock | HeadingBlock | null {
    let found: ParagraphBlock | HeadingBlock | null = null;
    for (const block of blocks) {
        if (block.kind !== 'paragraph' && block.kind !== 'heading') continue;
        if (block.lines.length !== 1 || block.lines[0].words.length > BUTTON_MAX_WORDS) continue;
        if (!outlineContainsLine(outline, block.lines[0])) continue;
        if (found) return null;
        found = block;
    }
    return found;
}

/** The image `y` is the outline's vertical centre; its true band is y ± h/2. */
function outlineContainsLine(outline: ImageItem, line: Line): boolean {
    const halfHeight = outline.renderHeight / 2;
    const centerX = (line.x + line.endX) / 2;
    return centerX >= outline.x && centerX <= outline.x + outline.renderWidth
        && line.y >= outline.y - halfHeight && line.y <= outline.y + halfHeight;
}

/**
 * A single near-empty vector blown up to cover most of the page is a
 * background or watermark, not content. Rendered inline in the reading view it
 * only injects a large blank gap, so it is dropped. Guarded on a tiny payload
 * so real full-page photos or charts (large rasters) are never suppressed.
 */
function isBackgroundDecoration(image: ImageItem, pageArea: number): boolean {
    const coverage = pageArea > 0 ? (image.renderWidth * image.renderHeight) / pageArea : 0;
    return coverage > 0.4 && image.dataUrl.length < 6000;
}

/** Smallest filled rect worth treating as a block background, in pt². */
const MIN_FILL_AREA = 1500;

/**
 * Reconstructs solid colour blocks (headers, callouts, badges) by giving a text
 * block the fill of the saturated rectangle it sits on. Without this, light
 * text designed to sit on a coloured panel — invisible on the white reading
 * surface — is lost. Only saturated fills qualify so black rules and grey
 * shading never turn same-coloured text unreadable.
 */
function applyFillBackgrounds(blocks: readonly DocBlock[], rects: readonly PathRect[]): void {
    const fills = rects.filter(r =>
        r.filled && r.width * r.height >= MIN_FILL_AREA && isSaturatedColor(r.fillColor));
    if (fills.length === 0) return;
    for (const block of blocks) {
        if (block.kind === 'table') {
            applyCellBackgrounds(block, fills);
            continue;
        }
        const bounds = textBlockBounds(block);
        if (bounds) {
            const fill = fills.find(r => rectCoversCentroid(r, bounds));
            if (fill) block.style.background = fill.fillColor;
        }
    }
}

/**
 * Gives a table cell the saturated fill it sits on — a highlighted total
 * (light text on a coloured box) is otherwise invisible on the white surface.
 * Applied per cell because a table row rarely shares one background.
 */
function applyCellBackgrounds(table: TableBlock, fills: readonly PathRect[]): void {
    for (const row of table.rows) {
        for (const cell of row) {
            if (cell.lines.length === 0) continue;
            const centroid = cellCentroid(cell.lines);
            const fill = fills.find(r => rectCoversCentroid(r, centroid));
            if (fill) cell.background = fill.fillColor;
        }
    }
}

function cellCentroid(lines: readonly Line[]): Centroid {
    let sx = 0;
    let sy = 0;
    for (const line of lines) {
        sx += (line.x + line.endX) / 2;
        sy += line.y;
    }
    return { cx: sx / lines.length, cy: sy / lines.length };
}

interface Centroid { readonly cx: number; readonly cy: number; }

function textBlockBounds(block: DocBlock): Centroid | null {
    const lines = textLinesOf(block);
    if (lines.length === 0) return null;
    let sx = 0;
    let sy = 0;
    for (const line of lines) {
        sx += (line.x + line.endX) / 2;
        sy += line.y;
    }
    return { cx: sx / lines.length, cy: sy / lines.length };
}

function rectCoversCentroid(rect: PathRect, c: Centroid): boolean {
    return c.cx >= rect.x && c.cx <= rect.x + rect.width &&
        c.cy >= rect.y && c.cy <= rect.y + rect.height;
}

function isSaturatedColor(hex: string): boolean {
    const match = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!match) return false;
    const value = Number.parseInt(match[1], 16);
    const r = (value >> 16) & 0xff;
    const g = (value >> 8) & 0xff;
    const b = value & 0xff;
    return Math.max(r, g, b) - Math.min(r, g, b) > 40;
}

/**
 * Table detection runs before band/column splitting — a ruled grid's widely
 * spaced rows would otherwise be cut into separate bands, and an unruled
 * table's aligned cells would be segmented as layout columns. `before`/
 * `after` remainders are re-analyzed recursively; each detected table
 * consumes at least two rows, so recursion terminates.
 */
function linesToBlocks(
    lines: Line[],
    tableRects: readonly PathRect[],
    pageIndex: number,
    ctx: ClassifyContext,
    usedRects: Set<PathRect>,
): DocBlock[] {
    if (lines.length === 0) return [];
    const split = findTableInBand(lines, tableRects, pageIndex, ctx, { unruled: 'strict' });
    if (split) {
        for (const rect of split.usedRects) usedRects.add(rect);
        return [
            ...linesToBlocks(split.before, tableRects, pageIndex, ctx, usedRects),
            split.table,
            ...linesToBlocks(split.after, tableRects, pageIndex, ctx, usedRects),
        ];
    }
    const blocks: DocBlock[] = [];
    for (const band of splitVerticalBands(lines)) {
        blocks.push(...bandToBlocks(band, pageIndex, ctx));
    }
    return blocks;
}

/**
 * Splits one vertical band into blocks, detecting an unruled table before the
 * XY-cut so a short, aligned cellular grid (e.g. a centered signature block)
 * is not sliced into one stacked column per cell. Multi-column prose fails the
 * cellular test and falls through to column cutting. Rows above/below the
 * table are handled recursively, exactly as at page level.
 */
function bandToBlocks(band: Line[], pageIndex: number, ctx: ClassifyContext): DocBlock[] {
    const split = findTableInBand(band, [], pageIndex, ctx, { ruled: false, unruled: 'strict' });
    if (split) {
        return [
            ...bandToBlocks(split.before, pageIndex, ctx),
            split.table,
            ...bandToBlocks(split.after, pageIndex, ctx),
        ];
    }
    return cutToBlocks(band, 1, pageIndex, ctx);
}

/**
 * Column-aware variant of {@link xyCut} that builds blocks directly: a
 * vertical band-split recurses into stacked blocks, but a horizontal
 * column-split is wrapped in a {@link ColumnsBlock} so the columns render side
 * by side instead of one after another. Spanner-tolerant splits keep their
 * flattened (stacked) reading order — the spanning rows between column groups
 * make a single parallel row unsound.
 */
function cutToBlocks(
    lines: Line[],
    depth: number,
    pageIndex: number,
    ctx: ClassifyContext,
): DocBlock[] {
    if (lines.length <= 1 || depth >= MAX_CUT_DEPTH) return regionToBlocks(lines, pageIndex, ctx);
    const bands = splitVerticalBands(lines);
    if (bands.length > 1) return bands.flatMap(band => cutToBlocks(band, depth + 1, pageIndex, ctx));
    const columns = splitColumns(lines);
    if (columns.length > 1) {
        return columnsSpanMultipleRows(columns)
            ? [columnsBlockFrom(columns, depth, pageIndex, ctx)]
            : columns.flatMap(column => cutToBlocks(column, depth + 1, pageIndex, ctx));
    }
    const aroundSpanners = splitColumnsAroundSpanners(lines);
    if (aroundSpanners.length > 1) {
        return aroundSpanners.flatMap(region => cutToBlocks(region, depth + 1, pageIndex, ctx));
    }
    const zone = findColumnZone(lines, ctx);
    if (zone) {
        return [
            ...cutToBlocks(zone.before, depth + 1, pageIndex, ctx),
            columnsBlockFrom(zone.columns, depth, pageIndex, ctx),
            ...cutToBlocks(zone.after, depth + 1, pageIndex, ctx),
        ];
    }
    return regionToBlocks(lines, pageIndex, ctx);
}

/**
 * Rows every column must span to render side by side. Set above 2 so a short
 * header strip (a contact block beside a title) is not forced into cells —
 * only a genuine multi-row column layout (a receipt's parallel columns) does.
 */
const MIN_COLUMN_ROWS = 3;

/**
 * True only when every column spans multiple distinct baselines. A single
 * visual line whose cells sit at one baseline (a right-aligned label with its
 * value across the page) fragments into "columns" of one row each — rendering
 * that side by side would cramp a full-width line into a narrow cell.
 */
function columnsSpanMultipleRows(columns: readonly Line[][]): boolean {
    return columns.every(column => distinctBaselineCount(column) >= MIN_COLUMN_ROWS);
}

function distinctBaselineCount(lines: readonly Line[]): number {
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

/** Wraps parallel column regions as one side-by-side row, widths from geometry. */
function columnsBlockFrom(
    columns: Line[][],
    depth: number,
    pageIndex: number,
    ctx: ClassifyContext,
): ColumnsBlock {
    const widthRatios = columnZoneRatios(columns);
    const groups = columns.map((col, i) => ({
        blocks: cutToBlocks(col, depth + 1, pageIndex, { ...ctx, pageBounds: boundsOfLines(col) }),
        widthRatio: widthRatios[i],
    }));
    const allLines = columns.flat();
    const dir = allLines.filter(l => l.dir === 'rtl').length * 2 > allLines.length ? 'rtl' : '';
    return { kind: 'columns', columns: groups, page: pageIndex, style: { ...emptyStyle(), dir } };
}

/**
 * Each column's share of the row width from its allocated horizontal zone —
 * its own extent plus the surrounding whitespace, split at the gutter
 * midpoints. Sizing by bare text extent would starve a narrow-text column
 * (a contact block) and wrap it to a sliver; the zone gives it the room the
 * original left for it.
 */
function columnZoneRatios(columns: readonly Line[][]): number[] {
    const spans = columns.map(col => ({
        x0: Math.min(...col.map(l => l.x)),
        x1: Math.max(...col.map(l => l.endX)),
    }));
    const overallX0 = Math.min(...spans.map(s => s.x0));
    const overallX1 = Math.max(...spans.map(s => s.x1));
    const totalWidth = Math.max(1, overallX1 - overallX0);
    const order = spans.map((_, i) => i).sort((a, b) => spans[a].x0 - spans[b].x0);
    const ratios = new Array<number>(columns.length).fill(0);
    for (let k = 0; k < order.length; k++) {
        const i = order[k];
        const left = k === 0 ? overallX0 : (spans[order[k - 1]].x1 + spans[i].x0) / 2;
        const right = k === order.length - 1 ? overallX1 : (spans[i].x1 + spans[order[k + 1]].x0) / 2;
        ratios[i] = Math.max(1, right - left) / totalWidth;
    }
    return ratios;
}

// ── XY-cut segmentation ─────────────────────────────────────────────────

/** Recursively splits lines into reading-ordered regions (bands, then columns). */
export function xyCut(lines: Line[], depth: number): Line[][] {
    if (lines.length <= 1 || depth >= MAX_CUT_DEPTH) return [lines];
    const bands = splitVerticalBands(lines);
    if (bands.length > 1) return bands.flatMap(band => xyCut(band, depth + 1));
    const columns = splitColumns(lines);
    if (columns.length > 1) return columns.flatMap(column => xyCut(column, depth + 1));
    const aroundSpanners = splitColumnsAroundSpanners(lines);
    if (aroundSpanners.length > 1) return aroundSpanners.flatMap(region => xyCut(region, depth + 1));
    return [lines];
}

/** A line spanning most of the region width vetoes any column valley. */
const SPANNER_WIDTH_RATIO = 0.7;

/**
 * Column split tolerant of full-width lines: a title or section header that
 * crosses the gutter must not collapse the columns beneath it. Spanning
 * lines become their own vertical chunks; the flowing lines between them are
 * column-split using valleys computed from the flowing lines alone. Chunks
 * whose lines cross a valley stay unsplit — no content is ever reordered
 * across a boundary that the geometry does not support.
 */
function splitColumnsAroundSpanners(lines: Line[]): Line[][] {
    if (lines.length < MIN_COLUMN_LINES * 2 + 1) return [lines];
    const x0 = Math.min(...lines.map(l => l.x));
    const x1 = Math.max(...lines.map(l => l.endX));
    const width = x1 - x0;
    if (width <= 0) return [lines];

    const isWide = (line: Line): boolean => (line.endX - line.x) > width * SPANNER_WIDTH_RATIO;
    let flowing = lines.filter(line => !isWide(line));
    if (flowing.length < MIN_COLUMN_LINES * 2) return [lines];

    let cuts = findColumnValleys(flowing).sort((a, b) => a - b);
    const crossers = new Set<Line>();
    if (cuts.length === 0) {
        const tolerant = findLowCoverageValley(flowing);
        if (!tolerant) return [lines];
        for (const line of tolerant.crossers) crossers.add(line);
        flowing = flowing.filter(line => !crossers.has(line));
        if (flowing.length < MIN_COLUMN_LINES * 2) return [lines];
        cuts = [tolerant.cut];
    }
    const isSpanner = (line: Line): boolean => isWide(line) || crossers.has(line);

    const chunks = chunkBySpanners(lines, isSpanner);
    const regions: Line[][] = [];
    let didSplit = false;
    for (const chunk of chunks) {
        const split = splitChunkAtCuts(chunk, cuts);
        if (split.length > 1) didSplit = true;
        regions.push(...split);
    }
    return didSplit ? regions : [lines];
}

/** Fraction of flowing lines allowed to cross a tolerant valley. */
const MAX_CROSSER_RATIO = 0.12;

/**
 * Fallback gutter search when no zero-coverage valley exists: finds the
 * lowest-coverage vertical strip wide enough to be a column gutter, provided
 * only a small fraction of lines cross it. Those crossers are returned so
 * the caller can isolate them as their own chunks instead of letting them
 * veto the entire column structure.
 */
function findLowCoverageValley(lines: readonly Line[]): { cut: number; crossers: Line[] } | null {
    const x0 = Math.floor(Math.min(...lines.map(l => l.x)));
    const x1 = Math.ceil(Math.max(...lines.map(l => l.endX)));
    const width = x1 - x0;
    if (width <= 0) return null;

    const coverage = new Array<number>(width).fill(0);
    for (const line of lines) {
        const from = Math.max(0, Math.floor(line.x) - x0);
        const to = Math.min(width, Math.ceil(line.endX) - x0);
        for (let i = from; i < to; i++) coverage[i]++;
    }
    const minValley = Math.max(6, medianFontSize(lines) * 0.5);
    const maxCrossers = Math.max(1, Math.floor(lines.length * MAX_CROSSER_RATIO));
    const edgeMargin = width * 0.1;

    let best: { cut: number; cost: number } | null = null;
    for (let start = Math.ceil(edgeMargin); start + minValley < width - edgeMargin; start++) {
        let peak = 0;
        for (let i = start; i < start + minValley; i++) peak = Math.max(peak, coverage[i]);
        if (peak > maxCrossers) continue;
        if (!best || peak < best.cost) best = { cut: x0 + start + minValley / 2, cost: peak };
    }
    if (!best) return null;
    const crossers = lines.filter(line => line.x < best.cut && line.endX > best.cut);
    if (crossers.length > maxCrossers) return null;
    return { cut: best.cut, crossers };
}

/** Groups y-sorted lines into runs, breaking at every spanning line. */
function chunkBySpanners(lines: Line[], isSpanner: (line: Line) => boolean): Line[][] {
    const sorted = [...lines].sort((a, b) => b.y - a.y || a.x - b.x);
    const chunks: Line[][] = [];
    for (const line of sorted) {
        const current = chunks.at(-1);
        if (isSpanner(line)) {
            chunks.push([line], []);
        } else if (current && !current.some(isSpanner)) {
            current.push(line);
        } else {
            chunks.push([line]);
        }
    }
    return chunks.filter(chunk => chunk.length > 0);
}

function splitChunkAtCuts(chunk: Line[], cuts: readonly number[]): Line[][] {
    if (chunk.length < MIN_COLUMN_LINES * 2) return [chunk];
    if (chunk.some(line => cuts.some(cut => line.x < cut && line.endX > cut))) return [chunk];

    const columns: Line[][] = Array.from({ length: cuts.length + 1 }, () => []);
    for (const line of chunk) {
        columns[columnIndexFor(line, cuts)].push(line);
    }
    const filled = columns.filter(column => column.length >= MIN_COLUMN_LINES);
    if (filled.length < 2 || filled.length !== columns.filter(c => c.length > 0).length) return [chunk];
    return orderColumns(filled, chunk);
}

function splitVerticalBands(lines: Line[]): Line[][] {
    const sorted = [...lines].sort((a, b) => b.y - a.y);
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
        gaps.push(sorted[i - 1].y - sorted[i].y);
    }
    const fontSize = medianFontSize(sorted);
    const threshold = Math.max(typicalLeading(gaps, fontSize) * 2.5, fontSize * 2.5);

    const bands: Line[][] = [[sorted[0]]];
    for (let i = 1; i < sorted.length; i++) {
        if (gaps[i - 1] > threshold) {
            bands.push([sorted[i]]);
        } else {
            bands.at(-1)?.push(sorted[i]);
        }
    }
    return bands;
}

/** Median positive baseline gap with outliers (> 3 em) excluded. */
function typicalLeading(gaps: readonly number[], fontSize: number): number {
    const usual = gaps.filter(g => g > 0 && g <= fontSize * 3).sort((a, b) => a - b);
    if (usual.length === 0) return fontSize * 1.2;
    return usual[Math.floor(usual.length / 2)];
}

function splitColumns(lines: Line[]): Line[][] {
    if (lines.length < MIN_COLUMN_LINES * 2) return [lines];
    const valleys = findColumnValleys(lines);
    if (valleys.length === 0) return [lines];

    const cuts = [...valleys].sort((a, b) => a - b);
    const columns: Line[][] = Array.from({ length: cuts.length + 1 }, () => []);
    for (const line of lines) {
        columns[columnIndexFor(line, cuts)].push(line);
    }
    const filled = columns.filter(column => column.length >= MIN_COLUMN_LINES);
    if (filled.length < 2 || filled.length !== columns.length) return [lines];
    return orderColumns(filled, lines);
}

function columnIndexFor(line: Line, cuts: readonly number[]): number {
    for (let i = 0; i < cuts.length; i++) {
        if (line.endX <= cuts[i]) return i;
    }
    return cuts.length;
}

function findColumnValleys(lines: Line[]): number[] {
    const x0 = Math.floor(Math.min(...lines.map(l => l.x)));
    const x1 = Math.ceil(Math.max(...lines.map(l => l.endX)));
    const width = x1 - x0;
    if (width <= 0) return [];

    const coverage = new Array<number>(width).fill(0);
    for (const line of lines) {
        const from = Math.max(0, Math.floor(line.x) - x0);
        const to = Math.min(width, Math.ceil(line.endX) - x0);
        for (let i = from; i < to; i++) coverage[i]++;
    }
    return zeroRunValleys(coverage, x0, width, medianFontSize(lines));
}

function zeroRunValleys(
    coverage: readonly number[],
    x0: number,
    width: number,
    fontSize: number,
): number[] {
    const minValley = Math.max(6, fontSize * 0.5);
    const edgeMargin = width * 0.1;
    const valleys: number[] = [];
    let runStart = -1;
    for (let i = 0; i <= coverage.length; i++) {
        const isZero = i < coverage.length && coverage[i] === 0;
        if (isZero && runStart < 0) runStart = i;
        if (isZero || runStart < 0) continue;
        const runLength = i - runStart;
        const center = runStart + runLength / 2;
        if (runLength >= minValley && center > edgeMargin && center < width - edgeMargin) {
            valleys.push(x0 + center);
        }
        runStart = -1;
    }
    return valleys;
}

function orderColumns(columns: Line[][], allLines: readonly Line[]): Line[][] {
    const byLeftEdge = [...columns].sort(
        (a, b) => Math.min(...a.map(l => l.x)) - Math.min(...b.map(l => l.x)));
    const rtlCount = allLines.filter(l => l.dir === 'rtl').length;
    return rtlCount * 2 > allLines.length ? byLeftEdge.reverse() : byLeftEdge;
}

function medianFontSize(lines: readonly Line[]): number {
    const sizes = lines.map(l => l.fontSize).sort((a, b) => a - b);
    return sizes[Math.floor(sizes.length / 2)] ?? 12;
}

// ── Region → typed blocks ───────────────────────────────────────────────

/**
 * Unruled table detection runs here — per region, AFTER column splitting —
 * because at page level an unruled table is indistinguishable from a
 * multi-column text layout and detection would swallow the columns.
 */
function regionToBlocks(rawRegion: Line[], pageIndex: number, ctx: ClassifyContext): DocBlock[] {
    if (rawRegion.length === 0) return [];
    const tableSplit = findTableInBand(rawRegion, [], pageIndex, ctx, { ruled: false });
    if (tableSplit) {
        return [
            ...regionToBlocks(tableSplit.before, pageIndex, ctx),
            tableSplit.table,
            ...regionToBlocks(tableSplit.after, pageIndex, ctx),
        ];
    }
    const region = mergeSameBaselineLines(rawRegion);
    const bounds = boundsOfLines(region);
    const groups = splitIntoParagraphGroups(region);
    const blocks: DocBlock[] = [];
    let previousBaseline: number | null = null;
    for (const lines of groups) {
        const gapAbove = previousBaseline === null ? null : previousBaseline - lines[0].y;
        const kind = classifyGroup(lines, bounds, gapAbove, ctx);
        const style = resolveBlockStyle(lines, bounds, previousBaseline, ctx.pageBounds);
        blocks.push(blockFrom(kind, lines, pageIndex, style));
        previousBaseline = lines.at(-1)?.y ?? previousBaseline;
    }
    return blocks;
}

function blockFrom(
    kind: GroupKind,
    lines: Line[],
    page: number,
    style: BlockStyle,
): DocBlock {
    switch (kind.kind) {
        case 'heading':
            return { kind: 'heading', level: kind.level, lines: [...lines], page, style };
        case 'list':
            return { kind: 'list', ordered: kind.ordered, items: kind.items, page, style };
        case 'blockquote':
            return { kind: 'blockquote', lines: [...lines], page, style };
        default:
            return { kind: 'paragraph', lines: [...lines], page, style };
    }
}

/**
 * Rejoins hard-break segments that share a baseline inside one region.
 * Segmentation exists so the XY-cut can see column valleys; once a region is
 * final, same-baseline segments were one visual line and must not stack as
 * separate paragraphs.
 */
function mergeSameBaselineLines(region: readonly Line[]): Line[] {
    const sorted = [...region].sort((a, b) => b.y - a.y || a.x - b.x);
    const merged: Line[] = [];
    for (const line of sorted) {
        const previous = merged.at(-1);
        if (previous && Math.abs(previous.y - line.y) <= previous.fontSize * 0.35) {
            merged[merged.length - 1] = joinLines(previous, line);
        } else {
            merged.push(line);
        }
    }
    return merged;
}

function joinLines(a: Line, b: Line): Line {
    const rtl = a.dir === 'rtl' || b.dir === 'rtl';
    const [left, right] = a.x <= b.x ? [a, b] : [b, a];
    const [first, second] = rtl ? [right, left] : [left, right];
    const words = [...first.words, ...second.words.map((word, i) =>
        i === 0 ? { ...word, spaceBefore: true } : word)];
    return {
        words,
        x: Math.min(a.x, b.x),
        endX: Math.max(a.endX, b.endX),
        y: a.y,
        fontSize: Math.max(a.fontSize, b.fontSize),
        dir: rtl ? 'rtl' : 'ltr',
        page: a.page,
    };
}

export function boundsOfLines(lines: readonly Line[]): ColumnBounds {
    return {
        x0: Math.min(...lines.map(l => l.x)),
        x1: Math.max(...lines.map(l => l.endX)),
    };
}

function splitIntoParagraphGroups(lines: readonly Line[]): Line[][] {
    if (lines.length === 0) return [];
    const medianGap = medianBaselineGap(lines);
    let current: Line[] = [lines[0]];
    const groups: Line[][] = [current];
    for (let i = 1; i < lines.length; i++) {
        if (startsNewParagraph(lines[i - 1], lines[i], medianGap)) {
            current = [lines[i]];
            groups.push(current);
        } else {
            current.push(lines[i]);
        }
    }
    return groups;
}

function startsNewParagraph(previous: Line, line: Line, medianGap: number): boolean {
    const gap = previous.y - line.y;
    if (gap <= 0) return true;
    if (gap > Math.max(previous.fontSize, line.fontSize) * 2.2) return true;
    if (medianGap > 0 && gap > medianGap * PARAGRAPH_GAP_FACTOR) return true;
    const sizeRatio = Math.max(previous.fontSize, line.fontSize) /
        Math.max(1, Math.min(previous.fontSize, line.fontSize));
    if (sizeRatio >= FONT_SIZE_CHANGE_RATIO) return true;
    if (isListSubheadingBoundary(previous, line, sizeRatio)) return true;
    return previous.dir !== line.dir;
}

/**
 * A subheading interleaved in a bullet list (e.g. a CV's job-title lines
 * between bullet groups) shares the list's baseline gap and stays under the
 * paragraph font-change threshold, so it would otherwise be swept into the
 * list — dropped when it precedes the first marker, or merged into the prior
 * item when it follows one. It is set apart by the bullet-marker status
 * flipping between the two lines together with a real font-size difference; a
 * genuine wrapped continuation keeps the body font, so the size gate leaves it
 * attached.
 */
function isListSubheadingBoundary(previous: Line, line: Line, sizeRatio: number): boolean {
    return hasListMarker(previous) !== hasListMarker(line) && sizeRatio >= LIST_SUBHEADING_RATIO;
}

function medianBaselineGap(lines: readonly Line[]): number {
    const gaps: number[] = [];
    for (let i = 1; i < lines.length; i++) {
        const gap = lines[i - 1].y - lines[i].y;
        if (gap > 0) gaps.push(gap);
    }
    if (gaps.length === 0) return 0;
    gaps.sort((a, b) => a - b);
    return gaps[Math.floor(gaps.length / 2)];
}

// ── Underlines & horizontal rules ───────────────────────────────────────

/** Flags words sitting directly above thin drawn rects as underlined. */
export function applyUnderlines(lines: readonly Line[], rects: readonly PathRect[]): Set<PathRect> {
    const used = new Set<PathRect>();
    for (const rect of rects) {
        if (rect.height > UNDERLINE_MAX_HEIGHT || rect.width < 4) continue;
        if (flagUnderlinedWords(lines, rect)) used.add(rect);
    }
    return used;
}

function flagUnderlinedWords(lines: readonly Line[], rect: PathRect): boolean {
    let flagged = false;
    for (const line of lines) {
        const drop = line.y - rect.y;
        if (drop < -1 || drop > line.fontSize * 0.35) continue;
        for (const word of line.words) {
            if (overlapRatio(word.x, word.endX, rect.x, rect.x + rect.width) < 0.5) continue;
            word.style = { ...word.style, underline: true };
            flagged = true;
        }
    }
    return flagged;
}

function overlapRatio(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
    const overlap = Math.min(aEnd, bEnd) - Math.max(aStart, bStart);
    const span = aEnd - aStart;
    return span <= 0 ? 0 : overlap / span;
}

function detectRules(
    page: PageExtract,
    usedRects: ReadonlySet<PathRect>,
    lines: readonly Line[],
): RuleBlock[] {
    const contentWidth = lines.length > 0
        ? Math.max(...lines.map(l => l.endX)) - Math.min(...lines.map(l => l.x))
        : page.width;
    const candidates = page.rects
        .filter(rect => !usedRects.has(rect) &&
            rect.height <= RULE_MAX_HEIGHT &&
            rect.width >= contentWidth * 0.4 &&
            (rect.stroked || rect.filled) &&
            !isNearWhite(rect.filled ? rect.fillColor : rect.strokeColor))
        .map(rect => rect.y)
        .sort((a, b) => b - a);
    return dedupeCloseTops(candidates).map(top => ({
        kind: 'rule' as const,
        page: page.index,
        style: emptyStyle(),
        top,
    }));
}

/** Collapses rules whose tops sit within {@link RULE_MERGE_GAP} — one drawn
 *  separator is often several overlapping sub-pixel rects. */
function dedupeCloseTops(descendingTops: readonly number[]): number[] {
    const result: number[] = [];
    let last = Infinity;
    for (const top of descendingTops) {
        if (last - top > RULE_MERGE_GAP) {
            result.push(top);
            last = top;
        }
    }
    return result;
}

/** A rule drawn in white (or near-white) is invisible on the page and is noise. */
function isNearWhite(color: string): boolean {
    const match = /^#([0-9a-f]{6})$/i.exec(color);
    if (!match) return false;
    const value = Number.parseInt(match[1], 16);
    return ((value >> 16) & 0xff) > 235 && ((value >> 8) & 0xff) > 235 && (value & 0xff) > 235;
}

function emptyStyle(): BlockStyle {
    return { align: '', indentStart: 0, textIndent: 0, lineHeight: 0, marginTop: 0, dir: '', background: '', border: '' };
}

// ── Image & rule interleaving ───────────────────────────────────────────

function interleaveByTop(blocks: DocBlock[], rules: RuleBlock[]): DocBlock[] {
    if (rules.length === 0) return blocks;
    const sortedRules = [...rules].sort((a, b) => b.top - a.top);
    const result: DocBlock[] = [];
    let ruleIdx = 0;
    for (const block of blocks) {
        const top = blockTopOf(block);
        while (ruleIdx < sortedRules.length && sortedRules[ruleIdx].top > top) {
            result.push(sortedRules[ruleIdx]);
            ruleIdx++;
        }
        result.push(block);
    }
    result.push(...sortedRules.slice(ruleIdx));
    return result;
}

function interleaveImages(
    blocks: readonly DocBlock[],
    images: readonly ImageItem[],
    pageIndex: number,
): DocBlock[] {
    const floatsByHost = assignFloats(blocks, images);
    const floated = new Set([...floatsByHost.values()].map(f => f.image));
    const inline = images
        .filter(img => !floated.has(img))
        .sort((a, b) => imageTop(b) - imageTop(a));
    const result: DocBlock[] = [];
    let imageIdx = 0;
    for (const block of blocks) {
        const floatImage = floatsByHost.get(block);
        if (floatImage) result.push(floatImage);
        const blockTop = blockTopOf(block);
        while (imageIdx < inline.length && imageTop(inline[imageIdx]) > blockTop) {
            result.push(imageBlockFrom(inline[imageIdx], pageIndex, ''));
            imageIdx++;
        }
        result.push(block);
    }
    while (imageIdx < inline.length) {
        result.push(imageBlockFrom(inline[imageIdx], pageIndex, ''));
        imageIdx++;
    }
    return result;
}

/** Pairs each image that sits beside a multi-line text block with that block. */
function assignFloats(
    blocks: readonly DocBlock[],
    images: readonly ImageItem[],
): Map<DocBlock, ImageBlock> {
    const byHost = new Map<DocBlock, ImageBlock>();
    for (const image of images) {
        const host = blocks.find(block => !byHost.has(block) && floatSideFor(block, image) !== null);
        if (!host) continue;
        const side = floatSideFor(host, image);
        if (side) byHost.set(host, imageBlockFrom(image, host.page, side));
    }
    return byHost;
}

function floatSideFor(block: DocBlock, image: ImageItem): 'left' | 'right' | null {
    const lines = textLinesOf(block);
    if (lines.length < 2) return null;
    const top = Math.max(...lines.map(l => l.y));
    const bottom = Math.min(...lines.map(l => l.y));
    const imgTopY = imageTop(image);
    const overlap = Math.min(top, imgTopY) - Math.max(bottom, image.y);
    if (overlap < image.renderHeight * 0.5) return null;

    const blockLeft = Math.min(...lines.map(l => l.x));
    const blockRight = Math.max(...lines.map(l => l.endX));
    const imgRight = image.x + image.renderWidth;
    if (imgRight <= blockLeft + 1) return 'left';
    if (image.x >= blockRight - 1) return 'right';
    return null;
}

function textLinesOf(block: DocBlock): readonly Line[] {
    if (block.kind === 'paragraph' || block.kind === 'heading' || block.kind === 'blockquote') {
        return block.lines;
    }
    if (block.kind === 'list') return block.items.flatMap(item => item.lines);
    if (block.kind === 'columns') {
        return block.columns.flatMap(col => col.blocks.flatMap(textLinesOf));
    }
    return [];
}

function imageTop(image: ImageItem): number {
    return image.y + image.renderHeight;
}

function blockTopOf(block: DocBlock): number {
    if (block.kind === 'image') return imageTop(block.image);
    if (block.kind === 'rule') return block.top;
    if (block.kind === 'table') {
        const firstCell = block.rows[0]?.find(cell => cell.lines.length > 0);
        return firstCell?.lines[0]?.y ?? 0;
    }
    if (block.kind === 'columns') {
        const tops = block.columns.flatMap(col => col.blocks.map(blockTopOf));
        return tops.length > 0 ? Math.max(...tops) : 0;
    }
    const lines = textLinesOf(block);
    return lines[0]?.y ?? 0;
}

function imageBlockFrom(image: ImageItem, pageIndex: number, float: '' | 'left' | 'right'): ImageBlock {
    return {
        kind: 'image',
        image,
        float,
        page: pageIndex,
        style: emptyStyle(),
    };
}
