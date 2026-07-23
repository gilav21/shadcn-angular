import { sameStyle } from './readable-words';
import type {
    BlockStyle,
    DocBlock,
    DocModel,
    FontMapping,
    HeadingBlock,
    ImageBlock,
    Line,
    ListBlock,
    PdfReadableOptions,
    RunStyle,
    TableBlock,
    Word,
} from './readable-types';

interface EmitContext {
    readonly fonts: Map<string, FontMapping>;
    readonly bodyFontSize: number;
}

interface RunModel {
    readonly style: RunStyle;
    readonly text: string;
}

export function emitDocument(
    doc: DocModel,
    options: Required<PdfReadableOptions>,
    fonts: Map<string, FontMapping>,
): { html: string; text: string } {
    const ctx: EmitContext = { fonts, bodyFontSize: doc.bodyFontSize };
    const htmlParts: string[] = [];
    const textParts: string[] = [];

    for (const page of doc.pages) {
        const pageHtml = page.blocks.map(block => emitBlock(block, ctx)).filter(Boolean);
        if (pageHtml.length === 0) continue;
        if (options.pageWrappers) {
            htmlParts.push(
                `<div style="max-width:${round(page.width)}pt;margin:0 auto">${pageHtml.join('\n')}</div>`);
        } else {
            htmlParts.push(pageHtml.join('\n'));
        }
        collectPageText(page.blocks, textParts);
    }

    const separator = options.pageWrappers ? '\n<hr>\n' : '\n';
    return {
        html: htmlParts.join(separator),
        text: textParts.join(' ').replaceAll(/\s+/g, ' ').trim(),
    };
}

function collectPageText(blocks: readonly DocBlock[], out: string[]): void {
    for (const block of blocks) {
        for (const line of blockLines(block)) {
            out.push(line.words.map(w => w.text).join(' '));
        }
    }
}

export function blockLines(block: DocBlock): readonly Line[] {
    switch (block.kind) {
        case 'paragraph':
        case 'heading':
        case 'blockquote':
            return block.lines;
        case 'list':
            return block.items.flatMap(item => item.lines);
        case 'table':
            return block.rows.flatMap(row => row.flatMap(cell => cell.lines));
        default:
            return [];
    }
}

function emitBlock(block: DocBlock, ctx: EmitContext): string {
    switch (block.kind) {
        case 'paragraph':
            return emitLinesBlock('p', block.lines, block.style, ctx);
        case 'heading':
            return emitHeading(block, ctx);
        case 'blockquote':
            return emitBlockquote(block.lines, block.style, ctx);
        case 'list':
            return emitList(block, ctx);
        case 'table':
            return emitTable(block, ctx);
        case 'image':
            return emitImage(block);
        case 'rule':
            return '<hr>';
        default:
            return '';
    }
}

function emitHeading(block: HeadingBlock, ctx: EmitContext): string {
    return emitLinesBlock(`h${block.level}`, block.lines, block.style, ctx);
}

function emitBlockquote(lines: readonly Line[], style: BlockStyle, ctx: EmitContext): string {
    const inner = emitLinesBlock('p', lines, { ...style, marginTop: 0 }, ctx);
    const attrs = attrString(styleAttr([['margin-top', ptOrEmpty(style.marginTop)]]), '');
    return `<blockquote${attrs}>${inner}</blockquote>`;
}

function emitLinesBlock(
    tag: string,
    lines: readonly Line[],
    style: BlockStyle,
    ctx: EmitContext,
): string {
    if (lines.length === 0) return '';
    const dominant = dominantRunStyle(lines);
    const content = emitLineContents(lines, dominant, ctx);
    const styleValue = styleAttr([
        ...blockStylePairs(style),
        ...baseFontPairs(dominant, ctx),
    ]);
    return `<${tag}${attrString(styleValue, style.dir === 'rtl' ? 'rtl' : '')}>${content}</${tag}>`;
}

function emitList(block: ListBlock, ctx: EmitContext): string {
    const tag = block.ordered ? 'ol' : 'ul';
    const items = block.items.map(item => {
        const dominant = dominantRunStyle(item.lines);
        const content = emitLineContents(item.lines, dominant, ctx);
        return `<li${attrString(styleAttr(baseFontPairs(dominant, ctx)), '')}>${content}</li>`;
    });
    const styleValue = styleAttr([['margin-top', ptOrEmpty(block.style.marginTop)]]);
    return `<${tag}${attrString(styleValue, block.style.dir === 'rtl' ? 'rtl' : '')}>${items.join('')}</${tag}>`;
}

function emitTable(block: TableBlock, ctx: EmitContext): string {
    const cellBorder = block.ruled ? 'border:0.5pt solid #999;' : '';
    const rows = block.rows.map((row, rowIdx) => {
        const cellTag = block.headerRow && rowIdx === 0 ? 'th' : 'td';
        const cells = row.map(cell => {
            const dominant = dominantRunStyle(cell.lines);
            const inner = emitLineContents(cell.lines, dominant, ctx);
            const styleValue = cellBorder + styleAttr([['padding', '2pt 4pt'], ...baseFontPairs(dominant, ctx)]);
            return `<${cellTag} style="${styleValue}">${inner}</${cellTag}>`;
        });
        return `<tr>${cells.join('')}</tr>`;
    });
    const tableStyle = `border-collapse:collapse;${styleAttr([['margin-top', ptOrEmpty(block.style.marginTop)]])}`;
    return `<table style="${tableStyle}"${block.style.dir === 'rtl' ? ' dir="rtl"' : ''}>${rows.join('')}</table>`;
}

function emitImage(block: ImageBlock): string {
    const pairs: Array<[string, string]> = [
        ['width', `${round(block.image.renderWidth)}pt`],
        ['max-width', '100%'],
        ['height', 'auto'],
        ['margin-top', ptOrEmpty(block.style.marginTop)],
    ];
    if (block.float) {
        pairs.push(['float', block.float], ['margin', '4pt']);
    }
    return `<img src="${block.image.dataUrl}" alt="Embedded image" style="${styleAttr(pairs)}">`;
}

/** Joins a block's lines into styled runs; hyphen-broken lines join seamlessly. */
function emitLineContents(
    lines: readonly Line[],
    dominant: RunStyle | null,
    ctx: EmitContext,
): string {
    const runs: RunModel[] = [];
    for (let i = 0; i < lines.length; i++) {
        if (i > 0) appendLineJoin(runs, lines[i - 1]);
        appendLineRuns(runs, lines[i].words);
    }
    return runs.map(run => emitRun(run, dominant, ctx)).join('');
}

function appendLineJoin(runs: RunModel[], previousLine: Line): void {
    const last = runs.at(-1);
    if (!last) return;
    if (last.text.endsWith('-') && previousLine.dir === 'ltr') {
        runs[runs.length - 1] = { style: last.style, text: last.text.slice(0, -1) };
        return;
    }
    runs[runs.length - 1] = { style: last.style, text: `${last.text} ` };
}

function appendLineRuns(runs: RunModel[], words: readonly Word[]): void {
    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const separator = i > 0 && word.spaceBefore ? ' ' : '';
        const last = runs.at(-1);
        if (last && sameStyle(last.style, word.style)) {
            runs[runs.length - 1] = { style: last.style, text: last.text + separator + word.text };
        } else {
            runs.push({ style: word.style, text: separator + word.text });
        }
    }
}

function emitRun(run: RunModel, dominant: RunStyle | null, ctx: EmitContext): string {
    let html = escapeHtml(run.text);
    const style = run.style;
    const spanStyle = runDeltaPairs(style, dominant, ctx);
    if (spanStyle.some(([, v]) => v !== '')) html = `<span style="${styleAttr(spanStyle)}">${html}</span>`;
    if (style.underline) html = `<u>${html}</u>`;
    if (style.italic) html = `<em>${html}</em>`;
    if (style.bold) html = `<strong>${html}</strong>`;
    if (style.baselineShift === 'sup') html = `<sup>${html}</sup>`;
    if (style.baselineShift === 'sub') html = `<sub>${html}</sub>`;
    if (style.link) html = `<a href="${escapeHtml(style.link)}" target="_blank" rel="noopener">${html}</a>`;
    return html;
}

function dominantRunStyle(lines: readonly Line[]): RunStyle | null {
    const weights = new Map<string, { style: RunStyle; weight: number }>();
    for (const line of lines) {
        for (const word of line.words) {
            const key = runStyleKey(word.style);
            const entry = weights.get(key);
            if (entry) {
                entry.weight += word.text.length;
            } else {
                weights.set(key, { style: word.style, weight: word.text.length });
            }
        }
    }
    let best: { style: RunStyle; weight: number } | null = null;
    for (const entry of weights.values()) {
        if (!best || entry.weight > best.weight) best = entry;
    }
    return best?.style ?? null;
}

function runStyleKey(style: RunStyle): string {
    return [style.fontName, style.fontSize, style.color].join('|');
}

function baseFontPairs(dominant: RunStyle | null, ctx: EmitContext): Array<[string, string]> {
    if (!dominant) return [];
    return [
        ['font-family', fontFamilyValue(dominant.fontName, ctx)],
        ['font-size', `${round(dominant.fontSize)}pt`],
        ['color', colorValue(dominant.color)],
    ];
}

function runDeltaPairs(
    style: RunStyle,
    dominant: RunStyle | null,
    ctx: EmitContext,
): Array<[string, string]> {
    const pairs: Array<[string, string]> = [];
    if (!dominant || style.fontName !== dominant.fontName) {
        pairs.push(['font-family', fontFamilyValue(style.fontName, ctx)]);
    }
    if (!dominant || Math.abs(style.fontSize - dominant.fontSize) >= 0.25) {
        pairs.push(['font-size', `${round(style.fontSize)}pt`]);
    }
    if (!dominant || style.color !== dominant.color) {
        pairs.push(['color', colorValue(style.color)]);
    }
    return pairs;
}

function blockStylePairs(style: BlockStyle): Array<[string, string]> {
    return [
        ['text-align', style.align],
        ['text-indent', ptOrEmpty(style.textIndent)],
        ['line-height', style.lineHeight > 0 ? String(style.lineHeight) : ''],
        ['margin-top', ptOrEmpty(style.marginTop)],
    ];
}

function fontFamilyValue(fontName: string, ctx: EmitContext): string {
    const mapping = ctx.fonts.get(fontName);
    if (!mapping) return '';
    const parts: string[] = [];
    if (mapping.embedded && mapping.family) parts.push(`'${mapping.family}'`);
    if (mapping.fallback) parts.push(`'${mapping.fallback}'`);
    parts.push('sans-serif');
    return parts.length > 1 ? parts.join(',') : '';
}

function colorValue(color: string): string {
    const normalized = color.toLowerCase();
    return normalized === '#000000' || normalized === '#000' ? '' : color;
}

function styleAttr(pairs: ReadonlyArray<readonly [string, string]>): string {
    return pairs
        .filter(([, value]) => value !== '')
        .map(([prop, value]) => `${prop}:${value}`)
        .join(';');
}

function attrString(styleValue: string, dir: string): string {
    const stylePart = styleValue ? ` style="${styleValue}"` : '';
    const dirPart = dir ? ` dir="${dir}"` : '';
    return `${stylePart}${dirPart}`;
}

function ptOrEmpty(value: number): string {
    return value > 0 ? `${round(value)}pt` : '';
}

function round(value: number): number {
    return Math.round(value * 100) / 100;
}

export function escapeHtml(str: string): string {
    return str
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}
