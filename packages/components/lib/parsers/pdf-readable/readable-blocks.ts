import type { ImageItem } from '../pdf-parser';
import { resolveBlockStyle, type ColumnBounds } from './readable-styles';
import type { DocBlock, ImageBlock, Line, PageExtract, ParagraphBlock } from './readable-types';

const PARAGRAPH_GAP_FACTOR = 1.8;
const FONT_SIZE_CHANGE_RATIO = 1.2;

/**
 * Groups a page's lines (top-to-bottom) into paragraph blocks by vertical
 * gap analysis and interleaves image blocks by vertical position.
 * Columns, headings, lists and tables are refined by later stages.
 */
export function buildPageBlocks(
    lines: readonly Line[],
    page: PageExtract,
    includeImages: boolean,
): DocBlock[] {
    const bounds = columnBoundsOf(lines, page);
    const groups = splitIntoParagraphGroups(lines);
    const blocks = paragraphBlocksFrom(groups, page.index, bounds);
    if (!includeImages || page.images.length === 0) return blocks;
    return interleaveImages(blocks, page.images, page.index);
}

export function columnBoundsOf(lines: readonly Line[], page: PageExtract): ColumnBounds {
    if (lines.length === 0) return { x0: 0, x1: page.width };
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

function paragraphBlocksFrom(
    groups: readonly Line[][],
    pageIndex: number,
    bounds: ColumnBounds,
): ParagraphBlock[] {
    const blocks: ParagraphBlock[] = [];
    let previousBaseline: number | null = null;
    for (const lines of groups) {
        blocks.push({
            kind: 'paragraph',
            lines: [...lines],
            page: pageIndex,
            style: resolveBlockStyle(lines, bounds, previousBaseline),
        });
        previousBaseline = lines.at(-1)?.y ?? previousBaseline;
    }
    return blocks;
}

function interleaveImages(
    blocks: readonly DocBlock[],
    images: readonly ImageItem[],
    pageIndex: number,
): DocBlock[] {
    const sortedImages = [...images].sort((a, b) => imageTop(b) - imageTop(a));
    const result: DocBlock[] = [];
    let imageIdx = 0;
    for (const block of blocks) {
        const blockTop = blockTopOf(block);
        while (imageIdx < sortedImages.length && imageTop(sortedImages[imageIdx]) > blockTop) {
            result.push(imageBlockFrom(sortedImages[imageIdx], pageIndex));
            imageIdx++;
        }
        result.push(block);
    }
    while (imageIdx < sortedImages.length) {
        result.push(imageBlockFrom(sortedImages[imageIdx], pageIndex));
        imageIdx++;
    }
    return result;
}

function imageTop(image: ImageItem): number {
    return image.y + image.renderHeight;
}

function blockTopOf(block: DocBlock): number {
    if (block.kind === 'image') return imageTop(block.image);
    if (block.kind === 'rule') return 0;
    if (block.kind === 'table') {
        const firstCell = block.rows[0]?.find(cell => cell.lines.length > 0);
        return firstCell?.lines[0]?.y ?? 0;
    }
    if (block.kind === 'list') return block.items[0]?.lines[0]?.y ?? 0;
    return block.lines[0]?.y ?? 0;
}

function imageBlockFrom(image: ImageItem, pageIndex: number): ImageBlock {
    return {
        kind: 'image',
        image,
        float: '',
        page: pageIndex,
        style: { align: '', textIndent: 0, lineHeight: 0, marginTop: 0, dir: '' },
    };
}
