import type {
    BlockAlign,
    BlockStyle,
    Line,
    PageModel,
    ParagraphBlock,
    TextDirection,
} from './readable-types';

const EDGE_TOLERANCE = 1.5;
const CENTER_TOLERANCE = 3;
const MARGIN_FRACTION = 0.05;
const MAX_MARGIN_TOP = 24;

export interface ColumnBounds {
    readonly x0: number;
    readonly x1: number;
}

/** Resolves the visual style of a block of lines against its column bounds. */
export function resolveBlockStyle(
    lines: readonly Line[],
    bounds: ColumnBounds,
    previousBaseline: number | null,
    pageBounds: ColumnBounds = bounds,
): BlockStyle {
    const dir = blockDirection(lines);
    const lineHeight = computeLineHeight(lines);
    const align = detectAlignment(lines, pageBounds, dir);
    return {
        align,
        indentStart: computeIndentStart(lines, pageBounds, dir, align),
        textIndent: computeTextIndent(lines, dir),
        lineHeight,
        marginTop: computeMarginTop(lines, previousBaseline, lineHeight),
        dir,
        background: '',
        border: '',
    };
}

/**
 * Preserves a block's real horizontal position: when it is not centered or
 * end-aligned, its offset from the page content start becomes a margin. This
 * is what keeps scattered fragments and indented regions where the PDF put
 * them instead of collapsing everything to the left edge.
 */
function computeIndentStart(
    lines: readonly Line[],
    pageBounds: ColumnBounds,
    dir: TextDirection,
    align: BlockAlign,
): number {
    if (lines.length === 0 || align === 'center' || align === 'right' || align === 'left') return 0;
    const offset = dir === 'rtl'
        ? pageBounds.x1 - Math.max(...lines.map(l => l.endX))
        : Math.min(...lines.map(l => l.x)) - pageBounds.x0;
    return offset > 4 ? Math.round(offset * 10) / 10 : 0;
}

export function blockDirection(lines: readonly Line[]): TextDirection {
    let rtl = 0;
    for (const line of lines) {
        if (line.dir === 'rtl') rtl++;
    }
    return rtl * 2 > lines.length ? 'rtl' : 'ltr';
}

/**
 * Detects text alignment from edge variance relative to the column.
 * Returns '' when the block sits at the natural start edge for its direction.
 */
export function detectAlignment(
    lines: readonly Line[],
    bounds: ColumnBounds,
    dir: TextDirection,
): BlockAlign {
    if (lines.length === 0) return '';
    const width = bounds.x1 - bounds.x0;
    if (width <= 0) return '';
    if (lines.length === 1) return singleLineAlignment(lines[0], bounds, dir);

    const leftTight = edgeSpread(lines.map(l => l.x)) <= EDGE_TOLERANCE;
    const rightTight = edgeSpread(lines.map(l => l.endX)) <= EDGE_TOLERANCE;
    if (leftTight && rightTight && lines.length >= 3) return 'justify';
    if (isCentered(lines, bounds)) return 'center';
    if (leftTight) return dir === 'rtl' ? 'left' : '';
    if (rightTight) return dir === 'rtl' ? '' : 'right';
    return '';
}

function singleLineAlignment(line: Line, bounds: ColumnBounds, dir: TextDirection): BlockAlign {
    const width = bounds.x1 - bounds.x0;
    if (line.endX - line.x < width * 0.25) return '';
    const left = line.x - bounds.x0;
    const right = bounds.x1 - line.endX;
    const margin = width * MARGIN_FRACTION;
    if (Math.abs(left - right) <= Math.max(CENTER_TOLERANCE, width * 0.02) &&
        left > margin && right > margin) {
        return 'center';
    }
    if (dir === 'rtl') return left > margin * 3 && right <= margin ? '' : alignFromEdges(left, right, margin, 'rtl');
    return right > margin * 3 && left <= margin ? '' : alignFromEdges(left, right, margin, 'ltr');
}

function alignFromEdges(
    left: number,
    right: number,
    margin: number,
    dir: TextDirection,
): BlockAlign {
    if (dir === 'ltr' && left > margin * 3 && right <= margin) return 'right';
    if (dir === 'rtl' && right > margin * 3 && left <= margin) return 'left';
    return '';
}

function isCentered(lines: readonly Line[], bounds: ColumnBounds): boolean {
    const center = (bounds.x0 + bounds.x1) / 2;
    let deviation = 0;
    for (const line of lines) {
        deviation = Math.max(deviation, Math.abs((line.x + line.endX) / 2 - center));
    }
    const width = bounds.x1 - bounds.x0;
    const offCenterEdges = lines.every(l =>
        l.x - bounds.x0 > width * MARGIN_FRACTION && bounds.x1 - l.endX > width * MARGIN_FRACTION);
    return offCenterEdges && deviation <= Math.max(CENTER_TOLERANCE, width * 0.02);
}

function edgeSpread(values: readonly number[]): number {
    return Math.max(...values) - Math.min(...values);
}

/** First-line indent in pt; 0 when below the noise threshold. */
export function computeTextIndent(lines: readonly Line[], dir: TextDirection): number {
    if (lines.length < 2) return 0;
    const [first, ...rest] = lines;
    const indent = dir === 'rtl'
        ? Math.max(...rest.map(l => l.endX)) - first.endX
        : first.x - Math.min(...rest.map(l => l.x));
    return indent > 2 ? Math.round(indent * 10) / 10 : 0;
}

/** Modal baseline-gap to font-size ratio, quantized to 0.05; 0 when unknown. */
export function computeLineHeight(lines: readonly Line[]): number {
    if (lines.length < 2) return 0;
    const ratios: number[] = [];
    for (let i = 1; i < lines.length; i++) {
        const gap = lines[i - 1].y - lines[i].y;
        const size = Math.max(lines[i].fontSize, 1);
        if (gap > 0 && gap < size * 4) ratios.push(gap / size);
    }
    if (ratios.length === 0) return 0;
    ratios.sort((a, b) => a - b);
    const median = ratios[Math.floor(ratios.length / 2)];
    const quantized = Math.round(median * 20) / 20;
    return Math.min(3, Math.max(0.9, quantized));
}

/**
 * The whitespace the PDF left above a block, beyond one line's own leading,
 * in pt. Pass `0` for `lineHeight` to assume normal leading.
 */
export function computeMarginTop(
    lines: readonly Line[],
    previousBaseline: number | null,
    lineHeight: number,
): number {
    if (previousBaseline === null || lines.length === 0) return 0;
    const leading = (lineHeight || 1.2) * lines[0].fontSize;
    const gap = previousBaseline - lines[0].y - leading;
    if (gap <= 1) return 0;
    return Math.min(MAX_MARGIN_TOP, Math.round(gap * 10) / 10);
}

/**
 * Joins a paragraph that continues across a page break: the trailing
 * paragraph of each page merges into the leading paragraph of the next when
 * both flow in the same style and the earlier one does not end a sentence.
 */
export function mergeCrossPageParagraphs(pages: readonly PageModel[]): void {
    for (let i = 1; i < pages.length; i++) {
        const previous = trailingParagraph(pages[i - 1]);
        const next = leadingParagraph(pages[i]);
        if (!previous || !next || !paragraphsContinue(previous, next)) continue;
        previous.lines.push(...next.lines);
        pages[i].blocks.splice(pages[i].blocks.indexOf(next), 1);
    }
}

function trailingParagraph(page: PageModel): ParagraphBlock | null {
    const block = page.blocks.at(-1);
    return block?.kind === 'paragraph' ? block : null;
}

function leadingParagraph(page: PageModel): ParagraphBlock | null {
    const block = page.blocks[0];
    return block?.kind === 'paragraph' ? block : null;
}

function paragraphsContinue(previous: ParagraphBlock, next: ParagraphBlock): boolean {
    const lastLine = previous.lines.at(-1);
    const firstNext = next.lines[0];
    if (!lastLine || !firstNext) return false;
    if (Math.abs(lastLine.fontSize - firstNext.fontSize) > 0.5) return false;
    if (lastLine.dir !== firstNext.dir) return false;
    if (next.style.textIndent > 0) return false;
    const text = lastLine.words.map(w => w.text).join(' ').trimEnd();
    if (/[.!?:;…]$/.test(text)) return false;
    return isLineFull(previous);
}

function isLineFull(block: ParagraphBlock): boolean {
    if (block.lines.length < 2) return true;
    const widths = block.lines.map(l => l.endX - l.x);
    const lastWidth = widths.at(-1) ?? 0;
    return lastWidth >= Math.max(...widths) * 0.85;
}
