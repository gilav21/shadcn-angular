import type { ImageItem, PathRect } from '../pdf-parser';
import { classifyGroup, type ClassifyContext, type GroupKind } from './readable-classify';
import { resolveBlockStyle, type ColumnBounds } from './readable-styles';
import { findTableInBand } from './readable-tables';
import type {
    BlockStyle,
    DocBlock,
    ImageBlock,
    Line,
    PageExtract,
    RuleBlock,
} from './readable-types';

const PARAGRAPH_GAP_FACTOR = 1.8;
const FONT_SIZE_CHANGE_RATIO = 1.2;
const MAX_CUT_DEPTH = 4;
const MIN_COLUMN_LINES = 2;
const UNDERLINE_MAX_HEIGHT = 2.5;
const RULE_MAX_HEIGHT = 3;

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
    const withRules = interleaveByTop(blocks, detectRules(page, usedRects, lines));
    if (!includeImages || page.images.length === 0) return withRules;
    return interleaveImages(withRules, page.images, page.index);
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
    const split = findTableInBand(lines, tableRects, pageIndex, ctx);
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
        blocks.push(...xyCut(band, 1).flatMap(region => regionToBlocks(region, pageIndex, ctx)));
    }
    return blocks;
}

// ── XY-cut segmentation ─────────────────────────────────────────────────

/** Recursively splits lines into reading-ordered regions (bands, then columns). */
export function xyCut(lines: Line[], depth: number): Line[][] {
    if (lines.length <= 1 || depth >= MAX_CUT_DEPTH) return [lines];
    const bands = splitVerticalBands(lines);
    if (bands.length > 1) return bands.flatMap(band => xyCut(band, depth + 1));
    const columns = splitColumns(lines);
    if (columns.length > 1) return columns.flatMap(column => xyCut(column, depth + 1));
    return [lines];
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

function regionToBlocks(rawRegion: Line[], pageIndex: number, ctx: ClassifyContext): DocBlock[] {
    if (rawRegion.length === 0) return [];
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
    return previous.dir !== line.dir;
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
    return page.rects
        .filter(rect => !usedRects.has(rect) &&
            rect.height <= RULE_MAX_HEIGHT &&
            rect.width >= contentWidth * 0.4 &&
            (rect.stroked || rect.filled))
        .map(rect => ({
            kind: 'rule' as const,
            page: page.index,
            style: emptyStyle(),
            top: rect.y,
        }));
}

function emptyStyle(): BlockStyle {
    return { align: '', indentStart: 0, textIndent: 0, lineHeight: 0, marginTop: 0, dir: '' };
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
