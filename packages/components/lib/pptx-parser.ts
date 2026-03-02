import { readZip } from './zip-reader';
import { isValidImageMagicBytes } from './image-validator';

export interface PptxTextRun {
    readonly text: string;
    readonly bold?: boolean;
    readonly italic?: boolean;
    readonly fontSize?: number;
    readonly color?: string;
}

export interface PptxTextFrame {
    readonly type: 'text';
    readonly runs: ReadonlyArray<PptxTextRun>;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

export interface PptxImageElement {
    readonly type: 'image';
    readonly dataUrl: string;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

export interface PptxShapeElement {
    readonly type: 'shape';
    readonly shapeType: string;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly fillColor?: string;
}

export type PptxSlideElement = PptxTextFrame | PptxImageElement | PptxShapeElement;

export interface PptxSlide {
    readonly index: number;
    readonly title: string;
    readonly elements: ReadonlyArray<PptxSlideElement>;
    readonly width: number;
    readonly height: number;
}

export interface PptxParseResult {
    readonly slides: ReadonlyArray<PptxSlide>;
    readonly slideWidth: number;
    readonly slideHeight: number;
}

const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

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

function emuToPixels(emu: string | null): number {
    if (!emu) return 0;
    return Math.round(Number.parseInt(emu, 10) / EMU_PER_PIXEL);
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

function guessMimeType(data: Uint8Array): string {
    if (data[0] === 0xFF && data[1] === 0xD8) return 'image/jpeg';
    if (data[0] === 0x89 && data[1] === 0x50) return 'image/png';
    if (data[0] === 0x47 && data[1] === 0x49) return 'image/gif';
    return 'image/png';
}

function parseSlideSize(files: Map<string, Uint8Array>): { width: number; height: number } {
    const presFile = files.get('ppt/presentation.xml');
    if (!presFile) return { width: 960, height: 540 };

    const doc = parseXml(new TextDecoder().decode(presFile));
    const sldSz = getChildNS(doc.documentElement, NS_P, 'sldSz');
    if (!sldSz) return { width: 960, height: 540 };

    const cx = sldSz.getAttribute('cx');
    const cy = sldSz.getAttribute('cy');
    return {
        width: cx ? emuToPixels(cx) : 960,
        height: cy ? emuToPixels(cy) : 540,
    };
}

function getSlideList(files: Map<string, Uint8Array>): string[] {
    const presFile = files.get('ppt/presentation.xml');
    if (!presFile) return [];

    const doc = parseXml(new TextDecoder().decode(presFile));
    const sldIdLst = getChildNS(doc.documentElement, NS_P, 'sldIdLst');
    if (!sldIdLst) return [];

    const sldIds = getAllChildrenNS(sldIdLst, NS_P, 'sldId');
    const rIds: string[] = [];
    for (const sldId of sldIds) {
        const rId = sldId.getAttributeNS(NS_R, 'id');
        if (rId) rIds.push(rId);
    }

    return rIds;
}

function getSlideRelationships(files: Map<string, Uint8Array>): Map<string, string> {
    const relsFile = files.get('ppt/_rels/presentation.xml.rels');
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

function getSlideMediaRelationships(files: Map<string, Uint8Array>, slideIndex: number): Map<string, string> {
    const relsPath = `ppt/slides/_rels/slide${slideIndex + 1}.xml.rels`;
    const relsFile = files.get(relsPath);
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

function parseTextRun(r: Element): PptxTextRun {
    const rPr = getChildNS(r, NS_A, 'rPr');
    const t = getChildNS(r, NS_A, 't');
    const text = t?.textContent ?? '';

    const run: PptxTextRun = { text };
    if (!rPr) return run;

    const result: { bold?: boolean; italic?: boolean; fontSize?: number; color?: string } = {};

    if (rPr.getAttribute('b') === '1') result.bold = true;
    if (rPr.getAttribute('i') === '1') result.italic = true;

    const sz = rPr.getAttribute('sz');
    if (sz) result.fontSize = Number.parseInt(sz, 10) / 100;

    const solidFill = getChildNS(rPr, NS_A, 'solidFill');
    if (solidFill) {
        const srgbClr = getChildNS(solidFill, NS_A, 'srgbClr');
        if (srgbClr) {
            result.color = `#${srgbClr.getAttribute('val') ?? '000000'}`;
        }
    }

    return { ...run, ...result };
}

function parsePosition(spTree: Element): { x: number; y: number; width: number; height: number } {
    const off = getChildNS(spTree, NS_A, 'off');
    const ext = getChildNS(spTree, NS_A, 'ext');

    return {
        x: emuToPixels(off?.getAttribute('x') ?? null),
        y: emuToPixels(off?.getAttribute('y') ?? null),
        width: emuToPixels(ext?.getAttribute('cx') ?? null),
        height: emuToPixels(ext?.getAttribute('cy') ?? null),
    };
}

function extractParagraphRuns(paragraph: Element): PptxTextRun[] {
    const runs: PptxTextRun[] = [];

    const rElements = getAllChildrenNS(paragraph, NS_A, 'r');
    for (const r of rElements) {
        runs.push(parseTextRun(r));
    }

    const fldElements = getAllChildrenNS(paragraph, NS_A, 'fld');
    for (const fld of fldElements) {
        const t = getChildNS(fld, NS_A, 't');
        if (t?.textContent?.trim()) {
            runs.push({ text: t.textContent });
        }
    }

    if (runs.length === 0) {
        const brElements = getAllChildrenNS(paragraph, NS_A, 'br');
        if (brElements.length > 0) return [];
        const directText = paragraph.textContent?.trim();
        if (directText) runs.push({ text: directText });
    }

    return runs;
}

function parseTextFrame(sp: Element): PptxTextFrame | null {
    const txBody = getChildNS(sp, NS_P, 'txBody')
        ?? getChildNS(sp, NS_A, 'txBody');
    if (!txBody) return null;

    const paragraphs = getAllChildrenNS(txBody, NS_A, 'p');
    const allRuns: PptxTextRun[] = [];

    for (let pi = 0; pi < paragraphs.length; pi++) {
        if (pi > 0) allRuns.push({ text: '\n' });
        const pRuns = extractParagraphRuns(paragraphs[pi]);
        allRuns.push(...pRuns);
    }

    if (allRuns.length === 0 || allRuns.every(r => !r.text.trim())) return null;

    const spPr = getChildNS(sp, NS_P, 'spPr') ?? getChildNS(sp, NS_A, 'spPr');
    const xfrm = spPr ? getChildNS(spPr, NS_A, 'xfrm') : null;
    const pos = xfrm ? parsePosition(xfrm) : { x: 0, y: 0, width: 300, height: 50 };

    return { type: 'text', runs: allRuns, ...pos };
}

function parseImage(
    sp: Element,
    mediaRels: Map<string, string>,
    files: Map<string, Uint8Array>,
): PptxImageElement | null {
    const blipFill = getChildNS(sp, NS_P, 'blipFill');
    if (!blipFill) return null;

    const blip = getChildNS(blipFill, NS_A, 'blip');
    if (!blip) return null;

    const rId = blip.getAttributeNS(NS_R, 'embed') ?? '';
    if (!rId) return null;

    const target = mediaRels.get(rId);
    if (!target) return null;

    const imagePath = target.startsWith('/') ? target.substring(1) : `ppt/slides/${target}`.replaceAll('../', 'ppt/');
    const normalizedPath = normalizePath(imagePath);
    const imageData = files.get(normalizedPath);
    if (!imageData || !isValidImageMagicBytes(imageData)) return null;

    const spPr = getChildNS(sp, NS_P, 'spPr');
    const xfrm = spPr ? getChildNS(spPr, NS_A, 'xfrm') : null;
    const pos = xfrm ? parsePosition(xfrm) : { x: 0, y: 0, width: 200, height: 200 };

    const mimeType = guessMimeType(imageData);
    const base64 = uint8ArrayToBase64(imageData);
    const dataUrl = `data:${mimeType};base64,${base64}`;

    return { type: 'image', dataUrl, ...pos };
}

function normalizePath(path: string): string {
    const parts = path.split('/');
    const normalized: string[] = [];
    for (const part of parts) {
        if (part === '..') {
            normalized.pop();
        } else if (part !== '.' && part !== '') {
            normalized.push(part);
        }
    }
    return normalized.join('/');
}

function extractShapeElements(
    root: Element,
    mediaRels: Map<string, string>,
    files: Map<string, Uint8Array>,
): PptxSlideElement[] {
    const elements: PptxSlideElement[] = [];

    const spElements = getAllChildrenNS(root, NS_P, 'sp');
    for (const sp of spElements) {
        const textFrame = parseTextFrame(sp);
        if (textFrame) elements.push(textFrame);
    }

    const picElements = getAllChildrenNS(root, NS_P, 'pic');
    for (const pic of picElements) {
        const img = parseImage(pic, mediaRels, files);
        if (img) elements.push(img);
    }

    return elements;
}

function getSlideLayoutPath(files: Map<string, Uint8Array>, slideIndex: number): string | null {
    const relsPath = `ppt/slides/_rels/slide${slideIndex + 1}.xml.rels`;
    const relsFile = files.get(relsPath);
    if (!relsFile) return null;

    const doc = parseXml(new TextDecoder().decode(relsFile));
    const rels = doc.getElementsByTagName('Relationship');

    for (let i = 0; i < rels.length; i++) {
        const relType = rels[i].getAttribute('Type') ?? '';
        if (relType.includes('slideLayout')) {
            const target = rels[i].getAttribute('Target') ?? '';
            return target.startsWith('/') ? target.substring(1) : normalizePath(`ppt/slides/${target}`);
        }
    }
    return null;
}

function getLayoutMediaRels(files: Map<string, Uint8Array>, layoutPath: string): Map<string, string> {
    const dir = layoutPath.substring(0, layoutPath.lastIndexOf('/'));
    const filename = layoutPath.substring(layoutPath.lastIndexOf('/') + 1);
    const relsPath = `${dir}/_rels/${filename}.rels`;
    const relsFile = files.get(relsPath);
    if (!relsFile) return new Map();

    const doc = parseXml(new TextDecoder().decode(relsFile));
    const rels = doc.getElementsByTagName('Relationship');
    const map = new Map<string, string>();
    for (let i = 0; i < rels.length; i++) {
        map.set(rels[i].getAttribute('Id') ?? '', rels[i].getAttribute('Target') ?? '');
    }
    return map;
}

function parseSlide(
    slideData: Uint8Array,
    slideIndex: number,
    files: Map<string, Uint8Array>,
    slideWidth: number,
    slideHeight: number,
): PptxSlide {
    const doc = parseXml(new TextDecoder().decode(slideData));
    const mediaRels = getSlideMediaRelationships(files, slideIndex);

    const elements = extractShapeElements(doc.documentElement, mediaRels, files);
    let title = '';

    for (const el of elements) {
        if (el.type === 'text' && !title) {
            const plainText = el.runs.map(r => r.text).join('').trim();
            if (plainText) title = plainText;
        }
    }

    if (elements.length === 0) {
        const layoutPath = getSlideLayoutPath(files, slideIndex);
        if (layoutPath) {
            const layoutData = files.get(layoutPath);
            if (layoutData) {
                const layoutDoc = parseXml(new TextDecoder().decode(layoutData));
                const layoutRels = getLayoutMediaRels(files, layoutPath);
                const layoutElements = extractShapeElements(layoutDoc.documentElement, layoutRels, files);
                elements.push(...layoutElements);

                for (const el of layoutElements) {
                    if (el.type === 'text' && !title) {
                        const plainText = el.runs.map(r => r.text).join('').trim();
                        if (plainText) title = plainText;
                    }
                }
            }
        }
    }

    return {
        index: slideIndex,
        title: title.substring(0, 200),
        elements,
        width: slideWidth,
        height: slideHeight,
    };
}

export function parsePptx(data: Uint8Array): PptxParseResult {
    const files = readZip(data);
    const { width, height } = parseSlideSize(files);

    const slideRIds = getSlideList(files);
    const presRels = getSlideRelationships(files);

    const slides: PptxSlide[] = [];

    if (slideRIds.length > 0) {
        for (let i = 0; i < slideRIds.length; i++) {
            const target = presRels.get(slideRIds[i]);
            if (!target) continue;
            const slidePath = target.startsWith('/') ? target.substring(1) : `ppt/${target}`;
            const slideData = files.get(slidePath);
            if (!slideData) continue;
            slides.push(parseSlide(slideData, i, files, width, height));
        }
    }

    if (slides.length === 0) {
        for (let i = 1; i <= 100; i++) {
            const slidePath = `ppt/slides/slide${i}.xml`;
            const slideData = files.get(slidePath);
            if (!slideData) break;
            slides.push(parseSlide(slideData, i - 1, files, width, height));
        }
    }

    return { slides, slideWidth: width, slideHeight: height };
}
