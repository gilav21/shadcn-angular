import { readZip } from './zip-reader';
import { isValidImageMagicBytes } from './image-validator';

export interface DocxRunStyle {
    readonly bold?: boolean;
    readonly italic?: boolean;
    readonly underline?: boolean;
    readonly fontSize?: number;
    readonly color?: string;
}

export interface DocxRun {
    readonly text: string;
    readonly style: DocxRunStyle;
}

export interface DocxParagraph {
    readonly type: 'paragraph';
    readonly runs: ReadonlyArray<DocxRun>;
    readonly style: string;
    readonly listLevel?: number;
    readonly listType?: 'bullet' | 'numbered';
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
const NS_PIC = 'http://schemas.openxmlformats.org/drawingml/2006/picture';

const EMU_PER_PIXEL = 9525;

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

function parseRunStyle(rPr: Element | null): DocxRunStyle {
    if (!rPr) return {};

    const style: DocxRunStyle = {};
    const result: {
        bold?: boolean;
        italic?: boolean;
        underline?: boolean;
        fontSize?: number;
        color?: string;
    } = {};

    if (getChildNS(rPr, NS_W, 'b')) result.bold = true;
    if (getChildNS(rPr, NS_W, 'i')) result.italic = true;
    if (getChildNS(rPr, NS_W, 'u')) result.underline = true;

    const sz = getChildNS(rPr, NS_W, 'sz');
    if (sz) {
        const val = sz.getAttributeNS(NS_W, 'val');
        if (val) result.fontSize = Number.parseInt(val, 10) / 2;
    }

    const color = getChildNS(rPr, NS_W, 'color');
    if (color) {
        const val = color.getAttributeNS(NS_W, 'val');
        if (val && val !== 'auto') result.color = `#${val}`;
    }

    return { ...style, ...result };
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

function parseParagraphStyle(pPr: Element | null): { style: string; listLevel?: number; listType?: 'bullet' | 'numbered' } {
    if (!pPr) return { style: '' };

    const pStyleEl = getChildNS(pPr, NS_W, 'pStyle');
    const style = pStyleEl?.getAttributeNS(NS_W, 'val') ?? '';

    const numPr = getChildNS(pPr, NS_W, 'numPr');
    if (numPr) {
        const ilvl = getChildNS(numPr, NS_W, 'ilvl');
        const level = ilvl ? Number.parseInt(ilvl.getAttributeNS(NS_W, 'val') ?? '0', 10) : 0;
        const numId = getChildNS(numPr, NS_W, 'numId');
        const numIdVal = numId ? Number.parseInt(numId.getAttributeNS(NS_W, 'val') ?? '0', 10) : 0;
        if (numIdVal > 0) {
            return { style, listLevel: level, listType: 'bullet' };
        }
    }

    return { style };
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

function parseParagraph(
    para: Element,
    relationships: Map<string, string>,
    files: Map<string, Uint8Array>,
): { paragraph: DocxParagraph; images: DocxImage[] } {
    const pPr = getChildNS(para, NS_W, 'pPr');
    const { style, listLevel, listType } = parseParagraphStyle(pPr);

    const allRuns: DocxRun[] = [];
    const allImages: DocxImage[] = [];

    const runElements = getAllChildrenNS(para, NS_W, 'r');
    for (const run of runElements) {
        const { runs, images } = parseRun(run, relationships, files);
        allRuns.push(...runs);
        allImages.push(...images);
    }

    const drawingElements = getAllChildrenNS(para, NS_W, 'drawing');
    for (const drawing of drawingElements) {
        const img = extractImageFromDrawing(drawing, relationships, files);
        if (img) allImages.push(img);
    }

    const paragraph: DocxParagraph = {
        type: 'paragraph',
        runs: allRuns,
        style,
        ...(listLevel !== undefined ? { listLevel } : {}),
        ...(listType !== undefined ? { listType } : {}),
    };

    return { paragraph, images: allImages };
}

function parseTableCell(
    tc: Element,
    relationships: Map<string, string>,
    files: Map<string, Uint8Array>,
): DocxTableCell {
    const tcPr = getChildNS(tc, NS_W, 'tcPr');
    let colSpan = 1;
    let rowSpan = 1;

    if (tcPr) {
        const gridSpan = getChildNS(tcPr, NS_W, 'gridSpan');
        if (gridSpan) {
            colSpan = Number.parseInt(gridSpan.getAttributeNS(NS_W, 'val') ?? '1', 10);
        }
        const vMerge = getChildNS(tcPr, NS_W, 'vMerge');
        if (vMerge) {
            const mergeVal = vMerge.getAttributeNS(NS_W, 'val');
            if (!mergeVal || mergeVal === 'continue') {
                rowSpan = 0;
            }
        }
    }

    const paragraphs: DocxParagraph[] = [];
    const paraElements = getAllChildrenNS(tc, NS_W, 'p');
    for (const para of paraElements) {
        const { paragraph } = parseParagraph(para, relationships, files);
        paragraphs.push(paragraph);
    }

    return { paragraphs, colSpan, rowSpan };
}

function parseTable(
    tbl: Element,
    relationships: Map<string, string>,
    files: Map<string, Uint8Array>,
): DocxTable {
    const rows: DocxTableCell[][] = [];
    const trElements = getAllChildrenNS(tbl, NS_W, 'tr');

    for (const tr of trElements) {
        const cells: DocxTableCell[] = [];
        const tcElements = getAllChildrenNS(tr, NS_W, 'tc');
        for (const tc of tcElements) {
            cells.push(parseTableCell(tc, relationships, files));
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

export function parseDocx(data: Uint8Array): DocxParseResult {
    const files = readZip(data);
    const documentFile = files.get('word/document.xml');
    if (!documentFile) {
        throw new Error('Invalid DOCX: missing word/document.xml');
    }

    const relationships = parseRelationships(files);
    const doc = parseXml(new TextDecoder().decode(documentFile));
    const body = doc.getElementsByTagNameNS(NS_W, 'body')[0];
    if (!body) {
        throw new Error('Invalid DOCX: missing document body');
    }

    const elements: DocxElement[] = [];

    for (let i = 0; i < body.childNodes.length; i++) {
        const child = body.childNodes[i];
        if (!(child instanceof Element)) continue;

        const localName = child.localName;
        if (localName === 'p') {
            const { paragraph, images } = parseParagraph(child, relationships, files);
            elements.push(...images);
            elements.push(paragraph);
        } else if (localName === 'tbl') {
            elements.push(parseTable(child, relationships, files));
        }
    }

    const plainText = extractPlainText(elements);
    return { elements, plainText };
}
