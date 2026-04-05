import type {
    DocxParseResult,
    DocxElement,
    DocxParagraph,
    DocxTable,
    DocxImage,
    DocxRun,
    DocxRunStyle,
    DocxTableCell,
    DocxTableRow,
    DocxBorder,
    DocxTableBorder,
    DocxParagraphBorders,
    DocxTableCellStyle,
    DocxTableStyle,
} from './docx-parser';

/**
 * Renders a DocxParseResult into inline-styled HTML suitable for
 * insertion into the rich text editor. Uses only inline styles
 * (no Tailwind classes) so the editor sanitizer preserves them.
 */
export function renderDocxForEditor(result: DocxParseResult): string {
    return renderElements(result.elements);
}

function renderElements(elements: ReadonlyArray<DocxElement>): string {
    const parts: string[] = [];
    let i = 0;

    while (i < elements.length) {
        const el = elements[i];

        if (el.type === 'paragraph' && el.listLevel != null && el.listType) {
            i = renderListGroup(elements, i, parts);
        } else if (el.type === 'paragraph') {
            parts.push(renderParagraph(el));
            i++;
        } else if (el.type === 'table') {
            parts.push(renderTable(el));
            i++;
        } else {
            parts.push(renderImage(el));
            i++;
        }
    }

    return parts.join('');
}

// --- List grouping ---

function hasNestedListChild(
    elements: ReadonlyArray<DocxElement>,
    index: number,
    baseLevel: number,
): boolean {
    if (index + 1 >= elements.length) return false;
    const next = elements[index + 1];
    return next.type === 'paragraph' &&
        next.listLevel != null &&
        next.listType != null &&
        next.listLevel > baseLevel;
}

function renderListGroup(
    elements: ReadonlyArray<DocxElement>,
    startIndex: number,
    output: string[],
): number {
    const first = elements[startIndex];
    if (first.type !== 'paragraph') return startIndex;
    const listType = first.listType ?? 'bullet';
    const baseLevel = first.listLevel ?? 0;
    const tag = listType === 'numbered' ? 'ol' : 'ul';

    output.push(`<${tag}>`);
    let i = startIndex;

    while (i < elements.length) {
        const el = elements[i];
        if (el.type !== 'paragraph' || el.listLevel == null || el.listType == null) break;
        if (el.listLevel < baseLevel) break;

        if (el.listLevel === baseLevel && el.listType === listType) {
            i = renderListItem(elements, i, baseLevel, output);
        } else if (el.listLevel > baseLevel) {
            i = renderListGroup(elements, i, output);
        } else {
            break;
        }
    }

    output.push(`</${tag}>`);
    return i;
}

function renderListItem(
    elements: ReadonlyArray<DocxElement>,
    index: number,
    baseLevel: number,
    output: string[],
): number {
    const el = elements[index];
    if (el.type !== 'paragraph') return index + 1;
    output.push(`<li>${renderRuns(el.runs)}`);

    if (hasNestedListChild(elements, index, baseLevel)) {
        const nextIndex = renderListGroup(elements, index + 1, output);
        output.push('</li>');
        return nextIndex;
    }

    output.push('</li>');
    return index + 1;
}

// --- Paragraph rendering ---

function renderParagraph(p: DocxParagraph): string {
    const pageBreak = p.runs.some(r => r.breakType === 'page');
    let prefix = '';
    if (pageBreak) {
        prefix = '<hr>';
    }

    const dirAttr = p.rtl ? ' dir="rtl"' : '';
    const content = renderRuns(p.runs) || '<br>';

    const headingMatch = /^Heading(\d)$/i.exec(p.style);
    if (headingMatch) {
        const level = Math.min(Number(headingMatch[1]), 6);
        const tag = `h${level}`;
        const styleAttr = buildParagraphStyle(p);
        const styleStr = styleAttr ? ` style="${styleAttr}"` : '';
        return `${prefix}<${tag}${dirAttr}${styleStr}>${content}</${tag}>`;
    }

    const styleAttr = buildParagraphStyle(p);
    const styleStr = styleAttr ? ` style="${styleAttr}"` : '';
    return `${prefix}<p${dirAttr}${styleStr}>${content}</p>`;
}

function buildParagraphStyle(p: DocxParagraph): string {
    const styles: string[] = [];

    if (p.alignment) {
        styles.push(`text-align:${p.alignment}`);
    }
    if (p.spacingBefore != null) {
        styles.push(`margin-top:${formatPt(p.spacingBefore)}pt`);
    }
    if (p.spacingAfter != null) {
        styles.push(`margin-bottom:${formatPt(p.spacingAfter)}pt`);
    }
    if (p.indentLeft != null) {
        styles.push(`margin-left:${formatPt(p.indentLeft)}pt`);
    }
    if (p.indentRight != null) {
        styles.push(`margin-right:${formatPt(p.indentRight)}pt`);
    }
    if (p.indentFirstLine != null) {
        styles.push(`text-indent:${formatPt(p.indentFirstLine)}pt`);
    }
    if (p.indentHanging != null && p.indentFirstLine == null) {
        styles.push(`text-indent:-${formatPt(p.indentHanging)}pt`);
    }
    if (p.lineSpacing != null) {
        if (p.lineSpacing > 4) {
            styles.push(`line-height:${p.lineSpacing.toFixed(1)}pt`);
        } else {
            styles.push(`line-height:${p.lineSpacing.toFixed(2)}`);
        }
    }
    if (p.shading) {
        styles.push(`background-color:${p.shading}`);
    }
    if (p.borders) {
        appendParagraphBorders(styles, p.borders);
    }

    return styles.join(';');
}

function appendParagraphBorders(styles: string[], borders: DocxParagraphBorders): void {
    if (borders.top) styles.push(`border-top:${formatBorder(borders.top)}`);
    if (borders.bottom) styles.push(`border-bottom:${formatBorder(borders.bottom)}`);
    if (borders.left) styles.push(`border-left:${formatBorder(borders.left)}`);
    if (borders.right) styles.push(`border-right:${formatBorder(borders.right)}`);
    if (borders.top || borders.bottom || borders.left || borders.right) {
        styles.push('padding:2pt 4pt');
    }
}

function formatBorder(b: DocxBorder | DocxTableBorder): string {
    const widthPt = Math.max(b.size, 0.5);
    const style = mapBorderStyle(b.style);
    return `${widthPt}pt ${style} ${b.color}`;
}

function mapBorderStyle(docxStyle: string): string {
    switch (docxStyle) {
        case 'dashed': case 'dashDotStroked': case 'dashSmallGap':
            return 'dashed';
        case 'dotted': case 'dotDash': case 'dotDotDash':
            return 'dotted';
        case 'double': case 'triple': case 'thinThickSmallGap':
        case 'thickThinSmallGap': case 'thinThickMediumGap':
        case 'thickThinMediumGap': case 'thinThickLargeGap':
        case 'thickThinLargeGap':
            return 'double';
        case 'none': case 'nil':
            return 'none';
        default:
            return 'solid';
    }
}

// --- Run rendering ---

function renderRuns(runs: ReadonlyArray<DocxRun>): string {
    const parts: string[] = [];

    for (const run of runs) {
        if (run.style.hidden) continue;
        if (run.breakType === 'page') continue;
        if (run.breakType === 'textWrapping' || run.breakType === 'column') {
            parts.push('<br>');
            continue;
        }

        let html = escapeHtml(run.text);

        html = applyRunFormatting(html, run.style);
        html = applyTrackChanges(html, run);
        html = applyHyperlink(html, run);

        parts.push(html);
    }

    return parts.join('');
}

function applyRunFormatting(html: string, style: DocxRunStyle): string {
    let result = html;

    if (style.bold) result = `<strong>${result}</strong>`;
    if (style.italic) result = `<em>${result}</em>`;
    if (style.underline) result = `<u>${result}</u>`;
    if (style.strikethrough) result = `<s>${result}</s>`;
    if (style.doubleStrikethrough) {
        result = `<s style="text-decoration-style:double">${result}</s>`;
    }
    if (style.vertAlign === 'superscript') result = `<sup>${result}</sup>`;
    if (style.vertAlign === 'subscript') result = `<sub>${result}</sub>`;

    const spanStyle = buildRunSpanStyle(style);
    const dirAttr = style.rtl ? ' dir="rtl"' : '';
    if (spanStyle || dirAttr) {
        const styleAttr = spanStyle ? ` style="${spanStyle}"` : '';
        result = `<span${dirAttr}${styleAttr}>${result}</span>`;
    }

    return result;
}

function buildRunSpanStyle(style: DocxRunStyle): string {
    const parts: string[] = [];

    if (style.color) parts.push(`color:${style.color}`);
    if (style.fontSize) parts.push(`font-size:${style.fontSize}pt`);
    if (style.fontFamily) parts.push(`font-family:${escapeAttr(style.fontFamily)}`);
    if (style.highlight) parts.push(`background-color:${style.highlight}`);
    if (style.backgroundColor) parts.push(`background-color:${style.backgroundColor}`);
    if (style.charSpacing) parts.push(`letter-spacing:${formatPt(style.charSpacing)}pt`);
    if (style.smallCaps) parts.push('font-variant:small-caps');
    if (style.caps) parts.push('text-transform:uppercase');

    return parts.join(';');
}

function applyTrackChanges(html: string, run: DocxRun): string {
    if (run.isInserted) return `<ins>${html}</ins>`;
    if (run.isDeleted) return `<del>${html}</del>`;
    return html;
}

function applyHyperlink(html: string, run: DocxRun): string {
    if (run.href) {
        return `<a href="${escapeAttr(run.href)}" target="_blank" rel="noopener noreferrer">${html}</a>`;
    }
    return html;
}

// --- Image rendering ---

function renderImage(img: DocxImage): string {
    const widthAttr = img.width > 0 ? ` width="${img.width}"` : '';
    const heightAttr = img.height > 0 ? ` height="${img.height}"` : '';
    const alt = escapeAttr(img.altText || 'image');
    return `<img src="${escapeAttr(img.dataUrl)}"${widthAttr}${heightAttr} alt="${alt}">`;
}

// --- Table rendering ---

function renderTable(table: DocxTable): string {
    const tableStyle = buildTableStyle(table.tableStyle);
    const styleStr = tableStyle ? ` style="${tableStyle}"` : '';
    const borderFallbacks: TableBorderFallbacks = {
        insideH: table.tableStyle?.borders?.insideH,
        insideV: table.tableStyle?.borders?.insideV,
        top: table.tableStyle?.borders?.top,
        bottom: table.tableStyle?.borders?.bottom,
        left: table.tableStyle?.borders?.left,
        right: table.tableStyle?.borders?.right,
    };

    const parts: string[] = [`<table${styleStr}>`];

    const headerRows: DocxTableRow[] = [];
    const bodyRows: DocxTableRow[] = [];

    for (const row of table.rows) {
        if (row.rowStyle?.isHeader) {
            headerRows.push(row);
        } else {
            bodyRows.push(row);
        }
    }

    const totalRows = table.rows.length;
    let rowIndex = 0;

    if (headerRows.length > 0) {
        parts.push('<thead>');
        for (const row of headerRows) {
            parts.push(renderTableRow(row, true, borderFallbacks, rowIndex, totalRows));
            rowIndex++;
        }
        parts.push('</thead>');
    }

    parts.push('<tbody>');
    for (const row of bodyRows) {
        parts.push(renderTableRow(row, false, borderFallbacks, rowIndex, totalRows));
        rowIndex++;
    }
    parts.push('</tbody>', '</table>');
    return parts.join('');
}

function buildTableStyle(style?: DocxTableStyle): string {
    const parts: string[] = ['border-collapse:collapse'];

    if (style?.width) {
        const unit = style.widthUnit === 'pct' ? '%' : 'pt';
        const value = unit === '%' ? (style.width / 50).toFixed(1) : twipsToPt(style.width);
        parts.push(`width:${value}${unit}`);
    }

    return parts.join(';');
}

interface TableBorderFallbacks {
    readonly insideH?: DocxTableBorder;
    readonly insideV?: DocxTableBorder;
    readonly top?: DocxTableBorder;
    readonly bottom?: DocxTableBorder;
    readonly left?: DocxTableBorder;
    readonly right?: DocxTableBorder;
}

function renderTableRow(
    row: DocxTableRow, isHeader: boolean,
    fallbacks: TableBorderFallbacks, rowIndex: number, totalRows: number,
): string {
    const heightStyle = row.rowStyle?.height
        ? ` style="height:${formatPt(row.rowStyle.height)}pt"`
        : '';
    const tag = isHeader ? 'th' : 'td';
    const totalCols = row.cells.reduce((sum, c) => sum + c.colSpan, 0);

    let colIndex = 0;
    const cellsHtml: string[] = [];
    for (const cell of row.cells) {
        cellsHtml.push(renderTableCell(cell, tag, fallbacks, rowIndex, colIndex, totalRows, totalCols));
        colIndex += cell.colSpan;
    }
    return `<tr${heightStyle}>${cellsHtml.join('')}</tr>`;
}

function renderTableCell(
    cell: DocxTableCell, tag: string,
    fallbacks: TableBorderFallbacks, rowIndex: number, colIndex: number,
    totalRows: number, totalCols: number,
): string {
    const attrs: string[] = [];

    if (cell.colSpan > 1) attrs.push(`colspan="${cell.colSpan}"`);
    if (cell.rowSpan > 1) attrs.push(`rowspan="${cell.rowSpan}"`);

    const cellStyle = buildCellStyle(cell.cellStyle, fallbacks, rowIndex, colIndex, totalRows, totalCols);
    if (cellStyle) attrs.push(`style="${cellStyle}"`);

    const attrStr = attrs.length > 0 ? ` ${attrs.join(' ')}` : '';
    const content = renderCellContent(cell.elements);
    return `<${tag}${attrStr}>${content}</${tag}>`;
}

function buildCellStyle(
    style: DocxTableCellStyle | undefined,
    fallbacks: TableBorderFallbacks, rowIndex: number, colIndex: number,
    totalRows: number, totalCols: number,
): string {
    const parts: string[] = [];

    if (style?.backgroundColor) parts.push(`background-color:${style.backgroundColor}`);
    if (style?.verticalAlign) parts.push(`vertical-align:${style.verticalAlign}`);
    if (style?.width) {
        const unit = style.widthUnit === 'pct' ? '%' : 'pt';
        const value = unit === '%' ? (style.width / 50).toFixed(1) : twipsToPt(style.width);
        parts.push(`width:${value}${unit}`);
    }

    appendCellBorders(parts, style, fallbacks, rowIndex, colIndex, totalRows, totalCols);
    if (style) appendCellPaddings(parts, style);

    return parts.join(';');
}

function appendCellBorders(
    parts: string[], style: DocxTableCellStyle | undefined,
    fallbacks: TableBorderFallbacks, rowIndex: number, colIndex: number,
    totalRows: number, totalCols: number,
): void {
    const top = style?.borders?.top ?? (rowIndex === 0 ? fallbacks.top : fallbacks.insideH);
    const bottom = style?.borders?.bottom ?? (rowIndex === totalRows - 1 ? fallbacks.bottom : fallbacks.insideH);
    const left = style?.borders?.left ?? (colIndex === 0 ? fallbacks.left : fallbacks.insideV);
    const right = style?.borders?.right ?? (colIndex === totalCols - 1 ? fallbacks.right : fallbacks.insideV);

    if (top) parts.push(`border-top:${formatBorder(top)}`);
    if (bottom) parts.push(`border-bottom:${formatBorder(bottom)}`);
    if (left) parts.push(`border-left:${formatBorder(left)}`);
    if (right) parts.push(`border-right:${formatBorder(right)}`);
}

function appendCellPaddings(parts: string[], style: DocxTableCellStyle): void {
    if (!style.paddings) return;
    if (style.paddings.top != null) parts.push(`padding-top:${formatPt(style.paddings.top)}pt`);
    if (style.paddings.bottom != null) parts.push(`padding-bottom:${formatPt(style.paddings.bottom)}pt`);
    if (style.paddings.left != null) parts.push(`padding-left:${formatPt(style.paddings.left)}pt`);
    if (style.paddings.right != null) parts.push(`padding-right:${formatPt(style.paddings.right)}pt`);
}

function renderCellContent(elements: ReadonlyArray<DocxParagraph | DocxTable>): string {
    return elements.map(el => {
        if (el.type === 'table') return renderTable(el);
        return renderParagraph(el);
    }).join('');
}

// --- Utilities ---

function formatPt(pts: number): string {
    return pts.toFixed(1).replace(/\.0$/, '');
}

function twipsToPt(twips: number): string {
    return (twips / 20).toFixed(1).replace(/\.0$/, '');
}

function escapeHtml(text: string): string {
    return text
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll('\t', '\u2003');
}

function escapeAttr(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}
