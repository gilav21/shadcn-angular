import { readZip } from './zip-reader';
import { isValidImageMagicBytes } from './image-validator';

export type DocxVertAlign = 'superscript' | 'subscript';
export type DocxBreakType = 'page' | 'column' | 'textWrapping';
export type DocxListType = 'bullet' | 'numbered';
type FieldState = 'none' | 'begin' | 'separate';

export interface DocxRunStyle {
    readonly bold?: boolean;
    readonly italic?: boolean;
    readonly underline?: boolean;
    readonly strikethrough?: boolean;
    readonly doubleStrikethrough?: boolean;
    readonly caps?: boolean;
    readonly smallCaps?: boolean;
    readonly fontSize?: number;
    readonly color?: string;
    readonly fontFamily?: string;
    readonly highlight?: string;
    readonly backgroundColor?: string;
    readonly vertAlign?: DocxVertAlign;
    readonly rtl?: boolean;
    readonly charSpacing?: number;
    readonly hidden?: boolean;
}

export interface DocxRun {
    readonly text: string;
    readonly style: DocxRunStyle;
    readonly href?: string;
    readonly breakType?: DocxBreakType;
    readonly isInserted?: boolean;
    readonly isDeleted?: boolean;
    readonly anchorId?: string;
}

export interface DocxBorder {
    readonly style: string;
    readonly color: string;
    readonly size: number;
}

export interface DocxParagraphBorders {
    readonly top?: DocxBorder;
    readonly bottom?: DocxBorder;
    readonly left?: DocxBorder;
    readonly right?: DocxBorder;
}

export interface DocxParagraph {
    readonly type: 'paragraph';
    readonly runs: ReadonlyArray<DocxRun>;
    readonly style: string;
    readonly listLevel?: number;
    readonly listType?: DocxListType;
    readonly rtl?: boolean;
    readonly alignment?: string;
    readonly spacingBefore?: number;
    readonly spacingAfter?: number;
    readonly lineSpacing?: number;
    readonly indentLeft?: number;
    readonly indentRight?: number;
    readonly indentHanging?: number;
    readonly indentFirstLine?: number;
    readonly shading?: string;
    readonly borders?: DocxParagraphBorders;
}

export interface DocxTableBorder {
    readonly style: string;
    readonly color: string;
    readonly size: number;
}

export interface DocxTableCellStyle {
    readonly backgroundColor?: string;
    readonly verticalAlign?: string;
    readonly width?: number;
    readonly widthUnit?: string;
    readonly borders?: {
        readonly top?: DocxTableBorder;
        readonly bottom?: DocxTableBorder;
        readonly left?: DocxTableBorder;
        readonly right?: DocxTableBorder;
    };
    readonly paddings?: {
        readonly top?: number;
        readonly bottom?: number;
        readonly left?: number;
        readonly right?: number;
    };
}

export interface DocxTableCell {
    readonly elements: ReadonlyArray<DocxParagraph | DocxTable>;
    readonly colSpan: number;
    readonly rowSpan: number;
    readonly cellStyle?: DocxTableCellStyle;
}

export interface DocxTableRowStyle {
    readonly height?: number;
    readonly isHeader?: boolean;
}

export interface DocxTableRow {
    readonly cells: ReadonlyArray<DocxTableCell>;
    readonly rowStyle?: DocxTableRowStyle;
}

export interface DocxTableStyle {
    readonly width?: number;
    readonly widthUnit?: string;
    readonly borders?: {
        readonly top?: DocxTableBorder;
        readonly bottom?: DocxTableBorder;
        readonly left?: DocxTableBorder;
        readonly right?: DocxTableBorder;
        readonly insideH?: DocxTableBorder;
        readonly insideV?: DocxTableBorder;
    };
}

export interface DocxTable {
    readonly type: 'table';
    readonly rows: ReadonlyArray<DocxTableRow>;
    readonly tableStyle?: DocxTableStyle;
}

export interface DocxImage {
    readonly type: 'image';
    readonly dataUrl: string;
    readonly width: number;
    readonly height: number;
    readonly altText: string;
}

export interface DocxFootnote {
    readonly id: string;
    readonly paragraphs: ReadonlyArray<DocxParagraph>;
}

export type DocxElement = DocxParagraph | DocxTable | DocxImage;

export interface DocxComment {
    readonly id: string;
    readonly author: string;
    readonly date: string;
    readonly paragraphs: ReadonlyArray<DocxParagraph>;
}

export interface DocxParseResult {
    readonly elements: ReadonlyArray<DocxElement>;
    readonly plainText: string;
    readonly footnotes: ReadonlyArray<DocxFootnote>;
    readonly endnotes: ReadonlyArray<DocxFootnote>;
    readonly comments: ReadonlyArray<DocxComment>;
    readonly headers: ReadonlyArray<ReadonlyArray<DocxElement>>;
    readonly footers: ReadonlyArray<ReadonlyArray<DocxElement>>;
}

const NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_MC = 'http://schemas.openxmlformats.org/markup-compatibility/2006';

type ThemeColorMap = ReadonlyMap<string, string>;

const SCHEME_COLOR_ALIASES: ReadonlyMap<string, string> = new Map([
    ['tx1', 'dk1'], ['tx2', 'dk2'],
    ['bg1', 'lt1'], ['bg2', 'lt2'],
]);

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
    return Array.from(parent.getElementsByTagNameNS(ns, localName));
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

    for (const rel of Array.from(rels)) {
        const id = rel.getAttribute('Id') ?? '';
        const target = rel.getAttribute('Target') ?? '';
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

function parseRunStyle(rPr: Element | null, themeColors?: ThemeColorMap): DocxRunStyle {
    if (!rPr) return {};

    const result: {
        bold?: boolean;
        italic?: boolean;
        underline?: boolean;
        strikethrough?: boolean;
        doubleStrikethrough?: boolean;
        caps?: boolean;
        smallCaps?: boolean;
        fontSize?: number;
        color?: string;
        fontFamily?: string;
        highlight?: string;
        backgroundColor?: string;
        vertAlign?: DocxVertAlign;
        rtl?: boolean;
        charSpacing?: number;
        hidden?: boolean;
    } = {};

    parseBoldItalic(rPr, result);
    if (getChildNS(rPr, NS_W, 'u')) result.underline = true;
    if (getChildNS(rPr, NS_W, 'strike')) result.strikethrough = true;
    if (getChildNS(rPr, NS_W, 'dstrike')) result.doubleStrikethrough = true;
    if (getChildNS(rPr, NS_W, 'caps')) result.caps = true;
    if (getChildNS(rPr, NS_W, 'smallCaps')) result.smallCaps = true;
    if (getChildNS(rPr, NS_W, 'vanish')) result.hidden = true;

    parseFontSizeAndColor(rPr, result, themeColors);
    parseFontFamily(rPr, result);
    parseHighlightAndShading(rPr, result);
    parseVertAlignAndRtl(rPr, result);
    parseCharSpacing(rPr, result);

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

function parseFontSizeAndColor(
    rPr: Element,
    result: { fontSize?: number; color?: string },
    themeColors?: ThemeColorMap,
): void {
    const sz = getChildNS(rPr, NS_W, 'sz');
    if (sz) {
        const val = getAttrVal(sz, NS_W, 'val');
        if (val) result.fontSize = Number.parseInt(val, 10) / 2;
    }

    const color = getChildNS(rPr, NS_W, 'color');
    if (color) {
        result.color = parseColorElement(color, themeColors);
    }
}

function parseColorElement(color: Element, themeColors?: ThemeColorMap): string | undefined {
    const val = getAttrVal(color, NS_W, 'val');
    if (val && val !== 'auto') return `#${val}`;
    if (!themeColors) return undefined;
    const themeColor = getAttrVal(color, NS_W, 'themeColor');
    if (!themeColor) return undefined;
    const resolved = resolveThemeColor(themeColor, themeColors);
    if (!resolved) return undefined;
    const tint = getAttrVal(color, NS_W, 'themeTint');
    const shade = getAttrVal(color, NS_W, 'themeShade');
    return applyTintShade(resolved, tint, shade);
}

function resolveThemeColor(themeColor: string, themeColors: ThemeColorMap): string | undefined {
    const mapped = SCHEME_COLOR_ALIASES.get(themeColor) ?? themeColor;
    return themeColors.get(mapped);
}

function applyTintShade(hex: string, tint: string | null, shade: string | null): string {
    if (!tint && !shade) return hex;

    const r = Number.parseInt(hex.substring(1, 3), 16);
    const g = Number.parseInt(hex.substring(3, 5), 16);
    const b = Number.parseInt(hex.substring(5, 7), 16);

    if (tint) {
        const t = Number.parseInt(tint, 16) / 255;
        return rgbToHex(
            Math.round(r + (255 - r) * t),
            Math.round(g + (255 - g) * t),
            Math.round(b + (255 - b) * t),
        );
    }

    if (shade) {
        const s = Number.parseInt(shade, 16) / 255;
        return rgbToHex(
            Math.round(r * s),
            Math.round(g * s),
            Math.round(b * s),
        );
    }

    return hex;
}

function rgbToHex(r: number, g: number, b: number): string {
    const toHex = (v: number): string => Math.min(255, Math.max(0, v)).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function parseCharSpacing(rPr: Element, result: { charSpacing?: number }): void {
    const spacing = getChildNS(rPr, NS_W, 'spacing');
    if (spacing) {
        const val = getAttrVal(spacing, NS_W, 'val');
        if (val) result.charSpacing = Number.parseInt(val, 10) / TWIPS_PER_PT;
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
    readonly listType?: DocxListType;
    readonly rtl?: boolean;
    readonly alignment?: string;
    readonly spacingBefore?: number;
    readonly spacingAfter?: number;
    readonly lineSpacing?: number;
    readonly indentLeft?: number;
    readonly indentRight?: number;
    readonly indentHanging?: number;
    readonly indentFirstLine?: number;
    readonly shading?: string;
    readonly borders?: DocxParagraphBorders;
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
        ...parseParagraphBordersAndShading(pPr),
    };
}

function parseParagraphBordersAndShading(pPr: Element): {
    shading?: string; borders?: DocxParagraphBorders;
} {
    const result: { shading?: string; borders?: DocxParagraphBorders } = {};

    const shd = getChildNS(pPr, NS_W, 'shd');
    if (shd) {
        const fill = getAttrVal(shd, NS_W, 'fill');
        if (fill && fill !== 'auto') result.shading = `#${fill}`;
    }

    const pBdr = getChildNS(pPr, NS_W, 'pBdr');
    if (pBdr) {
        result.borders = parseBorderSet(pBdr);
    }

    return result;
}

function parseBorderSet(borderParent: Element): DocxParagraphBorders {
    const borders: {
        top?: DocxBorder; bottom?: DocxBorder; left?: DocxBorder; right?: DocxBorder;
    } = {};

    const top = getChildNS(borderParent, NS_W, 'top');
    if (top) borders.top = parseSingleBorder(top);

    const bottom = getChildNS(borderParent, NS_W, 'bottom');
    if (bottom) borders.bottom = parseSingleBorder(bottom);

    const left = getChildNS(borderParent, NS_W, 'left');
    if (left) borders.left = parseSingleBorder(left);

    const right = getChildNS(borderParent, NS_W, 'right');
    if (right) borders.right = parseSingleBorder(right);

    return borders;
}

function parseSingleBorder(el: Element): DocxBorder {
    const style = getAttrVal(el, NS_W, 'val') ?? 'single';
    const colorVal = getAttrVal(el, NS_W, 'color');
    const color = colorVal && colorVal !== 'auto' ? `#${colorVal}` : '#000000';
    const sizeVal = getAttrVal(el, NS_W, 'sz');
    const size = sizeVal ? Number.parseInt(sizeVal, 10) / 8 : 1;
    return { style, color, size };
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

function parseIndentProperties(pPr: Element): {
    indentLeft?: number; indentRight?: number; indentHanging?: number; indentFirstLine?: number;
} {
    const ind = getChildNS(pPr, NS_W, 'ind');
    if (!ind) return {};

    const result: { indentLeft?: number; indentRight?: number; indentHanging?: number; indentFirstLine?: number } = {};

    const left = getAttrVal(ind, NS_W, 'left') ?? getAttrVal(ind, NS_W, 'start');
    if (left) result.indentLeft = Number.parseInt(left, 10) / TWIPS_PER_PT;

    const right = getAttrVal(ind, NS_W, 'right') ?? getAttrVal(ind, NS_W, 'end');
    if (right) result.indentRight = Number.parseInt(right, 10) / TWIPS_PER_PT;

    const hanging = getAttrVal(ind, NS_W, 'hanging');
    if (hanging) result.indentHanging = Number.parseInt(hanging, 10) / TWIPS_PER_PT;

    const firstLine = getAttrVal(ind, NS_W, 'firstLine');
    if (firstLine) result.indentFirstLine = Number.parseInt(firstLine, 10) / TWIPS_PER_PT;

    return result;
}

function parseRunChildren(
    run: Element,
    style: DocxRunStyle,
    relationships: Map<string, string>,
    files: Map<string, Uint8Array>,
): { runs: DocxRun[]; images: DocxImage[] } {
    const runs: DocxRun[] = [];
    const images: DocxImage[] = [];

    for (const child of Array.from(run.childNodes)) {
        if (child instanceof Element) {
            parseRunChildElement(child, style, runs, images, relationships, files);
        }
    }

    return { runs, images };
}

const SIMPLE_RUN_CHARS: Record<string, string> = {
    tab: '\t',
    noBreakHyphen: '\u2011',
    softHyphen: '\u00AD',
};

function parseRunChildElement(
    child: Element,
    style: DocxRunStyle,
    runs: DocxRun[],
    images: DocxImage[],
    relationships: Map<string, string>,
    files: Map<string, Uint8Array>,
): void {
    const localName = child.localName;

    if (localName === 't' || localName === 'delText') {
        const text = child.textContent ?? '';
        if (text) runs.push({ text, style });
        return;
    }
    if (localName === 'br') {
        runs.push({ text: '\n', style, breakType: parseBreakType(child) });
        return;
    }
    const simpleChar = SIMPLE_RUN_CHARS[localName];
    if (simpleChar) { runs.push({ text: simpleChar, style }); return; }
    if (localName === 'sym') {
        const symRun = parseSymbol(child, style);
        if (symRun) runs.push(symRun);
        return;
    }
    parseRunChildElementExtended(child, localName, style, runs, images, relationships, files);
}

function parseRunChildElementExtended(
    child: Element,
    localName: string,
    style: DocxRunStyle,
    runs: DocxRun[],
    images: DocxImage[],
    relationships: Map<string, string>,
    files: Map<string, Uint8Array>,
): void {
    if (localName === 'drawing' || localName === 'pict') {
        const img = extractImageFromDrawing(child, relationships, files);
        if (img) images.push(img);
        return;
    }
    if (localName === 'footnoteReference' || localName === 'endnoteReference') {
        parseNoteReference(child, localName, style, runs);
        return;
    }
    if (localName === 'commentReference') {
        const commentId = getAttrVal(child, NS_W, 'id');
        if (commentId) {
            runs.push({ text: `*${commentId}`, style: { ...style, vertAlign: 'superscript' } });
        }
    }
}

function parseNoteReference(
    child: Element,
    localName: string,
    style: DocxRunStyle,
    runs: DocxRun[],
): void {
    const noteId = getAttrVal(child, NS_W, 'id');
    if (noteId) {
        const marker = localName === 'footnoteReference' ? `[${noteId}]` : `{${noteId}}`;
        runs.push({ text: marker, style: { ...style, vertAlign: 'superscript' } });
    }
}

function parseBreakType(br: Element): DocxBreakType | undefined {
    const typeAttr = getAttrVal(br, NS_W, 'type');
    if (typeAttr === 'page') return 'page';
    if (typeAttr === 'column') return 'column';
    return undefined;
}

function parseSymbol(sym: Element, baseStyle: DocxRunStyle): DocxRun | null {
    const charCode = getAttrVal(sym, NS_W, 'char');
    if (!charCode) return null;
    const codePoint = Number.parseInt(charCode, 16);
    const text = String.fromCodePoint(codePoint);
    const font = getAttrVal(sym, NS_W, 'font');
    const style = font ? { ...baseStyle, fontFamily: font } : baseStyle;
    return { text, style };
}

function parseRun(
    run: Element,
    relationships: Map<string, string>,
    files: Map<string, Uint8Array>,
    themeColors?: ThemeColorMap,
): { runs: DocxRun[]; images: DocxImage[] } {
    const rPr = getChildNS(run, NS_W, 'rPr');
    const style = parseRunStyle(rPr, themeColors);
    return parseRunChildren(run, style, relationships, files);
}

function parseHyperlinkRuns(
    hyperlink: Element,
    relationships: Map<string, string>,
    files: Map<string, Uint8Array>,
    themeColors?: ThemeColorMap,
): { runs: DocxRun[]; images: DocxImage[] } {
    const allRuns: DocxRun[] = [];
    const allImages: DocxImage[] = [];

    const rId = hyperlink.getAttributeNS(NS_R, 'id') ?? hyperlink.getAttribute('r:id') ?? '';
    const target = rId ? (relationships.get(rId) ?? '') : '';
    const anchor = hyperlink.getAttributeNS(NS_W, 'anchor') ?? hyperlink.getAttribute('w:anchor') ?? '';
    const href = target || (anchor ? `#bookmark-${anchor}` : '');

    const runElements = getAllChildrenNS(hyperlink, NS_W, 'r');
    for (const run of runElements) {
        const { runs, images } = parseRun(run, relationships, files, themeColors);
        for (const r of runs) {
            if (href && r.text.trim()) {
                allRuns.push({
                    text: r.text,
                    style: { ...r.style, underline: true, color: r.style.color ?? '#0563C1' },
                    href,
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
    themeColors?: ThemeColorMap,
): { runs: DocxRun[]; images: DocxImage[] } {
    const allRuns: DocxRun[] = [];
    const allImages: DocxImage[] = [];
    let fieldState: FieldState = 'none';

    for (const child of Array.from(para.childNodes)) {
        if (!(child instanceof Element)) continue;
        fieldState = processDirectChild(child, fieldState, allRuns, allImages, relationships, files, themeColors);
    }

    return { runs: allRuns, images: allImages };
}

function processDirectChild(
    child: Element,
    fieldState: FieldState,
    allRuns: DocxRun[],
    allImages: DocxImage[],
    relationships: Map<string, string>,
    files: Map<string, Uint8Array>,
    themeColors?: ThemeColorMap,
): FieldState {
    if (child.localName === 'r' && child.namespaceURI === NS_W) {
        return processRunInField(child, fieldState, allRuns, allImages, relationships, files, themeColors);
    }

    if (fieldState !== 'begin') {
        collectChildElement(child, allRuns, allImages, relationships, files, themeColors);
    }
    return fieldState;
}

function processRunInField(
    child: Element,
    fieldState: FieldState,
    allRuns: DocxRun[],
    allImages: DocxImage[],
    relationships: Map<string, string>,
    files: Map<string, Uint8Array>,
    themeColors?: ThemeColorMap,
): FieldState {
    const fldCharResult = checkFieldChar(child);
    if (fldCharResult === 'begin') return 'begin';
    if (fldCharResult === 'separate') return 'separate';
    if (fldCharResult === 'end') return 'none';

    if (fieldState === 'begin') return fieldState;
    if (fieldState === 'separate') {
        const { runs, images } = parseRun(child, relationships, files, themeColors);
        allRuns.push(...runs);
        allImages.push(...images);
        return fieldState;
    }

    collectChildElement(child, allRuns, allImages, relationships, files, themeColors);
    return fieldState;
}

function checkFieldChar(run: Element): 'begin' | 'separate' | 'end' | null {
    for (const child of Array.from(run.childNodes)) {
        if (child instanceof Element && child.localName === 'fldChar') {
            const fldCharType = getAttrVal(child, NS_W, 'fldCharType');
            if (fldCharType === 'begin') return 'begin';
            if (fldCharType === 'separate') return 'separate';
            if (fldCharType === 'end') return 'end';
        }
    }
    return null;
}

function collectChildElement(
    child: Element,
    allRuns: DocxRun[],
    allImages: DocxImage[],
    relationships: Map<string, string>,
    files: Map<string, Uint8Array>,
    themeColors?: ThemeColorMap,
): void {
    const localName = child.localName;

    if (localName === 'r') {
        const { runs, images } = parseRun(child, relationships, files, themeColors);
        allRuns.push(...runs);
        allImages.push(...images);
    } else if (localName === 'hyperlink') {
        const { runs, images } = parseHyperlinkRuns(child, relationships, files, themeColors);
        allRuns.push(...runs);
        allImages.push(...images);
    } else if (localName === 'drawing') {
        const img = extractImageFromDrawing(child, relationships, files);
        if (img) allImages.push(img);
    } else if (localName === 'bookmarkStart') {
        const name = getAttrVal(child, NS_W, 'name');
        if (name && name !== '_GoBack') {
            allRuns.push({ text: '', style: {}, anchorId: `bookmark-${name}` });
        }
    } else if (localName === 'ins') {
        collectTrackChangeRuns(child, allRuns, allImages, relationships, files, true, themeColors);
    } else if (localName === 'del') {
        collectTrackChangeRuns(child, allRuns, allImages, relationships, files, false, themeColors);
    } else if (localName === 'fldSimple') {
        collectFieldSimpleRuns(child, allRuns, allImages, relationships, files, themeColors);
    } else if (isUnwrappableElement(localName)) {
        unwrapAndCollect(child, allRuns, allImages, relationships, files, themeColors);
    } else if (localName === 'AlternateContent' && child.namespaceURI === NS_MC) {
        collectAlternateContent(child, allRuns, allImages, relationships, files, themeColors);
    }
}

function isUnwrappableElement(localName: string): boolean {
    return localName === 'sdt' || localName === 'smartTag' || localName === 'customXml';
}

function unwrapAndCollect(
    wrapper: Element,
    allRuns: DocxRun[],
    allImages: DocxImage[],
    relationships: Map<string, string>,
    files: Map<string, Uint8Array>,
    themeColors?: ThemeColorMap,
): void {
    const content = wrapper.localName === 'sdt'
        ? getChildNS(wrapper, NS_W, 'sdtContent')
        : wrapper;
    if (!content) return;

    const { runs, images } = collectDirectChildRuns(content, relationships, files, themeColors);
    allRuns.push(...runs);
    allImages.push(...images);
}

function collectTrackChangeRuns(
    element: Element,
    allRuns: DocxRun[],
    allImages: DocxImage[],
    relationships: Map<string, string>,
    files: Map<string, Uint8Array>,
    isInserted: boolean,
    themeColors?: ThemeColorMap,
): void {
    for (const child of Array.from(element.childNodes)) {
        if (!(child instanceof Element)) continue;

        if (child.localName === 'r') {
            const { runs, images } = parseRun(child, relationships, files, themeColors);
            for (const r of runs) {
                allRuns.push(isInserted
                    ? { ...r, isInserted: true }
                    : { ...r, isDeleted: true });
            }
            allImages.push(...images);
        } else {
            collectChildElement(child, allRuns, allImages, relationships, files, themeColors);
        }
    }
}

function collectFieldSimpleRuns(
    fldSimple: Element,
    allRuns: DocxRun[],
    allImages: DocxImage[],
    relationships: Map<string, string>,
    files: Map<string, Uint8Array>,
    themeColors?: ThemeColorMap,
): void {
    const { runs, images } = collectDirectChildRuns(fldSimple, relationships, files, themeColors);
    allRuns.push(...runs);
    allImages.push(...images);
}

function collectAlternateContent(
    mc: Element,
    allRuns: DocxRun[],
    allImages: DocxImage[],
    relationships: Map<string, string>,
    files: Map<string, Uint8Array>,
    themeColors?: ThemeColorMap,
): void {
    const choice = getChildNS(mc, NS_MC, 'Choice');
    const target = choice ?? getChildNS(mc, NS_MC, 'Fallback');
    if (!target) return;

    const { runs, images } = collectDirectChildRuns(target, relationships, files, themeColors);
    allRuns.push(...runs);
    allImages.push(...images);
}

function parseParagraph(
    para: Element,
    relationships: Map<string, string>,
    files: Map<string, Uint8Array>,
    numberingMap: Map<string, Map<number, NumberingDefinition>>,
    themeColors?: ThemeColorMap,
): { paragraph: DocxParagraph; images: DocxImage[] } {
    const pPr = getChildNS(para, NS_W, 'pPr');
    const styleResult = parseParagraphStyle(pPr, numberingMap);

    const { runs: allRuns, images: allImages } = collectDirectChildRuns(para, relationships, files, themeColors);

    const paragraph: DocxParagraph = buildParagraphFromStyle(styleResult, allRuns);
    return { paragraph, images: allImages };
}

function buildParagraphFromStyle(
    sr: ParagraphStyleResult,
    runs: ReadonlyArray<DocxRun>,
): DocxParagraph {
    const paragraph: DocxParagraph = {
        type: 'paragraph',
        runs,
        style: sr.style,
        ...(sr.listLevel === undefined ? {} : { listLevel: sr.listLevel }),
        ...(sr.listType === undefined ? {} : { listType: sr.listType }),
        ...(sr.rtl === undefined ? {} : { rtl: sr.rtl }),
        ...(sr.alignment === undefined ? {} : { alignment: sr.alignment }),
        ...(sr.spacingBefore === undefined ? {} : { spacingBefore: sr.spacingBefore }),
        ...(sr.spacingAfter === undefined ? {} : { spacingAfter: sr.spacingAfter }),
        ...(sr.lineSpacing === undefined ? {} : { lineSpacing: sr.lineSpacing }),
        ...(sr.indentLeft === undefined ? {} : { indentLeft: sr.indentLeft }),
        ...(sr.indentRight === undefined ? {} : { indentRight: sr.indentRight }),
        ...(sr.indentHanging === undefined ? {} : { indentHanging: sr.indentHanging }),
        ...(sr.indentFirstLine === undefined ? {} : { indentFirstLine: sr.indentFirstLine }),
        ...(sr.shading === undefined ? {} : { shading: sr.shading }),
        ...(sr.borders === undefined ? {} : { borders: sr.borders }),
    };
    return paragraph;
}

function parseTableCellStyle(tcPr: Element | null): {
    colSpan: number; rowSpan: number; cellStyle?: DocxTableCellStyle;
} {
    if (!tcPr) return { colSpan: 1, rowSpan: 1 };

    let colSpan = 1;
    let rowSpan = 1;

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

    const cellStyle = buildCellStyle(tcPr);
    return { colSpan, rowSpan, cellStyle };
}

function buildCellStyle(tcPr: Element): DocxTableCellStyle | undefined {
    const style: {
        backgroundColor?: string; verticalAlign?: string;
        width?: number; widthUnit?: string;
        borders?: DocxTableCellStyle['borders'];
        paddings?: DocxTableCellStyle['paddings'];
    } = {};
    let hasStyle = false;

    const shd = getChildNS(tcPr, NS_W, 'shd');
    if (shd) {
        const fill = getAttrVal(shd, NS_W, 'fill');
        if (fill && fill !== 'auto') { style.backgroundColor = `#${fill}`; hasStyle = true; }
    }

    const vAlign = getChildNS(tcPr, NS_W, 'vAlign');
    if (vAlign) {
        const val = getAttrVal(vAlign, NS_W, 'val');
        if (val) { style.verticalAlign = val; hasStyle = true; }
    }

    const tcW = getChildNS(tcPr, NS_W, 'tcW');
    if (tcW) {
        const w = getAttrVal(tcW, NS_W, 'w');
        const wType = getAttrVal(tcW, NS_W, 'type') ?? 'dxa';
        if (w) { style.width = Number.parseInt(w, 10); style.widthUnit = wType; hasStyle = true; }
    }

    const tcBorders = getChildNS(tcPr, NS_W, 'tcBorders');
    if (tcBorders) {
        style.borders = parseTableBorderSet(tcBorders);
        hasStyle = true;
    }

    const tcMar = getChildNS(tcPr, NS_W, 'tcMar');
    if (tcMar) {
        style.paddings = parseCellMargins(tcMar);
        hasStyle = true;
    }

    return hasStyle ? style : undefined;
}

function parseCellMargins(tcMar: Element): DocxTableCellStyle['paddings'] {
    const paddings: { top?: number; bottom?: number; left?: number; right?: number } = {};
    const sideToNs: Record<string, string> = { left: 'start', right: 'end' };
    for (const side of ['top', 'bottom', 'left', 'right'] as const) {
        const nsName = sideToNs[side] ?? side;
        const el = getChildNS(tcMar, NS_W, nsName) ?? getChildNS(tcMar, NS_W, side);
        if (el) {
            const w = getAttrVal(el, NS_W, 'w');
            if (w) paddings[side] = Number.parseInt(w, 10) / TWIPS_PER_PT;
        }
    }
    return paddings;
}

function parseTableBorderSet(borderParent: Element): DocxTableCellStyle['borders'] {
    const borders: {
        top?: DocxTableBorder; bottom?: DocxTableBorder;
        left?: DocxTableBorder; right?: DocxTableBorder;
    } = {};

    for (const side of ['top', 'bottom', 'left', 'right'] as const) {
        const el = getChildNS(borderParent, NS_W, side);
        if (el) borders[side] = parseTableBorderElement(el);
    }

    return borders;
}

function parseTableBorderElement(el: Element): DocxTableBorder {
    return parseSingleBorder(el);
}

function getDirectChildElements(parent: Element, ns: string, localName: string): Element[] {
    const result: Element[] = [];
    for (const child of Array.from(parent.childNodes)) {
        if (child instanceof Element && child.namespaceURI === ns && child.localName === localName) {
            result.push(child);
        }
    }
    return result;
}

function parseTableCell(
    tc: Element,
    relationships: Map<string, string>,
    files: Map<string, Uint8Array>,
    numberingMap: Map<string, Map<number, NumberingDefinition>>,
    themeColors?: ThemeColorMap,
): DocxTableCell {
    const tcPr = getChildNS(tc, NS_W, 'tcPr');
    const { colSpan, rowSpan, cellStyle } = parseTableCellStyle(tcPr);

    const elements: (DocxParagraph | DocxTable)[] = [];
    for (const child of Array.from(tc.childNodes)) {
        if (!(child instanceof Element)) continue;

        if (child.localName === 'p' && child.namespaceURI === NS_W) {
            const { paragraph } = parseParagraph(child, relationships, files, numberingMap, themeColors);
            elements.push(paragraph);
        } else if (child.localName === 'tbl' && child.namespaceURI === NS_W) {
            elements.push(parseTable(child, relationships, files, numberingMap, themeColors));
        }
    }

    return { elements, colSpan, rowSpan, cellStyle };
}

function parseTableStyle(tblPr: Element | null): DocxTableStyle | undefined {
    if (!tblPr) return undefined;

    const style: {
        width?: number; widthUnit?: string; borders?: DocxTableStyle['borders'];
    } = {};
    let hasStyle = false;

    const tblW = getChildNS(tblPr, NS_W, 'tblW');
    if (tblW) {
        const w = getAttrVal(tblW, NS_W, 'w');
        const wType = getAttrVal(tblW, NS_W, 'type') ?? 'dxa';
        if (w) { style.width = Number.parseInt(w, 10); style.widthUnit = wType; hasStyle = true; }
    }

    const tblBorders = getChildNS(tblPr, NS_W, 'tblBorders');
    if (tblBorders) {
        const borders: {
            top?: DocxTableBorder; bottom?: DocxTableBorder;
            left?: DocxTableBorder; right?: DocxTableBorder;
            insideH?: DocxTableBorder; insideV?: DocxTableBorder;
        } = {};
        for (const side of ['top', 'bottom', 'left', 'right', 'insideH', 'insideV'] as const) {
            const el = getChildNS(tblBorders, NS_W, side);
            if (el) borders[side] = parseTableBorderElement(el);
        }
        style.borders = borders;
        hasStyle = true;
    }

    return hasStyle ? style : undefined;
}

function parseRowStyle(tr: Element): DocxTableRowStyle | undefined {
    const trPr = getChildNS(tr, NS_W, 'trPr');
    if (!trPr) return undefined;

    const style: { height?: number; isHeader?: boolean } = {};
    let hasStyle = false;

    const trHeight = getChildNS(trPr, NS_W, 'trHeight');
    if (trHeight) {
        const val = getAttrVal(trHeight, NS_W, 'val');
        if (val) { style.height = Number.parseInt(val, 10) / TWIPS_PER_PT; hasStyle = true; }
    }

    const tblHeader = getChildNS(trPr, NS_W, 'tblHeader');
    if (tblHeader) { style.isHeader = true; hasStyle = true; }

    return hasStyle ? style : undefined;
}

function parseTable(
    tbl: Element,
    relationships: Map<string, string>,
    files: Map<string, Uint8Array>,
    numberingMap: Map<string, Map<number, NumberingDefinition>>,
    themeColors?: ThemeColorMap,
): DocxTable {
    const tblPr = getChildNS(tbl, NS_W, 'tblPr');
    const tableStyle = parseTableStyle(tblPr);

    const rows: DocxTableRow[] = [];
    const trElements = getDirectChildElements(tbl, NS_W, 'tr');

    for (const tr of trElements) {
        const cells: DocxTableCell[] = [];
        const tcElements = getDirectChildElements(tr, NS_W, 'tc');
        for (const tc of tcElements) {
            cells.push(parseTableCell(tc, relationships, files, numberingMap, themeColors));
        }
        const rowStyle = parseRowStyle(tr);
        rows.push({ cells, rowStyle });
    }

    fixRowSpans(rows);
    return { type: 'table', rows, tableStyle };
}

function fixRowSpans(rows: ReadonlyArray<DocxTableRow>): void {
    if (rows.length === 0) return;

    const maxCols = Math.max(...rows.map(r => r.cells.length));
    for (let col = 0; col < maxCols; col++) {
        let startRow = -1;
        for (let row = 0; row < rows.length; row++) {
            const cell: DocxTableCell | undefined = rows[row].cells[col];
            if (!cell) continue;

            if (cell.rowSpan === 0 && startRow >= 0) {
                const startCell = rows[startRow].cells[col] as { rowSpan: number };
                startCell.rowSpan++;
            } else if (cell.rowSpan !== 0) {
                startRow = row;
            }
        }
    }
}

function extractPlainText(elements: ReadonlyArray<DocxElement>): string {
    const parts: string[] = [];

    for (const el of elements) {
        if (el.type === 'paragraph') {
            const text = el.runs.map(r => r.text).join('');
            if (text.trim()) parts.push(text);
        } else if (el.type === 'table') {
            for (const row of el.rows) {
                const cellTexts = row.cells.map(cell =>
                    extractCellText(cell)
                );
                parts.push(cellTexts.join('\t'));
            }
        }
    }

    return parts.join('\n');
}

function extractCellText(cell: DocxTableCell): string {
    return cell.elements.map(el => {
        if (el.type === 'paragraph') {
            return el.runs.map(r => r.text).join('');
        }
        return '';
    }).join(' ');
}

function parseBodyElements(
    body: Element,
    relationships: Map<string, string>,
    files: Map<string, Uint8Array>,
    numberingMap: Map<string, Map<number, NumberingDefinition>>,
    themeColors?: ThemeColorMap,
): DocxElement[] {
    const elements: DocxElement[] = [];

    for (const child of Array.from(body.childNodes)) {
        if (!(child instanceof Element)) continue;

        parseBodyChild(child, elements, relationships, files, numberingMap, themeColors);
    }

    return elements;
}

function parseBodyChild(
    child: Element,
    elements: DocxElement[],
    relationships: Map<string, string>,
    files: Map<string, Uint8Array>,
    numberingMap: Map<string, Map<number, NumberingDefinition>>,
    themeColors?: ThemeColorMap,
): void {
    const localName = child.localName;

    if (localName === 'p') {
        const { paragraph, images } = parseParagraph(child, relationships, files, numberingMap, themeColors);
        elements.push(...images, paragraph);
    } else if (localName === 'tbl') {
        elements.push(parseTable(child, relationships, files, numberingMap, themeColors));
    } else if (localName === 'sdt' || localName === 'customXml' || localName === 'smartTag') {
        const content = localName === 'sdt'
            ? getChildNS(child, NS_W, 'sdtContent')
            : child;
        if (content) {
            elements.push(...parseBodyElements(content, relationships, files, numberingMap, themeColors));
        }
    } else if (localName === 'AlternateContent' && child.namespaceURI === NS_MC) {
        const choice = getChildNS(child, NS_MC, 'Choice');
        const target = choice ?? getChildNS(child, NS_MC, 'Fallback');
        if (target) {
            elements.push(...parseBodyElements(target, relationships, files, numberingMap, themeColors));
        }
    }
}

function parseThemeColors(files: Map<string, Uint8Array>): ThemeColorMap {
    const themeFile = files.get('word/theme/theme1.xml');
    if (!themeFile) return new Map();

    const doc = parseXml(new TextDecoder().decode(themeFile));
    const map = new Map<string, string>();

    const themeElements = getChildNS(doc.documentElement, NS_A, 'themeElements');
    const clrScheme = themeElements ? getChildNS(themeElements, NS_A, 'clrScheme') : null;
    if (!clrScheme) return map;

    const colorNames = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];
    for (const name of colorNames) {
        const el = getChildNS(clrScheme, NS_A, name);
        if (!el) continue;

        const srgb = getChildNS(el, NS_A, 'srgbClr');
        if (srgb) {
            map.set(name, `#${srgb.getAttribute('val') ?? '000000'}`);
            continue;
        }
        const sys = getChildNS(el, NS_A, 'sysClr');
        if (sys) {
            map.set(name, `#${sys.getAttribute('lastClr') ?? sys.getAttribute('val') ?? '000000'}`);
        }
    }

    return map;
}

function parseFootnotesOrEndnotes(
    files: Map<string, Uint8Array>,
    fileName: string,
    relationships: Map<string, string>,
    numberingMap: Map<string, Map<number, NumberingDefinition>>,
    themeColors?: ThemeColorMap,
): DocxFootnote[] {
    const file = files.get(fileName);
    if (!file) return [];

    const doc = parseXml(new TextDecoder().decode(file));
    const tagName = fileName.includes('footnote') ? 'footnote' : 'endnote';
    const noteElements = getAllChildrenNS(doc.documentElement, NS_W, tagName);
    const notes: DocxFootnote[] = [];

    for (const note of noteElements) {
        const id = getAttrVal(note, NS_W, 'id') ?? '';
        const noteType = getAttrVal(note, NS_W, 'type');
        if (noteType === 'separator' || noteType === 'continuationSeparator') continue;

        const paragraphs: DocxParagraph[] = [];
        const paraElements = getAllChildrenNS(note, NS_W, 'p');
        for (const para of paraElements) {
            const { paragraph } = parseParagraph(para, relationships, files, numberingMap, themeColors);
            paragraphs.push(paragraph);
        }

        if (paragraphs.length > 0) {
            notes.push({ id, paragraphs });
        }
    }

    return notes;
}

interface ResolvedStyle {
    readonly runStyle?: DocxRunStyle;
    readonly paragraphAlignment?: string;
    readonly paragraphSpacingBefore?: number;
    readonly paragraphSpacingAfter?: number;
    readonly paragraphIndentLeft?: number;
    readonly paragraphIndentRight?: number;
    readonly paragraphIndentFirstLine?: number;
}

type StyleMap = ReadonlyMap<string, ResolvedStyle>;

function parseStyles(files: Map<string, Uint8Array>, themeColors?: ThemeColorMap): StyleMap {
    const stylesFile = files.get('word/styles.xml');
    if (!stylesFile) return new Map();

    const doc = parseXml(new TextDecoder().decode(stylesFile));
    const rawStyles = new Map<string, { basedOn?: string; rPr?: Element; pPr?: Element }>();

    const defaultRunStyle = extractDocDefaults(doc, themeColors);
    const styleElements = getAllChildrenNS(doc.documentElement, NS_W, 'style');

    for (const styleEl of styleElements) {
        const styleId = getAttrVal(styleEl, NS_W, 'styleId') ?? '';
        if (!styleId) continue;

        const basedOnEl = getChildNS(styleEl, NS_W, 'basedOn');
        const basedOn = basedOnEl ? (getAttrVal(basedOnEl, NS_W, 'val') ?? undefined) : undefined;
        const rPr = getChildNS(styleEl, NS_W, 'rPr') ?? undefined;
        const pPr = getChildNS(styleEl, NS_W, 'pPr') ?? undefined;

        rawStyles.set(styleId, { basedOn, rPr, pPr });
    }

    return resolveAllStyles(rawStyles, defaultRunStyle, themeColors);
}

function extractDocDefaults(doc: Document, themeColors?: ThemeColorMap): DocxRunStyle {
    const docDefaults = getChildNS(doc.documentElement, NS_W, 'docDefaults');
    if (!docDefaults) return {};

    const rPrDefault = getChildNS(docDefaults, NS_W, 'rPrDefault');
    if (!rPrDefault) return {};

    const rPr = getChildNS(rPrDefault, NS_W, 'rPr');
    return parseRunStyle(rPr, themeColors);
}

function resolveAllStyles(
    rawStyles: Map<string, { basedOn?: string; rPr?: Element; pPr?: Element }>,
    defaultRunStyle: DocxRunStyle,
    themeColors?: ThemeColorMap,
): Map<string, ResolvedStyle> {
    const resolved = new Map<string, ResolvedStyle>();
    const resolving = new Set<string>();

    for (const styleId of rawStyles.keys()) {
        resolveStyleChain(styleId, rawStyles, resolved, resolving, defaultRunStyle, themeColors);
    }

    return resolved;
}

function resolveStyleChain(
    styleId: string,
    rawStyles: Map<string, { basedOn?: string; rPr?: Element; pPr?: Element }>,
    resolved: Map<string, ResolvedStyle>,
    resolving: Set<string>,
    defaultRunStyle: DocxRunStyle,
    themeColors?: ThemeColorMap,
): ResolvedStyle {
    const cached = resolved.get(styleId);
    if (cached !== undefined) return cached;
    if (resolving.has(styleId)) return {};
    resolving.add(styleId);

    const raw = rawStyles.get(styleId);
    if (!raw) { resolving.delete(styleId); return {}; }

    let base: ResolvedStyle = {};
    if (raw.basedOn) {
        base = resolveStyleChain(raw.basedOn, rawStyles, resolved, resolving, defaultRunStyle, themeColors);
    }

    const ownRun = raw.rPr ? parseRunStyle(raw.rPr, themeColors) : {};
    const mergedRun = mergeRunStyles(defaultRunStyle, base.runStyle ?? {}, ownRun);
    const ownPara = extractParagraphStyleProps(raw.pPr);

    const result: ResolvedStyle = {
        runStyle: mergedRun,
        paragraphAlignment: ownPara.alignment ?? base.paragraphAlignment,
        paragraphSpacingBefore: ownPara.spacingBefore ?? base.paragraphSpacingBefore,
        paragraphSpacingAfter: ownPara.spacingAfter ?? base.paragraphSpacingAfter,
        paragraphIndentLeft: ownPara.indentLeft ?? base.paragraphIndentLeft,
        paragraphIndentRight: ownPara.indentRight ?? base.paragraphIndentRight,
        paragraphIndentFirstLine: ownPara.indentFirstLine ?? base.paragraphIndentFirstLine,
    };

    resolved.set(styleId, result);
    resolving.delete(styleId);
    return result;
}

function mergeRunStyles(
    defaults: DocxRunStyle,
    base: DocxRunStyle,
    own: DocxRunStyle,
): DocxRunStyle {
    return {
        ...mergeRunStylesText(defaults, base, own),
        ...mergeRunStylesDecoration(defaults, base, own),
    };
}

function mergeField<T>(own: T | undefined, base: T | undefined, def: T | undefined): T | undefined {
    return own ?? base ?? def;
}

function mergeRunStylesText(
    defaults: DocxRunStyle,
    base: DocxRunStyle,
    own: DocxRunStyle,
): Partial<DocxRunStyle> {
    return {
        bold: mergeField(own.bold, base.bold, defaults.bold),
        italic: mergeField(own.italic, base.italic, defaults.italic),
        fontSize: mergeField(own.fontSize, base.fontSize, defaults.fontSize),
        color: mergeField(own.color, base.color, defaults.color),
        fontFamily: mergeField(own.fontFamily, base.fontFamily, defaults.fontFamily),
        rtl: mergeField(own.rtl, base.rtl, defaults.rtl),
        charSpacing: mergeField(own.charSpacing, base.charSpacing, defaults.charSpacing),
        hidden: mergeField(own.hidden, base.hidden, defaults.hidden),
        vertAlign: mergeField(own.vertAlign, base.vertAlign, defaults.vertAlign),
    };
}

function mergeRunStylesDecoration(
    defaults: DocxRunStyle,
    base: DocxRunStyle,
    own: DocxRunStyle,
): Partial<DocxRunStyle> {
    return {
        underline: mergeField(own.underline, base.underline, defaults.underline),
        strikethrough: mergeField(own.strikethrough, base.strikethrough, defaults.strikethrough),
        doubleStrikethrough: mergeField(own.doubleStrikethrough, base.doubleStrikethrough, defaults.doubleStrikethrough),
        caps: mergeField(own.caps, base.caps, defaults.caps),
        smallCaps: mergeField(own.smallCaps, base.smallCaps, defaults.smallCaps),
        highlight: mergeField(own.highlight, base.highlight, defaults.highlight),
        backgroundColor: mergeField(own.backgroundColor, base.backgroundColor, defaults.backgroundColor),
    };
}

function extractParagraphStyleProps(pPr: Element | undefined): {
    alignment?: string; spacingBefore?: number; spacingAfter?: number;
    indentLeft?: number; indentRight?: number; indentFirstLine?: number;
} {
    if (!pPr) return {};
    const result: {
        alignment?: string; spacingBefore?: number; spacingAfter?: number;
        indentLeft?: number; indentRight?: number; indentFirstLine?: number;
    } = {};

    const jcEl = getChildNS(pPr, NS_W, 'jc');
    if (jcEl) {
        const val = getAttrVal(jcEl, NS_W, 'val');
        if (val) result.alignment = val;
    }

    extractSpacingProps(pPr, result);
    extractIndentProps(pPr, result);

    return result;
}

function extractSpacingProps(
    pPr: Element,
    result: { spacingBefore?: number; spacingAfter?: number },
): void {
    const spacing = getChildNS(pPr, NS_W, 'spacing');
    if (!spacing) return;
    const before = getAttrVal(spacing, NS_W, 'before');
    if (before) result.spacingBefore = Number.parseInt(before, 10) / TWIPS_PER_PT;
    const after = getAttrVal(spacing, NS_W, 'after');
    if (after) result.spacingAfter = Number.parseInt(after, 10) / TWIPS_PER_PT;
}

function extractIndentProps(
    pPr: Element,
    result: { indentLeft?: number; indentRight?: number; indentFirstLine?: number },
): void {
    const ind = getChildNS(pPr, NS_W, 'ind');
    if (!ind) return;
    const left = getAttrVal(ind, NS_W, 'left') ?? getAttrVal(ind, NS_W, 'start');
    if (left) result.indentLeft = Number.parseInt(left, 10) / TWIPS_PER_PT;
    const right = getAttrVal(ind, NS_W, 'right') ?? getAttrVal(ind, NS_W, 'end');
    if (right) result.indentRight = Number.parseInt(right, 10) / TWIPS_PER_PT;
    const firstLine = getAttrVal(ind, NS_W, 'firstLine');
    if (firstLine) result.indentFirstLine = Number.parseInt(firstLine, 10) / TWIPS_PER_PT;
}

function parseComments(
    files: Map<string, Uint8Array>,
    relationships: Map<string, string>,
    numberingMap: Map<string, Map<number, NumberingDefinition>>,
    themeColors?: ThemeColorMap,
): DocxComment[] {
    const file = files.get('word/comments.xml');
    if (!file) return [];

    const doc = parseXml(new TextDecoder().decode(file));
    const commentElements = getAllChildrenNS(doc.documentElement, NS_W, 'comment');
    const comments: DocxComment[] = [];

    for (const comment of commentElements) {
        const id = getAttrVal(comment, NS_W, 'id') ?? '';
        const author = getAttrVal(comment, NS_W, 'author') ?? '';
        const date = getAttrVal(comment, NS_W, 'date') ?? '';

        const paragraphs: DocxParagraph[] = [];
        const paraElements = getAllChildrenNS(comment, NS_W, 'p');
        for (const para of paraElements) {
            const { paragraph } = parseParagraph(para, relationships, files, numberingMap, themeColors);
            paragraphs.push(paragraph);
        }

        if (paragraphs.length > 0) {
            comments.push({ id, author, date, paragraphs });
        }
    }

    return comments;
}

function parseHeadersFooters(
    files: Map<string, Uint8Array>,
    relationships: Map<string, string>,
    numberingMap: Map<string, Map<number, NumberingDefinition>>,
    themeColors?: ThemeColorMap,
): { headers: DocxElement[][]; footers: DocxElement[][] } {
    const headers: DocxElement[][] = [];
    const footers: DocxElement[][] = [];

    for (const [, target] of relationships) {
        if (!target.startsWith('header') && !target.startsWith('footer')) continue;
        const filePath = target.startsWith('/') ? target.substring(1) : `word/${target}`;
        const file = files.get(filePath);
        if (!file) continue;

        const doc = parseXml(new TextDecoder().decode(file));
        const body = doc.documentElement;
        const elements = parseBodyElements(body, relationships, files, numberingMap, themeColors);

        if (target.startsWith('header')) {
            headers.push(elements);
        } else {
            footers.push(elements);
        }
    }

    return { headers, footers };
}

function applyStyleInheritance(
    elements: DocxElement[],
    styleMap: StyleMap,
): DocxElement[] {
    return elements.map(el => {
        if (el.type === 'paragraph') return applyStyleToParagraph(el, styleMap);
        if (el.type === 'table') return applyStyleToTable(el, styleMap);
        return el;
    });
}

function applyStyleToParagraph(para: DocxParagraph, styleMap: StyleMap): DocxParagraph {
    if (!para.style) return para;
    const resolved = styleMap.get(para.style);
    if (!resolved) return para;

    const mergedRuns = para.runs.map(run => applyStyleToRun(run, resolved));

    return {
        ...para,
        runs: mergedRuns,
        alignment: para.alignment ?? resolved.paragraphAlignment,
        spacingBefore: para.spacingBefore ?? resolved.paragraphSpacingBefore,
        spacingAfter: para.spacingAfter ?? resolved.paragraphSpacingAfter,
        indentLeft: para.indentLeft ?? resolved.paragraphIndentLeft,
        indentRight: para.indentRight ?? resolved.paragraphIndentRight,
        indentFirstLine: para.indentFirstLine ?? resolved.paragraphIndentFirstLine,
    };
}

function applyStyleToRun(run: DocxRun, resolved: ResolvedStyle): DocxRun {
    if (!resolved.runStyle) return run;
    const rs = resolved.runStyle;
    return { ...run, style: mergeRunStyles(rs, {}, run.style) };
}

function applyStyleToTable(table: DocxTable, styleMap: StyleMap): DocxTable {
    return {
        ...table,
        rows: table.rows.map(row => ({
            ...row,
            cells: row.cells.map(cell => ({
                ...cell,
                elements: cell.elements.map(el => {
                    if (el.type === 'paragraph') return applyStyleToParagraph(el, styleMap);
                    if (el.type === 'table') return applyStyleToTable(el, styleMap);
                    return el;
                }),
            })),
        })),
    };
}

export function parseDocx(data: Uint8Array): DocxParseResult {
    const files = readZip(data);
    const documentFile = files.get('word/document.xml');
    if (!documentFile) {
        throw new Error('Invalid DOCX: missing word/document.xml');
    }

    const relationships = parseRelationships(files);
    const numberingMap = parseNumberingDefinitions(files);
    const themeColors = parseThemeColors(files);
    const styleMap = parseStyles(files, themeColors);
    const doc = parseXml(new TextDecoder().decode(documentFile));
    const body = doc.getElementsByTagNameNS(NS_W, 'body')[0];
    if (!body) {
        throw new Error('Invalid DOCX: missing document body');
    }

    let elements = parseBodyElements(body, relationships, files, numberingMap, themeColors);
    elements = applyStyleInheritance(elements, styleMap);

    const { headers, footers } = parseHeadersFooters(files, relationships, numberingMap, themeColors);
    const footnotes = parseFootnotesOrEndnotes(files, 'word/footnotes.xml', relationships, numberingMap, themeColors);
    const endnotes = parseFootnotesOrEndnotes(files, 'word/endnotes.xml', relationships, numberingMap, themeColors);
    const comments = parseComments(files, relationships, numberingMap, themeColors);

    const plainText = extractPlainText(elements);
    return { elements, plainText, footnotes, endnotes, comments, headers, footers };
}
