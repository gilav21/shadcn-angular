import { readZip } from './zip-reader';
import { isValidImageMagicBytes } from './image-validator';

// --- Type Aliases ---

export type PptxAlignment = 'l' | 'ctr' | 'r' | 'just' | 'dist';
export type PptxBulletType = 'char' | 'autoNum' | 'none';
export type PptxGradientType = 'linear' | 'radial' | 'rect' | 'shape';
type PptxTabAlignment = 'l' | 'ctr' | 'r' | 'dec';
type PptxFontAlign = 'auto' | 't' | 'ctr' | 'base' | 'b';
type PptxCapType = 'all' | 'small';

// --- Interfaces ---

export interface PptxGradientStop {
    readonly position: number;
    readonly color: string;
}

export interface PptxGradientFill {
    readonly type: PptxGradientType;
    readonly angle?: number;
    readonly stops: ReadonlyArray<PptxGradientStop>;
}

export interface PptxPatternFill {
    readonly preset: string;
    readonly fgColor: string;
    readonly bgColor: string;
}

export interface PptxShadowEffect {
    readonly offsetX: number;
    readonly offsetY: number;
    readonly blur: number;
    readonly color: string;
}

export interface PptxGlowEffect {
    readonly radius: number;
    readonly color: string;
}

export interface PptxReflectionEffect {
    readonly blurRadius: number;
    readonly startOpacity: number;
    readonly endOpacity: number;
    readonly distance: number;
    readonly direction: number;
    readonly scaleY: number;
}

export interface PptxEffects {
    readonly outerShadow?: PptxShadowEffect;
    readonly innerShadow?: PptxShadowEffect;
    readonly glow?: PptxGlowEffect;
    readonly blur?: number;
    readonly softEdge?: number;
    readonly reflection?: PptxReflectionEffect;
}

export interface PptxUnderlineStyle {
    readonly color?: string;
    readonly width?: number;
    readonly dashStyle?: string;
    readonly compound?: string;
}

export interface PptxTextOutline {
    readonly width: number;
    readonly color?: string;
    readonly dashStyle?: string;
}

export interface PptxTabStop {
    readonly position: number;
    readonly alignment: PptxTabAlignment;
}

export interface PptxBullet {
    readonly type: PptxBulletType;
    readonly char?: string;
    readonly autoNumScheme?: string;
    readonly startAt?: number;
    readonly color?: string;
    readonly sizePercent?: number;
    readonly fontFamily?: string;
    readonly sizePoints?: number;
    readonly imageDataUrl?: string;
}

export interface PptxTextRun {
    readonly text: string;
    readonly bold?: boolean;
    readonly italic?: boolean;
    readonly fontSize?: number;
    readonly color?: string;
    readonly underline?: boolean;
    readonly strikethrough?: boolean;
    readonly fontFamily?: string;
    readonly baseline?: number;
    readonly cap?: PptxCapType;
    readonly spc?: number;
    readonly highlight?: string;
    readonly isHyperlink?: boolean;
    readonly hoverTooltip?: string;
    readonly gradientFill?: PptxGradientFill;
    readonly patternFill?: PptxPatternFill;
    readonly imageFill?: string;
    readonly noFill?: boolean;
    readonly textOutline?: PptxTextOutline;
    readonly underlineStyle?: PptxUnderlineStyle;
    readonly effects?: PptxEffects;
    readonly symFont?: string;
}

export interface PptxParagraph {
    readonly runs: ReadonlyArray<PptxTextRun>;
    readonly alignment?: PptxAlignment;
    readonly rtl?: boolean;
    readonly level?: number;
    readonly bullet?: PptxBullet;
    readonly spacingBefore?: number;
    readonly spacingAfter?: number;
    readonly lineSpacing?: number;
    readonly marginLeft?: number;
    readonly indent?: number;
    readonly fontAlign?: PptxFontAlign;
    readonly defaultTabSize?: number;
    readonly tabs?: ReadonlyArray<PptxTabStop>;
}

export interface PptxTextFrame {
    readonly type: 'text';
    readonly paragraphs: ReadonlyArray<PptxParagraph>;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly fillColor?: string;
    readonly borderColor?: string;
    readonly borderWidth?: number;
    readonly rotation?: number;
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
    readonly borderColor?: string;
    readonly borderWidth?: number;
    readonly rotation?: number;
    readonly gradientFill?: PptxGradientFill;
    readonly imageFill?: string;
    readonly patternFill?: PptxPatternFill;
    readonly effects?: PptxEffects;
    readonly dashStyle?: string;
}

export interface PptxTableCell {
    readonly text: string;
    readonly bold?: boolean;
    readonly fillColor?: string;
    readonly color?: string;
}

export interface PptxTableElement {
    readonly type: 'table';
    readonly rows: ReadonlyArray<ReadonlyArray<PptxTableCell>>;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly columnWidths?: ReadonlyArray<number>;
}

export interface PptxConnectorElement {
    readonly type: 'connector';
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly color?: string;
    readonly lineWidth?: number;
    readonly flipH?: boolean;
    readonly flipV?: boolean;
    readonly connectorType?: string;
    readonly dashStyle?: string;
    readonly headEnd?: boolean;
    readonly tailEnd?: boolean;
}

export type PptxSlideElement =
    | PptxTextFrame
    | PptxImageElement
    | PptxShapeElement
    | PptxTableElement
    | PptxConnectorElement;

export interface PptxSlide {
    readonly index: number;
    readonly title: string;
    readonly elements: ReadonlyArray<PptxSlideElement>;
    readonly width: number;
    readonly height: number;
    readonly backgroundColor?: string;
    readonly backgroundImage?: string;
}

export interface PptxParseResult {
    readonly slides: ReadonlyArray<PptxSlide>;
    readonly slideWidth: number;
    readonly slideHeight: number;
}

// --- Constants ---

const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

const EMU_PER_PIXEL = 9525;

type ThemeColorMap = ReadonlyMap<string, string>;

interface TextRunProperties {
    bold?: boolean;
    italic?: boolean;
    fontSize?: number;
    color?: string;
    underline?: boolean;
    strikethrough?: boolean;
    fontFamily?: string;
    baseline?: number;
    cap?: PptxCapType;
    spc?: number;
    highlight?: string;
    isHyperlink?: boolean;
    gradientFill?: PptxGradientFill;
    patternFill?: PptxPatternFill;
    imageFill?: string;
    noFill?: boolean;
    textOutline?: PptxTextOutline;
    underlineStyle?: PptxUnderlineStyle;
    effects?: PptxEffects;
    symFont?: string;
    hoverTooltip?: string;
}

interface MasterTextStyles {
    title?: TextRunProperties;
    body?: TextRunProperties;
}

// --- XML Helpers ---

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

// --- Binary / Image Helpers ---

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

// --- Color Foundation ---

function computeHue(r: number, g: number, b: number, max: number, d: number): number {
    if (max === r) return ((g - b) / d + (g < b ? 6 : 0)) / 6;
    if (max === g) return ((b - r) / d + 2) / 6;
    return ((r - g) / d + 4) / 6;
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
    const raw = hex.replace('#', '');
    const r = Number.parseInt(raw.substring(0, 2), 16) / 255;
    const g = Number.parseInt(raw.substring(2, 4), 16) / 255;
    const b = Number.parseInt(raw.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;

    if (max === min) return { h: 0, s: 0, l };

    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    const h = computeHue(r, g, b, max, d);

    return { h, s, l };
}

function hueToRgb(p: number, q: number, t: number): number {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
}

function hslToHex(h: number, s: number, l: number): string {
    if (s === 0) {
        const v = Math.round(l * 255);
        const hex = v.toString(16).padStart(2, '0');
        return `#${hex}${hex}${hex}`;
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const r = Math.round(hueToRgb(p, q, h + 1 / 3) * 255);
    const g = Math.round(hueToRgb(p, q, h) * 255);
    const b = Math.round(hueToRgb(p, q, h - 1 / 3) * 255);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function applyColorModifiers(colorEl: Element, baseHex: string): string {
    const hsl = hexToHsl(baseHex);

    const lumMod = getChildNS(colorEl, NS_A, 'lumMod');
    if (lumMod) {
        const val = Number.parseInt(lumMod.getAttribute('val') ?? '100000', 10) / 100000;
        hsl.l *= val;
    }

    const lumOff = getChildNS(colorEl, NS_A, 'lumOff');
    if (lumOff) {
        const val = Number.parseInt(lumOff.getAttribute('val') ?? '0', 10) / 100000;
        hsl.l += val;
    }

    const tint = getChildNS(colorEl, NS_A, 'tint');
    if (tint) {
        const val = Number.parseInt(tint.getAttribute('val') ?? '100000', 10) / 100000;
        hsl.l = hsl.l + (1 - hsl.l) * (1 - val);
    }

    const shade = getChildNS(colorEl, NS_A, 'shade');
    if (shade) {
        const val = Number.parseInt(shade.getAttribute('val') ?? '100000', 10) / 100000;
        hsl.l *= val;
    }

    hsl.l = Math.max(0, Math.min(1, hsl.l));
    hsl.s = Math.max(0, Math.min(1, hsl.s));

    return hslToHex(hsl.h, hsl.s, hsl.l);
}

const SCHEME_COLOR_ALIASES: ReadonlyMap<string, string> = new Map([
    ['tx1', 'dk1'], ['tx2', 'dk2'],
    ['bg1', 'lt1'], ['bg2', 'lt2'],
    ['phClr', 'accent1'],
]);

function resolveColorWithModifiers(element: Element, themeColors: ThemeColorMap): string | undefined {
    const srgb = getChildNS(element, NS_A, 'srgbClr');
    if (srgb) {
        const baseHex = `#${srgb.getAttribute('val') ?? '000000'}`;
        return applyColorModifiers(srgb, baseHex);
    }

    const schemeClr = getChildNS(element, NS_A, 'schemeClr');
    if (schemeClr) {
        const val = schemeClr.getAttribute('val');
        if (val) {
            const resolved = val;
            const baseHex = themeColors.get(resolved) ?? themeColors.get(SCHEME_COLOR_ALIASES.get(resolved) ?? '');
            if (baseHex) return applyColorModifiers(schemeClr, baseHex);
        }
    }

    return undefined;
}

// --- Theme ---

function parseThemeColors(files: Map<string, Uint8Array>): ThemeColorMap {
    const themeFile = files.get('ppt/theme/theme1.xml');
    if (!themeFile) return new Map();

    const doc = parseXml(new TextDecoder().decode(themeFile));
    const map = new Map<string, string>();

    const themeElements = getChildNS(doc.documentElement, NS_A, 'themeElements');
    const clrScheme = themeElements
        ? getChildNS(themeElements, NS_A, 'clrScheme')
        : null;
    if (!clrScheme) return map;

    extractSchemeColors(clrScheme, map);
    return map;
}

function extractSchemeColors(clrScheme: Element, map: Map<string, string>): void {
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
}

// --- Slide Size & Lists ---

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

// --- Relationships ---

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

// --- Gradient / Pattern / Effects Parsing ---

function resolveColorWithAlpha(
    element: Element,
    themeColors: ThemeColorMap,
): { color: string; alpha?: number } | undefined {
    const base = resolveColorWithModifiers(element, themeColors);
    if (!base) return undefined;

    let alpha: number | undefined;
    const alphaEl = getChildNS(element, NS_A, 'alpha');
    if (alphaEl) {
        const val = alphaEl.getAttribute('val');
        if (val) alpha = Number.parseInt(val, 10) / 100000;
    }
    // Also check inside the color child (srgbClr or schemeClr)
    if (alpha === undefined) {
        const srgb = getChildNS(element, NS_A, 'srgbClr');
        const schemeClr = getChildNS(element, NS_A, 'schemeClr');
        const colorEl = srgb ?? schemeClr;
        if (colorEl) {
            const childAlpha = getChildNS(colorEl, NS_A, 'alpha');
            if (childAlpha) {
                const val = childAlpha.getAttribute('val');
                if (val) alpha = Number.parseInt(val, 10) / 100000;
            }
        }
    }
    return { color: base, alpha };
}

function hexToRgba(hex: string, alpha: number): string {
    const raw = hex.replace('#', '');
    const r = Number.parseInt(raw.substring(0, 2), 16);
    const g = Number.parseInt(raw.substring(2, 4), 16);
    const b = Number.parseInt(raw.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

function parseGradientFill(
    gradFill: Element,
    themeColors: ThemeColorMap,
): PptxGradientFill {
    const stops: PptxGradientStop[] = [];
    const gsLst = getChildNS(gradFill, NS_A, 'gsLst');
    if (gsLst) {
        const gsElements = getAllChildrenNS(gsLst, NS_A, 'gs');
        for (const gs of gsElements) {
            const pos = Number.parseInt(gs.getAttribute('pos') ?? '0', 10) / 1000;
            const color = resolveColorWithModifiers(gs, themeColors) ?? '#000000';
            stops.push({ position: pos, color });
        }
    }

    const lin = getChildNS(gradFill, NS_A, 'lin');
    if (lin) {
        const ang = Number.parseInt(lin.getAttribute('ang') ?? '0', 10);
        const angle = ang / 60000 + 90;
        return { type: 'linear', angle, stops };
    }

    const path = getChildNS(gradFill, NS_A, 'path');
    if (path) {
        const pathType = path.getAttribute('path') ?? 'circle';
        const mapped: PptxGradientType = pathType === 'rect' ? 'rect'
            : pathType === 'shape' ? 'shape' : 'radial';
        return { type: mapped, stops };
    }

    return { type: 'linear', angle: 0, stops };
}

function parsePatternFill(
    pattFill: Element,
    themeColors: ThemeColorMap,
): PptxPatternFill {
    const preset = pattFill.getAttribute('prst') ?? 'pct50';
    const fgClr = getChildNS(pattFill, NS_A, 'fgClr');
    const bgClr = getChildNS(pattFill, NS_A, 'bgClr');
    const fgColor = fgClr ? (resolveColorWithModifiers(fgClr, themeColors) ?? '#000000') : '#000000';
    const bgColor = bgClr ? (resolveColorWithModifiers(bgClr, themeColors) ?? '#FFFFFF') : '#FFFFFF';
    return { preset, fgColor, bgColor };
}

function resolveBlipToDataUrlWithBase(
    blipFill: Element,
    mediaRels: Map<string, string>,
    files: Map<string, Uint8Array>,
    baseDir: string,
): string | undefined {
    const blip = getChildNS(blipFill, NS_A, 'blip');
    if (!blip) return undefined;

    const rId = blip.getAttributeNS(NS_R, 'embed') ?? '';
    if (!rId) return undefined;

    const target = mediaRels.get(rId);
    if (!target) return undefined;

    const imagePath = target.startsWith('/') ? target.substring(1) : normalizePath(`${baseDir}/${target}`);
    const imageData = files.get(imagePath);
    if (!imageData || !isValidImageMagicBytes(imageData)) return undefined;

    const mimeType = guessMimeType(imageData);
    const base64 = uint8ArrayToBase64(imageData);
    return `data:${mimeType};base64,${base64}`;
}

function parseShadowEffect(
    shadowEl: Element,
    themeColors: ThemeColorMap,
): PptxShadowEffect {
    const blurRad = Number.parseInt(shadowEl.getAttribute('blurRad') ?? '0', 10) / 12700;
    const dist = Number.parseInt(shadowEl.getAttribute('dist') ?? '0', 10) / 12700;
    const dir = Number.parseInt(shadowEl.getAttribute('dir') ?? '0', 10) / 60000;
    const radians = dir * Math.PI / 180;
    const offsetX = Math.round(dist * Math.cos(radians) * 100) / 100;
    const offsetY = Math.round(dist * Math.sin(radians) * 100) / 100;

    const colorResult = resolveColorWithAlpha(shadowEl, themeColors);
    const alpha = colorResult?.alpha ?? 0.5;
    const color = colorResult ? hexToRgba(colorResult.color, alpha) : 'rgba(0,0,0,0.5)';

    return { offsetX, offsetY, blur: blurRad, color };
}

function parseEffects(
    effectEl: Element,
    themeColors: ThemeColorMap,
): PptxEffects {
    const result: {
        outerShadow?: PptxShadowEffect; innerShadow?: PptxShadowEffect;
        glow?: PptxGlowEffect; blur?: number; softEdge?: number;
        reflection?: PptxReflectionEffect;
    } = {};

    const outerShdw = getChildNS(effectEl, NS_A, 'outerShdw');
    if (outerShdw) result.outerShadow = parseShadowEffect(outerShdw, themeColors);

    const innerShdw = getChildNS(effectEl, NS_A, 'innerShdw');
    if (innerShdw) result.innerShadow = parseShadowEffect(innerShdw, themeColors);

    const glowEl = getChildNS(effectEl, NS_A, 'glow');
    if (glowEl) {
        const radius = Number.parseInt(glowEl.getAttribute('rad') ?? '0', 10) / 12700;
        const colorResult = resolveColorWithAlpha(glowEl, themeColors);
        const alpha = colorResult?.alpha ?? 0.6;
        const color = colorResult ? hexToRgba(colorResult.color, alpha) : 'rgba(255,215,0,0.6)';
        result.glow = { radius, color };
    }

    const blurEl = getChildNS(effectEl, NS_A, 'blur');
    if (blurEl) {
        result.blur = Number.parseInt(blurEl.getAttribute('rad') ?? '0', 10) / 12700;
    }

    const softEdgeEl = getChildNS(effectEl, NS_A, 'softEdge');
    if (softEdgeEl) {
        result.softEdge = Number.parseInt(softEdgeEl.getAttribute('rad') ?? '0', 10) / 12700;
    }

    const reflEl = getChildNS(effectEl, NS_A, 'reflection');
    if (reflEl) {
        result.reflection = parseReflection(reflEl);
    }

    return result;
}

function parseReflection(reflEl: Element): PptxReflectionEffect {
    return {
        blurRadius: Number.parseInt(reflEl.getAttribute('blurRad') ?? '0', 10) / 12700,
        startOpacity: Number.parseInt(reflEl.getAttribute('stA') ?? '100000', 10) / 100000,
        endOpacity: Number.parseInt(reflEl.getAttribute('endA') ?? '0', 10) / 100000,
        distance: Number.parseInt(reflEl.getAttribute('dist') ?? '0', 10) / 12700,
        direction: Number.parseInt(reflEl.getAttribute('dir') ?? '0', 10) / 60000,
        scaleY: Number.parseInt(reflEl.getAttribute('sy') ?? '-100000', 10) / 100000,
    };
}

function parseUnderlineLine(
    uLn: Element,
    themeColors: ThemeColorMap,
): PptxUnderlineStyle {
    const result: { color?: string; width?: number; dashStyle?: string; compound?: string } = {};
    const w = uLn.getAttribute('w');
    if (w) result.width = Number.parseInt(w, 10) / 12700;
    const cmpd = uLn.getAttribute('cmpd');
    if (cmpd) result.compound = cmpd;
    const solidFill = getChildNS(uLn, NS_A, 'solidFill');
    if (solidFill) result.color = resolveColorWithModifiers(solidFill, themeColors);
    const prstDash = getChildNS(uLn, NS_A, 'prstDash');
    if (prstDash) result.dashStyle = prstDash.getAttribute('val') ?? undefined;
    return result;
}

function parseTextOutline(
    ln: Element,
    themeColors: ThemeColorMap,
): PptxTextOutline {
    const w = ln.getAttribute('w');
    const width = w ? Number.parseInt(w, 10) / 12700 : 1;
    const solidFill = getChildNS(ln, NS_A, 'solidFill');
    const color = solidFill ? resolveColorWithModifiers(solidFill, themeColors) : undefined;
    const prstDash = getChildNS(ln, NS_A, 'prstDash');
    const dashStyle = prstDash ? (prstDash.getAttribute('val') ?? undefined) : undefined;
    return { width, ...(color ? { color } : {}), ...(dashStyle ? { dashStyle } : {}) };
}

function parseTabList(tabLst: Element): PptxTabStop[] {
    const tabs: PptxTabStop[] = [];
    const tabElements = getAllChildrenNS(tabLst, NS_A, 'tab');
    for (const tab of tabElements) {
        const pos = Number.parseInt(tab.getAttribute('pos') ?? '0', 10) / EMU_PER_PIXEL;
        const algn = (tab.getAttribute('algn') ?? 'l') as PptxTabAlignment;
        tabs.push({ position: pos, alignment: algn });
    }
    return tabs;
}

function parseBulletImage(
    buBlip: Element,
    mediaRels: Map<string, string>,
    files: Map<string, Uint8Array>,
    baseDir: string,
): string | undefined {
    const blip = getChildNS(buBlip, NS_A, 'blip');
    if (!blip) return undefined;

    const rId = blip.getAttributeNS(NS_R, 'embed') ?? '';
    if (!rId) return undefined;

    const target = mediaRels.get(rId);
    if (!target) return undefined;

    const imagePath = target.startsWith('/') ? target.substring(1) : normalizePath(`${baseDir}/${target}`);
    const imageData = files.get(imagePath);
    if (!imageData || !isValidImageMagicBytes(imageData)) return undefined;

    const mimeType = guessMimeType(imageData);
    const base64 = uint8ArrayToBase64(imageData);
    return `data:${mimeType};base64,${base64}`;
}

// --- Text Run Properties Extraction ---

function extractRunPropertiesAttrs(rPr: Element): TextRunProperties {
    const result: TextRunProperties = {};
    if (rPr.getAttribute('b') === '1') result.bold = true;
    if (rPr.getAttribute('i') === '1') result.italic = true;

    const u = rPr.getAttribute('u');
    if (u && u !== 'none') result.underline = true;

    const strike = rPr.getAttribute('strike');
    if (strike === 'sngStrike' || strike === 'dblStrike') result.strikethrough = true;

    const baselineStr = rPr.getAttribute('baseline');
    if (baselineStr) result.baseline = Number.parseInt(baselineStr, 10);

    const sz = rPr.getAttribute('sz');
    if (sz) result.fontSize = Number.parseInt(sz, 10) / 100;

    const cap = rPr.getAttribute('cap');
    if (cap === 'all' || cap === 'small') result.cap = cap;

    const spc = rPr.getAttribute('spc');
    if (spc) result.spc = Number.parseInt(spc, 10) / 100;

    return result;
}

function extractRunPropertiesChildren(
    rPr: Element,
    themeColors: ThemeColorMap,
    mediaRels?: Map<string, string>,
    files?: Map<string, Uint8Array>,
    baseDir?: string,
): TextRunProperties {
    const result: TextRunProperties = {};

    // Fill priority: noFill > solidFill > gradFill > blipFill > pattFill
    const noFill = getChildNS(rPr, NS_A, 'noFill');
    if (noFill) {
        result.noFill = true;
    } else {
        const solidFill = getChildNS(rPr, NS_A, 'solidFill');
        if (solidFill) {
            result.color = resolveColorWithModifiers(solidFill, themeColors);
        } else {
            extractAdvancedFills(rPr, themeColors, mediaRels, files, baseDir, result);
        }
    }

    const fontFamily = parseFontFamily(rPr);
    if (fontFamily) result.fontFamily = fontFamily;

    const sym = getChildNS(rPr, NS_A, 'sym');
    if (sym) result.symFont = sym.getAttribute('typeface') ?? undefined;

    const highlightEl = getChildNS(rPr, NS_A, 'highlight');
    if (highlightEl) result.highlight = resolveColorWithModifiers(highlightEl, themeColors);

    const hlinkClick = getChildNS(rPr, NS_A, 'hlinkClick');
    if (hlinkClick) result.isHyperlink = true;

    const hlinkMouseOver = getChildNS(rPr, NS_A, 'hlinkMouseOver');
    if (hlinkMouseOver) result.hoverTooltip = hlinkMouseOver.getAttribute('tooltip') ?? undefined;

    extractUnderlineAndOutline(rPr, themeColors, result);
    extractEffectsFromProps(rPr, themeColors, result);

    return result;
}

function extractAdvancedFills(
    rPr: Element,
    themeColors: ThemeColorMap,
    mediaRels?: Map<string, string>,
    files?: Map<string, Uint8Array>,
    baseDir?: string,
    result?: TextRunProperties,
): void {
    if (!result) return;
    const gradFill = getChildNS(rPr, NS_A, 'gradFill');
    if (gradFill) {
        result.gradientFill = parseGradientFill(gradFill, themeColors);
        return;
    }
    const blipFill = getChildNS(rPr, NS_A, 'blipFill');
    if (blipFill && mediaRels && files && baseDir) {
        result.imageFill = resolveBlipToDataUrlWithBase(blipFill, mediaRels, files, baseDir);
        return;
    }
    const pattFill = getChildNS(rPr, NS_A, 'pattFill');
    if (pattFill) {
        result.patternFill = parsePatternFill(pattFill, themeColors);
    }
}

function extractUnderlineAndOutline(
    rPr: Element,
    themeColors: ThemeColorMap,
    result: TextRunProperties,
): void {
    const uLn = getChildNS(rPr, NS_A, 'uLn');
    if (uLn) result.underlineStyle = parseUnderlineLine(uLn, themeColors);

    const ln = getChildNS(rPr, NS_A, 'ln');
    if (ln) result.textOutline = parseTextOutline(ln, themeColors);
}

function extractEffectsFromProps(
    rPr: Element,
    themeColors: ThemeColorMap,
    result: TextRunProperties,
): void {
    const effectLst = getChildNS(rPr, NS_A, 'effectLst');
    if (effectLst) {
        result.effects = parseEffects(effectLst, themeColors);
        return;
    }
    const effectDag = getChildNS(rPr, NS_A, 'effectDag');
    if (effectDag) {
        result.effects = parseEffects(effectDag, themeColors);
    }
}

function extractRunProperties(
    rPr: Element,
    themeColors: ThemeColorMap,
    mediaRels?: Map<string, string>,
    files?: Map<string, Uint8Array>,
    baseDir?: string,
): TextRunProperties {
    const attrs = extractRunPropertiesAttrs(rPr);
    const children = extractRunPropertiesChildren(rPr, themeColors, mediaRels, files, baseDir);
    return { ...attrs, ...children };
}

function mergeTextRunDefaults(
    primary: TextRunProperties,
    secondary: TextRunProperties,
): TextRunProperties {
    return {
        bold: primary.bold ?? secondary.bold,
        italic: primary.italic ?? secondary.italic,
        fontSize: primary.fontSize ?? secondary.fontSize,
        color: primary.color ?? secondary.color,
        underline: primary.underline ?? secondary.underline,
        strikethrough: primary.strikethrough ?? secondary.strikethrough,
        fontFamily: primary.fontFamily ?? secondary.fontFamily,
        baseline: primary.baseline ?? secondary.baseline,
        cap: primary.cap ?? secondary.cap,
        spc: primary.spc ?? secondary.spc,
        highlight: primary.highlight ?? secondary.highlight,
        isHyperlink: primary.isHyperlink ?? secondary.isHyperlink,
        gradientFill: primary.gradientFill ?? secondary.gradientFill,
        patternFill: primary.patternFill ?? secondary.patternFill,
        imageFill: primary.imageFill ?? secondary.imageFill,
        noFill: primary.noFill ?? secondary.noFill,
        textOutline: primary.textOutline ?? secondary.textOutline,
        underlineStyle: primary.underlineStyle ?? secondary.underlineStyle,
        effects: primary.effects ?? secondary.effects,
        symFont: primary.symFont ?? secondary.symFont,
        hoverTooltip: primary.hoverTooltip ?? secondary.hoverTooltip,
    };
}

// --- Text Run Parsing ---

function isThemeFontPlaceholder(face: string): boolean {
    return face.startsWith('+');
}

function parseFontFamily(rPr: Element): string | undefined {
    const latin = getChildNS(rPr, NS_A, 'latin');
    if (latin) {
        const face = latin.getAttribute('typeface');
        if (face && !isThemeFontPlaceholder(face)) return face;
    }
    const ea = getChildNS(rPr, NS_A, 'ea');
    if (ea) {
        const face = ea.getAttribute('typeface');
        if (face && !isThemeFontPlaceholder(face)) return face;
    }
    const cs = getChildNS(rPr, NS_A, 'cs');
    if (cs) {
        const face = cs.getAttribute('typeface');
        if (face && !isThemeFontPlaceholder(face)) return face;
    }
    return undefined;
}

function parseTextRun(
    r: Element,
    themeColors: ThemeColorMap,
    inherited?: TextRunProperties,
    mediaRels?: Map<string, string>,
    files?: Map<string, Uint8Array>,
    baseDir?: string,
): PptxTextRun {
    const rPr = getChildNS(r, NS_A, 'rPr');
    const t = getChildNS(r, NS_A, 't');
    const text = t?.textContent ?? '';

    const explicit = rPr ? extractRunProperties(rPr, themeColors, mediaRels, files, baseDir) : {};
    const merged = inherited ? mergeTextRunDefaults(explicit, inherited) : explicit;

    return buildTextRunFromProps(text, merged);
}

function buildTextRunFromProps(text: string, props: TextRunProperties): PptxTextRun {
    const result: Record<string, unknown> = { text };
    if (props.bold) result['bold'] = true;
    if (props.italic) result['italic'] = true;
    if (props.underline) result['underline'] = true;
    if (props.strikethrough) result['strikethrough'] = true;
    if (props.baseline) result['baseline'] = props.baseline;
    if (props.fontSize) result['fontSize'] = props.fontSize;
    if (props.color) result['color'] = props.color;
    if (props.fontFamily) result['fontFamily'] = props.fontFamily;
    if (props.cap) result['cap'] = props.cap;
    if (props.spc != null) result['spc'] = props.spc;
    if (props.highlight) result['highlight'] = props.highlight;
    if (props.isHyperlink) result['isHyperlink'] = true;
    if (props.hoverTooltip) result['hoverTooltip'] = props.hoverTooltip;
    if (props.gradientFill) result['gradientFill'] = props.gradientFill;
    if (props.patternFill) result['patternFill'] = props.patternFill;
    if (props.imageFill) result['imageFill'] = props.imageFill;
    if (props.noFill) result['noFill'] = true;
    if (props.textOutline) result['textOutline'] = props.textOutline;
    if (props.underlineStyle) result['underlineStyle'] = props.underlineStyle;
    if (props.effects) result['effects'] = props.effects;
    if (props.symFont) result['symFont'] = props.symFont;
    return result as unknown as PptxTextRun;
}

function extractParagraphRuns(
    paragraph: Element,
    themeColors: ThemeColorMap,
    inherited?: TextRunProperties,
    mediaRels?: Map<string, string>,
    files?: Map<string, Uint8Array>,
    baseDir?: string,
): PptxTextRun[] {
    const runs: PptxTextRun[] = [];

    const rElements = getAllChildrenNS(paragraph, NS_A, 'r');
    for (const r of rElements) {
        runs.push(parseTextRun(r, themeColors, inherited, mediaRels, files, baseDir));
    }

    const fldElements = getAllChildrenNS(paragraph, NS_A, 'fld');
    for (const fld of fldElements) {
        const t = getChildNS(fld, NS_A, 't');
        if (t?.textContent?.trim()) {
            const fldRPr = getChildNS(fld, NS_A, 'rPr');
            const explicit = fldRPr ? extractRunProperties(fldRPr, themeColors, mediaRels, files, baseDir) : {};
            const merged = inherited ? mergeTextRunDefaults(explicit, inherited) : explicit;
            runs.push(buildTextRunFromProps(t.textContent, merged));
        }
    }

    if (runs.length === 0) {
        const brElements = getAllChildrenNS(paragraph, NS_A, 'br');
        if (brElements.length > 0) return [];
        const directText = paragraph.textContent?.trim();
        if (directText) runs.push(inherited ? buildTextRunFromProps(directText, inherited) : { text: directText });
    }

    return runs;
}

// --- Bullet Parsing ---

function parseBulletStyling(
    pPr: Element,
    themeColors: ThemeColorMap,
): { color?: string; sizePercent?: number; fontFamily?: string } {
    const result: { color?: string; sizePercent?: number; fontFamily?: string } = {};

    const buClr = getChildNS(pPr, NS_A, 'buClr');
    if (buClr) {
        const color = resolveColorWithModifiers(buClr, themeColors);
        if (color) result.color = color;
    }

    const buSzPct = getChildNS(pPr, NS_A, 'buSzPct');
    if (buSzPct) {
        const val = buSzPct.getAttribute('val');
        if (val) result.sizePercent = Number.parseInt(val, 10) / 1000;
    }

    const buFont = getChildNS(pPr, NS_A, 'buFont');
    if (buFont) {
        const face = buFont.getAttribute('typeface');
        if (face) result.fontFamily = face;
    }

    return result;
}

function buildCharBullet(buChar: Element, pPr: Element, themeColors: ThemeColorMap): PptxBullet {
    return {
        type: 'char',
        char: buChar.getAttribute('char') ?? '•',
        ...parseBulletStyling(pPr, themeColors),
    };
}

function buildAutoNumBullet(buAutoNum: Element, pPr: Element, themeColors: ThemeColorMap): PptxBullet {
    const startAtStr = buAutoNum.getAttribute('startAt');
    return {
        type: 'autoNum',
        autoNumScheme: buAutoNum.getAttribute('type') ?? 'arabicPeriod',
        ...(startAtStr ? { startAt: Number.parseInt(startAtStr, 10) } : {}),
        ...parseBulletStyling(pPr, themeColors),
    };
}

function parseBullet(
    pPr: Element,
    themeColors: ThemeColorMap,
    mediaRels?: Map<string, string>,
    files?: Map<string, Uint8Array>,
    baseDir?: string,
): PptxBullet | undefined {
    const buNone = getChildNS(pPr, NS_A, 'buNone');
    if (buNone) return { type: 'none' };

    const extraProps = parseBulletExtras(pPr, mediaRels, files, baseDir);

    const buChar = getChildNS(pPr, NS_A, 'buChar');
    if (buChar) return { ...buildCharBullet(buChar, pPr, themeColors), ...extraProps };

    const buAutoNum = getChildNS(pPr, NS_A, 'buAutoNum');
    if (buAutoNum) return { ...buildAutoNumBullet(buAutoNum, pPr, themeColors), ...extraProps };

    const buBlip = getChildNS(pPr, NS_A, 'buBlip');
    if (buBlip && mediaRels && files && baseDir) {
        const imageDataUrl = parseBulletImage(buBlip, mediaRels, files, baseDir);
        if (imageDataUrl) {
            return { type: 'char', char: '•', ...parseBulletStyling(pPr, themeColors), imageDataUrl, ...extraProps };
        }
    }

    return undefined;
}

function parseBulletExtras(
    pPr: Element,
    _mediaRels?: Map<string, string>,
    _files?: Map<string, Uint8Array>,
    _baseDir?: string,
): { sizePoints?: number } {
    const result: { sizePoints?: number } = {};
    const buSzPts = getChildNS(pPr, NS_A, 'buSzPts');
    if (buSzPts) {
        const val = buSzPts.getAttribute('val');
        if (val) result.sizePoints = Number.parseInt(val, 10) / 100;
    }
    return result;
}

// --- Paragraph Spacing ---

function resolveSpacingValue(spacingEl: Element): number | undefined {
    const spcPts = getChildNS(spacingEl, NS_A, 'spcPts');
    if (spcPts) {
        const val = spcPts.getAttribute('val');
        if (val) return Number.parseInt(val, 10) / 100;
    }

    const spcPct = getChildNS(spacingEl, NS_A, 'spcPct');
    if (spcPct) {
        const val = spcPct.getAttribute('val');
        if (val) return Number.parseInt(val, 10) / 100000 * 12;
    }

    return undefined;
}

function resolveLineSpacing(lnSpc: Element): number | undefined {
    const spcPct = getChildNS(lnSpc, NS_A, 'spcPct');
    if (spcPct) {
        const val = spcPct.getAttribute('val');
        if (val) return Number.parseInt(val, 10) / 100000;
    }

    const spcPts = getChildNS(lnSpc, NS_A, 'spcPts');
    if (spcPts) {
        const val = spcPts.getAttribute('val');
        if (val) return Number.parseInt(val, 10) / 100 / 12;
    }

    return undefined;
}

function parseParagraphSpacing(pPr: Element): { spacingBefore?: number; spacingAfter?: number; lineSpacing?: number } {
    const spcBef = getChildNS(pPr, NS_A, 'spcBef');
    const spcAft = getChildNS(pPr, NS_A, 'spcAft');
    const lnSpc = getChildNS(pPr, NS_A, 'lnSpc');

    return {
        ...(spcBef ? { spacingBefore: resolveSpacingValue(spcBef) } : {}),
        ...(spcAft ? { spacingAfter: resolveSpacingValue(spcAft) } : {}),
        ...(lnSpc ? { lineSpacing: resolveLineSpacing(lnSpc) } : {}),
    };
}

// --- Paragraph Model ---

function parseParagraphDefaultRunProps(
    paragraph: Element,
    themeColors: ThemeColorMap,
): TextRunProperties | undefined {
    const pPr = getChildNS(paragraph, NS_A, 'pPr');
    if (!pPr) return undefined;
    const defRPr = getChildNS(pPr, NS_A, 'defRPr');
    if (!defRPr) return undefined;
    return extractRunProperties(defRPr, themeColors);
}

function parseLstStyleDefaults(
    txBody: Element,
    level: number,
    themeColors: ThemeColorMap,
): TextRunProperties | undefined {
    const lstStyle = getChildNS(txBody, NS_A, 'lstStyle');
    if (!lstStyle) return undefined;
    const lvlName = `lvl${level + 1}pPr`;
    const lvlPPr = getChildNS(lstStyle, NS_A, lvlName);
    if (!lvlPPr) return undefined;
    const defRPr = getChildNS(lvlPPr, NS_A, 'defRPr');
    if (!defRPr) return undefined;
    return extractRunProperties(defRPr, themeColors);
}

function parseParagraph(
    paragraph: Element,
    themeColors: ThemeColorMap,
    txBody?: Element,
    masterDefaults?: TextRunProperties,
    mediaRels?: Map<string, string>,
    files?: Map<string, Uint8Array>,
    baseDir?: string,
): PptxParagraph {
    const pPr = getChildNS(paragraph, NS_A, 'pPr');

    // Build inheritance chain: paraDefRPr > lstStyle > masterDefaults
    const lvl = pPr?.getAttribute('lvl');
    const level = lvl ? Number.parseInt(lvl, 10) : 0;

    const paraDefaults = parseParagraphDefaultRunProps(paragraph, themeColors);
    const lstStyleDefaults = txBody ? parseLstStyleDefaults(txBody, level, themeColors) : undefined;

    let inherited: TextRunProperties = {};
    if (masterDefaults) inherited = mergeTextRunDefaults(inherited, masterDefaults);
    if (lstStyleDefaults) inherited = mergeTextRunDefaults(lstStyleDefaults, inherited);
    if (paraDefaults) inherited = mergeTextRunDefaults(paraDefaults, inherited);

    const runs = extractParagraphRuns(paragraph, themeColors, inherited, mediaRels, files, baseDir);

    if (!pPr) return { runs };

    const algn = pPr.getAttribute('algn') as PptxAlignment | null;
    const marL = pPr.getAttribute('marL');
    const indent = pPr.getAttribute('indent');
    const fontAlgn = pPr.getAttribute('fontAlgn') as PptxFontAlign | null;
    const defTabSz = pPr.getAttribute('defTabSz');
    const bullet = parseBullet(pPr, themeColors, mediaRels, files, baseDir);
    const spacing = parseParagraphSpacing(pPr);

    const tabLst = getChildNS(pPr, NS_A, 'tabLst');
    const tabs = tabLst ? parseTabList(tabLst) : undefined;

    return {
        runs,
        ...(algn ? { alignment: algn } : {}),
        ...(pPr.getAttribute('rtl') === '1' ? { rtl: true as const } : {}),
        ...(lvl ? { level } : {}),
        ...(marL ? { marginLeft: emuToPixels(marL) } : {}),
        ...(indent ? { indent: emuToPixels(indent) } : {}),
        ...(bullet ? { bullet } : {}),
        ...spacing,
        ...(fontAlgn ? { fontAlign: fontAlgn } : {}),
        ...(defTabSz ? { defaultTabSize: emuToPixels(defTabSz) } : {}),
        ...(tabs ? { tabs } : {}),
    };
}

// --- Position & Geometry ---

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

function parseRotation(xfrm: Element): number | undefined {
    const rot = xfrm.getAttribute('rot');
    if (!rot) return undefined;
    return Number.parseInt(rot, 10) / 60000;
}

// --- Shape Styling ---

interface ShapeStylingResult {
    fillColor?: string;
    borderColor?: string;
    borderWidth?: number;
    gradientFill?: PptxGradientFill;
    imageFill?: string;
    patternFill?: PptxPatternFill;
    effects?: PptxEffects;
    dashStyle?: string;
    explicitNoFill?: boolean;
    explicitNoLine?: boolean;
}

function parseShapeStyling(
    spPr: Element,
    themeColors: ThemeColorMap,
    mediaRels?: Map<string, string>,
    files?: Map<string, Uint8Array>,
    baseDir?: string,
): ShapeStylingResult {
    const result: ShapeStylingResult = {};

    const noFill = getChildNS(spPr, NS_A, 'noFill');
    if (noFill) {
        result.explicitNoFill = true;
    } else {
        const solidFill = getChildNS(spPr, NS_A, 'solidFill');
        if (solidFill) {
            result.fillColor = resolveColorWithModifiers(solidFill, themeColors);
        } else {
            parseShapeAdvancedFills(spPr, themeColors, mediaRels, files, baseDir, result);
        }
    }

    parseShapeLine(spPr, themeColors, result);
    parseShapeEffects(spPr, themeColors, result);

    return result;
}

function parseShapeAdvancedFills(
    spPr: Element,
    themeColors: ThemeColorMap,
    mediaRels?: Map<string, string>,
    files?: Map<string, Uint8Array>,
    baseDir?: string,
    result?: ShapeStylingResult,
): void {
    if (!result) return;
    const gradFill = getChildNS(spPr, NS_A, 'gradFill');
    if (gradFill) {
        result.gradientFill = parseGradientFill(gradFill, themeColors);
        return;
    }
    const blipFill = getChildNS(spPr, NS_A, 'blipFill');
    if (blipFill && mediaRels && files && baseDir) {
        result.imageFill = resolveBlipToDataUrlWithBase(blipFill, mediaRels, files, baseDir);
        return;
    }
    const pattFill = getChildNS(spPr, NS_A, 'pattFill');
    if (pattFill) {
        result.patternFill = parsePatternFill(pattFill, themeColors);
    }
}

function parseShapeLine(
    spPr: Element,
    themeColors: ThemeColorMap,
    result: ShapeStylingResult,
): void {
    const ln = getChildNS(spPr, NS_A, 'ln');
    if (!ln) return;
    const lnNoFill = getChildNS(ln, NS_A, 'noFill');
    if (lnNoFill) {
        result.explicitNoLine = true;
        return;
    }
    const w = ln.getAttribute('w');
    if (w) result.borderWidth = Math.round(Number.parseInt(w, 10) / 12700);
    const lnFill = getChildNS(ln, NS_A, 'solidFill');
    if (lnFill) result.borderColor = resolveColorWithModifiers(lnFill, themeColors);
    const prstDash = getChildNS(ln, NS_A, 'prstDash');
    if (prstDash) result.dashStyle = prstDash.getAttribute('val') ?? undefined;
}

function parseShapeEffects(
    spPr: Element,
    themeColors: ThemeColorMap,
    result: ShapeStylingResult,
): void {
    const effectLst = getChildNS(spPr, NS_A, 'effectLst');
    if (effectLst) {
        result.effects = parseEffects(effectLst, themeColors);
        return;
    }
    const effectDag = getChildNS(spPr, NS_A, 'effectDag');
    if (effectDag) {
        result.effects = parseEffects(effectDag, themeColors);
    }
}

function parseStyleRef(
    sp: Element,
    themeColors: ThemeColorMap,
): { fillColor?: string; borderColor?: string; borderWidth?: number } {
    const style = getChildNS(sp, NS_P, 'style');
    if (!style) return {};

    const result: { fillColor?: string; borderColor?: string; borderWidth?: number } = {};

    const fillRef = getChildNS(style, NS_A, 'fillRef');
    if (fillRef) {
        const idx = Number.parseInt(fillRef.getAttribute('idx') ?? '0', 10);
        if (idx > 0) {
            const fillColor = resolveColorWithModifiers(fillRef, themeColors);
            if (fillColor) result.fillColor = fillColor;
        }
    }

    const lnRef = getChildNS(style, NS_A, 'lnRef');
    if (lnRef) {
        const idx = Number.parseInt(lnRef.getAttribute('idx') ?? '0', 10);
        if (idx > 0) {
            const borderColor = resolveColorWithModifiers(lnRef, themeColors);
            if (borderColor) {
                result.borderColor = borderColor;
                result.borderWidth = Math.max(1, idx);
            }
        }
    }

    return result;
}

function mergeStyleRefIntoStyling(
    styling: ShapeStylingResult,
    styleRef: { fillColor?: string; borderColor?: string; borderWidth?: number },
): void {
    // Don't override explicit noFill/noLine from spPr
    const hasFill = styling.fillColor || styling.gradientFill || styling.imageFill || styling.patternFill;
    if (!hasFill && !styling.explicitNoFill && styleRef.fillColor) {
        styling.fillColor = styleRef.fillColor;
    }
    if (!styling.borderColor && !styling.explicitNoLine && styleRef.borderColor) {
        styling.borderColor = styleRef.borderColor;
        if (!styling.borderWidth && styleRef.borderWidth) {
            styling.borderWidth = styleRef.borderWidth;
        }
    }
}

const LINE_SHAPE_TYPES: ReadonlySet<string> = new Set([
    'line', 'straightConnector1', 'bentConnector2', 'bentConnector3',
    'bentConnector4', 'bentConnector5', 'curvedConnector2', 'curvedConnector3',
    'curvedConnector4', 'curvedConnector5',
]);

function parseShapeAsConnector(
    sp: Element,
    themeColors: ThemeColorMap,
): PptxConnectorElement | null {
    const spPr = getChildNS(sp, NS_P, 'spPr') ?? getChildNS(sp, NS_A, 'spPr');
    if (!spPr) return null;

    const prstGeom = getChildNS(spPr, NS_A, 'prstGeom');
    const connectorType = prstGeom?.getAttribute('prst') ?? 'line';

    const xfrm = getChildNS(spPr, NS_A, 'xfrm');
    const pos = xfrm ? parsePosition(xfrm) : { x: 0, y: 0, width: 0, height: 0 };
    const flipH = xfrm?.getAttribute('flipH') === '1';
    const flipV = xfrm?.getAttribute('flipV') === '1';

    let color: string | undefined;
    let lineWidth: number | undefined;
    let dashStyle: string | undefined;
    let headEnd = false;
    let tailEnd = false;

    const ln = getChildNS(spPr, NS_A, 'ln');
    if (ln) {
        const w = ln.getAttribute('w');
        if (w) lineWidth = Math.round(Number.parseInt(w, 10) / 12700);
        const lnFill = getChildNS(ln, NS_A, 'solidFill');
        if (lnFill) color = resolveColorWithModifiers(lnFill, themeColors);
        const prstDash = getChildNS(ln, NS_A, 'prstDash');
        if (prstDash) dashStyle = prstDash.getAttribute('val') ?? undefined;
        const headEndEl = getChildNS(ln, NS_A, 'headEnd');
        if (headEndEl && headEndEl.getAttribute('type') !== 'none') headEnd = true;
        const tailEndEl = getChildNS(ln, NS_A, 'tailEnd');
        if (tailEndEl && tailEndEl.getAttribute('type') !== 'none') tailEnd = true;
    }

    if (!color) {
        const styleRef = parseStyleRef(sp, themeColors);
        if (styleRef.borderColor) color = styleRef.borderColor;
        if (!lineWidth && styleRef.borderWidth) lineWidth = styleRef.borderWidth;
    }

    if (!color) color = '#000';

    return {
        type: 'connector',
        ...pos,
        color,
        ...(lineWidth ? { lineWidth } : {}),
        ...(flipH ? { flipH } : {}),
        ...(flipV ? { flipV } : {}),
        connectorType,
        ...(dashStyle ? { dashStyle } : {}),
        ...(headEnd ? { headEnd } : {}),
        ...(tailEnd ? { tailEnd } : {}),
    };
}

function parseShapeGeometry(
    sp: Element,
    themeColors: ThemeColorMap,
    mediaRels?: Map<string, string>,
    files?: Map<string, Uint8Array>,
    baseDir?: string,
): PptxShapeElement | PptxConnectorElement | null {
    const spPr = getChildNS(sp, NS_P, 'spPr') ?? getChildNS(sp, NS_A, 'spPr');
    if (!spPr) return null;

    const prstGeom = getChildNS(spPr, NS_A, 'prstGeom');
    const shapeType = prstGeom?.getAttribute('prst') ?? 'rect';

    if (LINE_SHAPE_TYPES.has(shapeType)) {
        return parseShapeAsConnector(sp, themeColors);
    }

    const styling = parseShapeStyling(spPr, themeColors, mediaRels, files, baseDir);

    // Merge in style reference (fillRef, lnRef) from <p:style>
    const styleRef = parseStyleRef(sp, themeColors);
    mergeStyleRefIntoStyling(styling, styleRef);

    const hasFill = styling.fillColor || styling.gradientFill || styling.imageFill || styling.patternFill;
    if (!hasFill && !styling.borderColor) return null;

    const xfrm = getChildNS(spPr, NS_A, 'xfrm');
    const pos = xfrm ? parsePosition(xfrm) : { x: 0, y: 0, width: 0, height: 0 };
    const rotation = xfrm ? parseRotation(xfrm) : undefined;

    // Don't pass internal flags to the output interface
    const { explicitNoFill: _nf, explicitNoLine: _nl, ...cleanStyling } = styling;

    return {
        type: 'shape',
        shapeType,
        ...pos,
        ...cleanStyling,
        ...(rotation ? { rotation } : {}),
    };
}

// --- Connector Parsing ---

function parseConnector(cxnSp: Element, themeColors: ThemeColorMap): PptxConnectorElement | null {
    const spPr = getChildNS(cxnSp, NS_P, 'spPr') ?? getChildNS(cxnSp, NS_A, 'spPr');
    if (!spPr) return null;

    const xfrm = getChildNS(spPr, NS_A, 'xfrm');
    const pos = xfrm ? parsePosition(xfrm) : { x: 0, y: 0, width: 0, height: 0 };

    // Extract flip attributes for correct line direction
    const flipH = xfrm?.getAttribute('flipH') === '1';
    const flipV = xfrm?.getAttribute('flipV') === '1';

    // Connector preset geometry (straight, bentConnector, curvedConnector)
    const prstGeom = getChildNS(spPr, NS_A, 'prstGeom');
    const connectorType = prstGeom?.getAttribute('prst') ?? 'line';

    let color: string | undefined;
    let lineWidth: number | undefined;
    let dashStyle: string | undefined;
    let headEnd = false;
    let tailEnd = false;

    const ln = getChildNS(spPr, NS_A, 'ln');
    if (ln) {
        const w = ln.getAttribute('w');
        if (w) lineWidth = Math.round(Number.parseInt(w, 10) / 12700);
        const lnFill = getChildNS(ln, NS_A, 'solidFill');
        if (lnFill) color = resolveColorWithModifiers(lnFill, themeColors);
        const prstDash = getChildNS(ln, NS_A, 'prstDash');
        if (prstDash) dashStyle = prstDash.getAttribute('val') ?? undefined;
        const headEndEl = getChildNS(ln, NS_A, 'headEnd');
        if (headEndEl && headEndEl.getAttribute('type') !== 'none') headEnd = true;
        const tailEndEl = getChildNS(ln, NS_A, 'tailEnd');
        if (tailEndEl && tailEndEl.getAttribute('type') !== 'none') tailEnd = true;
    }

    // Fallback: get color from style reference
    if (!color) {
        const lnRefColor = parseConnectorStyleRef(cxnSp, themeColors);
        if (lnRefColor.color) color = lnRefColor.color;
        if (lnRefColor.lineWidth && !lineWidth) lineWidth = lnRefColor.lineWidth;
    }

    return {
        type: 'connector',
        ...pos,
        ...(color ? { color } : {}),
        ...(lineWidth ? { lineWidth } : {}),
        ...(flipH ? { flipH } : {}),
        ...(flipV ? { flipV } : {}),
        connectorType,
        ...(dashStyle ? { dashStyle } : {}),
        ...(headEnd ? { headEnd } : {}),
        ...(tailEnd ? { tailEnd } : {}),
    };
}

function parseConnectorStyleRef(
    cxnSp: Element,
    themeColors: ThemeColorMap,
): { color?: string; lineWidth?: number } {
    const style = getChildNS(cxnSp, NS_P, 'style');
    if (!style) return {};

    const lnRef = getChildNS(style, NS_A, 'lnRef');
    if (!lnRef) return {};

    const idx = Number.parseInt(lnRef.getAttribute('idx') ?? '0', 10);
    const color = resolveColorWithModifiers(lnRef, themeColors);
    return {
        ...(color ? { color } : {}),
        ...(idx > 0 ? { lineWidth: Math.max(1, idx) } : {}),
    };
}

// --- Text Frame Parsing ---

function getPlaceholderType(sp: Element): string | undefined {
    const nvSpPr = getChildNS(sp, NS_P, 'nvSpPr');
    if (!nvSpPr) return undefined;
    const nvPr = getChildNS(nvSpPr, NS_P, 'nvPr');
    if (!nvPr) return undefined;
    const ph = getChildNS(nvPr, NS_P, 'ph');
    if (!ph) return undefined;
    return ph.getAttribute('type') ?? 'body';
}

function getPlaceholderIdx(sp: Element): string | undefined {
    const nvSpPr = getChildNS(sp, NS_P, 'nvSpPr');
    if (!nvSpPr) return undefined;
    const nvPr = getChildNS(nvSpPr, NS_P, 'nvPr');
    if (!nvPr) return undefined;
    const ph = getChildNS(nvPr, NS_P, 'ph');
    if (!ph) return undefined;
    return ph.getAttribute('idx') ?? undefined;
}

type PlaceholderPositionMap = ReadonlyMap<string, { x: number; y: number; width: number; height: number }>;

function buildPlaceholderPositionMap(
    files: Map<string, Uint8Array>,
    slideIndex: number,
): PlaceholderPositionMap {
    const result = new Map<string, { x: number; y: number; width: number; height: number }>();

    const layoutPath = getSlideLayoutPath(files, slideIndex);
    if (!layoutPath) return result;
    const layoutData = files.get(layoutPath);
    if (!layoutData) return result;

    const doc = parseXml(new TextDecoder().decode(layoutData));
    const spElements = getAllChildrenNS(doc.documentElement, NS_P, 'sp');

    for (const sp of spElements) {
        const phType = getPlaceholderType(sp);
        if (!phType) continue;

        const spPr = getChildNS(sp, NS_P, 'spPr') ?? getChildNS(sp, NS_A, 'spPr');
        if (!spPr) continue;
        const xfrm = getChildNS(spPr, NS_A, 'xfrm');
        if (!xfrm) continue;

        const pos = parsePosition(xfrm);
        const phIdx = getPlaceholderIdx(sp);
        const key = phIdx ? `idx:${phIdx}` : `type:${phType}`;
        result.set(key, pos);
        if (!result.has(`type:${phType}`)) {
            result.set(`type:${phType}`, pos);
        }
    }

    return result;
}

function resolvePlaceholderPosition(
    sp: Element,
    phPositions?: PlaceholderPositionMap,
): { x: number; y: number; width: number; height: number } | undefined {
    if (!phPositions) return undefined;
    const phIdx = getPlaceholderIdx(sp);
    if (phIdx) {
        const byIdx = phPositions.get(`idx:${phIdx}`);
        if (byIdx) return byIdx;
    }
    const phType = getPlaceholderType(sp);
    if (phType) {
        return phPositions.get(`type:${phType}`);
    }
    return undefined;
}


function parseTextFrame(
    sp: Element,
    themeColors: ThemeColorMap,
    masterStyles?: MasterTextStyles,
    mediaRels?: Map<string, string>,
    files?: Map<string, Uint8Array>,
    baseDir?: string,
    phPositions?: PlaceholderPositionMap,
): PptxTextFrame | null {
    const txBody = getChildNS(sp, NS_P, 'txBody')
        ?? getChildNS(sp, NS_A, 'txBody');
    if (!txBody) return null;

    // Determine master defaults based on placeholder type
    const phType = getPlaceholderType(sp);
    let masterDefaults: TextRunProperties | undefined;
    if (masterStyles) {
        if (phType === 'title' || phType === 'ctrTitle') {
            masterDefaults = masterStyles.title;
        } else {
            masterDefaults = masterStyles.body;
        }
    }

    const pElements = getAllChildrenNS(txBody, NS_A, 'p');
    const paragraphs: PptxParagraph[] = [];

    for (const p of pElements) {
        paragraphs.push(parseParagraph(p, themeColors, txBody, masterDefaults, mediaRels, files, baseDir));
    }

    const hasContent = paragraphs.some(para => para.runs.some(r => r.text.trim()));
    if (!hasContent) return null;

    const spPr = getChildNS(sp, NS_P, 'spPr') ?? getChildNS(sp, NS_A, 'spPr');
    const xfrm = spPr ? getChildNS(spPr, NS_A, 'xfrm') : null;
    const phFallback = resolvePlaceholderPosition(sp, phPositions);
    const pos = xfrm ? parsePosition(xfrm) : (phFallback ?? { x: 0, y: 0, width: 300, height: 50 });
    const rotation = xfrm ? parseRotation(xfrm) : undefined;
    const styling = spPr ? parseShapeStyling(spPr, themeColors, mediaRels, files, baseDir) : {};

    const styleRef = parseStyleRef(sp, themeColors);
    styleRef.fillColor = undefined;
    mergeStyleRefIntoStyling(styling, styleRef);

    return {
        type: 'text',
        paragraphs,
        ...pos,
        ...(styling.fillColor ? { fillColor: styling.fillColor } : {}),
        ...(styling.borderColor ? { borderColor: styling.borderColor } : {}),
        ...(styling.borderWidth ? { borderWidth: styling.borderWidth } : {}),
        ...(rotation ? { rotation } : {}),
    };
}

// --- Image Parsing ---

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

    const imagePath = target.startsWith('/') ? target.substring(1) : normalizePath(`ppt/slides/${target}`);
    const imageData = files.get(imagePath);
    if (!imageData || !isValidImageMagicBytes(imageData)) return null;

    const spPr = getChildNS(sp, NS_P, 'spPr');
    const xfrm = spPr ? getChildNS(spPr, NS_A, 'xfrm') : null;
    const pos = xfrm ? parsePosition(xfrm) : { x: 0, y: 0, width: 200, height: 200 };

    const mimeType = guessMimeType(imageData);
    const base64 = uint8ArrayToBase64(imageData);
    const dataUrl = `data:${mimeType};base64,${base64}`;

    return { type: 'image', dataUrl, ...pos };
}

// --- Table Parsing ---

function extractTableCellText(tc: Element, themeColors: ThemeColorMap): PptxTableCell {
    const paragraphs = getAllChildrenNS(tc, NS_A, 'p');
    const textParts: string[] = [];
    let bold: boolean | undefined;
    let color: string | undefined;

    for (const p of paragraphs) {
        const runs = extractParagraphRuns(p, themeColors);
        const pText = runs.map(r => r.text).join('');
        if (pText) textParts.push(pText);
        if (runs.some(r => r.bold)) bold = true;
        if (!color) {
            const firstColorRun = runs.find(r => r.color);
            if (firstColorRun) color = firstColorRun.color;
        }
    }

    const tcPr = getChildNS(tc, NS_A, 'tcPr');
    let fillColor: string | undefined;
    if (tcPr) {
        const sf = getChildNS(tcPr, NS_A, 'solidFill');
        if (sf) fillColor = resolveColorWithModifiers(sf, themeColors);
    }

    return {
        text: textParts.join('\n'),
        ...(bold ? { bold } : {}),
        ...(fillColor ? { fillColor } : {}),
        ...(color ? { color } : {}),
    };
}

function parseGraphicFrameTable(
    graphicFrame: Element,
    themeColors: ThemeColorMap,
): PptxTableElement | null {
    const tbl = getChildNS(graphicFrame, NS_A, 'tbl');
    if (!tbl) return null;

    const xfrmEl = getChildNS(graphicFrame, NS_P, 'xfrm')
        ?? (() => {
            const spPr = getChildNS(graphicFrame, NS_P, 'spPr');
            return spPr ? getChildNS(spPr, NS_A, 'xfrm') : null;
        })();
    const pos = xfrmEl ? parsePosition(xfrmEl) : { x: 0, y: 0, width: 600, height: 200 };

    const tblGrid = getChildNS(tbl, NS_A, 'tblGrid');
    let columnWidths: number[] | undefined;
    if (tblGrid) {
        const gridCols = getAllChildrenNS(tblGrid, NS_A, 'gridCol');
        if (gridCols.length > 0) {
            columnWidths = gridCols.map(col => emuToPixels(col.getAttribute('w')));
        }
    }

    const rows: PptxTableCell[][] = [];
    const trElements = getAllChildrenNS(tbl, NS_A, 'tr');

    for (const tr of trElements) {
        const cells: PptxTableCell[] = [];
        const tcElements = getAllChildrenNS(tr, NS_A, 'tc');
        for (const tc of tcElements) {
            cells.push(extractTableCellText(tc, themeColors));
        }
        rows.push(cells);
    }

    if (rows.length === 0) return null;

    return {
        type: 'table',
        rows,
        ...pos,
        ...(columnWidths ? { columnWidths } : {}),
    };
}

// --- Shape Element Extraction ---

function isInsideNestedGroup(el: Element, root: Element): boolean {
    let parent = el.parentElement;
    while (parent && parent !== root) {
        if (parent.namespaceURI === NS_P && parent.localName === 'grpSp') return true;
        parent = parent.parentElement;
    }
    return false;
}

function getDirectElements(root: Element, ns: string, localName: string): Element[] {
    return getAllChildrenNS(root, ns, localName).filter(el => !isInsideNestedGroup(el, root));
}

function extractShapeElements(
    root: Element,
    mediaRels: Map<string, string>,
    files: Map<string, Uint8Array>,
    themeColors: ThemeColorMap,
    masterStyles?: MasterTextStyles,
    baseDir?: string,
    phPositions?: PlaceholderPositionMap,
): PptxSlideElement[] {
    const elements: PptxSlideElement[] = [];
    const dir = baseDir ?? 'ppt/slides';

    const spElements = getDirectElements(root, NS_P, 'sp');
    for (const sp of spElements) {
        const shape = parseShapeGeometry(sp, themeColors, mediaRels, files, dir);
        if (shape) {
            elements.push(shape);
            if (shape.type === 'connector') continue;
        }
        const textFrame = parseTextFrame(sp, themeColors, masterStyles, mediaRels, files, dir, phPositions);
        if (textFrame) elements.push(textFrame);
    }

    const picElements = getDirectElements(root, NS_P, 'pic');
    for (const pic of picElements) {
        const img = parseImage(pic, mediaRels, files);
        if (img) elements.push(img);
    }

    const cxnSpElements = getDirectElements(root, NS_P, 'cxnSp');
    for (const cxnSp of cxnSpElements) {
        const connector = parseConnector(cxnSp, themeColors);
        if (connector) elements.push(connector);
    }

    extractGroupedShapes(root, mediaRels, files, themeColors, elements, masterStyles, dir, phPositions);
    extractGraphicFrames(root, themeColors, elements);

    return elements;
}

function extractGroupedShapes(
    root: Element,
    mediaRels: Map<string, string>,
    files: Map<string, Uint8Array>,
    themeColors: ThemeColorMap,
    elements: PptxSlideElement[],
    masterStyles?: MasterTextStyles,
    baseDir?: string,
    phPositions?: PlaceholderPositionMap,
): void {
    const grpSpElements = getDirectElements(root, NS_P, 'grpSp');
    for (const grpSp of grpSpElements) {
        const transform = parseGroupTransform(grpSp);
        const innerElements = extractShapeElements(grpSp, mediaRels, files, themeColors, masterStyles, baseDir, phPositions);
        for (const el of innerElements) {
            elements.push(applyGroupTransform(el, transform));
        }
    }
}

interface GroupTransform {
    readonly dx: number;
    readonly dy: number;
    readonly scaleX: number;
    readonly scaleY: number;
    readonly flipH: boolean;
    readonly flipV: boolean;
    readonly groupWidth: number;
    readonly groupHeight: number;
}

function parseGroupTransform(grpSp: Element): GroupTransform {
    const grpSpPr = getChildNS(grpSp, NS_P, 'grpSpPr');
    if (!grpSpPr) return { dx: 0, dy: 0, scaleX: 1, scaleY: 1, flipH: false, flipV: false, groupWidth: 0, groupHeight: 0 };

    const xfrm = getChildNS(grpSpPr, NS_A, 'xfrm');
    if (!xfrm) return { dx: 0, dy: 0, scaleX: 1, scaleY: 1, flipH: false, flipV: false, groupWidth: 0, groupHeight: 0 };

    const flipH = xfrm.getAttribute('flipH') === '1';
    const flipV = xfrm.getAttribute('flipV') === '1';

    const off = getChildNS(xfrm, NS_A, 'off');
    const ext = getChildNS(xfrm, NS_A, 'ext');
    const chOff = getChildNS(xfrm, NS_A, 'chOff');
    const chExt = getChildNS(xfrm, NS_A, 'chExt');

    const offX = emuToPixels(off?.getAttribute('x') ?? null);
    const offY = emuToPixels(off?.getAttribute('y') ?? null);
    const chOffX = emuToPixels(chOff?.getAttribute('x') ?? null);
    const chOffY = emuToPixels(chOff?.getAttribute('y') ?? null);

    const extCx = emuToPixels(ext?.getAttribute('cx') ?? null);
    const extCy = emuToPixels(ext?.getAttribute('cy') ?? null);
    const chExtCx = emuToPixels(chExt?.getAttribute('cx') ?? null);
    const chExtCy = emuToPixels(chExt?.getAttribute('cy') ?? null);

    const scaleX = chExtCx > 0 ? extCx / chExtCx : 1;
    const scaleY = chExtCy > 0 ? extCy / chExtCy : 1;

    return {
        dx: offX - chOffX * scaleX,
        dy: offY - chOffY * scaleY,
        scaleX,
        scaleY,
        flipH,
        flipV,
        groupWidth: extCx,
        groupHeight: extCy,
    };
}

function applyGroupTransform(el: PptxSlideElement, t: GroupTransform): PptxSlideElement {
    let newX = Math.round(el.x * t.scaleX + t.dx);
    let newY = Math.round(el.y * t.scaleY + t.dy);
    const newW = Math.round(el.width * t.scaleX);
    const newH = Math.round(el.height * t.scaleY);

    if (t.flipH) {
        newX = Math.round(t.dx + t.groupWidth - (el.x * t.scaleX + t.dx - t.dx) - newW);
    }
    if (t.flipV) {
        newY = Math.round(t.dy + t.groupHeight - (el.y * t.scaleY + t.dy - t.dy) - newH);
    }

    const result = { ...el, x: newX, y: newY, width: newW, height: newH };

    if (el.type === 'connector' && (t.flipH || t.flipV)) {
        const conn = result as unknown as Record<string, unknown>;
        if (t.flipH) conn['flipH'] = !conn['flipH'];
        if (t.flipV) conn['flipV'] = !conn['flipV'];
    }

    return result;
}

function extractGraphicFrames(
    root: Element,
    themeColors: ThemeColorMap,
    elements: PptxSlideElement[],
): void {
    const gfElements = getDirectElements(root, NS_P, 'graphicFrame');
    for (const gf of gfElements) {
        const table = parseGraphicFrameTable(gf, themeColors);
        if (table) elements.push(table);
    }
}

// --- Background Parsing ---

function resolveBlipToDataUrl(
    blipFill: Element,
    mediaRels: Map<string, string>,
    files: Map<string, Uint8Array>,
    baseDir?: string,
): string | undefined {
    return resolveBlipToDataUrlWithBase(blipFill, mediaRels, files, baseDir ?? 'ppt/slides');
}

function parseBgPr(
    bgPr: Element,
    themeColors: ThemeColorMap,
    mediaRels: Map<string, string>,
    files: Map<string, Uint8Array>,
    baseDir?: string,
): { backgroundColor?: string; backgroundImage?: string } {
    const solidFill = getChildNS(bgPr, NS_A, 'solidFill');
    if (solidFill) {
        return { backgroundColor: resolveColorWithModifiers(solidFill, themeColors) };
    }

    const gradFill = getChildNS(bgPr, NS_A, 'gradFill');
    if (gradFill) {
        const gsLst = getChildNS(gradFill, NS_A, 'gsLst');
        if (gsLst) {
            const gs = getChildNS(gsLst, NS_A, 'gs');
            if (gs) return { backgroundColor: resolveColorWithModifiers(gs, themeColors) };
        }
        return {};
    }

    const blipFill = getChildNS(bgPr, NS_A, 'blipFill');
    if (blipFill) {
        const bgImage = resolveBlipToDataUrl(blipFill, mediaRels, files, baseDir);
        if (bgImage) return { backgroundImage: bgImage };
    }

    return {};
}

function parseSlideBackground(
    slideRoot: Element,
    themeColors: ThemeColorMap,
    mediaRels: Map<string, string>,
    files: Map<string, Uint8Array>,
    baseDir?: string,
): { backgroundColor?: string; backgroundImage?: string } {
    const bg = getChildNS(slideRoot, NS_P, 'bg');
    if (!bg) return {};

    const bgPr = getChildNS(bg, NS_P, 'bgPr');
    if (bgPr) return parseBgPr(bgPr, themeColors, mediaRels, files, baseDir);

    const bgRef = getChildNS(bg, NS_P, 'bgRef');
    if (bgRef) {
        const solidFill = getChildNS(bgRef, NS_A, 'solidFill');
        if (solidFill) return { backgroundColor: resolveColorWithModifiers(solidFill, themeColors) };
    }

    return {};
}

function getMediaRelsForPath(files: Map<string, Uint8Array>, xmlPath: string): Map<string, string> {
    const dir = xmlPath.substring(0, xmlPath.lastIndexOf('/'));
    const filename = xmlPath.substring(xmlPath.lastIndexOf('/') + 1);
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

function getSlideMasterPath(files: Map<string, Uint8Array>, layoutPath: string): string | null {
    const rels = getMediaRelsForPath(files, layoutPath);
    for (const [, target] of rels) {
        if (target.includes('slideMaster')) {
            const dir = layoutPath.substring(0, layoutPath.lastIndexOf('/'));
            return target.startsWith('/') ? target.substring(1) : normalizePath(`${dir}/${target}`);
        }
    }
    return null;
}

function resolveBackgroundFromXmlFile(
    files: Map<string, Uint8Array>,
    xmlPath: string,
    themeColors: ThemeColorMap,
): { backgroundColor?: string; backgroundImage?: string } {
    const fileData = files.get(xmlPath);
    if (!fileData) return {};

    const doc = parseXml(new TextDecoder().decode(fileData));
    const cSld = getChildNS(doc.documentElement, NS_P, 'cSld');
    const root = cSld ?? doc.documentElement;
    const mediaRels = getMediaRelsForPath(files, xmlPath);
    const baseDir = xmlPath.substring(0, xmlPath.lastIndexOf('/'));

    return parseSlideBackground(root, themeColors, mediaRels, files, baseDir);
}

function resolveBackgroundWithFallback(
    slideRoot: Element,
    slideIndex: number,
    files: Map<string, Uint8Array>,
    themeColors: ThemeColorMap,
    mediaRels: Map<string, string>,
): { backgroundColor?: string; backgroundImage?: string } {
    // 1. Try slide itself
    const slideBg = parseSlideBackground(slideRoot, themeColors, mediaRels, files, 'ppt/slides');
    if (slideBg.backgroundColor || slideBg.backgroundImage) return slideBg;

    // 2. Try layout
    const layoutPath = getSlideLayoutPath(files, slideIndex);
    if (layoutPath) {
        const layoutBg = resolveBackgroundFromXmlFile(files, layoutPath, themeColors);
        if (layoutBg.backgroundColor || layoutBg.backgroundImage) return layoutBg;

        // 3. Try master
        const masterPath = getSlideMasterPath(files, layoutPath);
        if (masterPath) {
            const masterBg = resolveBackgroundFromXmlFile(files, masterPath, themeColors);
            if (masterBg.backgroundColor || masterBg.backgroundImage) return masterBg;
        }
    }

    return {};
}

// --- Layout Fallback ---

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

function isPlaceholderShape(sp: Element): boolean {
    const nvSpPr = getChildNS(sp, NS_P, 'nvSpPr');
    if (!nvSpPr) return false;
    const nvPr = getChildNS(nvSpPr, NS_P, 'nvPr');
    if (!nvPr) return false;
    return !!getChildNS(nvPr, NS_P, 'ph');
}

function extractNonPlaceholderElements(
    root: Element,
    mediaRels: Map<string, string>,
    files: Map<string, Uint8Array>,
    themeColors: ThemeColorMap,
    baseDir: string,
): PptxSlideElement[] {
    const elements: PptxSlideElement[] = [];
    const cSld = getChildNS(root, NS_P, 'cSld');
    const slideRoot = cSld ?? root;

    const spElements = getDirectElements(slideRoot, NS_P, 'sp');
    for (const sp of spElements) {
        if (isPlaceholderShape(sp)) continue;
        const shape = parseShapeGeometry(sp, themeColors, mediaRels, files, baseDir);
        if (shape) elements.push(shape);
        const textFrame = parseTextFrame(sp, themeColors, undefined, mediaRels, files, baseDir);
        if (textFrame) elements.push(textFrame);
    }

    const picElements = getDirectElements(slideRoot, NS_P, 'pic');
    for (const pic of picElements) {
        const img = parseImage(pic, mediaRels, files);
        if (img) elements.push(img);
    }

    const cxnSpElements = getDirectElements(slideRoot, NS_P, 'cxnSp');
    for (const cxnSp of cxnSpElements) {
        const connector = parseConnector(cxnSp, themeColors);
        if (connector) elements.push(connector);
    }

    extractGroupedShapes(slideRoot, mediaRels, files, themeColors, elements, undefined, baseDir);

    return elements;
}

function loadLayoutAndMasterElements(
    files: Map<string, Uint8Array>,
    slideIndex: number,
    themeColors: ThemeColorMap,
): PptxSlideElement[] {
    const backgroundElements: PptxSlideElement[] = [];

    const layoutPath = getSlideLayoutPath(files, slideIndex);
    if (!layoutPath) return backgroundElements;

    const masterPath = getSlideMasterPath(files, layoutPath);
    if (masterPath) {
        const masterData = files.get(masterPath);
        if (masterData) {
            const masterDoc = parseXml(new TextDecoder().decode(masterData));
            const masterRels = getMediaRelsForPath(files, masterPath);
            const masterDir = masterPath.substring(0, masterPath.lastIndexOf('/'));
            backgroundElements.push(
                ...extractNonPlaceholderElements(masterDoc.documentElement, masterRels, files, themeColors, masterDir),
            );
        }
    }

    const layoutData = files.get(layoutPath);
    if (layoutData) {
        const layoutDoc = parseXml(new TextDecoder().decode(layoutData));
        const layoutRels = getMediaRelsForPath(files, layoutPath);
        const layoutDir = layoutPath.substring(0, layoutPath.lastIndexOf('/'));
        backgroundElements.push(
            ...extractNonPlaceholderElements(layoutDoc.documentElement, layoutRels, files, themeColors, layoutDir),
        );
    }

    return backgroundElements;
}

// --- Master Text Styles ---

function parseMasterStyleElement(
    txStyles: Element,
    styleName: string,
    themeColors: ThemeColorMap,
    level = 0,
): TextRunProperties | undefined {
    const styleEl = getChildNS(txStyles, NS_P, styleName);
    if (!styleEl) return undefined;

    const lvlName = `lvl${level + 1}pPr`;
    const lvlPPr = getChildNS(styleEl, NS_A, lvlName);
    if (lvlPPr) {
        const defRPr = getChildNS(lvlPPr, NS_A, 'defRPr');
        if (defRPr) return extractRunProperties(defRPr, themeColors);
    }

    const defRPr = getChildNS(styleEl, NS_A, 'defRPr');
    if (defRPr) return extractRunProperties(defRPr, themeColors);

    const color = resolveColorWithModifiers(styleEl, themeColors);
    if (color) return { color };
    return undefined;
}

function parseMasterTextStyles(
    files: Map<string, Uint8Array>,
    slideIndex: number,
    themeColors: ThemeColorMap,
): MasterTextStyles {
    const result: MasterTextStyles = {};

    const layoutPath = getSlideLayoutPath(files, slideIndex);
    if (!layoutPath) return result;

    const masterPath = getSlideMasterPath(files, layoutPath);
    if (!masterPath) return result;

    const masterData = files.get(masterPath);
    if (!masterData) return result;

    const doc = parseXml(new TextDecoder().decode(masterData));
    const txStyles = getChildNS(doc.documentElement, NS_P, 'txStyles');
    if (!txStyles) return result;

    const titleStyle = parseMasterStyleElement(txStyles, 'titleStyle', themeColors);
    if (titleStyle) result.title = titleStyle;

    const bodyStyle = parseMasterStyleElement(txStyles, 'bodyStyle', themeColors);
    if (bodyStyle) result.body = bodyStyle;

    return result;
}

// --- Slide Parsing ---

function parseSlide(
    slideData: Uint8Array,
    slideIndex: number,
    files: Map<string, Uint8Array>,
    slideWidth: number,
    slideHeight: number,
    themeColors: ThemeColorMap,
): PptxSlide {
    const doc = parseXml(new TextDecoder().decode(slideData));
    const mediaRels = getSlideMediaRelationships(files, slideIndex);

    const cSld = getChildNS(doc.documentElement, NS_P, 'cSld');
    const slideRoot = cSld ?? doc.documentElement;

    // Bug 1 fix: use fallback chain for background
    const bg = resolveBackgroundWithFallback(slideRoot, slideIndex, files, themeColors, mediaRels);

    // Bug 3 fix: parse master text styles for inheritance
    const masterStyles = parseMasterTextStyles(files, slideIndex, themeColors);

    const phPositions = buildPlaceholderPositionMap(files, slideIndex);
    const backgroundElements = loadLayoutAndMasterElements(files, slideIndex, themeColors);
    const slideElements = extractShapeElements(slideRoot, mediaRels, files, themeColors, masterStyles, 'ppt/slides', phPositions);
    const elements = [...backgroundElements, ...slideElements];
    let title = '';

    for (const el of slideElements) {
        if (el.type === 'text' && !title) {
            const plainText = el.paragraphs.map(p => p.runs.map(r => r.text).join('')).join('').trim();
            if (plainText) title = plainText;
        }
    }

    return {
        index: slideIndex,
        title: title.substring(0, 200),
        elements,
        width: slideWidth,
        height: slideHeight,
        ...(bg.backgroundColor ? { backgroundColor: bg.backgroundColor } : {}),
        ...(bg.backgroundImage ? { backgroundImage: bg.backgroundImage } : {}),
    };
}

// --- Main Export ---

export function parsePptx(data: Uint8Array): PptxParseResult {
    const files = readZip(data);
    const { width, height } = parseSlideSize(files);
    const themeColors = parseThemeColors(files);

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
            slides.push(parseSlide(slideData, i, files, width, height, themeColors));
        }
    }

    if (slides.length === 0) {
        for (let i = 1; i <= 500; i++) {
            const slidePath = `ppt/slides/slide${i}.xml`;
            const slideData = files.get(slidePath);
            if (!slideData) break;
            slides.push(parseSlide(slideData, i - 1, files, width, height, themeColors));
        }
    }

    return { slides, slideWidth: width, slideHeight: height };
}
