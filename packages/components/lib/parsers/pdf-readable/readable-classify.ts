import type { StructureMap } from '../pdf-parser';
import { detectAlignment, type ColumnBounds } from './readable-styles';
import type { HeadingBlock, HeadingLevel, Line, ListItemModel, PageModel, Word } from './readable-types';

const HEADING_SCORE_THRESHOLD = 1;
const MAX_HEADING_LINES = 2;
const STRUCTURE_COVERAGE = 0.8;
const BULLET_RE = /^[•◦▪‣·∙*–—-]$|^[•◦▪‣·∙]/u;
const ORDERED_MARKER_RE = /^(\d{1,3}|[a-z]|[ivxlc]{1,5})[.)]$/i;
const NUMBERING_PATTERN = /^\d+(\.\d+)*[.)]?\s/;

export interface ClassifyContext {
    readonly bodyFontSize: number;
    readonly bodyLeading: number;
    readonly structure: StructureMap;
    /** Full-page content bounds — blockquote insets are measured against these. */
    readonly pageBounds: ColumnBounds;
}

export type GroupKind =
    | { kind: 'heading'; level: HeadingLevel }
    | { kind: 'list'; ordered: boolean; items: ListItemModel[] }
    | { kind: 'blockquote' }
    | { kind: 'paragraph' };

/** Classifies one paragraph-group of lines within its column. */
export function classifyGroup(
    lines: readonly Line[],
    bounds: ColumnBounds,
    gapAbove: number | null,
    ctx: ClassifyContext,
): GroupKind {
    const structural = structureKind(lines, ctx);
    if (structural) return structural;

    const list = detectList(lines, ctx);
    if (list) return list;

    const headingLevel = detectHeadingLevel(lines, bounds, gapAbove, ctx);
    if (headingLevel) return { kind: 'heading', level: headingLevel };

    if (isBlockquote(lines, ctx)) return { kind: 'blockquote' };
    return { kind: 'paragraph' };
}

// ── Structure tags ──────────────────────────────────────────────────────

function structureKind(lines: readonly Line[], ctx: ClassifyContext): GroupKind | null {
    if (!ctx.structure.hasStructure) return null;
    const types = taggedTypes(lines, ctx.structure);
    if (types.coverage < STRUCTURE_COVERAGE) return null;

    const headingLevel = structureHeadingLevel(types.counts);
    if (headingLevel) return { kind: 'heading', level: headingLevel };
    if (isDominant(types.counts, ['LI', 'LBody', 'Lbl', 'L'])) {
        return detectList(lines, ctx) ?? { kind: 'list', ordered: false, items: lines.map(l => ({ level: 0, lines: [l] })) };
    }
    if (isDominant(types.counts, ['BlockQuote'])) return { kind: 'blockquote' };
    return null;
}

function taggedTypes(
    lines: readonly Line[],
    structure: StructureMap,
): { counts: Map<string, number>; coverage: number } {
    const counts = new Map<string, number>();
    let tagged = 0;
    let total = 0;
    for (const line of lines) {
        for (const word of line.words) {
            total += word.text.length;
            if (word.mcid < 0) continue;
            const type = structure.mcidToType.get(`${line.page}:${word.mcid}`);
            if (!type) continue;
            tagged += word.text.length;
            counts.set(type, (counts.get(type) ?? 0) + word.text.length);
        }
    }
    return { counts, coverage: total === 0 ? 0 : tagged / total };
}

function structureHeadingLevel(counts: Map<string, number>): HeadingLevel | 0 {
    const levels: Array<[string, HeadingLevel]> = [
        ['H1', 1], ['H', 1], ['H2', 2], ['H3', 3], ['H4', 4], ['H5', 4], ['H6', 4],
    ];
    for (const [tag, level] of levels) {
        if (isDominant(counts, [tag])) return level;
    }
    return 0;
}

function isDominant(counts: Map<string, number>, tags: readonly string[]): boolean {
    let matched = 0;
    let total = 0;
    for (const [type, weight] of counts) {
        total += weight;
        if (tags.includes(type)) matched += weight;
    }
    return total > 0 && matched / total >= 0.5;
}

// ── Heading scoring ─────────────────────────────────────────────────────

function detectHeadingLevel(
    lines: readonly Line[],
    bounds: ColumnBounds,
    gapAbove: number | null,
    ctx: ClassifyContext,
): HeadingLevel | 0 {
    if (lines.length === 0 || lines.length > MAX_HEADING_LINES) return 0;
    const score = headingScore(lines, bounds, gapAbove, ctx);
    if (score < HEADING_SCORE_THRESHOLD) return 0;
    return headingLevelFromSize(lines[0].fontSize, allBold(lines), ctx.bodyFontSize);
}

/**
 * Multi-signal heading score: size ratio, boldness, spacing above,
 * numbering pattern, short width, all-caps, penalized by a trailing period.
 */
export function headingScore(
    lines: readonly Line[],
    bounds: ColumnBounds,
    gapAbove: number | null,
    ctx: ClassifyContext,
): number {
    const text = groupText(lines);
    if (text.length === 0 || ctx.bodyFontSize <= 0) return 0;
    const size = lines[0].fontSize;
    const width = bounds.x1 - bounds.x0;
    const lineWidth = Math.max(...lines.map(l => l.endX - l.x));

    let score = 2 * (size / ctx.bodyFontSize - 1);
    if (allBold(lines)) score += 0.8;
    if (gapAbove !== null && gapAbove > ctx.bodyLeading * 1.5) score += 0.5;
    if (NUMBERING_PATTERN.test(text)) score += 0.6;
    if (width > 0 && lineWidth < width * 0.7) score += 0.3;
    if (isAllCaps(text)) score += 0.3;
    if (/[.:;]$/.test(text) && !NUMBERING_PATTERN.test(text)) score -= 0.5;
    return score;
}

function headingLevelFromSize(size: number, bold: boolean, bodySize: number): HeadingLevel {
    const ratio = bodySize > 0 ? size / bodySize : 1;
    if (ratio >= 1.6) return 1;
    if (ratio >= 1.3) return 2;
    if (ratio >= 1.1) return 3;
    return bold ? 3 : 4;
}

/**
 * Document-wide post-pass: re-ranks heading levels by clustering distinct
 * (size, bold) signatures — the largest signature becomes h1, the next h2,
 * and so on (capped at h4). Structure-tagged headings keep their level.
 */
export function assignHeadingLevels(pages: readonly PageModel[], structureTagged: boolean): void {
    if (structureTagged) return;
    const headings: HeadingBlock[] = [];
    for (const page of pages) {
        for (const block of page.blocks) {
            if (block.kind === 'heading') headings.push(block);
        }
    }
    if (headings.length === 0) return;

    const signatures = [...new Set(headings.map(signatureOf))]
        .sort((a, b) => signatureSize(b) - signatureSize(a) || a.localeCompare(b));
    for (const heading of headings) {
        const rank = signatures.indexOf(signatureOf(heading));
        heading.level = Math.min(rank + 1, 4) as HeadingLevel;
    }
}

function signatureOf(heading: HeadingBlock): string {
    const size = Math.round((heading.lines[0]?.fontSize ?? 12) * 2) / 2;
    return `${size}|${allBold(heading.lines) ? 'b' : 'r'}`;
}

function signatureSize(signature: string): number {
    return Number.parseFloat(signature.split('|')[0]);
}

function allBold(lines: readonly Line[]): boolean {
    let boldChars = 0;
    let total = 0;
    for (const line of lines) {
        for (const word of line.words) {
            total += word.text.length;
            if (word.style.bold) boldChars += word.text.length;
        }
    }
    return total > 0 && boldChars / total >= 0.8;
}

function isAllCaps(text: string): boolean {
    const letters = text.replaceAll(/[^A-Za-z]/g, '');
    return letters.length >= 3 && letters === letters.toUpperCase();
}

function groupText(lines: readonly Line[]): string {
    return lines.map(l => l.words.map(w => w.text).join(' ')).join(' ').trim();
}

// ── Lists ───────────────────────────────────────────────────────────────

interface MarkerInfo {
    readonly ordered: boolean;
    readonly markerX: number;
}

function detectList(lines: readonly Line[], ctx: ClassifyContext): GroupKind | null {
    const markers = lines.map(line => lineMarker(line));
    const markerCount = markers.filter(Boolean).length;
    if (markerCount < 2 || markerCount < Math.ceil(lines.length / 2)) return null;

    const items = buildListItems(lines, markers, ctx);
    if (items.length === 0) return null;
    const ordered = markers.some(m => m?.ordered === true);
    return { kind: 'list', ordered, items };
}

function lineMarker(line: Line): MarkerInfo | null {
    const first = line.words[0];
    if (!first) return null;
    const token = firstToken(first);
    if (BULLET_RE.test(token)) return { ordered: false, markerX: markerEdge(line) };
    if (ORDERED_MARKER_RE.test(token)) return { ordered: true, markerX: markerEdge(line) };
    return null;
}

function firstToken(word: Word): string {
    return word.text.split(' ')[0] ?? '';
}

function markerEdge(line: Line): number {
    return line.dir === 'rtl' ? -line.endX : line.x;
}

function buildListItems(
    lines: readonly Line[],
    markers: ReadonlyArray<MarkerInfo | null>,
    ctx: ClassifyContext,
): ListItemModel[] {
    const levels = quantizeLevels(markers, ctx.bodyFontSize);
    const items: ListItemModel[] = [];
    for (let i = 0; i < lines.length; i++) {
        const marker = markers[i];
        if (marker) {
            items.push({ level: levels[i], lines: [stripMarker(lines[i])] });
        } else if (items.length > 0) {
            items.at(-1)?.lines.push(lines[i]);
        }
    }
    return items;
}

function quantizeLevels(
    markers: ReadonlyArray<MarkerInfo | null>,
    bodyFontSize: number,
): number[] {
    const xs = markers.filter((m): m is MarkerInfo => m !== null).map(m => m.markerX);
    const distinct = [...new Set(xs.map(x => Math.round(x)))].sort((a, b) => a - b);
    const levelStarts: number[] = [];
    const tolerance = Math.max(4, bodyFontSize * 0.6);
    for (const x of distinct) {
        const last = levelStarts.at(-1);
        if (last === undefined || x - last > tolerance) levelStarts.push(x);
    }
    return markers.map(m => {
        if (!m) return 0;
        let idx = 0;
        for (let i = levelStarts.length - 1; i >= 0; i--) {
            if (m.markerX >= levelStarts[i] - tolerance / 2) {
                idx = i;
                break;
            }
        }
        return Math.min(idx, 2);
    });
}

function stripMarker(line: Line): Line {
    const first = line.words[0];
    if (!first) return line;
    const token = firstToken(first);
    if (!BULLET_RE.test(token) && !ORDERED_MARKER_RE.test(token)) return line;

    const remainder = first.text.slice(token.length).trimStart();
    const words = remainder.length > 0
        ? [{ ...first, text: remainder }, ...line.words.slice(1)]
        : line.words.slice(1);
    return { ...line, words };
}

// ── Blockquote ──────────────────────────────────────────────────────────

/**
 * Both-side inset of at least 2 em against the page content bounds, not the
 * XY-cut region bounds (an isolated blockquote band's own bounds would hug
 * it). Centered blocks are excluded via alignment detection. A left-rule
 * signal is a possible future refinement.
 */
function isBlockquote(lines: readonly Line[], ctx: ClassifyContext): boolean {
    if (lines.length < 2) return false;
    const indent = ctx.bodyFontSize * 2;
    const left = Math.min(...lines.map(l => l.x));
    const right = Math.max(...lines.map(l => l.endX));
    if (left - ctx.pageBounds.x0 < indent || ctx.pageBounds.x1 - right < indent) return false;
    const dir = lines.filter(l => l.dir === 'rtl').length * 2 > lines.length ? 'rtl' : 'ltr';
    return detectAlignment(lines, ctx.pageBounds, dir) !== 'center';
}
