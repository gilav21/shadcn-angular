import { readZip } from './zip-reader';
import { isValidImageMagicBytes } from './image-validator';

type DocxVertAlign = 'superscript' | 'subscript';

export interface DocxRunStyle {
    readonly bold?: boolean;
    readonly italic?: boolean;
    readonly underline?: boolean;
    readonly strikethrough?: boolean;
    readonly fontSize?: number;
    readonly color?: string;
    readonly fontFamily?: string;
    readonly highlight?: string;
    readonly backgroundColor?: string;
    readonly vertAlign?: DocxVertAlign;
    readonly rtl?: boolean;
}

export interface DocxRun {
    readonly text: string;
    readonly style: DocxRunStyle;
    readonly href?: string;
}

export interface DocxParagraph {
    readonly type: 'paragraph';
    readonly runs: ReadonlyArray<DocxRun>;
    readonly style: string;
    readonly listLevel?: number;
    readonly listType?: 'bullet' | 'numbered';
    readonly rtl?: boolean;
    readonly alignment?: string;
    readonly spacingBefore?: number;
    readonly spacingAfter?: number;
    readonly lineSpacing?: number;
    readonly indentLeft?: number;
    readonly indentRight?: number;
    readonly indentHanging?: number;
}

export interface DocxTableCell {
    readonly paragraphs: ReadonlyArray<DocxParagraph>;
    readonly colSpan: number;
    readonly rowSpan: number;
}

export interface DocxTable {
    readonly type: 'table';
    readonly rows: ReadonlyArray<ReadonlyArray<DocxTableCell>>;
}

export interface DocxImage {
    readonly type: 'image';
    readonly dataUrl: string;
    readonly width: number;
    readonly height: number;
    readonly altText: string;
}

export type DocxElement = DocxParagraph | DocxTable | DocxImage;

export interface DocxParseResult {
    readonly elements: ReadonlyArray<DocxElement>;
    readonly plainText: string;
}

const NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';

const EMU_PER_PIXEL = 9525;
const TWIPS_PER_PT = 20;

const HIGHLIGHT_COLOR_MAP: Record<string, string> = {
    yellow: '#FFFF00',
    green: '#00FF00',
    cyan: '#00FFFF',
    magenta: '#FF00FF',
    blue: '#0000FF',
    red: '#FF0000',
    darkBlue: '#00008B',
    darkCyan: '#008B8B',
    darkGreen: '#006400',
    darkMagenta: '#8B008B',
    darkRed: '#8B0000',
    darkYellow: '#808000',
    darkGray: '#A9A9A9',
    lightGray: '#D3D3D3',
    black: '#000000',
    white: '#FFFFFF',
};

function parseXml(xmlString: string): Document {
    const parser = new DOMParser();
    return parser.parseFromString(xmlString, 'application/xml');
}

function getChildNS(parent: Element, ns: string, localName: string): Element | null {
    const children = parent.getElementsByTagNameNS(ns, localName);
    return children.length > 0 ? children[0] : null;
}

function getAllChildrenNS(parent: Element, ns: string, localName: string): Element[] {
    const nodeList = parent.getElementsByTagNameNS(ns, localName);
    const result: Element[] = [];
    for (let i = 0; i < nodeList.length; i++) {
        result.push(nodeList[i]);
    }
    return result;
}

function getAttrVal(element: Element, ns: string, localName: string): string | null {
    const nsVal = element.getAttributeNS(ns, localName);
    if (nsVal) return nsVal;
    return element.getAttribute(localName);
}

function parseRelationships(files: Map<string, Uint8Array>): Map<string, string> {
    const relsFile = files.get('word/_rels/document.xml.rels');
    if (!relsFile) return new Map();

    const doc = parseXml(new TextDecoder().decode(relsFile));
    const rels = doc.getElementsByTagName('Relationship');
    const map = new Map<string, string>();

    for (let i = 0; i < rels.length; i++) {
        const id = rels[i].getAttribute('Id') ?? '';
        const target = rels[i].getAttribute('Target') ?? '';
        map.set(id, target);
    }

    return map;
}

interface NumberingDefinition {
    readonly numFmt: string;
}

function parseNumberingDefinitions(files: Map<string, Uint8Array>): Map<string, Map<number, NumberingDefinition>> {
    const numFile = files.get('word/numbering.xml');
    if (!numFile) return new Map();

    const doc = parseXml(new TextDecoder().decode(numFile));
    const abstractNums = new Map<string, Map<number, NumberingDefinition>>();

    const abstractNumEls = getAllChildrenNS(doc.documentElement, NS_W, 'abstractNum');
    for (const abstractNum of abstractNumEls) {
        const abstractId = getAttrVal(abstractNum, NS_W, 'abstractNumId') ?? '';
        const levels = new Map<number, NumberingDefinition>();

        const lvlEls = getAllChildrenNS(abstractNum, NS_W, 'lvl');
        for (const lvl of lvlEls) {
            const ilvl = Number.parseInt(getAttrVal(lvl, NS_W, 'ilvl') ?? '0', 10);
            const numFmtEl = getChildNS(lvl, NS_W, 'numFmt');
            const numFmt = numFmtEl ? (getAttrVal(numFmtEl, NS_W, 'val') ?? 'bullet') : 'bullet';
            levels.set(ilvl, { numFmt });
        }
        abstractNums.set(abstractId, levels);
    }

    const numMap = new Map<string, Map<number, NumberingDefinition>>();
    const numEls = getAllChildrenNS(doc.documentElement, NS_W, 'num');
    for (const num of numEls) {
        const numId = getAttrVal(num, NS_W, 'numId') ?? '';
        const abstractNumIdEl = getChildNS(num, NS_W, 'abstractNumId');
        const abstractId = abstractNumIdEl ? (getAttrVal(abstractNumIdEl, NS_W, 'val') ?? '') : '';
        const levels = abstractNums.get(abstractId);
        if (levels) {
            numMap.set(numId, levels);
        }
    }

    return numMap;
}

function parseRunStyle(rPr: Element | null): DocxRunStyle {
    if (!rPr) return {};

    const result: {
        bold?: boolean;
        italic?: boolean;
        underline?: boolean;
        strikethrough?: boolean;
        fontSize?: number;
        color?: string;
        fontFamily?: string;
        highlight?: string;
        backgroundColor?: string;
        vertAlign?: DocxVertAlign;
        rtl?: boolean;
    } = {};

    parseBoldItalic(rPr, result);
    if (getChildNS(rPr, NS_W, 'u')) result.underline = true;
    if (getChildNS(rPr, NS_W, 'strike')) result.strikethrough = true;

    parseFontSizeAndColor(rPr, result);
    parseFontFamily(rPr, result);
    parseHighlightAndShading(rPr, result);
    parseVertAlignAndRtl(rPr, result);

    return result;
}

function parseBoldItalic(rPr: Element, result: { bold?: boolean; italic?: boolean }): void {
    const bEl = getChildNS(rPr, NS_W, 'b');
    if (bEl) {
        const bVal = getAttrVal(bEl, NS_W, 'val');
        result.bold = !bVal || bVal !== '0';
    }
    const iEl = getChildNS(rPr, NS_W, 'i');
    if (iEl) {
        const iVal = getAttrVal(iEl, NS_W, 'val');
        result.italic = !iVal || iVal !== '0';
    }
}

function parseFontSizeAndColor(rPr: Element, result: { fontSize?: number; color?: string }): void {
    const sz = getChildNS(rPr, NS_W, 'sz');
    if (sz) {
        const val = getAttrVal(sz, NS_W, 'val');
        if (val) result.fontSize = Number.parseInt(val, 10) / 2;
    }

    const color = getChildNS(rPr, NS_W, 'color');
    if (color) {
        const val = getAttrVal(color, NS_W, 'val');
        if (val && val !== 'auto') result.color = `#${val}`;
    }
}

function parseFontFamily(rPr: Element, result: { fontFamily?: string }): void {
    const rFonts = getChildNS(rPr, NS_W, 'rFonts');
    if (rFonts) {
        const ascii = getAttrVal(rFonts, NS_W, 'ascii')
            ?? getAttrVal(rFonts, NS_W, 'hAnsi')
            ?? getAttrVal(rFonts, NS_W, 'cs');
        if (ascii) result.fontFamily = ascii;
    }
}

function parseHighlightAndShading(rPr: Element, result: { highlight?: string; backgroundColor?: string }): void {
    const highlightEl = getChildNS(rPr, NS_W, 'highlight');
    if (highlightEl) {
        const val = getAttrVal(highlightEl, NS_W, 'val');
        if (val && val !== 'none') {
            result.highlight = HIGHLIGHT_COLOR_MAP[val] ?? `#${val}`;
        }
    }

    const shd = getChildNS(rPr, NS_W, 'shd');
    if (shd) {
        const fill = getAttrVal(shd, NS_W, 'fill');
        if (fill && fill !== 'auto') result.backgroundColor = `#${fill}`;
    }
}

function parseVertAlignAndRtl(rPr: Element, result: { vertAlign?: DocxVertAlign; rtl?: boolean }): void {
    const vertAlignEl = getChildNS(rPr, NS_W, 'vertAlign');
    if (vertAlignEl) {
        const val = getAttrVal(vertAlignEl, NS_W, 'val');
        if (val === 'superscript' || val === 'subscript') {
            result.vertAlign = val;
        }
    }

    const rtlEl = getChildNS(rPr, NS_W, 'rtl');
    if (rtlEl) {
        const rtlVal = getAttrVal(rtlEl, NS_W, 'val');
        result.rtl = !rtlVal || rtlVal !== '0';
    }
}

function extractImageFromDrawing(
    drawing: Element,
    relationships: Map<string, string>,
    files: Map<string, Uint8Array>,
): DocxImage | null {
    const blipEl = getAllChildrenNS(drawing, NS_A, 'blip')[0];
    if (!blipEl) return null;

    const rId = blipEl.getAttributeNS(NS_R, 'embed') ?? '';
    if (!rId) return null;

    const target = relationships.get(rId);
    if (!target) return null;

    const imagePath = target.startsWith('/') ? target.substring(1) : `word/${target}`;
    const imageData = files.get(imagePath);
    if (!imageData || !isValidImageMagicBytes(imageData)) return null;

    let width = 200;
    let height = 200;
    const extent = getAllChildrenNS(drawing, NS_WP, 'extent')[0]
        ?? getAllChildrenNS(drawing, NS_A, 'ext')[0];
    if (extent) {
        const cx = extent.getAttribute('cx');
        const cy = extent.getAttribute('cy');
        if (cx) width = Math.round(Number.parseInt(cx, 10) / EMU_PER_PIXEL);
        if (cy) height = Math.round(Number.parseInt(cy, 10) / EMU_PER_PIXEL);
    }

    const mimeType = guessMimeType(imageData);
    const base64 = uint8ArrayToBase64(imageData);
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const altText = drawing.getAttribute('descr') ?? '';

    return { type: 'image', dataUrl, width, height, altText };
}

function guessMimeType(data: Uint8Array): string {
    if (data[0] === 0xFF && data[1] === 0xD8) return 'image/jpeg';
    if (data[0] === 0x89 && data[1] === 0x50) return 'image/png';
    if (data[0] === 0x47 && data[1] === 0x49) return 'image/gif';
    if (data.length >= 12 && data[0] === 0x52 && data[8] === 0x57) return 'image/webp';
    return 'image/png';
}

function uint8ArrayToBase64(data: Uint8Array): string {
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < data.length; i += chunkSize) {
        const slice = data.subarray(i, Math.min(i + chunkSize, data.length));
        for (const byte of slice) {
            binary += String.fromCodePoint(byte);
        }
    }
    return btoa(binary);
}

interface ParagraphStyleResult {
    readonly style: string;
    readonly listLevel?: number;
    readonly listType?: 'bullet' | 'numbered';
    readonly rtl?: boolean;
    readonly alignment?: string;
    readonly spacingBefore?: number;
    readonly spacingAfter?: number;
    readonly lineSpacing?: number;
    readonly indentLeft?: number;
    readonly indentRight?: number;
    readonly indentHanging?: number;
}

function parseParagraphStyle(
    pPr: Element | null,
    numberingMap: Map<string, Map<number, NumberingDefinition>>,
): ParagraphStyleResult {
    if (!pPr) return { style: '' };

    const pStyleEl = getChildNS(pPr, NS_W, 'pStyle');
    const style = (pStyleEl ? getAttrVal(pStyleEl, NS_W, 'val') : null) ?? '';

    return {
        style,
        ...parseListProperties(pPr, numberingMap),
        ...parseBidiAndAlignment(pPr),
        ...parseSpacingProperties(pPr),
        ...parseIndentProperties(pPr),
    };
}

function parseListProperties(
    pPr: Element,
    numberingMap: Map<string, Map<number, NumberingDefinition>>,
): { listLevel?: number; listType?: 'bullet' | 'numbered' } {
    const numPr = getChildNS(pPr, NS_W, 'numPr');
    if (!numPr) return {};

    const ilvl = getChildNS(numPr, NS_W, 'ilvl');
    const level = ilvl ? Number.parseInt(getAttrVal(ilvl, NS_W, 'val') ?? '0', 10) : 0;
    const numId = getChildNS(numPr, NS_W, 'numId');
    const numIdVal = numId ? (getAttrVal(numId, NS_W, 'val') ?? '0') : '0';

    if (numIdVal === '0') return {};

    return { listLevel: level, listType: resolveListType(numberingMap, numIdVal, level) };
}

function resolveListType(
    numberingMap: Map<string, Map<number, NumberingDefinition>>,
    numIdVal: string,
    level: number,
): 'bullet' | 'numbered' {
    const levels = numberingMap.get(numIdVal);
    if (!levels) return 'bullet';

    const def = levels.get(level);
    if (!def) return 'bullet';

    const fmt = def.numFmt;
    if (fmt === 'bullet' || fmt === 'none') return 'bullet';
    return 'numbered';
}

function parseBidiAndAlignment(pPr: Element): { rtl?: boolean; alignment?: string } {
    const result: { rtl?: boolean; alignment?: string } = {};

    const bidi = getChildNS(pPr, NS_W, 'bidi');
    if (bidi) {
        const bidiVal = getAttrVal(bidi, NS_W, 'val');
        result.rtl = !bidiVal || bidiVal !== '0';
    }

    const jcEl = getChildNS(pPr, NS_W, 'jc');
    if (jcEl) {
        const val = getAttrVal(jcEl, NS_W, 'val');
        if (val) result.alignment = val;
    }

    return result;
}

function parseSpacingProperties(pPr: Element): { spacingBefore?: number; spacingAfter?: number; lineSpacing?: number } {
    const spacing = getChildNS(pPr, NS_W, 'spacing');
    if (!spacing) return {};

    const result: { spacingBefore?: number; spacingAfter?: number; lineSpacing?: number } = {};

    const before = getAttrVal(spacing, NS_W, 'before');
    if (before) result.spacingBefore = Number.parseInt(before, 10) / TWIPS_PER_PT;

    const after = getAttrVal(spacing, NS_W, 'after');
    if (after) result.spacingAfter = Number.parseInt(after, 10) / TWIPS_PER_PT;

    const line = getAttrVal(spacing, NS_W, 'line');
    const lineRule = getAttrVal(spacing, NS_W, 'lineRule');
    if (line) {
        const lineVal = Number.parseInt(line, 10);
        if (lineRule === 'exact' || lineRule === 'atLeast') {
            result.lineSpacing = lineVal / TWIPS_PER_PT;
        } else {
            result.lineSpacing = lineVal / 240;
        }
    }

    return result;
}

function parseIndentProperties(pPr: Element): { indentLeft?: number; indentRight?: number; indentHanging?: number } {
    const ind = getChildNS(pPr, NS_W, 'ind');
    if (!ind) return {};

    const result: { indentLeft?: number; indentRight?: number; indentHanging?: number } = {};

    const left = getAttrVal(ind, NS_W, 'left') ?? getAttrVal(ind, NS_W, 'start');
    if (left) result.indentLeft = Number.parseInt(left, 10) / TWIPS_PER_PT;

    const right = getAttrVal(ind, NS_W, 'right') ?? getAttrVal(ind, NS_W, 'end');
    if (right) result.indentRight = Number.parseInt(right, 10) / TWIPS_PER_PT;

    const hanging = getAttrVal(ind, NS_W, 'hanging');
    if (hanging) result.indentHanging = Number.parseInt(hanging, 10) / TWIPS_PER_PT;

    return result;
}

function parseRun(
    run: Element,
    relationships: Map<string, string>,
    files: Map<string, Uint8Array>,
): { runs: DocxRun[]; images: DocxImage[] } {
    const runs: DocxRun[] = [];
    const images: DocxImage[] = [];

    const rPr = getChildNS(run, NS_W, 'rPr');
    const style = parseRunStyle(rPr);

    for (let i = 0; i < run.childNodes.length; i++) {
        const child = run.childNodes[i];
        if (!(child instanceof Element)) continue;

        const localName = child.localName;
        if (localName === 't') {
            const text = child.textContent ?? '';
            if (text) runs.push({ text, style });
        } else if (localName === 'br') {
            runs.push({ text: '\n', style });
        } else if (localName === 'tab') {
            runs.push({ text: '\t', style });
        } else if (localName === 'drawing' || localName === 'pict') {
            const img = extractImageFromDrawing(child, relationships, files);
            if (img) images.push(img);
        }
    }

    return { runs, images };
}

function parseHyperlinkRuns(
    hyperlink: Element,
    relationships: Map<string, string>,
    files: Map<string, Uint8Array>,
): { runs: DocxRun[]; images: DocxImage[] } {
    const allRuns: DocxRun[] = [];
    const allImages: DocxImage[] = [];

    const rId = hyperlink.getAttributeNS(NS_R, 'id') ?? hyperlink.getAttribute('r:id') ?? '';
    const target = rId ? (relationships.get(rId) ?? '') : '';

    const runElements = getAllChildrenNS(hyperlink, NS_W, 'r');
    for (const run of runElements) {
        const { runs, images } = parseRun(run, relationships, files);
        for (const r of runs) {
            if (target && r.text.trim()) {
                allRuns.push({
                    text: r.text,
                    style: { ...r.style, underline: true, color: r.style.color ?? '#0563C1' },
                    href: target,
                });
            } else {
                allRuns.push(r);
            }
        }
        allImages.push(...images);
    }

    return { runs: allRuns, images: allImages };
}

function collectDirectChildRuns(
    para: Element,
    relationships: Map<string, string>,
    files: Map<string, Uint8Array>,
): { runs: DocxRun[]; images: DocxImage[] } {
    const allRuns: DocxRun[] = [];
    const allImages: DocxImage[] = [];

    for (let i = 0; i < para.childNodes.length; i++) {
        const child = para.childNodes[i];
        if (!(child instanceof Element)) continue;

        const localName = child.localName;
        if (localName === 'r') {
            const { runs, images } = parseRun(child, relationships, files);
            allRuns.push(...runs);
            allImages.push(...images);
        } else if (localName === 'hyperlink') {
            const { runs, images } = parseHyperlinkRuns(child, relationships, files);
            allRuns.push(...runs);
            allImages.push(...images);
        } else if (localName === 'drawing') {
            const img = extractImageFromDrawing(child, relationships, files);
            if (img) allImages.push(img);
        }
    }

    return { runs: allRuns, images: allImages };
}

function parseParagraph(
    para: Element,
    relationships: Map<string, string>,
    files: Map<string, Uint8Array>,
    numberingMap: Map<string, Map<number, NumberingDefinition>>,
): { paragraph: DocxParagraph; images: DocxImage[] } {
    const pPr = getChildNS(para, NS_W, 'pPr');
    const styleResult = parseParagraphStyle(pPr, numberingMap);

    const { runs: allRuns, images: allImages } = collectDirectChildRuns(para, relationships, files);

    const paragraph: DocxParagraph = {
        type: 'paragraph',
        runs: allRuns,
        style: styleResult.style,
        ...(styleResult.listLevel !== undefined ? { listLevel: styleResult.listLevel } : {}),
        ...(styleResult.listType !== undefined ? { listType: styleResult.listType } : {}),
        ...(styleResult.rtl !== undefined ? { rtl: styleResult.rtl } : {}),
        ...(styleResult.alignment !== undefined ? { alignment: styleResult.alignment } : {}),
        ...(styleResult.spacingBefore !== undefined ? { spacingBefore: styleResult.spacingBefore } : {}),
        ...(styleResult.spacingAfter !== undefined ? { spacingAfter: styleResult.spacingAfter } : {}),
        ...(styleResult.lineSpacing !== undefined ? { lineSpacing: styleResult.lineSpacing } : {}),
        ...(styleResult.indentLeft !== undefined ? { indentLeft: styleResult.indentLeft } : {}),
        ...(styleResult.indentRight !== undefined ? { indentRight: styleResult.indentRight } : {}),
        ...(styleResult.indentHanging !== undefined ? { indentHanging: styleResult.indentHanging } : {}),
    };

    return { paragraph, images: allImages };
}

function parseTableCell(
    tc: Element,
    relationships: Map<string, string>,
    files: Map<string, Uint8Array>,
    numberingMap: Map<string, Map<number, NumberingDefinition>>,
): DocxTableCell {
    const tcPr = getChildNS(tc, NS_W, 'tcPr');
    let colSpan = 1;
    let rowSpan = 1;

    if (tcPr) {
        const gridSpan = getChildNS(tcPr, NS_W, 'gridSpan');
        if (gridSpan) {
            colSpan = Number.parseInt(getAttrVal(gridSpan, NS_W, 'val') ?? '1', 10);
        }
        const vMerge = getChildNS(tcPr, NS_W, 'vMerge');
        if (vMerge) {
            const mergeVal = getAttrVal(vMerge, NS_W, 'val');
            if (!mergeVal || mergeVal === 'continue') {
                rowSpan = 0;
            }
        }
    }

    const paragraphs: DocxParagraph[] = [];
    const paraElements = getAllChildrenNS(tc, NS_W, 'p');
    for (const para of paraElements) {
        const { paragraph } = parseParagraph(para, relationships, files, numberingMap);
        paragraphs.push(paragraph);
    }

    return { paragraphs, colSpan, rowSpan };
}

function parseTable(
    tbl: Element,
    relationships: Map<string, string>,
    files: Map<string, Uint8Array>,
    numberingMap: Map<string, Map<number, NumberingDefinition>>,
): DocxTable {
    const rows: DocxTableCell[][] = [];
    const trElements = getAllChildrenNS(tbl, NS_W, 'tr');

    for (const tr of trElements) {
        const cells: DocxTableCell[] = [];
        const tcElements = getAllChildrenNS(tr, NS_W, 'tc');
        for (const tc of tcElements) {
            cells.push(parseTableCell(tc, relationships, files, numberingMap));
        }
        rows.push(cells);
    }

    return { type: 'table', rows };
}

function extractPlainText(elements: ReadonlyArray<DocxElement>): string {
    const parts: string[] = [];

    for (const el of elements) {
        if (el.type === 'paragraph') {
            const text = el.runs.map(r => r.text).join('');
            if (text.trim()) parts.push(text);
        } else if (el.type === 'table') {
            for (const row of el.rows) {
                const cellTexts = row.map(cell =>
                    cell.paragraphs.map(p =>
                        p.runs.map(r => r.text).join('')
                    ).join(' ')
                );
                parts.push(cellTexts.join('\t'));
            }
        }
    }

    return parts.join('\n');
}

function parseBodyElements(
    body: Element,
    relationships: Map<string, string>,
    files: Map<string, Uint8Array>,
    numberingMap: Map<string, Map<number, NumberingDefinition>>,
): DocxElement[] {
    const elements: DocxElement[] = [];

    for (let i = 0; i < body.childNodes.length; i++) {
        const child = body.childNodes[i];
        if (!(child instanceof Element)) continue;

        const localName = child.localName;
        if (localName === 'p') {
            const { paragraph, images } = parseParagraph(child, relationships, files, numberingMap);
            elements.push(...images);
            elements.push(paragraph);
        } else if (localName === 'tbl') {
            elements.push(parseTable(child, relationships, files, numberingMap));
        } else if (localName === 'sdt') {
            const sdtContent = getChildNS(child, NS_W, 'sdtContent');
            if (sdtContent) {
                elements.push(...parseBodyElements(sdtContent, relationships, files, numberingMap));
            }
        }
    }

    return elements;
}

export function parseDocx(data: Uint8Array): DocxParseResult {
    const files = readZip(data);
    const documentFile = files.get('word/document.xml');
    if (!documentFile) {
        throw new Error('Invalid DOCX: missing word/document.xml');
    }

    const relationships = parseRelationships(files);
    const numberingMap = parseNumberingDefinitions(files);
    const doc = parseXml(new TextDecoder().decode(documentFile));
    const body = doc.getElementsByTagNameNS(NS_W, 'body')[0];
    if (!body) {
        throw new Error('Invalid DOCX: missing document body');
    }

    const elements = parseBodyElements(body, relationships, files, numberingMap);

    const plainText = extractPlainText(elements);
    return { elements, plainText };
}
