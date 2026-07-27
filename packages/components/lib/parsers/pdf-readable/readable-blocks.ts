import type { ImageItem, PathRect } from '../pdf-parser';
import { classifyGroup, hasListMarker, type ClassifyContext, type GroupKind } from './readable-classify';
import { resolveBlockStyle, type ColumnBounds } from './readable-styles';
import { type BandTableSplit, findColumnZone, findTableInBand } from './readable-tables';
import type {
    BlockAlign,
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
    TableCellModel,
    Word,
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
/** A rule candidate within this distance (pt) of a table's row band counts as
 *  the table's own grid, not a document rule. */
const RULE_TABLE_MARGIN = 2;
/** A rule at least this fraction of the page width is a page-level separator,
 *  never a table cell gridline (cells never span the whole page). */
const PAGE_SEPARATOR_WIDTH_RATIO = 0.85;
/** A rectangular border must enclose at least this vertical span (pt); a smaller
 *  gap between two parallel rules is a pair of separators, not a bordering box. */
const MIN_BOX_HEIGHT = 20;
/** The two horizontal edges of a box must agree on x-start and width, and a
 *  vertical edge must meet a corner, within this many pt. */
const BOX_EDGE_MATCH = 6;
/** A form-field slot underline sits within this many font-sizes of the value
 *  above it and the label below it (the sandwich that distinguishes it from a
 *  bare answer-blank rule, whose space below carries no text). */
const SLOT_GAP_FONTS = 2;
/** A slot underline sits under a single value; a rule wider than this fraction
 *  of the page is a document separator or a box edge, never a field slot. */
const SLOT_MAX_WIDTH_RATIO = 0.5;

/**
 * Master switch for the nested-structure detectors (sub-detector B: left/right
 * justified single-baseline rows; sub-detector A: nested 2×2 quadrant in a
 * cell). Default OFF — a resolved region flows exactly as before until each
 * detector has been validated equal-or-better across the whole doc set.
 */
const DETECT_NESTED_STRUCTURE = true;

/** A justified row's inter-segment gap must span at least this fraction of the
 *  region width to count as a genuine left/right split rather than a word gap. */
const JUSTIFIED_GAP_RATIO = 0.25;

/** Both segments of a justified row must hug their region edge within this many
 *  font-sizes (edge-pinned test). */
const JUSTIFIED_EDGE_FONTS = 2;

/** A justified header band is short — a title strip, not a column of prose.
 *  Regions taller than this (dense multi-column pages, long content blocks) are
 *  never a two-item header. */
const JUSTIFIED_MAX_ROWS = 2;

/** The band must span most of the page/column width; a narrow region is a prose
 *  column whose per-glyph line happens to reach both its own edges. */
const JUSTIFIED_MIN_WIDTH_RATIO = 0.5;

/** Absolute floor (pt) on the band width. A justified header spans a wide page
 *  band; a narrow region (an in-cell amount|label row, whose scoped page bounds
 *  make the ratio test pass) belongs to the nested-cell detector, not here. */
const JUSTIFIED_MIN_WIDTH_PT = 300;

/** A header sits at body weight or larger; a sub-body strip (a print-chrome
 *  timestamp/URL footer) is not a document header. */
const JUSTIFIED_MIN_FONT_RATIO = 0.95;

/** Minimum trimmed length for each segment — a shorter one is a marker glyph. */
const JUSTIFIED_MIN_SEGMENT_CHARS = 3;

/** A page-number / list-marker token (digits, roman numerals, a fraction, a
 *  bare symbol) — never half of a justified content header. */
const MARKER_TOKEN_RE = /^[\divxlcm]+(?:[./-][\divxlcm]+)*%?$/i;

/** A nested quadrant's second column must begin past this fraction of the cell
 *  width — a genuine 2nd track, not a wrapped continuation. */
const QUADRANT_FAR_X_RATIO = 0.45;

/** The nested quadrant run must be at least this many consecutive rows. */
const QUADRANT_MIN_ROWS = 2;

/** …and no longer than this — a longer run is a full two-column body (owned by
 *  the outer column pass), not a leading header quadrant. */
const QUADRANT_MAX_ROWS = 3;

/** The far-x starts across the run must agree within this many font-sizes to be
 *  one shared second column rather than scattered wrapped text. */
const QUADRANT_CLUSTER_FONTS = 2;

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
        pageHeight: page.height,
    };
    const usedRects = applyUnderlines(lines, page.rects);
    applySlotUnderlines(lines, page.rects, usedRects, page.width);
    const inlined = includeImages
        ? attachInlineImages(lines, page.images)
        : new Set<ImageItem>();
    const tableRects = page.rects.filter(rect => !usedRects.has(rect));
    const blocks = applyFillBackgrounds(
        rejoinSplitBaselines(
            linesToBlocks(lines, tableRects, page.index, ctx, usedRects), ctx),
        page.rects, page.index, ctx.pageBounds);
    const boxed = applyBlockBorders(blocks, page.rects, usedRects, page.index);
    const withRules = interleaveByTop(boxed, detectRules(page, usedRects, lines, boxed));
    if (!includeImages || page.images.length === inlined.size) return withRules;
    const images = page.images.filter(img =>
        !inlined.has(img) && !isBackgroundDecoration(img, page.width * page.height));
    if (images.length === 0) return withRules;
    const consumed = applyButtonBoxes(withRules, images);
    const remaining = consumed.size > 0 ? images.filter(img => !consumed.has(img)) : images;
    if (remaining.length === 0) return withRules;
    return interleaveImages(withRules, remaining, page.index, isRtlPage(withRules) ? page.width : 0);
}

/** An inline icon is at most this multiple of the line font size tall. */
const INLINE_IMAGE_MAX_H_EM = 2.4;
/** An inline icon is at most this multiple of the line font size wide. */
const INLINE_IMAGE_MAX_W_EM = 3;
/** Horizontal slack, in em, an icon may sit outside the line's x-extent. */
const INLINE_IMAGE_SLACK_EM = 2;

/**
 * Attaches icon-sized images to the text line they flow within (a LinkedIn
 * glyph just before a profile URL). Page-level image interleave cannot reach
 * a line nested inside a column cell, so the icon becomes an inline word on
 * the line itself: height and width capped at icon size, vertical band
 * overlapping the line, x within the line's extent plus slack. Consumed
 * images are excluded from every later image pass. Insertion index follows
 * the line's reading direction so logical word order stays intact.
 */
function attachInlineImages(lines: readonly Line[], images: readonly ImageItem[]): Set<ImageItem> {
    const consumed = new Set<ImageItem>();
    const byArea = [...images].sort((a, b) =>
        b.renderWidth * b.renderHeight - a.renderWidth * a.renderHeight);
    for (const image of byArea) {
        const host = findInlineHost(lines, image);
        if (!host) continue;
        consumed.add(image);
        if (!hasInlineTwin(host, image)) insertInlineWord(host, image);
    }
    for (const image of byArea) {
        if (!consumed.has(image) && coveredByInlineImage(lines, image)) consumed.add(image);
    }
    swapStacksToTopPaint(lines, images, consumed);
    return consumed;
}

/**
 * A stacked icon paints bottom-up: background circle first, glyph last, so the
 * largest (hosting) layer is often a blank backdrop. Each inlined word swaps
 * to the last-painted non-outline layer covered by its box — the layer the
 * reader actually sees.
 */
function swapStacksToTopPaint(
    lines: readonly Line[],
    images: readonly ImageItem[],
    consumed: ReadonlySet<ImageItem>,
): void {
    for (const line of lines) {
        for (const word of line.words) {
            if (word.image) word.image = topPaintedLayer(word.image, images, consumed);
        }
    }
}

function topPaintedLayer(
    host: ImageItem,
    images: readonly ImageItem[],
    consumed: ReadonlySet<ImageItem>,
): ImageItem {
    let top = host;
    for (const candidate of images) {
        if (candidate === host || !consumed.has(candidate)) continue;
        if (candidate.svgStrokeColor) continue;
        const centerX = candidate.x + candidate.renderWidth / 2;
        const centerY = candidate.y + candidate.renderHeight / 2;
        const inside = centerX >= host.x && centerX <= host.x + host.renderWidth &&
            centerY >= host.y && centerY <= host.y + host.renderHeight;
        if (inside && images.indexOf(candidate) > images.indexOf(top)) top = candidate;
    }
    return top;
}

/** A PDF often stacks an icon from several drawings (raster + outline ring +
 *  inner glyph); once the largest is inlined, the overlapping rest are noise. */
function hasInlineTwin(line: Line, image: ImageItem): boolean {
    const centerX = image.x + image.renderWidth / 2;
    return line.words.some(w => w.image && centerX >= w.x && centerX <= w.endX);
}

/** True when the image's center falls inside an already-inlined image's box —
 *  a leftover layer of a stacked icon, dropped rather than emitted standalone. */
function coveredByInlineImage(lines: readonly Line[], image: ImageItem): boolean {
    const centerX = image.x + image.renderWidth / 2;
    const centerY = image.y + image.renderHeight / 2;
    for (const line of lines) {
        for (const word of line.words) {
            const host = word.image;
            if (!host) continue;
            if (centerX >= host.x && centerX <= host.x + host.renderWidth &&
                centerY >= host.y && centerY <= host.y + host.renderHeight) return true;
        }
    }
    return false;
}

function findInlineHost(lines: readonly Line[], image: ImageItem): Line | null {
    let best: Line | null = null;
    let bestDistance = Infinity;
    for (const line of lines) {
        if (!fitsInline(line, image)) continue;
        const outside = Math.max(
            0,
            line.x - (image.x + image.renderWidth),
            image.x - line.endX,
        );
        const distance = outside * 10 + Math.abs(image.y - line.y);
        if (distance < bestDistance) {
            best = line;
            bestDistance = distance;
        }
    }
    return best;
}

/** An adjacent badge (a header avatar hugging the line's end) is at most this
 *  multiple of the line font size in either dimension. */
const BADGE_MAX_EM = 3;
/** A badge may sit at most this multiple of the font size away from the line. */
const BADGE_GAP_EM = 1;

function fitsInline(line: Line, image: ImageItem): boolean {
    const em = Math.max(line.fontSize, 1);
    const centerY = image.y + image.renderHeight / 2;
    if (centerY < line.y - em * 0.5 || centerY > line.y + em * 1.2) return false;
    return fitsWithinLine(line, image, em) || fitsAsBadge(line, image, em);
}

/** Icon-sized and horizontally inside the line's extent (plus slack). */
function fitsWithinLine(line: Line, image: ImageItem, em: number): boolean {
    if (image.renderHeight > em * INLINE_IMAGE_MAX_H_EM) return false;
    if (image.renderWidth > em * INLINE_IMAGE_MAX_W_EM) return false;
    const slack = em * INLINE_IMAGE_SLACK_EM;
    return image.x >= line.x - slack && image.x + image.renderWidth <= line.endX + slack;
}

/** Badge-sized and hugging the line's start or end within a small gap. */
function fitsAsBadge(line: Line, image: ImageItem, em: number): boolean {
    if (image.renderHeight > em * BADGE_MAX_EM) return false;
    if (image.renderWidth > em * BADGE_MAX_EM) return false;
    const gapRight = image.x - line.endX;
    const gapLeft = line.x - (image.x + image.renderWidth);
    return (gapRight >= 0 && gapRight <= em * BADGE_GAP_EM) ||
        (gapLeft >= 0 && gapLeft <= em * BADGE_GAP_EM);
}

/** Splices the icon into the host line's words at its visual reading position. */
function insertInlineWord(line: Line, image: ImageItem): void {
    const centerX = image.x + image.renderWidth / 2;
    const before = line.dir === 'rtl'
        ? line.words.filter(w => w.x >= centerX).length
        : line.words.filter(w => w.endX <= centerX).length;
    const anchor = line.words[Math.min(before, line.words.length - 1)];
    line.words.splice(before, 0, {
        text: '',
        x: image.x,
        endX: image.x + image.renderWidth,
        y: line.y,
        fontSize: line.fontSize,
        style: anchor.style,
        mcid: anchor.mcid,
        spaceBefore: true,
        hardBreak: false,
        image,
    });
}

/** Majority of the text-bearing blocks read right-to-left. */
function isRtlPage(blocks: readonly DocBlock[]): boolean {
    let rtl = 0;
    let total = 0;
    for (const block of blocks) {
        if (block.kind === 'image' || block.kind === 'rule') continue;
        total++;
        if (block.style.dir === 'rtl') rtl++;
    }
    return total > 0 && rtl * 2 > total;
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
function applyFillBackgrounds(
    blocks: readonly DocBlock[],
    rects: readonly PathRect[],
    pageIndex: number,
    measure: ColumnBounds,
): DocBlock[] {
    const fills = mergeContiguousFills(rects.filter(r =>
        r.filled && r.width * r.height >= MIN_FILL_AREA && isSaturatedColor(r.fillColor)));
    if (fills.length === 0) return [...blocks];
    const fillOf = new Map<DocBlock, PathRect>();
    for (const block of blocks) {
        if (block.kind === 'table') {
            applyCellBackgrounds(block, fills);
            continue;
        }
        const bounds = textBlockBounds(block);
        if (bounds) {
            const fill = fills.find(r => rectCoversCentroid(r, bounds));
            if (fill) {
                block.style.background = fill.fillColor;
                fillOf.set(block, fill);
            }
        }
    }
    return wrapSharedFillRuns(blocks, fillOf, pageIndex, measure);
}

/** Vertical gap (pt) under which two same-colour fill slices are one rect. */
const FILL_MERGE_GAP = 2;

/**
 * A PDF often paints one visual background as several stacked slices (doc4's
 * blue header: four rects, identical x-span and colour, touching y-bands).
 * Merging them restores the single rect the design drew.
 */
function mergeContiguousFills(fills: readonly PathRect[]): PathRect[] {
    const merged: PathRect[] = [];
    const sorted = [...fills].sort((a, b) => a.x - b.x || b.y - a.y);
    for (const fill of sorted) {
        const host = merged.find(m =>
            m.fillColor === fill.fillColor &&
            Math.abs(m.x - fill.x) <= FILL_MERGE_GAP &&
            Math.abs(m.x + m.width - (fill.x + fill.width)) <= FILL_MERGE_GAP &&
            fill.y <= m.y + m.height + FILL_MERGE_GAP &&
            fill.y + fill.height >= m.y - FILL_MERGE_GAP);
        if (host) {
            const top = Math.max(host.y + host.height, fill.y + fill.height);
            const bottom = Math.min(host.y, fill.y);
            merged[merged.indexOf(host)] = { ...host, y: bottom, height: top - bottom };
        } else {
            merged.push({ ...fill });
        }
    }
    return merged;
}

/**
 * Wraps a run of two or more consecutive blocks sitting on the SAME merged
 * fill into one background container, so the original's single coloured panel
 * renders as one continuous box instead of striped per-block bands.
 */
function wrapSharedFillRuns(
    blocks: readonly DocBlock[],
    fillOf: ReadonlyMap<DocBlock, PathRect>,
    pageIndex: number,
    measure: ColumnBounds,
): DocBlock[] {
    const result: DocBlock[] = [];
    let i = 0;
    while (i < blocks.length) {
        const fill = fillOf.get(blocks[i]);
        let end = i + 1;
        while (fill && end < blocks.length && fillOf.get(blocks[end]) === fill) end++;
        if (fill && end - i >= 2) {
            const group = blocks.slice(i, end);
            for (const member of group) member.style.background = '';
            result.push(fillPanel(group, fill, pageIndex, measure));
        } else {
            result.push(...blocks.slice(i, end));
        }
        i = end;
    }
    return result;
}

/** A panel is treated as full-width above this share of the measure. */
const PANEL_FULL_RATIO = 0.85;

function fillPanel(
    group: DocBlock[],
    fill: PathRect,
    pageIndex: number,
    measure: ColumnBounds,
): ColumnsBlock {
    const rtl = group.filter(b => b.style.dir === 'rtl').length * 2 > group.length;
    const measureWidth = Math.max(1, measure.x1 - measure.x0);
    const ratio = Math.min(1, fill.width / measureWidth);
    const partial = ratio < PANEL_FULL_RATIO;
    const roomLeft = fill.x - measure.x0;
    const roomRight = measure.x1 - (fill.x + fill.width);
    return {
        kind: 'columns',
        columns: [{ blocks: group, widthRatio: 1 }],
        page: pageIndex,
        style: { ...emptyStyle(), dir: rtl ? 'rtl' : '', background: fill.fillColor },
        panelMinHeight: fill.height,
        ...(partial ? { panelRatio: ratio, panelSide: roomLeft > roomRight ? 'right' as const : 'left' as const } : {}),
    };
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

/** A rectangle drawn as separate stroked edges: its extent, stroke, and the
 *  edge rects that formed it (withheld from rule/underline emission). */
interface RectBox {
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
    readonly color: string;
    readonly lineWidth: number;
    readonly edges: PathRect[];
}

/** Number of distinct y-positions among rects (double-drawn edges at the same
 *  y collapse to one). */
function distinctYCount(rects: readonly PathRect[]): number {
    const ys: number[] = [];
    for (const r of rects) {
        if (!ys.some(y => Math.abs(y - r.y) <= BOX_EDGE_MATCH)) ys.push(r.y);
    }
    return ys.length;
}

function isBoxEdgeColor(rect: PathRect): boolean {
    return (rect.stroked || rect.filled) &&
        !isNearWhite(rect.filled ? rect.fillColor : rect.strokeColor);
}

/**
 * Detects rectangles drawn as four (or three) separate stroked edges rather
 * than a single rect op — the blue box a form draws around a details panel.
 * Two parallel horizontal edges that share an x-span and are far enough apart
 * to enclose content, closed by at least one vertical edge meeting a corner.
 */
function findRectBoxes(rects: readonly PathRect[]): RectBox[] {
    const horizontals = rects.filter(r => r.width > r.height && r.height <= RULE_MAX_HEIGHT && isBoxEdgeColor(r));
    const verticals = rects.filter(r => r.height > r.width && r.width <= RULE_MAX_HEIGHT && isBoxEdgeColor(r));
    const boxes: RectBox[] = [];
    const paired = new Set<PathRect>();
    for (const top of horizontals) {
        if (paired.has(top)) continue;
        const sameSpan = horizontals.filter(h =>
            Math.abs(h.x - top.x) <= BOX_EDGE_MATCH && Math.abs(h.width - top.width) <= BOX_EDGE_MATCH);
        // A panel box has exactly two horizontal edges (top + bottom) at its
        // x-span; three or more same-span lines are a table grid's rows, not a
        // border (double-drawn edges collapse to two distinct positions).
        if (distinctYCount(sameSpan) !== 2) continue;
        const bottom = horizontals.find(b => b !== top && !paired.has(b) &&
            top.y - b.y >= MIN_BOX_HEIGHT &&
            Math.abs(top.x - b.x) <= BOX_EDGE_MATCH &&
            Math.abs(top.width - b.width) <= BOX_EDGE_MATCH);
        if (!bottom) continue;
        const left = Math.min(top.x, bottom.x);
        const right = Math.max(top.x + top.width, bottom.x + bottom.width);
        const sides = verticals.filter(v =>
            v.y <= top.y + BOX_EDGE_MATCH && v.y + v.height >= bottom.y - BOX_EDGE_MATCH &&
            (Math.abs(v.x - left) <= BOX_EDGE_MATCH || Math.abs(v.x - right) <= BOX_EDGE_MATCH));
        if (sides.length === 0) continue;
        paired.add(top);
        paired.add(bottom);
        const twin = boxes.find(b =>
            Math.abs(b.left - left) <= BOX_EDGE_MATCH && Math.abs(b.top - top.y) <= BOX_EDGE_MATCH &&
            Math.abs(b.bottom - bottom.y) <= BOX_EDGE_MATCH);
        if (twin) {
            // A form over-draws the same box twice; keep one wrapper but consume
            // every copy's edges so none leaks out as a loose rule.
            twin.edges.push(top, bottom, ...sides);
            continue;
        }
        boxes.push({
            left, right, top: top.y, bottom: bottom.y,
            color: top.stroked ? top.strokeColor : top.fillColor,
            lineWidth: top.lineWidth > 0 ? top.lineWidth : 0.8,
            edges: [top, bottom, ...sides],
        });
    }
    return boxes;
}

/** Vertical/horizontal extent of a block's content, tables included. */
function blockContentBox(block: DocBlock): { top: number; bottom: number; left: number; right: number } | null {
    const lines = block.kind === 'table'
        ? block.rows.flatMap(row => row.flatMap(cell => cell.lines))
        : textLinesOf(block);
    if (lines.length === 0) return null;
    return {
        top: Math.max(...lines.map(l => l.y)),
        bottom: Math.min(...lines.map(l => l.y)),
        left: Math.min(...lines.map(l => l.x)),
        right: Math.max(...lines.map(l => l.endX)),
    };
}

/**
 * Wraps the run of blocks a drawn rectangle encloses in a bordered single-column
 * {@link ColumnsBlock}, so a form's details panel keeps its box instead of
 * losing it to the flow (its edge rects would otherwise emit as loose rules).
 * Only a contiguous run is wrapped — nothing is reordered — and the edge rects
 * are marked used so they neither rule nor underline.
 */
function applyBlockBorders(
    blocks: DocBlock[],
    rects: readonly PathRect[],
    usedRects: Set<PathRect>,
    pageIndex: number,
): DocBlock[] {
    const boxes = findRectBoxes(rects.filter(r => !usedRects.has(r)));
    let result = blocks;
    for (const box of boxes) {
        const wrapped = wrapEnclosedRun(result, box, pageIndex);
        if (!wrapped) continue;
        result = wrapped;
        for (const edge of box.edges) usedRects.add(edge);
    }
    return result;
}

function wrapEnclosedRun(blocks: DocBlock[], box: RectBox, pageIndex: number): DocBlock[] | null {
    const enclosed = blocks
        .map((block, index) => ({ index, box: blockContentBox(block) }))
        .filter(entry => entry.box !== null && insideBox(entry.box, box));
    if (enclosed.length === 0) return null;
    const first = enclosed[0].index;
    const last = enclosed.at(-1)?.index ?? first;
    if (last - first + 1 !== enclosed.length) return null;
    const group = blocks.slice(first, last + 1);
    const rtl = group.filter(b => b.style.dir === 'rtl').length * 2 > group.length;
    const wrapper: ColumnsBlock = {
        kind: 'columns',
        columns: [{ blocks: group, widthRatio: 1 }],
        page: pageIndex,
        style: { ...emptyStyle(), border: `${box.lineWidth.toFixed(1)}pt solid ${box.color}`, dir: rtl ? 'rtl' : '' },
    };
    return [...blocks.slice(0, first), wrapper, ...blocks.slice(last + 1)];
}

function insideBox(
    b: { top: number; bottom: number; left: number; right: number },
    box: RectBox,
): boolean {
    return b.left >= box.left - BOX_EDGE_MATCH && b.right <= box.right + BOX_EDGE_MATCH &&
        b.bottom >= box.bottom - BOX_EDGE_MATCH && b.top <= box.top + BOX_EDGE_MATCH;
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
            tableWithLeadingLabel(split, pageIndex),
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
 * Re-joins a visual line the XY-cut split across sibling blocks. Same-baseline
 * segments are one line (the invariant {@link mergeSameBaselineLines} enforces
 * inside a region), but a column valley can strand a row's short leading
 * segment ("סה"כ ימי מחלה: 1") in its own single-line block while the rest of
 * the row joins a neighbouring paragraph. The stranded words are merged back
 * into the matching baseline — appended on the logically-later side — and the
 * host's deliberate-break flag is recomputed over the restored line.
 */
function rejoinSplitBaselines(blocks: DocBlock[], ctx: ClassifyContext): DocBlock[] {
    const strays = blocks.filter(b =>
        b.kind === 'paragraph' && b.lines.length === 1 && (b.stacked ?? false) === false);
    const dropped = new Set<DocBlock>();
    for (const stray of strays) {
        if (stray.kind !== 'paragraph') continue;
        const line = stray.lines[0];
        const host = blocks.find(b => b !== stray && !dropped.has(b) &&
            (b.kind === 'paragraph' || b.kind === 'blockquote') &&
            b.lines.some(l => Math.abs(l.y - line.y) <= l.fontSize * 0.35));
        if (!host || (host.kind !== 'paragraph' && host.kind !== 'blockquote')) continue;
        const target = host.lines.find(l => Math.abs(l.y - line.y) <= l.fontSize * 0.35);
        if (!target || !sameRowFragment(target, line)) continue;
        mergeLineInto(target, line);
        dropped.add(stray);
        rebuildStacked(host, ctx);
    }
    return dropped.size > 0 ? blocks.filter(b => !dropped.has(b)) : blocks;
}

/** Fragments of one visual row share a font size and sit within a few ems of
 *  each other; a small-type marginal note beside a body line matches neither
 *  and stays its own block. */
function sameRowFragment(target: Line, stray: Line): boolean {
    const sizeRatio = Math.max(target.fontSize, stray.fontSize) /
        Math.max(1, Math.min(target.fontSize, stray.fontSize));
    if (sizeRatio > 1.25) return false;
    const gap = Math.max(target.x, stray.x) - Math.min(target.endX, stray.endX);
    return gap <= Math.max(target.fontSize, stray.fontSize) * 8;
}

/** Appends the stray segment's words on the logically-later side of the host
 *  line (visual left for RTL, visual right for LTR) and widens its extent. */
function mergeLineInto(target: Line, stray: Line): void {
    const strayIsVisuallyLeft = stray.x < target.x;
    const strayIsLater = target.dir === 'rtl' ? strayIsVisuallyLeft : !strayIsVisuallyLeft;
    if (stray.words[0]) stray.words[0].spaceBefore = true;
    if (strayIsLater) {
        target.words.push(...stray.words);
    } else {
        if (target.words[0]) target.words[0].spaceBefore = true;
        target.words.unshift(...stray.words);
    }
    (target as { x: number }).x = Math.min(target.x, stray.x);
    (target as { endX: number }).endX = Math.max(target.endX, stray.endX);
}

function rebuildStacked(host: DocBlock, ctx: ClassifyContext): void {
    if (host.kind !== 'paragraph' && host.kind !== 'blockquote') return;
    (host as { stacked?: boolean }).stacked = allBreaksIntentional(host.lines, ctx.pageBounds);
}

/**
 * A table with a leading row label (a form's "סובל מ" beside the diagnosis
 * grid) renders as one side-by-side row: the label keeps its edge position
 * next to the table exactly as the original draws it.
 */
function tableWithLeadingLabel(split: BandTableSplit, pageIndex: number): DocBlock {
    const label = split.leadingLabel;
    if (!label || label.length === 0) return split.table;
    const rtl = split.table.style.dir === 'rtl';
    const tableLines = split.table.rows.flat().flatMap((cell: TableCellModel) => cell.lines);
    const tableSpan = Math.max(...tableLines.map((l: Line) => l.endX)) -
        Math.min(...tableLines.map((l: Line) => l.x));
    const labelSpan = Math.max(...label.map((l: Line) => l.endX)) - Math.min(...label.map((l: Line) => l.x));
    const total = Math.max(1, tableSpan + labelSpan);
    const labelBlock: DocBlock = {
        kind: 'paragraph',
        lines: [...label],
        page: pageIndex,
        style: { ...emptyStyle(), dir: rtl ? 'rtl' : '' },
    };
    const labelColumn = { blocks: [labelBlock], widthRatio: Math.max(0.08, labelSpan / total) };
    const tableColumn = { blocks: [split.table], widthRatio: Math.min(0.92, tableSpan / total) };
    return {
        kind: 'columns',
        columns: [labelColumn, tableColumn],
        page: pageIndex,
        style: { ...emptyStyle(), dir: rtl ? 'rtl' : '' },
    };
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
        blocks: cellToBlocks(col, depth, pageIndex, { ...ctx, pageBounds: boundsOfLines(col) }),
        widthRatio: widthRatios[i],
    }));
    const allLines = columns.flat();
    const dir = allLines.filter(l => l.dir === 'rtl').length * 2 > allLines.length ? 'rtl' : '';
    return { kind: 'columns', columns: groups, page: pageIndex, style: { ...emptyStyle(), dir } };
}

/**
 * Builds one column cell's blocks. Sub-detector A first tries to peel a leading
 * nested 2×2 quadrant (a contact card sitting atop a CV's right column) off the
 * top of the cell; whatever it does not consume flows normally.
 */
function cellToBlocks(
    col: Line[],
    depth: number,
    pageIndex: number,
    cellCtx: ClassifyContext,
): DocBlock[] {
    if (DETECT_NESTED_STRUCTURE) {
        const quadrant = extractLeadingQuadrant(col, depth, pageIndex, cellCtx);
        if (quadrant) {
            return [quadrant.block, ...cutToBlocks(quadrant.rest, depth + 1, pageIndex, cellCtx)];
        }
        const run = extractKeyValueRun(col, pageIndex);
        if (run) {
            return [
                ...(run.before.length > 0 ? cutToBlocks(run.before, depth + 1, pageIndex, cellCtx) : []),
                run.block,
                ...(run.after.length > 0 ? cellToBlocks(run.after, depth, pageIndex, cellCtx) : []),
            ];
        }
    }
    return cutToBlocks(col, depth + 1, pageIndex, cellCtx);
}

/** Minimum matched pairs before an interior key/value run becomes a table. */
const KV_MIN_PAIRS = 2;
/** Minimum key-to-value gap, in em, for a row to read as two cells. */
const KV_MIN_GAP_EM = 1.5;
/** Minimum key-segment width, in em — excludes list markers and stray glyphs. */
const KV_MIN_KEY_EM = 2;

/**
 * Sub-detector C — an interior key/value run inside a column cell. A run of
 * baseline rows each carrying exactly two segments — the key pinned to the
 * cell's left edge, a clear gap, then the value — is a two-column sub-table
 * the outer passes cannot see (a receipt's Order-summary cell: amount|label
 * rows). Unlike sub-detector A the run may sit anywhere in the cell, the value
 * starts need not cluster (a right-pinned "Total" under a mid-cell label), and
 * a one-segment row that overlaps the previous value's x-band is that value's
 * wrap continuation. Emits a borderless two-column table so each pair stays
 * row-aligned; the rows before and after flow normally. Prose cells never
 * match: their rows are single-segment, and list markers fail the key-width
 * and gap gates.
 */
export function extractKeyValueRun(
    col: Line[],
    pageIndex: number,
): { before: Line[]; block: TableBlock; after: Line[] } | null {
    const rows = groupByBaseline(col);
    const cell = boundsOfLines(col);
    const start = rows.findIndex(row => asKeyValueRow(row, cell.x0) !== null);
    if (start < 0) return null;
    const pairs: { key: Line; value: Line[] }[] = [];
    let next = start;
    while (next < rows.length) {
        const row = rows[next];
        const pair = asKeyValueRow(row, cell.x0);
        if (pair) {
            pairs.push({ key: pair.key, value: [pair.value] });
        } else if (!attachValueContinuation(row, pairs)) {
            break;
        }
        next++;
    }
    if (pairs.length < KV_MIN_PAIRS) return null;
    const rowsModel = pairs.map(p => [{ lines: [p.key] }, { lines: p.value }]);
    const block: TableBlock = {
        kind: 'table',
        rows: rowsModel,
        ruled: false,
        headerRow: false,
        page: pageIndex,
        style: emptyStyle(),
    };
    return { before: rows.slice(0, start).flat(), block, after: rows.slice(next).flat() };
}

/** A cell row read as key | gap | value, or null when the shape does not hold. */
function asKeyValueRow(row: readonly Line[], cellLeft: number): { key: Line; value: Line } | null {
    if (row.length !== 2) return null;
    const [a, b] = row;
    const [key, value] = a.x <= b.x ? [a, b] : [b, a];
    const fontSize = Math.max(key.fontSize, value.fontSize, 1);
    if (key.x > cellLeft + fontSize) return null;
    if (key.endX - key.x < fontSize * KV_MIN_KEY_EM) return null;
    if (value.x - key.endX < fontSize * KV_MIN_GAP_EM) return null;
    if (segmentText(key) === segmentText(value)) return null;
    return { key, value };
}

/** Attaches a one-segment row to the previous value when it wraps within that
 *  value's x-band; returns false when the row ends the run instead. */
function attachValueContinuation(row: readonly Line[], pairs: { key: Line; value: Line[] }[]): boolean {
    const previous = pairs.at(-1)?.value.at(-1);
    if (row.length !== 1 || !previous) return false;
    const line = row[0];
    const slack = Math.max(line.fontSize, 1);
    if (line.x < previous.x - slack || line.x > previous.endX + slack) return false;
    pairs.at(-1)?.value.push(line);
    return true;
}

/**
 * Sub-detector A — a nested 2×2 quadrant at the head of a column cell. A short
 * leading run (≤ {@link QUADRANT_MAX_ROWS}) of baseline rows that each carry a
 * segment at the cell's left edge AND a second segment past a far-x threshold,
 * whose far-x starts agree across the run, followed by single-column content, is
 * a 2×2 grid the outer column pass could not see (the doc2 contact card:
 * Jerusalem|LinkedIn / phone|email above the "Core Skills" heading). It emits as
 * a nested borderless two-column block; the trailing content flows normally.
 * Returns null unless the whole shape holds — dense prose columns (their cells
 * are single-column) and marker+text rows never match.
 */
export function extractLeadingQuadrant(
    col: Line[],
    depth: number,
    pageIndex: number,
    ctx: ClassifyContext,
): { block: ColumnsBlock; rest: Line[] } | null {
    const rows = groupByBaseline(col);
    const cell = boundsOfLines(col);
    const farXMin = cell.x0 + (cell.x1 - cell.x0) * QUADRANT_FAR_X_RATIO;
    const run: { left: Line; right: Line }[] = [];
    for (const row of rows) {
        const quadrantRow = asQuadrantRow(row, cell.x0, farXMin);
        if (!quadrantRow) break;
        run.push(quadrantRow);
    }
    if (run.length < QUADRANT_MIN_ROWS || run.length > QUADRANT_MAX_ROWS) return null;
    if (run.length >= rows.length) return null;
    const fontSize = Math.max(...run.flatMap(q => [q.left.fontSize, q.right.fontSize]));
    const farXs = run.map(q => q.right.x);
    if (Math.max(...farXs) - Math.min(...farXs) > fontSize * QUADRANT_CLUSTER_FONTS) return null;
    const block = columnsBlockFrom(
        [run.map(q => q.left), run.map(q => q.right)], depth + 1, pageIndex, ctx,
    );
    return { block, rest: rows.slice(run.length).flat() };
}

/** A cell row split into its left-edge segment and a far-x quadrant segment. */
export function asQuadrantRow(
    row: readonly Line[],
    cellLeft: number,
    farXMin: number,
): { left: Line; right: Line } | null {
    if (row.length !== 2) return null;
    const [a, b] = row;
    const [left, right] = a.x <= b.x ? [a, b] : [b, a];
    if (left.x > cellLeft + Math.max(left.fontSize, right.fontSize)) return null;
    if (right.x < farXMin) return null;
    return { left, right };
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
    if (DETECT_NESTED_STRUCTURE) {
        const justified = splitJustifiedRows(rawRegion, pageIndex, ctx);
        if (justified) return justified;
    }
    return flowRegionToBlocks(rawRegion, pageIndex, ctx);
}

/**
 * Flows a region's hard-break segments into stacked paragraph/heading/list
 * blocks: rejoin same-baseline segments, split into paragraph groups, classify
 * each. This is the terminal (non-column, non-table) path of a resolved region.
 */
function flowRegionToBlocks(rawRegion: Line[], pageIndex: number, ctx: ClassifyContext): DocBlock[] {
    const region = mergeSameBaselineLines(rawRegion);
    const bounds = boundsOfLines(region);
    const groups = splitIntoParagraphGroups(region);
    const blocks: DocBlock[] = [];
    let previousBaseline: number | null = null;
    for (const lines of groups) {
        const gapAbove = previousBaseline === null ? null : previousBaseline - lines[0].y;
        const kind = classifyGroup(lines, bounds, gapAbove, ctx);
        const style = resolveBlockStyle(lines, bounds, previousBaseline, ctx.pageBounds);
        blocks.push(blockFrom(kind, lines, pageIndex, style, ctx.pageBounds));
        previousBaseline = lines.at(-1)?.y ?? previousBaseline;
    }
    return blocks;
}

function blockFrom(
    kind: GroupKind,
    lines: Line[],
    page: number,
    style: BlockStyle,
    measure: ColumnBounds,
): DocBlock {
    switch (kind.kind) {
        case 'heading':
            return { kind: 'heading', level: kind.level, lines: [...lines], page, style };
        case 'list':
            return { kind: 'list', ordered: kind.ordered, items: kind.items, page, style };
        case 'blockquote':
            return {
                kind: 'blockquote',
                lines: [...lines],
                page,
                style: { ...style, maxWidth: narrowBlockWidth(lines, measure) },
                stacked: allBreaksIntentional(lines, measure),
            };
        default:
            return {
                kind: 'paragraph',
                lines: [...lines],
                page,
                style,
                stacked: allBreaksIntentional(lines, measure),
            };
    }
}

/** Safety margin, in em, the next line's first word must clear beyond the
 *  broken line's remaining room before a break counts as deliberate. */
const INTENTIONAL_BREAK_MARGIN_EM = 1;

/**
 * True when every line break in the group is deliberate: the next line's first
 * word would have fit in the room left on the broken line (ISO 32000 has no
 * break semantics — this is the pdfminer-style layout inference). Wrapped prose
 * breaks a line precisely because the next word does NOT fit, so a genuine
 * paragraph fails this on its very first break. The measure is the enclosing
 * region/column's content bounds (column-scoped for column cells), and the fit
 * requires a full safety margin so a ragged edge near the measure never
 * misreads as deliberate. A hyphen-ended line is a wrap artifact regardless of
 * room (narrow gloss columns sit far from their region measure), so it vetoes
 * the whole group. RTL lines fill right-to-left, so their remaining room is on
 * the left edge.
 */
function allBreaksIntentional(lines: readonly Line[], measure: ColumnBounds): boolean {
    if (lines.length < 2) return false;
    if (lines.some(line => line.words.at(-1)?.text.endsWith('-'))) return false;
    const roomOnLeft = raggedOnLeft(lines);
    for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        const nextWord = lines[i + 1].words[0];
        if (!nextWord) return false;
        const room = roomOnLeft ? line.x - measure.x0 : measure.x1 - line.endX;
        const needed = firstTokenWidth(nextWord) +
            INTENTIONAL_BREAK_MARGIN_EM * Math.max(line.fontSize, 1);
        if (needed > room) return false;
    }
    return true;
}

/**
 * The room a broken word would have used sits on the block's RAGGED edge —
 * where the text stops short — not on a side implied by script direction: a
 * right-aligned LTR stack (a receipt's rate-of-exchange lines) wraps on the
 * left exactly like RTL text does. Equal spreads fall back to the direction.
 */
function raggedOnLeft(lines: readonly Line[]): boolean {
    const spreadLeft = Math.max(...lines.map(l => l.x)) - Math.min(...lines.map(l => l.x));
    const spreadRight = Math.max(...lines.map(l => l.endX)) - Math.min(...lines.map(l => l.endX));
    if (spreadLeft === spreadRight) {
        return lines.filter(l => l.dir === 'rtl').length * 2 > lines.length;
    }
    return spreadLeft > spreadRight;
}

/** Width of the word's first whitespace-separated token. Fragment merging can
 *  fold a whole line into one Word; the wrap decision only ever concerned the
 *  first token, so its width is estimated proportionally. */
function firstTokenWidth(word: Word): number {
    const width = word.endX - word.x;
    const text = word.text.trim();
    const spaceAt = text.search(/\s/);
    if (spaceAt < 0 || text.length === 0) return width;
    return width * (spaceAt / text.length);
}

/** A block spanning at most this share of its measure keeps its own width. */
const NARROW_BLOCK_MAX_RATIO = 0.5;

/**
 * A multi-line block much narrower than its measure was wrapped by the
 * original at ITS OWN width — constraining the emitted block to that width
 * lets the browser reproduce the original's line breaks naturally (a vendor
 * address card re-wraps at ~135pt into its three original lines), instead of
 * re-flowing to whatever measure the surrounding layout happens to leave.
 */
function narrowBlockWidth(lines: readonly Line[], measure: ColumnBounds): number {
    if (lines.length < 2) return 0;
    const x0 = Math.min(...lines.map(l => l.x));
    const x1 = Math.max(...lines.map(l => l.endX));
    const measureWidth = Math.max(1, measure.x1 - measure.x0);
    if (x1 - x0 > measureWidth * NARROW_BLOCK_MAX_RATIO) return 0;
    const fontSize = Math.max(1, ...lines.map(l => l.fontSize));
    return x1 - x0 + fontSize;
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

/**
 * Sub-detector B — left/right justified single-baseline rows. A region row that
 * carries exactly two segments each pinned to an opposite region edge with a
 * wide gap between them (a receipt's "−$15.00 USD … Lemon Squeezy LLC" header)
 * is a two-column layout that {@link mergeSameBaselineLines} would otherwise
 * flatten into one line. Such rows emit as a borderless two-cell row; the rest
 * of the region flows normally. Returns null when no row qualifies, so the
 * region is left to the standard flow path untouched.
 */
export function splitJustifiedRows(
    rawRegion: Line[],
    pageIndex: number,
    ctx: ClassifyContext,
): DocBlock[] | null {
    const bounds = boundsOfLines(rawRegion);
    const width = bounds.x1 - bounds.x0;
    if (width <= 0) return null;
    const rows = groupByBaseline(rawRegion);
    if (rows.length > JUSTIFIED_MAX_ROWS) return null;
    if (!rows.some(row => asJustifiedRow(row, bounds, width, ctx))) return null;
    const blocks: DocBlock[] = [];
    let buffer: Line[] = [];
    const flush = (): void => {
        if (buffer.length > 0) {
            blocks.push(...flowRegionToBlocks(buffer, pageIndex, ctx));
            buffer = [];
        }
    };
    for (const row of rows) {
        const justified = asJustifiedRow(row, bounds, width, ctx);
        if (justified) {
            flush();
            const rowBlock = columnsBlockFrom(
                [[justified.left], [justified.right]], MAX_CUT_DEPTH, pageIndex, ctx,
            );
            pinJustifiedCells(rowBlock);
            blocks.push(rowBlock);
        } else {
            buffer.push(...row);
        }
    }
    flush();
    return blocks;
}

/** A justified row's segments were pinned to opposite region edges, so their
 *  cells anchor the same way — the page number stays at the far margin. */
function pinJustifiedCells(rowBlock: ColumnsBlock): void {
    const [leftCol, rightCol] = rowBlock.columns;
    for (const block of leftCol?.blocks ?? []) block.style.align = 'left';
    for (const block of rightCol?.blocks ?? []) block.style.align = 'right';
}

/** Groups a region's segments into baseline rows, top-to-bottom, mirroring the
 *  same-baseline tolerance {@link mergeSameBaselineLines} uses. */
function groupByBaseline(region: readonly Line[]): Line[][] {
    const sorted = [...region].sort((a, b) => b.y - a.y || a.x - b.x);
    const rows: Line[][] = [];
    for (const line of sorted) {
        const current = rows.at(-1);
        if (current && Math.abs(current[0].y - line.y) <= current[0].fontSize * 0.35) {
            current.push(line);
        } else {
            rows.push([line]);
        }
    }
    return rows;
}

/**
 * Returns the two edge-pinned segments of a justified header row, or null.
 * Beyond the geometry (exactly two segments, each pinned to an opposite region
 * edge, a wide inter-segment gap) it rejects the shapes that share that
 * geometry but are not headers: page-number/marker tokens, duplicated segments
 * (rendered-twice visibility tests), narrow prose columns, and sub-body print
 * chrome. The region-level short-band check is applied by the caller
 * ({@link splitJustifiedRows}).
 */
export function asJustifiedRow(
    row: readonly Line[],
    bounds: ColumnBounds,
    width: number,
    ctx: ClassifyContext,
): { left: Line; right: Line } | null {
    if (row.length !== 2) return null;
    const [a, b] = row;
    const [left, right] = a.x <= b.x ? [a, b] : [b, a];
    const fontSize = Math.max(left.fontSize, right.fontSize);
    const pinTolerance = fontSize * JUSTIFIED_EDGE_FONTS;
    if (left.x > bounds.x0 + pinTolerance) return null;
    if (right.endX < bounds.x1 - pinTolerance) return null;
    if (right.x - left.endX < width * JUSTIFIED_GAP_RATIO) return null;
    if (width < JUSTIFIED_MIN_WIDTH_PT) return null;
    const footer = isFooterBandRow(left, right, ctx);
    if (!footer && fontSize < ctx.bodyFontSize * JUSTIFIED_MIN_FONT_RATIO) return null;
    const pageWidth = ctx.pageBounds.x1 - ctx.pageBounds.x0;
    if (pageWidth > 0 && width < pageWidth * JUSTIFIED_MIN_WIDTH_RATIO) return null;
    if (rejectsMarkers(left, right, footer)) return null;
    if (segmentText(left) === segmentText(right)) return null;
    return { left, right };
}

/** Rows this low on the page are footer chrome, where small type and a bare
 *  page number at the edges are exactly what a real footer looks like. */
const FOOTER_BAND_RATIO = 0.08;

function isFooterBandRow(left: Line, right: Line, ctx: ClassifyContext): boolean {
    const pageHeight = ctx.pageHeight ?? 0;
    return pageHeight > 0 && Math.max(left.y, right.y) <= pageHeight * FOOTER_BAND_RATIO;
}

/** Outside the footer band any marker segment rejects the row; inside it only
 *  a row of two bare markers does (URL | page-number is a genuine footer). */
function rejectsMarkers(left: Line, right: Line, footer: boolean): boolean {
    if (footer) return isMarkerSegment(left) && isMarkerSegment(right);
    return isMarkerSegment(left) || isMarkerSegment(right);
}

/** A segment's text, normalised for the marker/duplicate checks. */
function segmentText(line: Line): string {
    return line.words.map(w => w.text).join(' ').replaceAll(/\s+/g, ' ').trim();
}

/** True when a segment is a page number, list marker, or bare symbol rather
 *  than a content label. */
function isMarkerSegment(line: Line): boolean {
    const text = segmentText(line);
    return text.length < JUSTIFIED_MIN_SEGMENT_CHARS || MARKER_TOKEN_RE.test(text);
}

function splitIntoParagraphGroups(lines: readonly Line[]): Line[][] {
    if (lines.length === 0) return [];
    const medianGap = medianBaselineGap(lines);
    const bounds = boundsOfLines(lines);
    let current: Line[] = [lines[0]];
    const groups: Line[][] = [current];
    for (let i = 1; i < lines.length; i++) {
        if (startsNewParagraph(lines[i - 1], lines[i], medianGap, bounds)) {
            current = [lines[i]];
            groups.push(current);
        } else {
            current.push(lines[i]);
        }
    }
    return groups;
}

function startsNewParagraph(
    previous: Line,
    line: Line,
    medianGap: number,
    bounds: ColumnBounds,
): boolean {
    const gap = previous.y - line.y;
    if (gap <= 0) return true;
    if (gap > Math.max(previous.fontSize, line.fontSize) * 2.2) return true;
    if (medianGap > 0 && gap > medianGap * PARAGRAPH_GAP_FACTOR) return true;
    const sizeRatio = Math.max(previous.fontSize, line.fontSize) /
        Math.max(1, Math.min(previous.fontSize, line.fontSize));
    if (sizeRatio >= FONT_SIZE_CHANGE_RATIO) return true;
    if (isListSubheadingBoundary(previous, line, sizeRatio)) return true;
    if (dominantStyleChanges(previous, line)) return true;
    if (alignmentBreaks(previous, line, bounds)) return true;
    return previous.dir !== line.dir;
}

type LineAlignClass = 'full' | 'start' | 'end' | 'center' | 'other';

/**
 * An edge-pinned line next to a centered one is two differently-aligned
 * statements (a right-pinned RTL title over a centered emphasis line), not a
 * wrap. Full-width lines never split here — their continuation tail can land
 * anywhere, including dead centre — and 'other' placements stay inconclusive.
 */
function alignmentBreaks(previous: Line, line: Line, bounds: ColumnBounds): boolean {
    const a = lineAlignClass(previous, bounds);
    const b = lineAlignClass(line, bounds);
    if (a === 'full' || b === 'full' || a === 'other' || b === 'other') return false;
    return (a === 'center') !== (b === 'center');
}

function lineAlignClass(line: Line, bounds: ColumnBounds): LineAlignClass {
    const em = Math.max(line.fontSize, 1);
    const left = line.x - bounds.x0;
    const right = bounds.x1 - line.endX;
    if (left <= em && right <= em) return 'full';
    if (left <= em) return 'start';
    if (right <= em) return 'end';
    const tolerance = Math.max(em * 2, 0.2 * Math.min(left, right));
    if (Math.abs(left - right) <= tolerance) return 'center';
    return 'other';
}

/**
 * A uniformly bold line followed by a uniformly plain one is a heading-to-body
 * boundary (a name over a role line, a column header over data rows), not a
 * wrap. Only this direction splits: a plain label line followed by a bold
 * value ("לכבוד: <date>" over a bold recipient) is one visual unit, and mixed
 * lines (prose with an inline bold word) never trip the test.
 */
function dominantStyleChanges(previous: Line, line: Line): boolean {
    const uniformBold = (l: Line): boolean | null => {
        const [first, ...rest] = l.words;
        if (!first) return null;
        return rest.every(w => w.style.bold === first.style.bold) ? first.style.bold : null;
    };
    return uniformBold(previous) === true && uniformBold(line) === false;
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

/**
 * Underlines a form-field slot value. A signature/field slot is drawn as a short
 * horizontal rule sitting a line below its value with the field label a line
 * further down (value / ───── / label). `applyUnderlines` misses it — the rule
 * is too far below the value baseline — so it renders as a loose line. Requiring
 * BOTH a value centred above AND a label centred below (the sandwich) excludes a
 * bare answer-blank rule, whose writing space below carries no text, and the
 * width cap excludes document separators and box edges.
 */
export function applySlotUnderlines(
    lines: readonly Line[],
    rects: readonly PathRect[],
    usedRects: Set<PathRect>,
    pageWidth: number,
): void {
    for (const rect of rects) {
        if (usedRects.has(rect)) continue;
        const value = slotValueLine(lines, rect, pageWidth);
        if (value && underlineOverlappingWords(value, rect)) usedRects.add(rect);
    }
}

/** The value line a slot underline belongs to, or null when the rect is not a
 *  field slot (too tall/short/wide, unsaturated, or missing the value/label
 *  sandwich). */
function slotValueLine(lines: readonly Line[], rect: PathRect, pageWidth: number): Line | null {
    if (rect.height > UNDERLINE_MAX_HEIGHT || rect.width < 4) return null;
    if (rect.width > pageWidth * SLOT_MAX_WIDTH_RATIO) return null;
    // A field slot is drawn in the form's accent colour; a grey/black thin rect
    // with text either side is a table gridline or a plain rule, not a slot
    // (this also excludes with_form's black answer-blank lines).
    if (!isSaturatedColor(rect.stroked ? rect.strokeColor : rect.fillColor)) return null;
    const value = closestCentredLine(lines, rect, 'above');
    if (!value || !closestCentredLine(lines, rect, 'below')) return null;
    return value;
}

/** Underlines the value's words that sit over the rect; true if any matched. */
function underlineOverlappingWords(value: Line, rect: PathRect): boolean {
    let underlined = false;
    for (const word of value.words) {
        if (overlapRatio(word.x, word.endX, rect.x, rect.x + rect.width) < 0.3) continue;
        word.style = { ...word.style, underline: true };
        underlined = true;
    }
    return underlined;
}

/** The nearest line whose horizontal centre falls within the rect and whose
 *  baseline sits within {@link SLOT_GAP_FONTS} font-sizes on the given side. */
function closestCentredLine(lines: readonly Line[], rect: PathRect, side: 'above' | 'below'): Line | null {
    let best: Line | null = null;
    let bestGap = Number.POSITIVE_INFINITY;
    for (const line of lines) {
        const gap = side === 'above' ? line.y - rect.y : rect.y - line.y;
        if (gap <= 0 || gap > line.fontSize * SLOT_GAP_FONTS) continue;
        const centre = (line.x + line.endX) / 2;
        if (centre < rect.x || centre > rect.x + rect.width) continue;
        if (gap < bestGap) {
            best = line;
            bestGap = gap;
        }
    }
    return best;
}

function detectRules(
    page: PageExtract,
    usedRects: ReadonlySet<PathRect>,
    lines: readonly Line[],
    blocks: readonly DocBlock[],
): RuleBlock[] {
    const contentWidth = lines.length > 0
        ? Math.max(...lines.map(l => l.endX)) - Math.min(...lines.map(l => l.x))
        : page.width;
    const tableSpans = tableRowSpans(blocks);
    const candidates = page.rects
        .filter(rect => !usedRects.has(rect) &&
            rect.height <= RULE_MAX_HEIGHT &&
            rect.width >= contentWidth * 0.4 &&
            (rect.stroked || rect.filled) &&
            !isNearWhite(rect.filled ? rect.fillColor : rect.strokeColor) &&
            !hidesInTableGrid(rect, tableSpans, page.width))
        .map(rect => rect.y)
        .sort((a, b) => b - a);
    return dedupeCloseTops(candidates).map(top => ({
        kind: 'rule' as const,
        page: page.index,
        style: emptyStyle(),
        top,
    }));
}

/** A detected table's bounding band: vertical row extent and column extent. */
interface TableSpan {
    readonly top: number;
    readonly bottom: number;
    readonly left: number;
    readonly right: number;
}

/**
 * Bounding bands of the detected tables. A thin wide rect inside one is a
 * cell border / row separator (the table's own structure), not a standalone
 * document rule — an unruled data table (invoice, statement) is reconstructed
 * from geometry, so its grey grid lines are never consumed as table rects and
 * would otherwise leak out as spurious rules between the rows.
 */
function tableRowSpans(blocks: readonly DocBlock[]): TableSpan[] {
    const spans: TableSpan[] = [];
    for (const block of blocks) {
        if (block.kind !== 'table') continue;
        const cellLines = block.rows.flatMap(row => row.flatMap(cell => cell.lines));
        const ys = cellLines.map(l => l.y);
        if (ys.length === 0) continue;
        spans.push({
            top: Math.max(...ys),
            bottom: Math.min(...ys),
            left: Math.min(...cellLines.map(l => l.x)),
            right: Math.max(...cellLines.map(l => l.endX)),
        });
    }
    return spans;
}

/**
 * A thin wide rect inside a table's row band is that table's own cell border /
 * row separator and must not leak out as a document rule — EXCEPT a near-full-
 * page-width rule that extends beyond the table's own column span, which is a
 * page-level separator drawn across the header band (doc1's blue header rule
 * sits at the top of the header table yet runs the full page width). Cell
 * gridlines are always contained within their table's columns, so requiring the
 * rule to both span most of the page AND poke past the table keeps every real
 * gridline (doc4's grey grid maxes at 58% page width, fully contained) guarded.
 */
function hidesInTableGrid(rect: PathRect, spans: readonly TableSpan[], pageWidth: number): boolean {
    return spans.some(span => {
        const inBand = rect.y >= span.bottom - RULE_TABLE_MARGIN && rect.y <= span.top + RULE_TABLE_MARGIN;
        if (!inBand) return false;
        const pageWide = rect.width >= pageWidth * PAGE_SEPARATOR_WIDTH_RATIO;
        const pokesOut = rect.x < span.left - RULE_TABLE_MARGIN ||
            rect.x + rect.width > span.right + RULE_TABLE_MARGIN;
        return !(pageWide && pokesOut);
    });
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
    rtlPageWidth: number,
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
            result.push(standaloneImage(inline[imageIdx], pageIndex, rtlPageWidth));
            imageIdx++;
        }
        result.push(block);
    }
    while (imageIdx < inline.length) {
        result.push(standaloneImage(inline[imageIdx], pageIndex, rtlPageWidth));
        imageIdx++;
    }
    return result;
}

/**
 * A standalone image, anchored to its true horizontal side on an RTL page
 * (rtlPageWidth > 0) so the RTL container does not right-anchor a logo that sat
 * on the left. On LTR pages the inline default already matches, so no anchor is
 * set (avoids disturbing existing output).
 */
function standaloneImage(image: ImageItem, pageIndex: number, rtlPageWidth: number): ImageBlock {
    const block = imageBlockFrom(image, pageIndex, '');
    if (rtlPageWidth > 0) block.style.align = imageSideAlign(image, rtlPageWidth);
    return block;
}

function imageSideAlign(image: ImageItem, pageWidth: number): BlockAlign {
    const center = (image.x + image.renderWidth / 2) / pageWidth;
    if (center < 0.4) return 'left';
    if (center > 0.6) return 'right';
    return 'center';
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
    const bandHeight = top - bottom + Math.max(...lines.map(l => l.fontSize));
    if (overlap < Math.min(image.renderHeight, bandHeight) * 0.5) return null;

    // Only lines vertically beside the image constrain the shared band — a
    // lower row extending under the image does not block the float.
    const beside = lines.filter(l =>
        l.y <= imgTopY + l.fontSize && l.y >= image.y - l.fontSize);
    if (beside.length === 0) return null;
    const blockLeft = Math.min(...beside.map(l => l.x));
    const blockRight = Math.max(...beside.map(l => l.endX));
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
    if (block.kind === 'table') return block.rows.flat().flatMap(cell => cell.lines);
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
