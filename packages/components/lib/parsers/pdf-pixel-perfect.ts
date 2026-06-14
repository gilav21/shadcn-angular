import type { PdfObject, FontInfo } from './pdf-parser';
import { PdfReader, buildFontInfo, getPageMediaBox, buildImageDataUrl, resolveImageFilterName } from './pdf-parser';
import { TtfFont } from './ttf-parser';
import { buildTtf } from './ttf-builder';
import type { TtfBuilderGlyph } from './ttf-builder';

// Fallback font for glyphs missing from embedded PDF fonts.
// Loaded lazily from bundled NotoSans-Regular.ttf in Node.js environments.
let fallbackFont: TtfFont | null | undefined;
let fallbackFontData: ArrayBuffer | null = null;

export function setFallbackFontData(data: ArrayBuffer): void {
    fallbackFontData = data;
    fallbackFont = undefined; // reset cache
}

function getFallbackFont(): TtfFont | null {
    if (fallbackFont !== undefined) return fallbackFont;
    fallbackFont = null;

    // If data was provided explicitly (e.g., from browser fetch), use it
    if (fallbackFontData) {
        try {
            fallbackFont = new TtfFont(fallbackFontData);
            return fallbackFont;
        } catch { /* skip */ }
    }

    // Try Node.js file system
    try {
         
        const nodeRequire = resolveNodeRequire();
        if (!nodeRequire) return null;

        const fs = nodeRequire('fs') as { readFileSync: (p: string) => Buffer };
        const path = nodeRequire('path') as { resolve: (...p: string[]) => string; dirname: (p: string) => string };

        const candidates = [
            path.resolve(path.dirname(__filename), 'fonts', 'NotoSans-Regular.ttf'),
            path.resolve(process.cwd(), 'packages', 'components', 'lib', 'parsers', 'fonts', 'NotoSans-Regular.ttf'),
        ];
        for (const p of candidates) {
            try {
                const data = fs.readFileSync(p);
                const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
                fallbackFont = new TtfFont(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
                return fallbackFont;
            } catch { /* try next */ }
        }
    } catch { /* no Node.js fs available */ }
    return null;
}

declare const __non_webpack_require__: ((m: string) => unknown) | undefined;
declare const __filename: string;
declare const module: { require?: (m: string) => unknown };
declare const process: { cwd: () => string };
declare type Buffer = ArrayBufferLike;

function resolveNodeRequire(): ((m: string) => unknown) | undefined {
     
    if (__non_webpack_require__ !== undefined) return __non_webpack_require__;
    if (typeof module !== 'undefined' && typeof module.require === 'function') return module.require.bind(module);
    return undefined;
}

// ── Options & Output Interfaces ───────────────────────────────────────

export interface PixelPerfectOptions {
    readonly zoom?: number;
}

const DEFAULT_ZOOM = 1.3;

export interface PixelPerfectPage {
    readonly html: string;
    readonly text: string;
    readonly pageIndex: number;
    readonly pageWidth: number;
    readonly pageHeight: number;
}

export interface PixelPerfectPagedResult {
    readonly pages: ReadonlyArray<PixelPerfectPage>;
    readonly totalPages: number;
    readonly globalCss: string;
}

// ── Internal Types ────────────────────────────────────────────────────

interface PathRect {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly stroked: boolean;
    readonly filled: boolean;
    readonly strokeColor: string;
    readonly fillColor: string;
    readonly lineWidth: number;
    readonly borderRadius: number;
}

interface ImageItem {
    readonly dataUrl: string;
    readonly width: number;
    readonly height: number;
    readonly renderWidth: number;
    readonly renderHeight: number;
    readonly x: number;
    readonly y: number;
}

interface PdfAnnotation {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly uri: string;
}

// ── CSS Class Deduplication Engine ────────────────────────────────────

export class NumericStateManager {
    private readonly entries: { value: number; id: number }[] = [];
    private readonly eps: number;

    constructor(eps: number) {
        this.eps = eps;
    }

    install(value: number): number {
        for (const entry of this.entries) {
            if (Math.abs(entry.value - value) <= this.eps) return entry.id;
        }
        const id = this.entries.length;
        this.entries.push({ value, id });
        return id;
    }

    // C++ StateManager::install(new_value, &actual_value) — returns ID and
    // writes back the snapped value. Needed for letter_space/word_space in
    // optimize_normal where the INSTALLED value feeds single_space_offset().
    installAndSnap(value: number): { id: number; snapped: number } {
        for (const entry of this.entries) {
            if (Math.abs(entry.value - value) <= this.eps) {
                return { id: entry.id, snapped: entry.value };
            }
        }
        const id = this.entries.length;
        this.entries.push({ value, id });
        return { id, snapped: value };
    }

    dumpCss(prefix: string, formatter: (value: number) => string): string {
        const parts: string[] = [];
        for (const { value, id } of this.entries) {
            parts.push(`.${prefix}${id.toString(16)}{${formatter(value)}}`);
        }
        return parts.join('\n');
    }
}

export class ColorStateManager {
    private readonly colorMap = new Map<string, number>();

    install(color: string): number {
        const existing = this.colorMap.get(color);
        if (existing !== undefined) return existing;
        const id = this.colorMap.size;
        this.colorMap.set(color, id);
        return id;
    }

    dumpFillCss(prefix: string): string {
        const parts: string[] = [];
        for (const [color, id] of this.colorMap) {
            parts.push(`.${prefix}${id.toString(16)}{color:${color};}`);
        }
        return parts.join('\n');
    }

    dumpStrokeCss(prefix: string): string {
        const parts: string[] = [];
        for (const [color, id] of this.colorMap) {
            parts.push(`.${prefix}${id.toString(16)}{text-shadow:` +
                `-0.015em 0 ${color},0 0.015em ${color},` +
                `0.015em 0 ${color},0 -0.015em ${color};}`);
        }
        return parts.join('\n');
    }
}

export class TransformMatrixManager {
    private readonly entries: { m: readonly [number, number, number, number]; id: number }[] = [];
    private readonly eps = 0.001;

    install(m: readonly [number, number, number, number]): number {
        for (const entry of this.entries) {
            if (Math.abs(entry.m[0] - m[0]) <= this.eps &&
                Math.abs(entry.m[1] - m[1]) <= this.eps &&
                Math.abs(entry.m[2] - m[2]) <= this.eps &&
                Math.abs(entry.m[3] - m[3]) <= this.eps) {
                return entry.id;
            }
        }
        const id = this.entries.length;
        this.entries.push({ m, id });
        return id;
    }

    dumpCss(prefix: string): string {
        const parts: string[] = [];
        for (const { m, id } of this.entries) {
            const isIdentity = Math.abs(m[0] - 1) <= this.eps &&
                Math.abs(m[1]) <= this.eps &&
                Math.abs(m[2]) <= this.eps &&
                Math.abs(m[3] - 1) <= this.eps;
            if (isIdentity) {
                parts.push(`.${prefix}${id.toString(16)}{transform:none;}`);
            } else {
                const r = (v: number): number => Math.round(v * 1000000) / 1000000;
                const val = `matrix(${r(m[0])},${r(-m[1])},${r(-m[2])},${r(m[3])},0,0)`;
                parts.push(`.${prefix}${id.toString(16)}{transform:${val};}`);
            }
        }
        return parts.join('\n');
    }
}

export class AllStateManager {
    readonly transformMatrix = new TransformMatrixManager();
    readonly fillColor = new ColorStateManager();
    readonly strokeColor = new ColorStateManager();
    readonly fontSize = new NumericStateManager(0.001);
    readonly letterSpace = new NumericStateManager(0.001);
    readonly wordSpace = new NumericStateManager(0.001);
    readonly whitespace = new NumericStateManager(1);
    readonly bottom = new NumericStateManager(0.001);
    readonly height = new NumericStateManager(0.001);
    readonly left = new NumericStateManager(1);
    readonly verticalAlign = new NumericStateManager(0.001);

    dumpAllCss(): string {
        const sections: string[] = [];
        const addIfNonEmpty = (css: string): void => { if (css) sections.push(css); };

        addIfNonEmpty(this.transformMatrix.dumpCss('m'));
        addIfNonEmpty(this.fillColor.dumpFillCss('fc'));
        addIfNonEmpty(this.strokeColor.dumpStrokeCss('sc'));
        addIfNonEmpty(this.fontSize.dumpCss('fs', v => `font-size:${round(v)}px;`));
        addIfNonEmpty(this.letterSpace.dumpCss('ls', v => `letter-spacing:${round(v)}px;`));
        addIfNonEmpty(this.wordSpace.dumpCss('ws', v => `word-spacing:${round(v)}px;`));
        addIfNonEmpty(this.whitespace.dumpCss('_', v =>
            v >= 0 ? `width:${round(v)}px;` : `margin-left:${round(v)}px;`));
        addIfNonEmpty(this.bottom.dumpCss('y', v => `bottom:${round(v)}px;`));
        addIfNonEmpty(this.height.dumpCss('h', v => `height:${round(v)}px;`));
        addIfNonEmpty(this.left.dumpCss('x', v => `left:${round(v)}px;`));
        addIfNonEmpty(this.verticalAlign.dumpCss('v', v => `vertical-align:${round(v)}px;`));

        return sections.join('\n');
    }
}

// ── Utility Functions ─────────────────────────────────────────────────

function round(v: number): string {
    const r = Math.round(v * 10000) / 10000;
    return r.toString();
}

function escapeHtml(str: string): string {
    return str.replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

// ── Font Extraction & Registry ────────────────────────────────────────

type FontFormat = 'truetype' | 'cff' | 'opentype' | 'type1';

interface ExtractedFont {
    readonly data: Uint8Array;
    readonly format: FontFormat;
}

function resolveFontDescriptor(reader: PdfReader, fontObjDict: Record<string, PdfObject>): PdfObject | undefined {
    const direct = fontObjDict['FontDescriptor'];
    if (direct) return direct;
    const descendantsRef = fontObjDict['DescendantFonts'];
    if (!descendantsRef) return undefined;
    const descendants = reader.getArray(descendantsRef);
    if (descendants.length === 0) return undefined;
    const cidFontDict = reader.getDict(descendants[0]);
    return cidFontDict['FontDescriptor'];
}

function tryReadStream(reader: PdfReader, ref: PdfObject | undefined): Uint8Array | null {
    if (!ref) return null;
    try {
        const data = reader.getStreamData(ref);
        return data.length > 0 ? data : null;
    } catch { return null; }
}

function extractFontProgram(reader: PdfReader, fontObjDict: Record<string, PdfObject>): ExtractedFont | null {
    const descriptorRef = resolveFontDescriptor(reader, fontObjDict);
    if (!descriptorRef) return null;

    const descriptor = reader.getDict(descriptorRef);

    const ff2Data = tryReadStream(reader, descriptor['FontFile2']);
    if (ff2Data) return { data: ff2Data, format: 'truetype' };

    const ff3Data = tryReadStream(reader, descriptor['FontFile3']);
    if (ff3Data) {
        const ffDict = reader.getDict(descriptor['FontFile3']);
        const subtype = reader.getString(ffDict['Subtype']);
        return { data: ff3Data, format: subtype === 'OpenType' ? 'opentype' : 'cff' };
    }

    const ff1Data = tryReadStream(reader, descriptor['FontFile']);
    if (ff1Data) return { data: ff1Data, format: 'type1' };

    return null;
}

function uint8ToBase64(data: Uint8Array): string {
    const chunkSize = 8192;
    let binary = '';
    for (let i = 0; i < data.length; i += chunkSize) {
        const slice = data.subarray(i, Math.min(i + chunkSize, data.length));
        for (const byte of slice) {
            binary += String.fromCodePoint(byte);
        }
    }
    return btoa(binary);
}

function fontFormatToMime(format: FontFormat): { mime: string; cssFormat: string } | null {
    if (format === 'truetype') return { mime: 'font/ttf', cssFormat: 'truetype' };
    if (format === 'opentype') return { mime: 'font/otf', cssFormat: 'opentype' };
    if (format === 'cff') return { mime: 'font/otf', cssFormat: 'opentype' };
    return null;
}

// Unicode mirrored bracket pairs
const MIRROR_PAIRS: ReadonlyMap<number, number> = new Map([
    [0x0028, 0x0029], [0x0029, 0x0028], // ( ↔ )
    [0x005B, 0x005D], [0x005D, 0x005B], // [ ↔ ]
    [0x007B, 0x007D], [0x007D, 0x007B], // { ↔ }
    [0x003C, 0x003E], [0x003E, 0x003C], // < ↔ >
    [0x00AB, 0x00BB], [0x00BB, 0x00AB], // « ↔ »
]);

interface FontRegistryEntry {
    readonly id: number;
    readonly fontData: ExtractedFont | null;
    readonly familyName: string;
    readonly baseFontName: string;
    readonly ascent: number;
    readonly descent: number;
    readonly glyphAdvances: Map<number, number> | null;
    readonly unitsPerEm: number;
    readonly reEncodedData: Uint8Array | null;
    readonly unicodeFallbackWidths: Map<number, number> | null;
    readonly glyphFixupMap: Map<number, number> | null;
}

function fontNeedsReencoding(srcFont: TtfFont, fontInfo: FontInfo): boolean {
    if (!fontInfo.isTwoByte || fontInfo.toUnicode.size === 0) return false;

    let totalMapped = 0;
    let coveredMapped = 0;
    let puaMapped = 0;

    for (const unicodeStr of fontInfo.toUnicode.values()) {
        let cp = unicodeStr.codePointAt(0) ?? 0;
        if (cp >= 0xF000 && cp <= 0xF0FF) {
            puaMapped++;
            cp = SYMBOL_PUA_MAP[cp] ?? (cp & 0x00FF);
        }
        if (cp <= 0 || cp > 0xFFFF) continue;
        totalMapped++;
        const metrics = srcFont.charToGlyphMetrics(cp);
        if (metrics.advanceWidth > 0 && metrics.index > 0) {
            coveredMapped++;
        }
    }

    if (puaMapped > 0) return true;
    if (totalMapped === 0) return false;
    return (coveredMapped / totalMapped) < 0.95;
}

function fixCidToUnicodeWidths(
    font: TtfFont, fontInfo: FontInfo, glyphAdvances: Map<number, number>,
): void {
    for (const [code, unicodeStr] of fontInfo.toUnicode) {
        const existingAdv = glyphAdvances.get(code);
        if (existingAdv !== undefined && existingAdv > 0) continue;
        const cp = unicodeStr.codePointAt(0) ?? 0;
        if (cp <= 0 || cp > 0xFFFF) continue;
        const metrics = font.charToGlyphMetrics(cp);
        if (metrics.advanceWidth > 0) {
            glyphAdvances.set(code, metrics.advanceWidth);
        }
    }
}

function fixAsciiFallbackWidths(
    font: TtfFont, fb: TtfFont | null, unitsPerEm: number, glyphAdvances: Map<number, number>,
): void {
    for (let lo = 0x20; lo <= 0x7E; lo++) {
        const existingLoAdv = glyphAdvances.get(lo);
        if (existingLoAdv !== undefined && existingLoAdv > 0) continue;
        const metrics = font.charToGlyphMetrics(lo);
        if (metrics.advanceWidth > 0 && metrics.index > 0) {
            glyphAdvances.set(lo, metrics.advanceWidth);
            continue;
        }
        if (!fb) continue;
        const fbMetrics = fb.charToGlyphMetrics(lo);
        if (fbMetrics.advanceWidth > 0 && fbMetrics.index > 0) {
            const scaled = Math.round(fbMetrics.advanceWidth * unitsPerEm / fb.unitsPerEm);
            glyphAdvances.set(lo, scaled);
        }
    }
}

function buildGlyphFixupMap(font: TtfFont, fontInfo: FontInfo): Map<number, number> | null {
    const fixes = new Map<number, number>();
    for (const [code, unicodeStr] of fontInfo.toUnicode) {
        const cp = unicodeStr.codePointAt(0) ?? 0;
        const mirrorCp = MIRROR_PAIRS.get(cp);
        if (!mirrorCp) continue;
        const glyphAtCode = font.getGlyphMetrics(code);
        if (glyphAtCode.advanceWidth <= 0) continue;
        const glyphForChar = font.charToGlyphMetrics(cp);
        const glyphForMirror = font.charToGlyphMetrics(mirrorCp);
        if (glyphAtCode.index !== glyphForChar.index && glyphAtCode.index === glyphForMirror.index) {
            fixes.set(code, mirrorCp);
        }
    }
    return fixes.size > 0 ? fixes : null;
}

function processEmbeddedFont(
    fontData: ExtractedFont,
    fontInfo: FontInfo,
): { glyphAdvances: Map<number, number>; unitsPerEm: number; reEncodedData: Uint8Array | null; glyphFixupMap: Map<number, number> | null } {
    if (fontData.format !== 'truetype' && fontData.format !== 'opentype') {
        return { glyphAdvances: new Map(), unitsPerEm: 1000, reEncodedData: null, glyphFixupMap: null };
    }

    try {
        const font = new TtfFont(fontData.data.buffer.slice(
            fontData.data.byteOffset,
            fontData.data.byteOffset + fontData.data.byteLength,
        ));

        const glyphAdvances = new Map<number, number>();
        const unitsPerEm = font.unitsPerEm;

        for (let gid = 0; gid < font.numGlyphs; gid++) {
            const w = font.getAdvanceWidth(gid);
            if (w > 0) glyphAdvances.set(gid, w);
        }

        if (fontInfo.isTwoByte) {
            fixCidToUnicodeWidths(font, fontInfo, glyphAdvances);
            fixAsciiFallbackWidths(font, getFallbackFont(), unitsPerEm, glyphAdvances);
        }

        let reEncodedData: Uint8Array | null = null;
        if (fontNeedsReencoding(font, fontInfo)) {
            try { reEncodedData = reEncodeFont(font, fontInfo, unitsPerEm); } catch { /* fall back */ }
        }

        const glyphFixupMap = fontInfo.isTwoByte && !reEncodedData
            ? buildGlyphFixupMap(font, fontInfo)
            : null;

        return { glyphAdvances, unitsPerEm, reEncodedData, glyphFixupMap };
    } catch {
        return { glyphAdvances: new Map(), unitsPerEm: 1000, reEncodedData: null, glyphFixupMap: null };
    }
}

function computeTargetAdvance(widths: ReadonlyMap<number, number>, code: number, unitsPerEm: number): number {
    const pdfWidth = widths.get(code);
    return pdfWidth === undefined ? 0 : Math.round(pdfWidth * unitsPerEm / 1000);
}

function collectToUnicodeGlyphs(
    srcFont: TtfFont, fontInfo: FontInfo, unitsPerEm: number,
    fb: TtfFont | null, glyphs: TtfBuilderGlyph[], usedUnicodes: Set<number>,
): void {
    for (const [code, unicodeStr] of fontInfo.toUnicode) {
        const resolved = resolveUnicode(unicodeStr);
        if (resolved <= 0 || resolved > 0xFFFF || usedUnicodes.has(resolved)) continue;

        const targetAdvance = computeTargetAdvance(fontInfo.widths, code, unitsPerEm);
        const srcGlyphResult = findSourceGlyph(srcFont, resolved, code);
        if (srcGlyphResult) {
            usedUnicodes.add(resolved);
            glyphs.push(buildReEncodedGlyph(srcFont, srcGlyphResult, resolved, targetAdvance));
        } else if (fb) {
            const fbGlyph = buildFallbackGlyph(fb, resolved, targetAdvance, unitsPerEm);
            if (fbGlyph) { usedUnicodes.add(resolved); glyphs.push(fbGlyph); }
        }
    }
}

function collectAsciiFallbackGlyphs(
    fb: TtfFont, fontInfo: FontInfo, unitsPerEm: number,
    glyphs: TtfBuilderGlyph[], usedUnicodes: Set<number>,
): void {
    for (let cp = 0x20; cp <= 0x7E; cp++) {
        if (usedUnicodes.has(cp)) continue;
        const targetAdvance = computeTargetAdvance(fontInfo.widths, cp, unitsPerEm);
        const fbGlyph = buildFallbackGlyph(fb, cp, targetAdvance, unitsPerEm);
        if (fbGlyph) { usedUnicodes.add(cp); glyphs.push(fbGlyph); }
    }
}

function reEncodeFont(
    srcFont: TtfFont,
    fontInfo: FontInfo,
    unitsPerEm: number,
): Uint8Array | null {
    const glyphs: TtfBuilderGlyph[] = [{
        unicode: 0,
        advanceWidth: Math.round(unitsPerEm * 0.5),
        glyphData: new Uint8Array(0),
    }];
    const usedUnicodes = new Set<number>();
    const fb = getFallbackFont();

    collectToUnicodeGlyphs(srcFont, fontInfo, unitsPerEm, fb, glyphs, usedUnicodes);
    if (fb) collectAsciiFallbackGlyphs(fb, fontInfo, unitsPerEm, glyphs, usedUnicodes);

    if (glyphs.length <= 1) return null;

    return buildTtf({
        familyName: fontInfo.familyName || 'ReEncoded',
        styleName: 'Regular',
        unitsPerEm,
        ascender: srcFont.ascender || Math.round(unitsPerEm * 0.8),
        descender: srcFont.descender || Math.round(unitsPerEm * -0.2),
        glyphs,
    });
}

function resolveUnicode(unicodeStr: string): number {
    let cp = unicodeStr.codePointAt(0) ?? 0;
    if (cp >= 0xF000 && cp <= 0xF0FF) {
        cp = SYMBOL_PUA_MAP[cp] ?? (cp & 0x00FF);
    }
    return cp;
}

function findSourceGlyph(
    srcFont: TtfFont, unicode: number, code: number,
): { gid: number; advanceWidth: number } | null {
    // Prefer the source font's Unicode cmap when available.
    const byUnicode = srcFont.charToGlyphMetrics(unicode);
    if (byUnicode.advanceWidth > 0 && byUnicode.index > 0) {
        return { gid: byUnicode.index, advanceWidth: byUnicode.advanceWidth };
    }
    // Fall back to the raw CID glyph
    const byCode = srcFont.getGlyphMetrics(code);
    if (byCode.advanceWidth > 0) {
        return { gid: code, advanceWidth: byCode.advanceWidth };
    }
    return null;
}

function buildReEncodedGlyph(
    srcFont: TtfFont,
    src: { gid: number; advanceWidth: number },
    unicode: number,
    targetAdvance: number,
): TtfBuilderGlyph {
    const finalAdvance = targetAdvance > 0 ? targetAdvance : src.advanceWidth;
    let glyphData = srcFont.getRawGlyph(src.gid) ?? new Uint8Array(0);

    // Scale glyph horizontally if width changed (C++ stretch/squeeze)
    if (targetAdvance > 0 && Math.abs(src.advanceWidth - targetAdvance) > 1 && glyphData.length > 0) {
        const sx = targetAdvance / src.advanceWidth;
        glyphData = srcFont.scaleRawGlyphX(glyphData, sx);
    }

    return { unicode, advanceWidth: finalAdvance, glyphData };
}

function buildFallbackGlyph(
    fb: TtfFont, unicode: number, targetAdvance: number, unitsPerEm: number,
): TtfBuilderGlyph | null {
    const fbMetrics = fb.charToGlyphMetrics(unicode);
    if (fbMetrics.advanceWidth <= 0 || fbMetrics.index <= 0) return null;

    const scale = unitsPerEm / fb.unitsPerEm;
    const fbAdvance = Math.round(fbMetrics.advanceWidth * scale);
    const finalAdvance = targetAdvance > 0 ? targetAdvance : fbAdvance;

    let glyphData = fb.getRawGlyph(fbMetrics.index) ?? new Uint8Array(0);
    if (glyphData.length > 0) {
        // Uniform scale first, then horizontal adjustment
        glyphData = fb.scaleRawGlyph(glyphData, scale);
        if (targetAdvance > 0 && fbAdvance > 0 && Math.abs(targetAdvance - fbAdvance) > 1) {
            const sx = targetAdvance / fbAdvance;
            glyphData = fb.scaleRawGlyphX(glyphData, sx);
        }
    }

    return { unicode, advanceWidth: finalAdvance, glyphData };
}

// Serif font family keywords for generic fallback detection
const SERIF_KEYWORDS = ['times', 'georgia', 'cambria', 'garamond', 'palatino', 'bodoni', 'baskerville', 'bookman', 'century'];
const MONO_KEYWORDS = ['courier', 'mono', 'consolas', 'menlo', 'lucidaconsole', 'inconsolata'];

/**
 * Dynamically extract a CSS font-family from any PDF BaseFontName.
 * No static map needed — works for any font by parsing the name.
 *
 * Examples:
 *   "ABCDEF+Arial"              → "'Arial', sans-serif"
 *   "MZPIBW+Arial Narrow Bold"  → "'Arial Narrow', sans-serif"
 *   "TimesNewRomanPS-BoldMT"    → "'Times New Roman', serif"
 *   "AKOBGE+arialuni"           → "'Arialuni', sans-serif"
 *   "CourierNew-Regular"         → "'Courier New', monospace"
 */
function getSystemFontFamily(baseFontName: string): string {
    let name = baseFontName;
    // Strip subset prefix (e.g. "ABCDEF+")
    const plusIdx = name.indexOf('+');
    if (plusIdx >= 0 && plusIdx <= 6) name = name.slice(plusIdx + 1);

    // Strip trailing technical suffixes before CamelCase split
    name = name.replaceAll(/-?(PS)?MT$/gi, '');

    // Insert spaces before uppercase runs for CamelCase: "TimesNewRoman" → "Times New Roman"
    name = name.replaceAll(/([a-z])([A-Z])/g, '$1 $2');

    // Clean up dashes/underscores/commas to spaces
    name = name.replaceAll(/[-_,]+/g, ' ').trim();

    // Remove style/weight suffixes (run twice to catch consecutive: "PS Bold" → "")
    const stylePat = /(?=(\s+))\1(Bold|Italic|Regular|Medium|Light|Condensed|Black|Heavy|Oblique|Book|Demi|Semi|Ultra|Thin|Extra|PS)$/gi;
    name = name.replaceAll(stylePat, '').trim();
    name = name.replaceAll(stylePat, '').trim();

    // Title-case all-lowercase names: "arialuni" → "Arialuni"
    if (name === name.toLowerCase() && name.length > 0) {
        name = name[0].toUpperCase() + name.slice(1);
    }

    // Determine generic fallback from lowercase name
    const lower = name.toLowerCase().replaceAll(/\s/g, '');
    let generic = 'sans-serif';
    if (SERIF_KEYWORDS.some(k => lower.includes(k))) generic = 'serif';
    else if (MONO_KEYWORDS.some(k => lower.includes(k))) generic = 'monospace';

    return `'${name}', ${generic}`;
}

function usesSystemFallback(entry: FontRegistryEntry): boolean {
    return !entry.reEncodedData;
}

function processEmbeddedFontData(
    fontData: ExtractedFont | null, info: FontInfo,
): {
    glyphAdvances: Map<number, number> | null;
    unitsPerEm: number;
    reEncodedData: Uint8Array | null;
    glyphFixupMap: Map<number, number> | null;
} {
    if (!fontData) {
        return { glyphAdvances: null, unitsPerEm: 1000, reEncodedData: null, glyphFixupMap: null };
    }
    const processed = processEmbeddedFont(fontData, info);
    return {
        glyphAdvances: processed.glyphAdvances.size > 0 ? processed.glyphAdvances : null,
        unitsPerEm: processed.unitsPerEm,
        reEncodedData: processed.reEncodedData,
        glyphFixupMap: processed.glyphFixupMap,
    };
}

function buildUnicodeFallbackWidths(
    glyphAdvances: Map<number, number> | null,
    unitsPerEm: number,
    info: FontInfo,
): Map<number, number> | null {
    if (!glyphAdvances || info.toUnicode.size === 0) return null;

    const uniMap = new Map<number, number>();
    fillUniMapFromGlyphAdvances(uniMap, info.toUnicode, glyphAdvances, unitsPerEm);
    fillUniMapFromPdfWidths(uniMap, info.toUnicode, info.widths, info.defaultWidth);
    return uniMap.size > 0 ? uniMap : null;
}

function fillUniMapFromGlyphAdvances(
    uniMap: Map<number, number>, toUnicode: Map<number, string>,
    glyphAdvances: Map<number, number>, unitsPerEm: number,
): void {
    for (const [code, unicodeStr] of toUnicode) {
        const cp = unicodeStr.codePointAt(0) ?? 0;
        if (cp <= 0) continue;
        const otAdv = glyphAdvances.get(code);
        if (otAdv && otAdv > 0 && !uniMap.has(cp)) {
            uniMap.set(cp, Math.round(otAdv * 1000 / unitsPerEm));
        }
    }
}

function fillUniMapFromPdfWidths(
    uniMap: Map<number, number>, toUnicode: Map<number, string>,
    widths: Map<number, number>, defaultWidth: number,
): void {
    for (const [code, unicodeStr] of toUnicode) {
        const cp = unicodeStr.codePointAt(0) ?? 0;
        if (cp <= 0 || uniMap.has(cp)) continue;
        const pdfW = widths.get(code);
        if (pdfW !== undefined && pdfW !== defaultWidth) uniMap.set(cp, pdfW);
    }
}

function buildFontBaseProps(entry: FontRegistryEntry): string {
    const lineHeight = Math.abs(entry.ascent - entry.descent) > 0.01
        ? `line-height:${(entry.ascent - entry.descent).toFixed(6).replace(/0{1,8}$/, '').replace(/\.$/, '')};` : '';
    const isBold = entry.baseFontName.toLowerCase().includes('bold');
    const isItalic = entry.baseFontName.toLowerCase().includes('italic') ||
        entry.baseFontName.toLowerCase().includes('oblique');
    const fontWeight = isBold ? 'bold' : 'normal';
    const fontStyle = isItalic ? 'italic' : 'normal';
    return `${lineHeight}font-style:${fontStyle};font-weight:${fontWeight};font-synthesis:none;` +
        `-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision;`;
}

function resolveFontFamily(entry: FontRegistryEntry, isSymbolFont: boolean): string {
    if (isSymbolFont) return 'sans-serif';
    const embeddedId = `'f${entry.id.toString(16)}'`;
    if (entry.reEncodedData && entry.fontData && fontFormatToMime(entry.fontData.format)) {
        return embeddedId;
    }
    const systemFamily = getSystemFontFamily(entry.baseFontName);
    if (systemFamily && !entry.reEncodedData) return systemFamily;
    if (entry.fontData && fontFormatToMime(entry.fontData.format)) return embeddedId;
    return entry.familyName || 'serif';
}

export class FontRegistry {
    private readonly entriesByResourceName = new Map<string, FontRegistryEntry>();
    private readonly entriesByBaseFont = new Map<string, FontRegistryEntry>();
    private nextId = 0;

    registerFont(reader: PdfReader, fontName: string, fontRef: PdfObject): FontRegistryEntry {
        const existingByResource = this.entriesByResourceName.get(fontName);
        if (existingByResource) {
            return existingByResource;
        }

        const fontObjDict = reader.getDict(fontRef);
        const baseFontName = reader.getString(fontObjDict['BaseFont']) || fontName;

        const fontData = extractFontProgram(reader, fontObjDict);
        const info = buildFontInfo(reader, fontRef);
        const { ascent, descent } = extractFontMetrics(reader, fontObjDict);

        const { glyphAdvances, unitsPerEm, reEncodedData, glyphFixupMap } =
            processEmbeddedFontData(fontData, info);

        const unicodeFallbackWidths = buildUnicodeFallbackWidths(
            glyphAdvances, unitsPerEm, info,
        );

        const entry: FontRegistryEntry = {
            id: this.nextId++,
            fontData,
            familyName: info.familyName,
            baseFontName,
            ascent,
            descent,
            glyphAdvances,
            unitsPerEm,
            reEncodedData,
            unicodeFallbackWidths,
            glyphFixupMap,
        };
        this.entriesByResourceName.set(fontName, entry);
        if (!this.entriesByBaseFont.has(baseFontName)) {
            this.entriesByBaseFont.set(baseFontName, entry);
        }
        return entry;
    }

    getEntry(fontName: string): FontRegistryEntry | undefined {
        return this.entriesByResourceName.get(fontName) ?? this.entriesByBaseFont.get(fontName);
    }

    getGlyphAdvance(fontName: string, code: number, unicode?: string): number | null {
        const entry = this.getEntry(fontName);
        if (!entry?.glyphAdvances) return null;
        const advance = entry.glyphAdvances.get(code);
        if (advance !== undefined && advance > 0) {
            return Math.round(advance * 1000 / entry.unitsPerEm);
        }
        // Glyph missing — look up by Unicode from another CID with valid width
        if (unicode && entry.unicodeFallbackWidths) {
            const cp = unicode.codePointAt(0) ?? 0;
            if (cp > 0) {
                const fallback = entry.unicodeFallbackWidths.get(cp);
                if (fallback !== undefined) return fallback;
            }
        }
        return null;
    }

    getGlyphFixup(fontName: string, code: number): number | undefined {
        const entry = this.getEntry(fontName);
        return entry?.glyphFixupMap?.get(code);
    }

    private allUniqueEntries(): FontRegistryEntry[] {
        const seen = new Set<number>();
        const result: FontRegistryEntry[] = [];
        for (const entry of this.entriesByResourceName.values()) {
            if (!seen.has(entry.id)) {
                seen.add(entry.id);
                result.push(entry);
            }
        }
        return result;
    }

    dumpFontFaceCss(): string {
        const rules: string[] = [];
        for (const entry of this.allUniqueEntries()) {
            if (usesSystemFallback(entry)) continue;
            if (entry.reEncodedData) {
                const b64 = uint8ToBase64(entry.reEncodedData);
                rules.push(
                    `@font-face{font-family:'f${entry.id.toString(16)}';` +
                    `src:url('data:font/ttf;base64,${b64}') format('truetype');}`,
                );
                continue;
            }
            if (!entry.fontData) continue;
            const fmt = fontFormatToMime(entry.fontData.format);
            if (!fmt) continue;
            const b64 = uint8ToBase64(entry.fontData.data);
            rules.push(
                `@font-face{font-family:'f${entry.id.toString(16)}';` +
                `src:url('data:${fmt.mime};base64,${b64}') format('${fmt.cssFormat}');}`,
            );
        }
        return rules.join('\n');
    }

    dumpFontFamilyCss(): string {
        const SYMBOL_FONTS = ['symbol', 'zapfdingbats', 'wingdings'];
        const rules: string[] = [];
        for (const entry of this.allUniqueEntries()) {
            const isSymbolFont = SYMBOL_FONTS.some(
                s => entry.baseFontName.toLowerCase().includes(s),
            );
            const baseProps = buildFontBaseProps(entry);
            const family = resolveFontFamily(entry, isSymbolFont);
            const hexId = entry.id.toString(16);
            rules.push(`.ff${hexId}{font-family:${family};${baseProps}}`);
        }
        return rules.join('\n');
    }
}

function extractFontMetrics(
    reader: PdfReader,
    fontObjDict: Record<string, PdfObject>,
): { ascent: number; descent: number } {
    let descriptorRef = fontObjDict['FontDescriptor'];
    if (!descriptorRef) {
        const descendantsRef = fontObjDict['DescendantFonts'];
        if (descendantsRef) {
            const descendants = reader.getArray(descendantsRef);
            if (descendants.length > 0) {
                const cidFontDict = reader.getDict(descendants[0]);
                descriptorRef = cidFontDict['FontDescriptor'];
            }
        }
    }
    if (!descriptorRef) return { ascent: 0.8, descent: -0.2 };

    const descriptor = reader.getDict(descriptorRef);
    const rawAscent = descriptor['Ascent'] ? reader.getNumber(descriptor['Ascent']) : 0;
    const rawDescent = descriptor['Descent'] ? reader.getNumber(descriptor['Descent']) : 0;

    const ascent = rawAscent === 0 ? 0.8 : rawAscent / 1000;
    const descent = rawDescent === 0 ? -0.2 : rawDescent / 1000;
    return { ascent, descent };
}

// ── Base CSS (equivalent of pdf2htmlEX base.css.in) ───────────────────

const BASE_CSS = `.pf{position:relative;background-color:white;overflow:hidden;margin:13px auto;box-shadow:1px 1px 3px 1px #333;border-collapse:separate}
.pc{position:absolute;border:0;padding:0;margin:0;top:0;left:0;width:100%;height:100%;overflow:hidden;display:block;transform-origin:0 0;-ms-transform-origin:0 0;-webkit-transform-origin:0 0}
.t{position:absolute;white-space:pre;font-size:1px;transform-origin:0% 100%;-ms-transform-origin:0% 100%;-webkit-transform-origin:0% 100%;unicode-bidi:bidi-override;-moz-font-feature-settings:"liga" 0}
.t:after{content:''}
.t:before{content:'';display:inline-block}
.t span{position:relative;unicode-bidi:bidi-override}
._{display:inline-block;color:transparent;z-index:-1}
.c{position:absolute;border:0;padding:0;margin:0;overflow:hidden;display:block}
.fwb{font-weight:bold}
.fwn{font-weight:normal}
.fsi{font-style:italic}
.fsn{font-style:normal}
::selection{background:rgba(127,255,255,0.4)}
::-moz-selection{background:rgba(127,255,255,0.4)}
@media print{.pf{margin:0;box-shadow:none;page-break-after:always;page-break-inside:avoid}}`;

// ── Content Stream Utilities ─────────────────────────────────────────
// (Copies of module-private functions from pdf-parser.ts needed for
//  the new content stream processor)

const PDF_DOC_ENCODING: Record<number, string> = {
    0x80: '\u2022', 0x81: '\u2020', 0x82: '\u2021', 0x83: '\u2026',
    0x84: '\u2014', 0x85: '\u2013', 0x86: '\u0192', 0x87: '\u2044',
    0x88: '\u2039', 0x89: '\u203A', 0x8A: '\u2212', 0x8B: '\u2030',
    0x8C: '\u201E', 0x8D: '\u201C', 0x8E: '\u201D', 0x8F: '\u2018',
    0x90: '\u2019', 0x91: '\u201A', 0x92: '\u2122', 0x93: '\uFB01',
    0x94: '\uFB02', 0x95: '\u0141', 0x96: '\u0152', 0x97: '\u0160',
    0x98: '\u0178', 0x99: '\u017D', 0x9A: '\u0131', 0x9B: '\u0142',
    0x9C: '\u0153', 0x9D: '\u0161', 0x9E: '\u017E', 0xA0: '\u20AC',
    0xAD: '\u02C7',
};

const VALID_DECODED_CHAR_RANGES: ReadonlyArray<readonly [number, number]> = [
    [0x0020, 0x007E], [0x00A0, 0x024F], [0x0370, 0x03FF], [0x0400, 0x04FF],
    [0x0500, 0x05FF], [0x0600, 0x06FF], [0x0900, 0x097F], [0x2000, 0x206F],
    [0x2010, 0x2027], [0x20A0, 0x20CF], [0xFB1D, 0xFB4F], [0xFB50, 0xFDFF],
    [0xFE70, 0xFEFF],
];

function isValidDecodedChar(code: number): boolean {
    return VALID_DECODED_CHAR_RANGES.some(([lo, hi]) => code >= lo && code <= hi);
}

// Symbol font PUA (U+F000-U+F0FF) → standard Unicode mapping.
// Symbol fonts use PUA code points that browsers can't render with normal fonts.
const SYMBOL_PUA_MAP: Record<number, number> = {
    0xF020: 0x0020, 0xF021: 0x0021, 0xF022: 0x2200, 0xF023: 0x0023,
    0xF025: 0x0025, 0xF026: 0x0026, 0xF028: 0x0028, 0xF029: 0x0029,
    0xF02B: 0x002B, 0xF02C: 0x002C, 0xF02E: 0x002E, 0xF02F: 0x002F,
    0xF030: 0x0030, 0xF031: 0x0031, 0xF032: 0x0032, 0xF033: 0x0033,
    0xF034: 0x0034, 0xF035: 0x0035, 0xF036: 0x0036, 0xF037: 0x0037,
    0xF038: 0x0038, 0xF039: 0x0039, 0xF03D: 0x003D,
    0xF05B: 0x005B, 0xF05D: 0x005D,
    0xF0A0: 0x20AC, 0xF0A5: 0x2030, 0xF0A7: 0x00A7, 0xF0A8: 0x2663,
    0xF0AA: 0x2666, 0xF0AB: 0x2665, 0xF0AE: 0x25BA, 0xF0B0: 0x00B0,
    0xF0B1: 0x00B1, 0xF0B2: 0x2033, 0xF0B3: 0x2265, 0xF0B4: 0x00D7,
    0xF0B5: 0x221D, 0xF0B6: 0x2202, 0xF0B7: 0x2022, 0xF0B8: 0x00F7,
    0xF0B9: 0x2260, 0xF0BA: 0x2261, 0xF0BB: 0x2248, 0xF0BC: 0x2026,
    0xF0D8: 0x2191, 0xF0E0: 0x2660, 0xF0E1: 0x2663, 0xF0E2: 0x2665,
    0xF0E3: 0x2666, 0xF0E8: 0x2190, 0xF0E9: 0x2191, 0xF0EA: 0x2192,
    0xF0EB: 0x2193, 0xF0FC: 0x221A,
};

function mapSymbolPua(unicode: string): string {
    if (unicode.length === 0) return unicode;
    const cp = unicode.codePointAt(0) ?? 0;
    if (cp >= 0xF000 && cp <= 0xF0FF) {
        const mapped: number | undefined = SYMBOL_PUA_MAP[cp];        if (mapped !== undefined) return String.fromCodePoint(mapped);
        // Fallback: strip F0 prefix → U+00XX
        return String.fromCodePoint(cp & 0x00FF);
    }
    return unicode;
}

function decodeTwoByteChar(code: number, toUnicode: Map<number, string>): string {
    const codeMapped = toUnicode.get(code);
    if (codeMapped !== undefined) return mapSymbolPua(codeMapped);
    const lo = code & 0xFF;
    const loMapped = toUnicode.get(lo);
    if (loMapped !== undefined) return loMapped;
    if (code >= 0x20 && code < 0xFFFE) {
        if (isValidDecodedChar(code)) return String.fromCodePoint(code);
    }
    if (lo >= 0x20 && lo < 0x7F) return String.fromCodePoint(lo);
    return '';
}

function pdfStringToCharacters(
    raw: string,
    fontInfo?: FontInfo,
): { charCodes: number[]; unicodes: string[] } {
    const charCodes: number[] = [];
    const unicodes: string[] = [];
    if (fontInfo?.isTwoByte) {
        for (let i = 0; i + 1 < raw.length; i += 2) {
            const code = ((raw.codePointAt(i) ?? 0) << 8) | (raw.codePointAt(i + 1) ?? 0);
            charCodes.push(code);
            unicodes.push(decodeTwoByteChar(code, fontInfo.toUnicode));
        }
        if (raw.length % 2 === 1) {
            const code = raw.codePointAt(raw.length - 1) ?? 0;
            charCodes.push(code);
            unicodes.push(decodeTwoByteChar(code, fontInfo.toUnicode));
        }
    } else {
        const toUnicode = fontInfo?.toUnicode;
        for (let i = 0; i < raw.length; i++) {
            const code = raw.codePointAt(i) ?? 0;
            charCodes.push(code);
            const mapped = toUnicode?.get(code);
            if (mapped !== undefined) {
                unicodes.push(mapped);
            } else if (PDF_DOC_ENCODING[code]) {
                unicodes.push(PDF_DOC_ENCODING[code]);
            } else {
                unicodes.push(raw[i]);
            }
        }
    }
    return { charCodes, unicodes };
}

// ── Content Stream Tokenizer ─────────────────────────────────────────

const CONTENT_ESCAPE_MAP: Record<string, string> = {
    'n': '\n', 'r': '\r', 't': '\t', 'b': '\b', 'f': '\f',
    '(': '(', ')': ')', '\\': '\\',
};

function tokenizeEscapeSequence(text: string, pos: number): { char: string; endPos: number } {
    const esc = text[pos];
    const mapped = CONTENT_ESCAPE_MAP[esc];
    if (mapped) return { char: mapped, endPos: pos + 1 };
    if (esc >= '0' && esc <= '7') {
        let oct = esc;
        if (pos + 1 < text.length && text[pos + 1] >= '0' && text[pos + 1] <= '7') {
            pos++; oct += text[pos];
            if (pos + 1 < text.length && text[pos + 1] >= '0' && text[pos + 1] <= '7') {
                pos++; oct += text[pos];
            }
        }
        return { char: String.fromCodePoint(Number.parseInt(oct, 8)), endPos: pos + 1 };
    }
    if (esc === '\r' || esc === '\n') {
        const endPos = (esc === '\r' && pos + 1 < text.length && text[pos + 1] === '\n')
            ? pos + 2 : pos + 1;
        return { char: '', endPos };
    }
    return { char: esc, endPos: pos + 1 };
}

function tokenizeLiteralString(text: string, startPos: number): { token: string; endPos: number } {
    let pos = startPos + 1;
    let str = '';
    let depth = 1;
    while (pos < text.length && depth > 0) {
        if (text[pos] === '\\') {
            pos++;
            if (pos >= text.length) break;
            const result = tokenizeEscapeSequence(text, pos);
            str += result.char;
            pos = result.endPos;
        } else if (text[pos] === '(') {
            depth++; str += text[pos++];
        } else if (text[pos] === ')') {
            depth--;
            if (depth > 0) str += text[pos];
            pos++;
        } else {
            str += text[pos++];
        }
    }
    return { token: '(' + str + ')', endPos: pos };
}

function tokenizeHexString(text: string, startPos: number): { token: string; endPos: number } {
    let pos = startPos + 1;
    let hex = '';
    while (pos < text.length && text[pos] !== '>') {
        if (!' \t\r\n\0\f'.includes(text[pos])) hex += text[pos];
        pos++;
    }
    if (pos < text.length) pos++;
    if (hex.length % 2 !== 0) hex += '0';
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
        str += String.fromCodePoint(Number.parseInt(hex.substring(i, i + 2), 16));
    }
    return { token: '(' + str + ')', endPos: pos };
}

function skipComment(text: string, pos: number): number {
    while (pos < text.length && text[pos] !== '\n' && text[pos] !== '\r') pos++;
    return pos;
}

function tokenizeAngleBracket(text: string, pos: number, tokens: string[]): number {
    if (pos + 1 < text.length && text[pos + 1] === '<') { tokens.push('<<'); return pos + 2; }
    const result = tokenizeHexString(text, pos);
    tokens.push(result.token);
    return result.endPos;
}

function tokenizeClosingAngle(text: string, pos: number, tokens: string[]): number {
    if (pos + 1 < text.length && text[pos + 1] === '>') { tokens.push('>>'); return pos + 2; }
    return pos + 1;
}

function tokenizeName(text: string, pos: number, tokens: string[]): number {
    let name = '/';
    pos++;
    while (pos < text.length && !' \t\r\n\0\f/<>[]()%'.includes(text[pos])) {
        name += text[pos++];
    }
    tokens.push(name);
    return pos;
}

function tokenizeGenericToken(text: string, pos: number, tokens: string[]): number {
    let token = '';
    while (pos < text.length && !' \t\r\n\0\f/<>[]()%'.includes(text[pos])) {
        token += text[pos++];
    }
    if (token) tokens.push(token);
    return pos;
}

function tokenizeNextElement(text: string, pos: number, tokens: string[]): number {
    const c = text[pos];
    if (c === '(') { const r = tokenizeLiteralString(text, pos); tokens.push(r.token); return r.endPos; }
    if (c === '<') return tokenizeAngleBracket(text, pos, tokens);
    if (c === '>') return tokenizeClosingAngle(text, pos, tokens);
    if (c === '[') { tokens.push('['); return pos + 1; }
    if (c === ']') { tokens.push(']'); return pos + 1; }
    if (c === '/') return tokenizeName(text, pos, tokens);
    return tokenizeGenericToken(text, pos, tokens);
}

function tokenizeContentStream(data: Uint8Array): string[] {
    const text = new TextDecoder('latin1').decode(data);
    const tokens: string[] = [];
    let pos = 0;
    while (pos < text.length) {
        while (pos < text.length && ' \t\r\n\0\f'.includes(text[pos])) pos++;
        if (pos >= text.length) break;
        if (text[pos] === '%') { pos = skipComment(text, pos); continue; }
        pos = tokenizeNextElement(text, pos, tokens);
    }
    return tokens;
}

// ── Matrix & Transform Utilities ─────────────────────────────────────

// Matrix multiplication matching C++ pdf2htmlEX tm_multiply (math.h:34-42).
// PDF matrices use column-major layout: [a,b,c,d,e,f] represents
// [[a,c,e],[b,d,f],[0,0,1]].  The translation formula differs from
// row-major: result[4] = m1[0]*m2[4] + m1[2]*m2[5] + m1[4].
function multiplyMatrix(a: readonly number[], b: readonly number[]): number[] {
    return [
        a[0] * b[0] + a[2] * b[1],
        a[1] * b[0] + a[3] * b[1],
        a[0] * b[2] + a[2] * b[3],
        a[1] * b[2] + a[3] * b[3],
        a[0] * b[4] + a[2] * b[5] + a[4],
        a[1] * b[4] + a[3] * b[5] + a[5],
    ];
}

function transformPoint(x: number, y: number, tm: readonly number[]): { tx: number; ty: number } {
    return {
        tx: x * tm[0] + y * tm[2] + tm[4],
        ty: x * tm[1] + y * tm[3] + tm[5],
    };
}

function tmEqual(a: readonly number[], b: readonly number[], count: number, eps: number): boolean {
    for (let i = 0; i < count; i++) {
        if (Math.abs(a[i] - b[i]) > eps) return false;
    }
    return true;
}

function rgbToHex(r: number, g: number, b: number): string {
    const clamp = (v: number): number => Math.max(0, Math.min(255, Math.round(v * 255)));
    const hex = (v: number): string => clamp(v).toString(16).padStart(2, '0');
    return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function cmykToHex(c: number, m: number, y: number, k: number): string {
    return rgbToHex((1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k));
}

function grayToHex(g: number): string {
    return rgbToHex(g, g, g);
}

// ── TextLine Model (1:1 translation of pdf2htmlEX HTMLTextLine) ──────


const H_EPS = 1;
const SPACE_THRESHOLD = 0.125;
const EPS = 0.001;
// C++ State::HASH_ID_COUNT — number of IDs compared in diff/hash (font through word_space)
const HASH_ID_COUNT = 6;

const h = (id: number): string => id.toString(16);

/**
 * Mirrors pdf2htmlEX HTMLTextState.
 * Holds per-character style information extracted from TextItem.
 */
interface TextState {
    readonly fontName: string;
    readonly fontFamily: string;
    readonly fontSize: number;
    readonly fillColor: string;
    readonly strokeColor: string;
    letterSpace: number;   // mutable: optimize_normal updates via installAndSnap
    wordSpace: number;     // mutable: optimize_normal updates via installAndSnap
    readonly verticalAlign: number;
    readonly bold: boolean;
    readonly italic: boolean;
    readonly textRenderMode: number;
    readonly horizontalScaling: number;
    readonly spaceWidth: number; // font's space char width in 1000ths (for single_space_offset)
    readonly fontAscent: number;
    readonly fontDescent: number;
}


/**
 * Mirrors pdf2htmlEX HTMLTextLine::Offset.
 * Records a horizontal gap at a specific position in the text array.
 */
interface TextLineOffset {
    readonly startIdx: number;
    width: number;
}

/**
 * Mirrors pdf2htmlEX HTMLTextLine::State.
 * Records installed CSS class IDs for a style segment starting at a text position.
 */
interface LineStyleState {
    readonly startIdx: number;
    fontId: number;
    fontSizeId: number;
    fillColorId: number;
    strokeColorId: number;
    letterSpaceId: number;
    wordSpaceId: number;
    verticalAlignId: number;
    readonly bold: boolean;
    readonly italic: boolean;
    readonly embedded: boolean;
    readonly hasStroke: boolean;
    readonly horizontalScaling: number;
    verticalAlignIsZero: boolean;
    wordSpaceFree: boolean; // C++ hash_umask & word_space_umask — true if word_space can vary freely
}

function lineStylesEqual(a: LineStyleState | null, b: LineStyleState): boolean {
    if (!a) return false;
    return a.fontId === b.fontId &&
        a.fontSizeId === b.fontSizeId &&
        a.fillColorId === b.fillColorId &&
        a.strokeColorId === b.strokeColorId &&
        a.letterSpaceId === b.letterSpaceId &&
        (a.wordSpaceFree || b.wordSpaceFree || a.wordSpaceId === b.wordSpaceId) &&
        a.verticalAlignId === b.verticalAlignId;
}

/**
 * Compute diff classes between two LineStyleStates.
 * Mirrors HTMLTextLine::State::begin() which only emits classes that differ.
 */
function lineStyleDiffClasses(prev: LineStyleState | null, cur: LineStyleState): string[] {
    const classes: string[] = [];
    addFontClasses(prev, cur, classes);
    addSpacingClasses(prev, cur, classes);
    return classes;
}

function addFontClasses(prev: LineStyleState | null, cur: LineStyleState, classes: string[]): void {
    if (prev?.fontId !== cur.fontId) classes.push(`ff${h(cur.fontId)}`);
    if (prev?.fontSizeId !== cur.fontSizeId) classes.push(`fs${h(cur.fontSizeId)}`);
    if (prev?.fillColorId !== cur.fillColorId) classes.push(`fc${h(cur.fillColorId)}`);
    if (!cur.embedded) handleBoldItalicDiff(prev, cur, classes);
    if (cur.hasStroke && prev?.strokeColorId !== cur.strokeColorId) classes.push(`sc${h(cur.strokeColorId)}`);
}

function addSpacingClasses(prev: LineStyleState | null, cur: LineStyleState, classes: string[]): void {
    if (prev?.letterSpaceId !== cur.letterSpaceId) classes.push(`ls${h(cur.letterSpaceId)}`);
    if (!cur.wordSpaceFree && (!prev || prev.wordSpaceFree || prev.wordSpaceId !== cur.wordSpaceId)) {
        classes.push(`ws${h(cur.wordSpaceId)}`);
    }
    if (prev && !cur.verticalAlignIsZero && prev.verticalAlignId !== cur.verticalAlignId) {
        classes.push(`v${h(cur.verticalAlignId)}`);
    }
}

function handleBoldItalicDiff(
    prev: LineStyleState | null, cur: LineStyleState, classes: string[],
): void {
    if (prev?.bold !== cur.bold) {
        classes.push(cur.bold ? 'fwb' : 'fwn');
    }
    if (prev?.italic !== cur.italic) {
        classes.push(cur.italic ? 'fsi' : 'fsn');
    }
}

function fontIsEmbedded(fontName: string, fontFamily: string, fontRegistry: FontRegistry): boolean {
    const entry = fontRegistry.getEntry(fontName) ?? fontRegistry.getEntry(fontFamily);
    return !!entry?.fontData && !!fontFormatToMime(entry.fontData.format);
}

function getFontRegistryId(fontName: string, fontFamily: string, fontRegistry: FontRegistry): number {
    const entry = fontRegistry.getEntry(fontName) ?? fontRegistry.getEntry(fontFamily);
    return entry ? entry.id : -1;
}


/**
 * Direct translation of pdf2htmlEX HTMLTextLine.
 *
 * A line contains:
 * - text: number[] -- Unicode code points (>0 = char, 0 = padding)
 * - offsets: TextLineOffset[] -- horizontal gaps at specific text indices
 * - states: LineStyleState[] -- style changes at specific text indices
 */
function addWidthsToHistogram(
    offsets: ReadonlyArray<TextLineOffset>, start: number, end: number, widthMap: Map<number, number>,
): void {
    for (let oi = start; oi < end; oi++) {
        const target = offsets[oi].width;
        let found = false;
        for (const [w, c] of widthMap) {
            if (Math.abs(w - target) <= EPS) {
                widthMap.set(w, c + 1);
                found = true;
                break;
            }
        }
        if (!found) widthMap.set(target, 1);
    }
}

function findMostUsedWidth(widthMap: ReadonlyMap<number, number>): { width: number; count: number } {
    let width = 0;
    let count = 0;
    for (const [w, c] of widthMap) {
        if (c > count) { width = w; count = c; }
    }
    return { width, count };
}

function findMostFrequentAboveThreshold(
    widthMap: ReadonlyMap<number, number>, letterSpaceDiff: number, threshold: number,
): { width: number; count: number } {
    let width = 0;
    let count = 0;
    for (const [w, c] of widthMap) {
        const fixedWidth = w + letterSpaceDiff;
        if (fixedWidth >= threshold - EPS && c > count) {
            count = c;
            width = fixedWidth;
        }
    }
    return { width, count };
}

interface OptimizeSpaceOptions {
    readonly mgr: AllStateManager;
    readonly stateEntry: { textState: TextState; installed: LineStyleState | null };
    readonly textIdx1: number;
    readonly textIdx2: number;
    readonly widthMap: Map<number, number>;
    readonly z: number;
}

interface EmitOffsetOptions {
    readonly mgr: AllStateManager;
    readonly ts: TextState;
    readonly installed: LineStyleState | null;
    readonly target: number;
    readonly curTextIdx: number;
    readonly hEps: number;
    readonly spaceThreshold: number;
    readonly z: number;
}

class TextLine {
    readonly text: number[] = [];
    readonly decomposedText: number[][] = []; // C++ decomposed_text for ligatures
    offsets: TextLineOffset[] = [];
    readonly states: {
        textState: TextState;
        installed: LineStyleState | null;
    }[] = [];

    x = 0;
    y = 0;
    transformMatrix: readonly [number, number, number, number] = [1, 0, 0, 1];
    ascent = 0;
    descent = 0;
    lineWidth = 0; // C++ HTMLTextLine::width — total horizontal width

    // F1: append_unicodes (HTMLTextLine.cc:37-48)
    appendUnicodes(codePoints: number[], width: number): void {
        if (codePoints.length === 1) {
            this.text.push(codePoints[0]);
        } else if (codePoints.length > 1) {
            this.text.push(-this.decomposedText.length - 1);
            this.decomposedText.push([...codePoints]);
        }
        this.lineWidth += width;
    }

    // F2: append_offset (HTMLTextLine.cc:50-69) — merges at same position
    appendOffset(width: number): void {
        // Offset must follow last non-padding char (C++ lines 61-63)
        let offsetIdx = this.text.length;
        while (offsetIdx > 0 && this.text[offsetIdx - 1] === 0) {
            --offsetIdx;
        }
        const lastOffset = this.offsets.at(-1);
        if (lastOffset?.startIdx === offsetIdx) {
            lastOffset.width += width;
        } else {
            this.offsets.push({ startIdx: offsetIdx, width });
        }
        this.lineWidth += width;
    }

    // F3: append_state (HTMLTextLine.cc:71-84) — reuses last if same position
    appendState(textState: TextState): void {
        const lastState = this.states.at(-1);
        if (!lastState || lastState.installed?.startIdx !== this.text.length) {
            this.states.push({ textState, installed: null });
        } else {
            lastState.textState = textState;
        }
    }

    // F4: prepare (HTMLTextLine.cc:319-345)
    // Installs all style IDs via managers, computes ascent/descent.
    // Uses installAndSnap for letter_space/word_space so the INSTALLED
    // values are available for single_space_offset() in optimize/dump.
    prepare(mgr: AllStateManager, fontRegistry: FontRegistry, z: number): void {
        let accumVerticalAlign = 0;
        this.ascent = 0;
        this.descent = 0;

        for (const stateEntry of this.states) {
            const ts = stateEntry.textState;
            const scaledFontSize = ts.fontSize * z;

            const fontId = getFontRegistryId(ts.fontName, ts.fontFamily, fontRegistry);
            const embedded = fontIsEmbedded(ts.fontName, ts.fontFamily, fontRegistry);
            const hasStroke = ts.textRenderMode === 1 || ts.textRenderMode === 2;

            // C++ prepare lines 333-334: install letter/word space (one-arg form, no snap-back)
            const lsId = mgr.letterSpace.install(ts.letterSpace * z);
            const wsId = mgr.wordSpace.install(ts.wordSpace * z);

            const vaIsZero = Math.abs(ts.verticalAlign) < EPS;

            const installed: LineStyleState = {
                startIdx: stateEntry.installed?.startIdx ?? 0,
                fontId: fontId >= 0 ? fontId : mgr.fillColor.install('#000000'),
                fontSizeId: mgr.fontSize.install(scaledFontSize),
                fillColorId: mgr.fillColor.install(ts.fillColor),
                strokeColorId: hasStroke ? mgr.strokeColor.install(ts.strokeColor) : 0,
                letterSpaceId: lsId,
                wordSpaceId: wsId,
                verticalAlignId: vaIsZero ? 0 : mgr.verticalAlign.install(ts.verticalAlign * z),
                bold: ts.bold,
                italic: ts.italic,
                embedded,
                hasStroke,
                horizontalScaling: ts.horizontalScaling,
                verticalAlignIsZero: vaIsZero,
                wordSpaceFree: false, // C++ hash_umask starts at 0
            };
            stateEntry.installed = installed;

            // C++ lines 337-343: ascent/descent with accumulated vertical_align
            accumVerticalAlign += ts.verticalAlign;
            const curAscent = accumVerticalAlign + ts.fontAscent * scaledFontSize;
            if (curAscent > this.ascent) this.ascent = curAscent;
            const curDescent = accumVerticalAlign + ts.fontDescent * scaledFontSize;
            if (curDescent < this.descent) this.descent = curDescent;
        }
    }

    // F5: optimize_normal (HTMLTextLine.cc:363-540) — 1:1 C++ translation
    // Adjusts letter-space and word-space to reduce HTML element count.
    // Builds new_offsets list and swaps at end (C++ line 537).
    optimizeNormal(mgr: AllStateManager, hEps: number, spaceThreshold: number, z: number): void {
        // C++ line 366-367: remove useless states at end
        let lastSt = this.states.at(-1);
        while (lastSt && (lastSt.installed?.startIdx ?? 0) >= this.text.length) {
            this.states.pop();
            lastSt = this.states.at(-1);
        }
        if (this.states.length === 0) return;

        const widthMap = new Map<number, number>(); // width → count
        const newOffsets: TextLineOffset[] = [];

        // C++ line 383: offset iterator tracking current position in offsets array
        let offIter1 = 0;

        for (let si = 0; si < this.states.length; si++) {
            const stateEntry = this.states[si];
            if (!stateEntry.installed) continue;

            const textIdx1 = stateEntry.installed.startIdx;
            const textIdx2 = si + 1 < this.states.length
                ? (this.states[si + 1].installed?.startIdx ?? this.text.length)
                : this.text.length;

            while (offIter1 < this.offsets.length && this.offsets[offIter1].startIdx <= textIdx1) {
                newOffsets.push({ ...this.offsets[offIter1] });
                offIter1++;
            }
            let offIter2 = offIter1;
            while (offIter2 < this.offsets.length && this.offsets[offIter2].startIdx <= textIdx2) {
                offIter2++;
            }

            const spaceOpts: OptimizeSpaceOptions = { mgr, stateEntry, textIdx1, textIdx2, widthMap, z };
            const lsResult = this.optimizeLetterSpace(spaceOpts, offIter1, offIter2, newOffsets);
            this.optimizeWordSpace(spaceOpts, lsResult.offsetCount, lsResult.letterSpaceDiff, spaceThreshold);
            offIter1 = offIter2;
        }

        this.offsets = newOffsets;
    }

    private optimizeLetterSpace(
        opts: OptimizeSpaceOptions,
        offIter1: number, offIter2: number,
        newOffsets: TextLineOffset[],
    ): { offsetCount: number; letterSpaceDiff: number } {
        const { mgr, stateEntry, textIdx1, textIdx2, widthMap, z } = opts;
        const ts = stateEntry.textState;
        let offsetCount = offIter2 - offIter1;
        let letterSpaceDiff = 0;
        const textCount = textIdx2 - textIdx1;
        widthMap.clear();

        if (offsetCount === 0) return { offsetCount, letterSpaceDiff };

        if (textCount > offsetCount) widthMap.set(0, textCount - offsetCount);
        addWidthsToHistogram(this.offsets, offIter1, offIter2, widthMap);
        const { width: mostUsedWidth, count: maxCount } = findMostUsedWidth(widthMap);

        if (maxCount <= textCount / 2 || (ts.letterSpace * z + mostUsedWidth) <= EPS) {
            for (let oi = offIter1; oi < offIter2; oi++) {
                newOffsets.push({ ...this.offsets[oi] });
            }
            return { offsetCount, letterSpaceDiff };
        }

        if (!stateEntry.installed) return { offsetCount, letterSpaceDiff };
        const oldLs = ts.letterSpace * z;
        const lsResult = mgr.letterSpace.installAndSnap(oldLs + mostUsedWidth);
        stateEntry.installed.letterSpaceId = lsResult.id;
        ts.letterSpace = lsResult.snapped / z;
        letterSpaceDiff = oldLs - lsResult.snapped;

        let oi = offIter1;
        offsetCount = 0;
        for (let curIdx = textIdx1; curIdx < textIdx2; curIdx++) {
            const curWidth = (oi < offIter2 && this.offsets[oi].startIdx === curIdx + 1)
                ? this.offsets[oi++].width + letterSpaceDiff
                : letterSpaceDiff;
            if (Math.abs(curWidth) > EPS) {
                newOffsets.push({ startIdx: curIdx + 1, width: curWidth });
                offsetCount++;
            }
        }

        return { offsetCount, letterSpaceDiff };
    }

    private optimizeWordSpace(
        opts: OptimizeSpaceOptions,
        offsetCount: number, letterSpaceDiff: number,
        spaceThreshold: number,
    ): void {
        const { mgr, stateEntry, textIdx1, textIdx2, widthMap, z } = opts;
        if (this.text.slice(textIdx1, textIdx2).includes(0x20)) return;
        if (!stateEntry.installed) return;

        const ts = stateEntry.textState;
        if (offsetCount === 0) {
            stateEntry.installed.wordSpaceFree = true;
            return;
        }

        const emSize = ts.fontSize * z * (ts.fontAscent - ts.fontDescent);
        const threshold = emSize * spaceThreshold;
        const { width: mostUsedWidth, count: maxCount } = findMostFrequentAboveThreshold(
            widthMap, letterSpaceDiff, threshold,
        );

        if (maxCount === 0) {
            stateEntry.installed.wordSpaceFree = true;
            return;
        }

        ts.wordSpace = 0;
        const singleSpaceOff = ts.letterSpace * z + (ts.spaceWidth / 1000) * ts.fontSize * z;
        const wsResult = mgr.wordSpace.installAndSnap(mostUsedWidth - singleSpaceOff);
        stateEntry.installed.wordSpaceId = wsResult.id;
        ts.wordSpace = wsResult.snapped / z;
        stateEntry.installed.wordSpaceFree = false;
    }

    /**
     * Mirrors HTMLTextLine::dump_text().
     *
     * Produces HTML output matching pdf2htmlEX format:
     * <div class="t mN xN yN hN [style classes]">
     *   text<span class="_ _N"> </span>text
     *   <span class="[diff classes]">styled text</span>
     * </div>
     */
    dumpText(mgr: AllStateManager, fontRegistry: FontRegistry, hEps: number, spaceThreshold: number, z: number): string {
        if (this.text.length === 0 && this.states.length === 0) return '';

        const mId = mgr.transformMatrix.install(this.transformMatrix);
        const xId = mgr.left.install(this.x * z);
        const yId = mgr.bottom.install(this.y * z);
        const hId = mgr.height.install(this.ascent);

        const parts: string[] = [];

        const divClasses = this.buildDivClasses(mId, xId, yId, hId);
        parts.push(`<div class="${divClasses}">`);

        this.emitLineContent(parts, mgr, fontRegistry, hEps, spaceThreshold, z);

        parts.push('</div>');
        return parts.join('');
    }

    private buildDivClasses(mId: number, xId: number, yId: number, hId: number): string {
        const classes = [`t`, `m${h(mId)}`, `x${h(xId)}`, `y${h(yId)}`, `h${h(hId)}`];

        if (this.states.length > 0 && this.states[0].installed) {
            const first = this.states[0].installed;
            const initialClasses = lineStyleDiffClasses(null, first);
            for (const c of initialClasses) {
                classes.push(c);
            }
        }

        return classes.join(' ');
    }

    // F6: emitLineContent — 1:1 translation of C++ dump_text inner loop
    // (HTMLTextLine.cc:226-293). Interleaves offset and text output with
    // accumulated dx and single_space_offset matching.
    private emitLineContent(
        parts: string[],
        mgr: AllStateManager,
        fontRegistry: FontRegistry,
        hEps: number,
        spaceThreshold: number,
        z: number,
    ): void {
        const stateStack: LineStyleState[] = [];

        if (this.states.length > 0 && this.states[0].installed) {
            stateStack.push(this.states[0].installed);
        }

        const ctx = { dx: 0, lastTextPosWithNegativeOffset: 0, curTextIdx: 0, curOffsetIdx: 0 };

        for (let si = 0; si < this.states.length; si++) {
            const siInstalled = this.states[si].installed;
            if (si > 0 && siInstalled) {
                this.applyGreedyStateChange(
                    parts, stateStack, siInstalled, ctx.lastTextPosWithNegativeOffset,
                );
            }

            const ts = this.states[si].textState;
            const textIdx2 = si + 1 < this.states.length
                ? (this.states[si + 1].installed?.startIdx ?? this.text.length)
                : this.text.length;

            this.emitInterleavedContent(
                parts, ctx,
                { ts, installed: this.states[si].installed, textIdx2 },
                { mgr, hEps, spaceThreshold, z },
            );
        }

        for (let i = stateStack.length - 1; i >= 1; i--) {
            parts.push('</span>');
        }
    }

    private emitInterleavedOffset(
        parts: string[],
        ctx: { dx: number; lastTextPosWithNegativeOffset: number; curTextIdx: number; curOffsetIdx: number },
        ts: TextState, installed: LineStyleState | null,
        emitCtx: { mgr: AllStateManager; hEps: number; spaceThreshold: number; z: number },
    ): void {
        const target = this.offsets[ctx.curOffsetIdx].width + ctx.dx;
        const result = this.emitOffset(parts, {
            mgr: emitCtx.mgr, ts, installed, target, curTextIdx: ctx.curTextIdx,
            hEps: emitCtx.hEps, spaceThreshold: emitCtx.spaceThreshold, z: emitCtx.z,
        });
        if (result.negativeOffset) ctx.lastTextPosWithNegativeOffset = ctx.curTextIdx;
        ctx.dx = target - result.actualOffset;
        ctx.curOffsetIdx++;
    }

    private emitInterleavedContent(
        parts: string[],
        ctx: { dx: number; lastTextPosWithNegativeOffset: number; curTextIdx: number; curOffsetIdx: number },
        stateInfo: { ts: TextState; installed: LineStyleState | null; textIdx2: number },
        emitCtx: { mgr: AllStateManager; hEps: number; spaceThreshold: number; z: number },
    ): void {
        const { ts, installed, textIdx2 } = stateInfo;
        for (;;) {
            const hasOffset = ctx.curOffsetIdx < this.offsets.length &&
                this.offsets[ctx.curOffsetIdx].startIdx <= ctx.curTextIdx;
            if (hasOffset) {
                if (this.offsets[ctx.curOffsetIdx].startIdx > textIdx2) break;
                this.emitInterleavedOffset(parts, ctx, ts, installed, emitCtx);
            } else {
                if (ctx.curTextIdx >= textIdx2) break;
                let nextTextIdx = textIdx2;
                if (ctx.curOffsetIdx < this.offsets.length &&
                    this.offsets[ctx.curOffsetIdx].startIdx < nextTextIdx) {
                    nextTextIdx = this.offsets[ctx.curOffsetIdx].startIdx;
                }
                this.dumpChars(parts, ctx.curTextIdx, nextTextIdx);
                ctx.curTextIdx = nextTextIdx;
            }
        }
    }

    private dumpChars(parts: string[], from: number, to: number): void {
        for (let i = from; i < to; i++) {
            const cp = this.text[i];
            if (cp > 0) {
                parts.push(escapeHtml(String.fromCodePoint(cp)));
            } else if (cp < 0) {
                const decomposed = this.decomposedText[-cp - 1];
                for (const u of decomposed) {
                    parts.push(escapeHtml(String.fromCodePoint(u)));
                }
            }
        }
    }

    private findStateForIndex(charIdx: number, currentIdx: number): number {
        for (let si = currentIdx + 1; si < this.states.length; si++) {
            const stateStart = this.states[si].installed?.startIdx ?? 0;
            if (stateStart > charIdx) return currentIdx;
            if (stateStart === charIdx) return si;
        }
        return currentIdx;
    }

    private emitOffset(
        parts: string[], opts: EmitOffsetOptions,
    ): { actualOffset: number; negativeOffset: boolean } {
        const { mgr, ts, installed, target, hEps, spaceThreshold, z } = opts;
        if (Math.abs(target) <= hEps) return { actualOffset: 0, negativeOffset: false };

        if (installed && !installed.wordSpaceFree) {
            const sso = ts.wordSpace * z + ts.letterSpace * z
                + (ts.spaceWidth / 1000) * ts.fontSize * z;
            if (Math.abs(target - sso) <= hEps) {
                parts.push('<span class="_"> </span>');
                return { actualOffset: sso, negativeOffset: false };
            }
        }

        const wsResult = mgr.whitespace.installAndSnap(target);
        let negativeOffset = false;
        if (Math.abs(wsResult.snapped) > EPS) {
            if (wsResult.snapped < -EPS) negativeOffset = true;
            const emSize = ts.fontSize * z * (ts.fontAscent - ts.fontDescent);
            const threshold = emSize * spaceThreshold;
            const spaceChar = target > (threshold - EPS) ? ' ' : '';
            parts.push(`<span class="_ _${h(wsResult.id)}">${spaceChar}</span>`);
        }
        return { actualOffset: wsResult.snapped, negativeOffset };
    }

    /**
     * Greedy state stack optimization — 1:1 translation of C++ dump_text lines 185-221.
     * Walks stack from back to front, accumulates vertical_align, tracks negative offset guard.
     */
    private applyGreedyStateChange(
        parts: string[],
        stateStack: LineStyleState[],
        newState: LineStyleState,
        lastTextPosWithNegativeOffset: number,
    ): void {
        this.trimStateStack(parts, stateStack, newState, lastTextPosWithNegativeOffset);
        this.pushDiffSpan(parts, stateStack, newState);
    }

    private trimStateStack(
        parts: string[], stateStack: LineStyleState[],
        newState: LineStyleState, lastTextPosWithNegativeOffset: number,
    ): void {
        let verticalAlign = newState.verticalAlignIsZero ? 0 : 1;
        let bestCost = HASH_ID_COUNT + 1;

        for (let i = stateStack.length - 1; i >= 0; i--) {
            const existing = stateStack[i];
            let cost = this.stateDiffCount(existing, newState);
            if (verticalAlign !== 0) cost++;

            if (cost < bestCost) {
                this.popStackTo(parts, stateStack, i);
                bestCost = cost;
                if (bestCost === 0) break;
            }

            if (existing.startIdx <= lastTextPosWithNegativeOffset) break;
            if (!existing.verticalAlignIsZero) verticalAlign++;
        }
    }

    private popStackTo(parts: string[], stateStack: LineStyleState[], targetIdx: number): void {
        while (stateStack.length - 1 > targetIdx) {
            if (stateStack.length > 1) parts.push('</span>');
            stateStack.pop();
        }
    }

    private pushDiffSpan(parts: string[], stateStack: LineStyleState[], newState: LineStyleState): void {
        const prev = stateStack.at(-1) ?? null;
        if (lineStylesEqual(prev, newState)) return;
        const diffClasses = lineStyleDiffClasses(prev, newState);
        if (diffClasses.length > 0) {
            parts.push(`<span class="${diffClasses.join(' ')}">`);
            stateStack.push(newState);
        }
    }

    /**
     * C++ State::diff (HTMLTextLine.cc:699-718) — counts DIFFERENCES for common-mask IDs.
     * Only compares IDs where BOTH states care (neither has the ID free/masked).
     */
    private stateDiffCount(a: LineStyleState, b: LineStyleState): number {
        let d = 0;
        if (a.fontId !== b.fontId) d++;
        if (a.fontSizeId !== b.fontSizeId) d++;
        if (a.fillColorId !== b.fillColorId) d++;
        if (a.strokeColorId !== b.strokeColorId) d++;
        if (a.letterSpaceId !== b.letterSpaceId) d++;
        // C++ common_mask: only count if BOTH care (neither free)
        if (!a.wordSpaceFree && !b.wordSpaceFree && a.wordSpaceId !== b.wordSpaceId) d++;
        return d;
    }

    private getEmSizeForState(stateIdx: number, z: number): number {
        if (stateIdx < this.states.length) {
            return this.states[stateIdx].textState.fontSize * z;
        }
        return 12 * z;
    }

}


// ── Content Stream Processor (mirrors pdf2htmlEX HTMLRenderer) ───────

type OperatorHandler = (
    op: string,
    operands: ReadonlyArray<string>,
    resources: Record<string, PdfObject>,
    pageWidth: number,
    pageHeight: number,
) => void;

const PP_EPS = 1e-6;

const FILL_BY_RENDER_MODE: ReadonlyArray<boolean> = [true, false, true, false, true, false, true, false];
const STROKE_BY_RENDER_MODE: ReadonlyArray<boolean> = [false, true, true, false, false, true, true, false];

const enum NewLineState {
    NLS_NONE = 0,
    NLS_NEWSTATE = 1,
    NLS_NEWLINE = 2,
    NLS_NEWCLIP = 3,
}

function setLineState(current: NewLineState, target: NewLineState): NewLineState {
    return target > current ? target : current;
}

interface ProcessedPage {
    readonly lines: TextLine[];
    readonly pathRects: PathRect[];
    readonly imageItems: ImageItem[];
    readonly annotations: PdfAnnotation[];
    readonly pageWidth: number;
    readonly pageHeight: number;
    readonly initialYScale: number;
}

const FONT_SIZE_MULTIPLIER = 4; // pdf2htmlEX default (pdf2htmlEX.cc:185)

class PixelPerfectProcessor {
    private readonly reader: PdfReader;
    private readonly fontRegistry: FontRegistry;
    private readonly zoom: number;
    private pageHeight = 792;
    // text_scale_factor1/2 from general.cc:326-327
    private readonly textScaleFactor1: number;
    private readonly textScaleFactor2: number;

    // PDF graphics state
    private ctm: number[] = [1, 0, 0, 1, 0, 0];
    private textMatrix: number[] = [1, 0, 0, 1, 0, 0];
    private lineMatrix: number[] = [1, 0, 0, 1, 0, 0];
    private fontSize = 0;
    private fontName = '';
    private fillColor = '#000000';
    private strokeColor = '#000000';
    private patternFillImage: string | null = null; // data URL when fill uses a tiling pattern with image
    private fillColorSpaceIsPattern = false;
    private charSpace = 0;
    private wordSpace = 0;
    private horizScaling = 1;
    private rise = 0;
    private renderMode = 0;
    private leading = 0;
    private lineWidth = 1;

    // Derived state (mirrors C++ draw_* variables)
    private drawTextScale = 1;
    private drawTx = 0;
    private drawTy = 0;
    private curTx = 0;
    private curTy = 0;
    private curFontSize = 0;
    private curTextTm: number[] = [1, 0, 0, 1, 0, 0];

    // State from before current checkStateChange
    private prevDrawTextScale = 1;
    private prevTextTm: number[] = [1, 0, 0, 1, 0, 0];

    // HTML state (mirrors C++ cur_text_state / cur_line_state)
    private curTransformMatrix: readonly [number, number, number, number] = [1, 0, 0, 1];
    private prevTransformMatrix: readonly [number, number, number, number] = [1, 0, 0, 1];
    private curLetterSpace = 0;
    private curWordSpace = 0;
    private curFillColor = '#000000';
    private curStrokeColor = '#000000';
    private curVerticalAlign = 0;

    // Change flags
    private allChanged = true;
    private fontChanged = false;
    private ctmChanged = false;
    private textMatChanged = false;
    private horizScaleChanged = false;
    private riseChanged = false;
    private fillColorChanged = false;
    private strokeColorChanged = false;
    private letterSpaceChanged = false;
    private wordSpaceChanged = false;

    // State stack for q/Q
    private readonly stateStack: Array<{
        ctm: number[]; fillColor: string; strokeColor: string;
        lineWidth: number; fontSize: number; fontName: string;
        charSpace: number; wordSpace: number; horizScaling: number;
        rise: number; renderMode: number; leading: number;
        textMatrix: number[]; lineMatrix: number[];
    }> = [];

    // Font info cache per resource name
    private fontInfoMap = new Map<string, FontInfo>();

    // Line tracking
    private currentLine: TextLine | null = null;
    private readonly lines: TextLine[] = [];
    private currentFontInfo: FontInfo | undefined;

    // Graphics tracking
    private readonly pathRects: PathRect[] = [];
    private readonly imageItems: ImageItem[] = [];
    private pathPoints: number[] = [];
    private readonly generalPathPoints: Array<{ tx: number; ty: number }> = [];

    constructor(reader: PdfReader, fontRegistry: FontRegistry, zoom: number) {
        this.reader = reader;
        this.fontRegistry = fontRegistry;
        this.zoom = zoom;
        // general.cc:326-327: text_scale_factor1 = max(zoom, font_size_multiplier)
        this.textScaleFactor1 = Math.max(zoom, FONT_SIZE_MULTIPLIER);
        this.textScaleFactor2 = zoom / this.textScaleFactor1;
    }

    processPage(pageObj: PdfObject, _pageIndex: number): ProcessedPage {
        this.resetState();
        this.lines.length = 0;
        this.pathRects.length = 0;
        this.imageItems.length = 0;

        const pageDict = this.reader.getDict(pageObj);
        const mediaBox = getPageMediaBox(this.reader, pageDict);
        let pageWidth = Math.abs(mediaBox[2] - mediaBox[0]);
        let pageHeight = Math.abs(mediaBox[3] - mediaBox[1]);
        this.pageHeight = pageHeight;
        this.initialYScale = 0;

        const rotation = pageDict['Rotate'] ? this.reader.getNumber(pageDict['Rotate']) : 0;
        if (rotation === 90 || rotation === 270) {
            [pageWidth, pageHeight] = [pageHeight, pageWidth];
        }

        // Build font info map from page resources
        const resources = this.resolveResources(pageDict);
        const fontDict = resources['Font'] ? this.reader.getDict(resources['Font']) : {};
        for (const [name, ref] of Object.entries(fontDict)) {
            this.fontRegistry.registerFont(this.reader, name, ref);
            this.fontInfoMap.set(name, buildFontInfo(this.reader, ref));
        }

        // Get and process content stream
        const contentData = this.resolveContentData(pageDict);
        if (contentData.length > 0) {
            const tokens = tokenizeContentStream(contentData);
            this.dispatchOperators(tokens, resources, pageWidth, pageHeight);
        }

        // Finalize last line
        if (this.currentLine && this.currentLine.text.length > 0) {
            this.lines.push(this.currentLine);
        }

        // Extract annotations
        const annotations = this.extractAnnotations(pageDict, pageHeight);

        return {
            lines: [...this.lines],
            pathRects: [...this.pathRects],
            imageItems: [...this.imageItems],
            annotations,
            pageWidth,
            pageHeight,
            initialYScale: this.initialYScale,
        };
    }

    private resetState(): void {
        this.ctm = [1, 0, 0, 1, 0, 0];
        this.textMatrix = [1, 0, 0, 1, 0, 0];
        this.lineMatrix = [1, 0, 0, 1, 0, 0];
        this.fontSize = 0;
        this.fontName = '';
        this.fillColor = '#000000';
        this.strokeColor = '#000000';
        this.charSpace = 0;
        this.wordSpace = 0;
        this.horizScaling = 1;
        this.rise = 0;
        this.renderMode = 0;
        this.leading = 0;
        this.lineWidth = 1;
        this.drawTextScale = 1;
        this.drawTx = 0;
        this.drawTy = 0;
        this.curTx = 0;
        this.curTy = 0;
        this.curFontSize = 0;
        this.curTextTm = [1, 0, 0, 1, 0, 0];
        this.prevTextTm = [1, 0, 0, 1, 0, 0];
        this.prevDrawTextScale = 1;
        this.curTransformMatrix = [1, 0, 0, 1];
        this.prevTransformMatrix = [1, 0, 0, 1];
        this.curLetterSpace = 0;
        this.curWordSpace = 0;
        this.curFillColor = '#000000';
        this.curStrokeColor = '#000000';
        this.curVerticalAlign = 0;
        this.allChanged = true;
        this.fontChanged = false;
        this.ctmChanged = false;
        this.textMatChanged = false;
        this.horizScaleChanged = false;
        this.riseChanged = false;
        this.fillColorChanged = false;
        this.strokeColorChanged = false;
        this.letterSpaceChanged = false;
        this.wordSpaceChanged = false;
        this.stateStack.length = 0;
        this.fontInfoMap = new Map();
        this.currentLine = null;
        this.currentFontInfo = undefined;
        this.pathPoints = [];
    }

    // ── check_state_change (state.cc:168-494) ────────────────────────

    private checkStateChange(): NewLineState {
        let nls = NewLineState.NLS_NONE;
        let needRescaleFont = false;
        let needRecheckPosition = false;
        let drawTextScaleChanged = false;

        // Save previous state for position merge
        const oldTm = [...this.curTextTm];
        const oldDrawTextScale = this.drawTextScale;
        this.prevTransformMatrix = this.curTransformMatrix;
        this.prevTextTm = oldTm;
        this.prevDrawTextScale = oldDrawTextScale;

        // Font change (state.cc:208-239)
        if (this.allChanged || this.fontChanged) {
            const newFontInfo = this.fontInfoMap.get(this.fontName);
            if (!this.currentFontInfo || newFontInfo !== this.currentFontInfo) {
                nls = setLineState(nls, NewLineState.NLS_NEWSTATE);
            }
            this.currentFontInfo = newFontInfo;
            needRescaleFont = true;
            this.fontChanged = false;
        }

        // Transform matrix change (state.cc:242-264)
        if (this.allChanged || this.ctmChanged || this.textMatChanged ||
            this.horizScaleChanged || this.riseChanged) {
            const scaleMat = [this.horizScaling, 0, 0, 1, 0, this.rise];
            const m2 = multiplyMatrix(this.ctm, this.textMatrix);
            const newTextTm = multiplyMatrix(m2, scaleMat);

            if (!tmEqual(newTextTm, this.curTextTm, 6, PP_EPS)) {
                needRecheckPosition = true;
                needRescaleFont = true;
                this.curTextTm = newTextTm;
            }
            this.ctmChanged = false;
            this.textMatChanged = false;
            this.horizScaleChanged = false;
            this.riseChanged = false;
        }

        if (needRescaleFont) {
            const rescaleResult = this.rescaleFont(nls);
            nls = rescaleResult.nls;
            drawTextScaleChanged = rescaleResult.drawTextScaleChanged;
        }

        // First text on page forces new line
        if (this.allChanged) {
            nls = setLineState(nls, NewLineState.NLS_NEWLINE);
            this.allChanged = false;
        }

        // Position merging (state.cc:327-411)
        if (needRecheckPosition && nls < NewLineState.NLS_NEWLINE) {
            nls = this.tryMergePosition(nls, oldTm, oldDrawTextScale);
        }

        nls = this.checkSpacingAndColorChanges(nls, drawTextScaleChanged);

        return nls;
    }

    private rescaleFont(nls: NewLineState): { nls: NewLineState; drawTextScaleChanged: boolean } {
        const newDrawTm = [...this.curTextTm];
        let newDrawTextScale = (1 / this.textScaleFactor2) *
            Math.hypot(newDrawTm[2], newDrawTm[3]);
        let newDrawFontSize = this.fontSize;
        let drawTextScaleChanged = false;

        if (newDrawTextScale > PP_EPS) {
            newDrawFontSize *= newDrawTextScale;
            for (let i = 0; i < 4; i++) newDrawTm[i] /= newDrawTextScale;
        } else {
            newDrawTextScale = 1;
        }

        if (newDrawFontSize < -PP_EPS) {
            newDrawFontSize *= -1;
            for (let i = 0; i < 4; i++) newDrawTm[i] *= -1;
        }

        if (Math.abs(newDrawTextScale - this.drawTextScale) > PP_EPS) {
            drawTextScaleChanged = true;
            this.drawTextScale = newDrawTextScale;
        }

        if (Math.abs(newDrawFontSize - this.curFontSize) > PP_EPS) {
            nls = setLineState(nls, NewLineState.NLS_NEWSTATE);
            this.curFontSize = newDrawFontSize;
        }

        const newTm: readonly [number, number, number, number] =
            [newDrawTm[0], newDrawTm[1], newDrawTm[2], newDrawTm[3]];
        if (!tmEqual(
            [newTm[0], newTm[1], newTm[2], newTm[3]],
            [this.curTransformMatrix[0], this.curTransformMatrix[1],
                this.curTransformMatrix[2], this.curTransformMatrix[3]],
            4, PP_EPS,
        )) {
            nls = setLineState(nls, NewLineState.NLS_NEWLINE);
            this.curTransformMatrix = newTm;
        }

        return { nls, drawTextScaleChanged };
    }

    private checkSpacingAndColorChanges(nls: NewLineState, drawTextScaleChanged: boolean): NewLineState {
        if (this.allChanged || this.letterSpaceChanged || drawTextScaleChanged) {
            const newLs = this.charSpace * this.drawTextScale;
            if (Math.abs(newLs - this.curLetterSpace) > PP_EPS) {
                this.curLetterSpace = newLs;
                nls = setLineState(nls, NewLineState.NLS_NEWSTATE);
            }
            this.letterSpaceChanged = false;
        }

        if (this.allChanged || this.wordSpaceChanged || drawTextScaleChanged) {
            const newWs = this.wordSpace * this.drawTextScale;
            if (Math.abs(newWs - this.curWordSpace) > PP_EPS) {
                this.curWordSpace = newWs;
                nls = setLineState(nls, NewLineState.NLS_NEWSTATE);
            }
            this.wordSpaceChanged = false;
        }

        nls = this.checkColorChanges(nls);
        return nls;
    }

    private checkColorChanges(nls: NewLineState): NewLineState {
        if (this.fillColorChanged) {
            const newFill = FILL_BY_RENDER_MODE[this.renderMode] ? this.fillColor : 'transparent';
            if (newFill !== this.curFillColor) {
                this.curFillColor = newFill;
                nls = setLineState(nls, NewLineState.NLS_NEWSTATE);
            }
            this.fillColorChanged = false;
        }

        if (this.strokeColorChanged) {
            const newStroke = STROKE_BY_RENDER_MODE[this.renderMode] ? this.strokeColor : 'transparent';
            if (newStroke !== this.curStrokeColor) {
                this.curStrokeColor = newStroke;
                nls = setLineState(nls, NewLineState.NLS_NEWSTATE);
            }
            this.strokeColorChanged = false;
        }

        return nls;
    }

    // Position merge logic (state.cc:327-411)
    private tryMergePosition(
        nls: NewLineState, oldTm: readonly number[], oldDrawTextScale: number,
    ): NewLineState {
        if (!tmEqual(
            [this.prevTransformMatrix[0], this.prevTransformMatrix[1],
                this.prevTransformMatrix[2], this.prevTransformMatrix[3]],
            [this.curTransformMatrix[0], this.curTransformMatrix[1],
                this.curTransformMatrix[2], this.curTransformMatrix[3]],
            4, PP_EPS,
        )) {
            return setLineState(nls, NewLineState.NLS_NEWLINE);
        }

        const det = oldTm[0] * oldTm[3] - oldTm[1] * oldTm[2];
        if (Math.abs(det) <= PP_EPS) {
            return setLineState(nls, NewLineState.NLS_NEWLINE);
        }

        const lhs1 = this.curTextTm[0] * this.curTx + this.curTextTm[2] * this.curTy + this.curTextTm[4]
            - oldTm[0] * this.drawTx - oldTm[2] * this.drawTy - oldTm[4];
        const lhs2 = this.curTextTm[1] * this.curTx + this.curTextTm[3] * this.curTy + this.curTextTm[5]
            - oldTm[1] * this.drawTx - oldTm[3] * this.drawTy - oldTm[5];

        const dx = (lhs1 * oldTm[3] - lhs2 * oldTm[2]) / det;
        const dy = (lhs2 * oldTm[0] - lhs1 * oldTm[1]) / det;


        const merged = Math.abs(dy) <= PP_EPS ||
            this.canMergeVertically(dx, dy, oldDrawTextScale);

        if (merged && Math.abs(this.horizScaling) > PP_EPS) {
            const offset = dx * oldDrawTextScale / this.horizScaling * this.zoom;
            if (this.currentLine && Math.abs(offset) > PP_EPS) {
                this.currentLine.appendOffset(offset);
            }
            if (Math.abs(dy) <= PP_EPS) {
                this.curVerticalAlign = 0;
            } else {
                this.curVerticalAlign = dy * oldDrawTextScale;
                nls = setLineState(nls, NewLineState.NLS_NEWSTATE);
            }
            this.drawTx = this.curTx;
            this.drawTy = this.curTy;
            return nls;
        }

        return setLineState(nls, NewLineState.NLS_NEWLINE);
    }

    private canMergeVertically(dx: number, dy: number, oldDrawTextScale: number): boolean {
        const entry = this.fontRegistry.getEntry(this.fontName);
        const descent = entry?.descent ?? -0.2;
        const ascent = entry?.ascent ?? 0.8;
        const emSize = this.curFontSize * (ascent - descent);
        if ((dx * oldDrawTextScale) < -SPACE_THRESHOLD * emSize - PP_EPS) return false;
        const oldAscent = ascent * this.curFontSize;
        const oldDescent = descent * this.curFontSize;
        const newAscent = dy * oldDrawTextScale + ascent * this.curFontSize;
        const newDescent = dy * oldDrawTextScale + descent * this.curFontSize;
        return newDescent <= oldAscent + PP_EPS && newAscent >= oldDescent - PP_EPS;
    }

    // ── prepare_text_line (state.cc:496-540) ─────────────────────────

    private prepareTextLine(nlState: NewLineState): void {
        if (!this.currentLine) {
            nlState = NewLineState.NLS_NEWCLIP;
        }

        if (nlState >= NewLineState.NLS_NEWLINE) {
            // Open new line
            const pos = transformPoint(this.curTx, this.curTy, this.curTextTm);
            if (this.currentLine && this.currentLine.text.length > 0) {
                this.lines.push(this.currentLine);
            }
            this.currentLine = new TextLine();
            this.currentLine.x = pos.tx;
            this.currentLine.y = pos.ty;
            this.currentLine.transformMatrix = this.curTransformMatrix;
            this.curVerticalAlign = 0;
            this.drawTx = this.curTx;
            this.drawTy = this.curTy;
        } else if (this.currentLine) {
            // Merge: append horizontal offset if needed
            const target = (this.curTx - this.drawTx) * this.drawTextScale * this.zoom;
            if (Math.abs(target) > PP_EPS) {
                this.currentLine.appendOffset(target);
                this.drawTx += target / (this.drawTextScale * this.zoom);
            }
        }

        // Append state if changed
        if (nlState !== NewLineState.NLS_NONE && this.currentLine) {
            const ts = this.buildTextState();
            this.currentLine.appendState(ts);
            this.updateLastStateStartIdx();
        }
    }

    // ── drawString (text.cc:26-187) ──────────────────────────────────

    private drawString(rawString: string): void {
        if (rawString.length === 0) return;

        const nlState = this.checkStateChange();
        this.prepareTextLine(nlState);

        if (!this.currentLine) return;

        const fi = this.currentFontInfo;
        const { charCodes, unicodes } = pdfStringToCharacters(rawString, fi);
        const isTwoByte = fi?.isTwoByte ?? false;

        let dx = 0;
        for (let i = 0; i < charCodes.length; i++) {
            dx += this.processDrawChar(charCodes[i], unicodes[i], fi, isTwoByte);
        }

        this.curTx += dx;
        this.drawTx += dx;
    }

    private processDrawChar(code: number, unicode: string, fi: FontInfo | undefined, isTwoByte: boolean): number {
        if (!this.currentLine) return 0;
        const w = fi ? (fi.widths.get(code) ?? fi.defaultWidth) : 1000;
        const ddx = (w / 1000) * this.fontSize + this.charSpace;
        const isSpace = !isTwoByte && code === 0x20;
        const charWidth = ddx * this.drawTextScale * this.zoom;

        let cp = unicode.codePointAt(0) ?? code;
        const fixup = this.fontRegistry.getGlyphFixup(this.fontName, code);
        if (fixup !== undefined) cp = fixup;
        this.currentLine.appendUnicodes([cp], charWidth);

        const isUnicodeSpace = cp === 0x20;
        const spaceCount = (isSpace ? 1 : 0) - (isUnicodeSpace ? 1 : 0);
        if (spaceCount !== 0) {
            this.currentLine.appendOffset(
                this.wordSpace * this.drawTextScale * this.zoom * spaceCount,
            );
        }

        let advance = ddx * this.horizScaling;
        if (isSpace) advance += this.wordSpace * this.horizScaling;
        return advance;
    }

    // ── Operator Dispatch ────────────────────────────────────────────

    private dispatchOperators(
        tokens: ReadonlyArray<string>,
        resources: Record<string, PdfObject>,
        pageWidth: number,
        pageHeight: number,
    ): void {
        const operandStack: string[] = [];

        for (const tok of tokens) {

            // Operand: push to stack (strings start with '(', names with '/', numbers, etc.)
            if (this.isOperand(tok)) {
                operandStack.push(tok);
                continue;
            }

            // Operator: dispatch
            this.executeOperator(tok, operandStack, resources, pageWidth, pageHeight);
            operandStack.length = 0;
        }
    }

    private isOperand(tok: string): boolean {
        if (tok.startsWith('(') || tok.startsWith('/') || tok === '[' || tok === ']' ||
            tok === '<<' || tok === '>>') return true;
        if (tok === 'true' || tok === 'false' || tok === 'null') return true;
        const c = tok.codePointAt(0) ?? 0;
        // Numbers: digit, sign, or decimal point
        return (c >= 0x30 && c <= 0x39) || c === 0x2D || c === 0x2B || c === 0x2E;
    }

    private operatorMap: Map<string, OperatorHandler> | null = null;

    private registerGraphicsStateOps(m: Map<string, OperatorHandler>, noop: OperatorHandler): void {
        m.set('q', () => this.saveState());
        m.set('Q', () => this.restoreState());
        m.set('cm', (_op, ops) => this.opCm(ops));
        m.set('w', (_op, ops) => { if (ops.length >= 1) this.lineWidth = Number.parseFloat(ops[0]); });
        m.set('g', (_op, ops) => { this.fillColor = grayToHex(Number.parseFloat(ops[0] ?? '0')); this.fillColorChanged = true; });
        m.set('G', (_op, ops) => { this.strokeColor = grayToHex(Number.parseFloat(ops[0] ?? '0')); this.strokeColorChanged = true; });
        m.set('rg', (_op, ops) => this.opRg(ops, true));
        m.set('RG', (_op, ops) => this.opRg(ops, false));
        m.set('k', (_op, ops) => this.opK(ops, true));
        m.set('K', (_op, ops) => this.opK(ops, false));
        m.set('cs', (_op, ops, res) => this.opCs(ops, res));
        m.set('CS', (_op, ops, res) => this.opCs(ops, res));
        m.set('sc', (op, ops, res) => this.opSc(ops, op === 'sc' || op === 'scn', res));
        m.set('SC', (op, ops, res) => this.opSc(ops, op === 'sc' || op === 'scn', res));
        m.set('scn', (op, ops, res) => this.opSc(ops, op === 'sc' || op === 'scn', res));
        m.set('SCN', (op, ops, res) => this.opSc(ops, op === 'sc' || op === 'scn', res));
        m.set('Do', (_op, ops, res, pw, ph) => this.opDo(ops, res, pw, ph));
        m.set('gs', (_op, ops, res) => this.opGs(ops, res));
        for (const name of ['BMC', 'BDC', 'EMC', 'MP', 'DP', 'BI']) m.set(name, noop);
    }

    private registerTextOps(m: Map<string, OperatorHandler>, noop: OperatorHandler): void {
        m.set('Tf', (_op, ops) => this.opTf(ops));
        m.set('Tc', (_op, ops) => { this.charSpace = Number.parseFloat(ops[0] ?? '0'); this.letterSpaceChanged = true; });
        m.set('Tw', (_op, ops) => { this.wordSpace = Number.parseFloat(ops[0] ?? '0'); this.wordSpaceChanged = true; });
        m.set('Tz', (_op, ops) => { this.horizScaling = Number.parseFloat(ops[0] ?? '100') / 100; this.horizScaleChanged = true; });
        m.set('TL', (_op, ops) => { this.leading = Number.parseFloat(ops[0] ?? '0'); });
        m.set('Tr', (_op, ops) => { this.renderMode = Number.parseInt(ops[0] ?? '0', 10); this.fillColorChanged = true; this.strokeColorChanged = true; });
        m.set('Ts', (_op, ops) => { this.rise = Number.parseFloat(ops[0] ?? '0'); this.riseChanged = true; });
        m.set('BT', () => this.opBT());
        m.set('ET', noop);
        m.set('Td', (_op, ops) => this.opTd(ops));
        m.set('TD', (_op, ops) => this.opTD(ops));
        m.set('Tm', (_op, ops) => this.opTm(ops));
        m.set('T*', () => this.opTStar());
        m.set('Tj', (_op, ops) => this.opTj(ops));
        m.set('TJ', (_op, ops) => this.opTJ(ops));
        m.set('\'', (_op, ops) => { this.opTStar(); this.opTj(ops); });
        m.set('"', (_op, ops) => this.opQuoteDbl(ops));
    }

    private registerPathOps(m: Map<string, OperatorHandler>, noop: OperatorHandler): void {
        m.set('re', (_op, ops) => this.opRe(ops));
        m.set('m', (_op, ops) => this.opPathMove(ops));
        m.set('l', (_op, ops) => this.opPathLine(ops));
        m.set('c', (_op, ops) => this.opPathCurve(ops));
        m.set('v', (_op, ops) => this.opPathCurve2Points(ops));
        m.set('y', (_op, ops) => this.opPathCurve2Points(ops));
        m.set('h', noop);
        m.set('S', () => this.paintPath(true, false));
        m.set('s', () => this.paintPath(true, false));
        m.set('f', () => this.paintPath(false, true));
        m.set('F', () => this.paintPath(false, true));
        m.set('f*', () => this.paintPath(false, true));
        m.set('B', () => this.paintPath(true, true));
        m.set('B*', () => this.paintPath(true, true));
        m.set('b', () => this.paintPath(true, true));
        m.set('b*', () => this.paintPath(true, true));
        m.set('n', () => { this.pathPoints = []; this.generalPathPoints.length = 0; });
    }

    private getOperatorMap(): Map<string, OperatorHandler> {
        if (this.operatorMap) return this.operatorMap;
        const noop: OperatorHandler = () => { /* no-op */ };
        const m = new Map<string, OperatorHandler>();
        this.registerGraphicsStateOps(m, noop);
        this.registerTextOps(m, noop);
        this.registerPathOps(m, noop);
        this.operatorMap = m;
        return m;
    }

    private executeOperator(
        op: string,
        operands: ReadonlyArray<string>,
        resources: Record<string, PdfObject>,
        pageWidth: number,
        pageHeight: number,
    ): void {
        const handler = this.getOperatorMap().get(op);
        if (handler) handler(op, operands, resources, pageWidth, pageHeight);
    }

    // ── Operator implementations ─────────────────────────────────────

    private saveState(): void {
        this.stateStack.push({
            ctm: [...this.ctm], fillColor: this.fillColor, strokeColor: this.strokeColor,
            lineWidth: this.lineWidth, fontSize: this.fontSize, fontName: this.fontName,
            charSpace: this.charSpace, wordSpace: this.wordSpace, horizScaling: this.horizScaling,
            rise: this.rise, renderMode: this.renderMode, leading: this.leading,
            textMatrix: [...this.textMatrix], lineMatrix: [...this.lineMatrix],
        });
    }

    private restoreState(): void {
        const saved = this.stateStack.pop();
        if (!saved) return;
        this.ctm = saved.ctm; this.ctmChanged = true;
        this.fillColor = saved.fillColor; this.fillColorChanged = true;
        this.strokeColor = saved.strokeColor; this.strokeColorChanged = true;
        this.lineWidth = saved.lineWidth;
        this.fontSize = saved.fontSize; this.fontName = saved.fontName; this.fontChanged = true;
        this.charSpace = saved.charSpace; this.letterSpaceChanged = true;
        this.wordSpace = saved.wordSpace; this.wordSpaceChanged = true;
        this.horizScaling = saved.horizScaling; this.horizScaleChanged = true;
        this.rise = saved.rise; this.riseChanged = true;
        this.renderMode = saved.renderMode;
        this.leading = saved.leading;
        this.textMatrix = saved.textMatrix; this.lineMatrix = saved.lineMatrix;
        this.textMatChanged = true;
    }

    private initialYScale = 0;

    private opCm(operands: ReadonlyArray<string>): void {
        if (operands.length < 6) return;
        const m = operands.map(Number.parseFloat);
        // Detect Y-flip on the FIRST cm that has negative d-component.
        // Store the absolute d value as the initial Y scale factor for
        // coordinate correction in assemblePageHtml.
        if (this.initialYScale === 0 && m[3] < 0 && m[1] === 0 && m[2] === 0) {
            this.initialYScale = Math.abs(m[3]);
        }
        this.ctm = multiplyMatrix(this.ctm, m);
        this.ctmChanged = true;
    }

    private opRg(operands: ReadonlyArray<string>, isFill: boolean): void {
        if (operands.length < 3) return;
        const hex = rgbToHex(
            Number.parseFloat(operands[0]),
            Number.parseFloat(operands[1]),
            Number.parseFloat(operands[2]),
        );
        if (isFill) { this.fillColor = hex; this.fillColorChanged = true; }
        else { this.strokeColor = hex; this.strokeColorChanged = true; }
    }

    private opK(operands: ReadonlyArray<string>, isFill: boolean): void {
        if (operands.length < 4) return;
        const hex = cmykToHex(
            Number.parseFloat(operands[0]), Number.parseFloat(operands[1]),
            Number.parseFloat(operands[2]), Number.parseFloat(operands[3]),
        );
        if (isFill) { this.fillColor = hex; this.fillColorChanged = true; }
        else { this.strokeColor = hex; this.strokeColorChanged = true; }
    }

    private opCs(operands: ReadonlyArray<string>, _resources: Record<string, PdfObject>): void {
        const name = operands[0]?.startsWith('/') ? operands[0].substring(1) : operands[0] ?? '';
        this.fillColorSpaceIsPattern = name === 'Pattern';
        if (!this.fillColorSpaceIsPattern) this.patternFillImage = null;
    }

    private extractPatternImage(patternName: string, resources: Record<string, PdfObject>): string | null {
        const patterns = resources['Pattern'] ? this.reader.getDict(resources['Pattern']) : {};
        const patRef = patterns[patternName];
        if (!patRef) return null;
        const patDict = this.reader.getDict(patRef);
        // Only handle tiling patterns with image XObjects
        const patType = patDict['PatternType'] ? this.reader.getNumber(patDict['PatternType']) : 0;
        if (patType !== 1) return null;
        const patRes = patDict['Resources'] ? this.reader.getDict(patDict['Resources']) : {};
        const patXObj = patRes['XObject'] ? this.reader.getDict(patRes['XObject']) : {};
        for (const [, imgRef] of Object.entries(patXObj)) {
            const imgDict = this.reader.getDict(imgRef);
            const subtype = this.reader.getString(imgDict['Subtype']);
            if (subtype !== 'Image') continue;
            const w = this.reader.getNumber(imgDict['Width']);
            const h = this.reader.getNumber(imgDict['Height']);
            if (w <= 0 || h <= 0) continue;
            const resolved = this.reader.resolveDeep(imgRef);
            const filterName = resolveImageFilterName(this.reader, imgDict);
            return buildImageDataUrl(filterName, resolved, this.reader, w, h, imgDict);
        }
        return null;
    }

    private applyFillColor(hex: string): void {
        this.fillColor = hex;
        this.fillColorChanged = true;
    }

    private applyStrokeColor(hex: string): void {
        this.strokeColor = hex;
        this.strokeColorChanged = true;
    }

    private tryApplyPatternFill(operands: ReadonlyArray<string>, resources: Record<string, PdfObject>): boolean {
        if (!this.fillColorSpaceIsPattern) return false;
        const name = operands[0].startsWith('/') ? operands[0].substring(1) : operands[0];
        const img = this.extractPatternImage(name, resources);
        if (!img) return false;
        this.patternFillImage = img;
        return true;
    }

    private opSc(operands: ReadonlyArray<string>, isFill: boolean, resources: Record<string, PdfObject>): void {
        if (operands.length >= 3) {
            const hex = rgbToHex(
                Number.parseFloat(operands[0]),
                Number.parseFloat(operands[1]),
                Number.parseFloat(operands[2]),
            );
            if (isFill) this.applyFillColor(hex); else this.applyStrokeColor(hex);
            return;
        }
        if (operands.length < 1) return;
        if (isFill && this.tryApplyPatternFill(operands, resources)) return;
        const hex = grayToHex(Number.parseFloat(operands[0]));
        if (isFill) this.applyFillColor(hex); else this.applyStrokeColor(hex);
    }

    private opTf(operands: ReadonlyArray<string>): void {
        if (operands.length < 2) return;
        const name = operands[0].startsWith('/') ? operands[0].substring(1) : operands[0];
        this.fontName = name;
        this.fontSize = Number.parseFloat(operands[1]);
        this.fontChanged = true;
    }

    private opBT(): void {
        // BT resets text matrix to identity (PDF spec 9.4.1).
        // Critical: sync drawTx/drawTy with the OUTPUT position of the previous text
        // so tryMergePosition computes correct small offsets between BT blocks,
        // not huge negatives from stale curTx/drawTx values.
        // The curTextTm * (curTx, curTy) gives the current output position;
        // after resetting textMatrix, curTx=0 maps through the new identity matrix.
        // We must set drawTx/drawTy so that oldTm * (drawTx, drawTy) + oldTm[4,5]
        // equals curTextTm * (curTx, curTy) + curTextTm[4,5] from before the reset.
        this.drawTx = this.curTx;
        this.drawTy = this.curTy;
        this.textMatrix = [1, 0, 0, 1, 0, 0];
        this.lineMatrix = [1, 0, 0, 1, 0, 0];
        this.curTx = 0;
        this.curTy = 0;
        this.textMatChanged = true;
    }

    private opTd(operands: ReadonlyArray<string>): void {
        if (operands.length < 2) return;
        const tx = Number.parseFloat(operands[0]);
        const ty = Number.parseFloat(operands[1]);
        this.lineMatrix = multiplyMatrix([1, 0, 0, 1, tx, ty], this.lineMatrix);
        this.textMatrix = [...this.lineMatrix];
        this.curTx = 0;
        this.curTy = 0;
        this.textMatChanged = true;
    }

    private opTD(operands: ReadonlyArray<string>): void {
        if (operands.length < 2) return;
        this.leading = -Number.parseFloat(operands[1]);
        this.opTd(operands);
    }

    private opTm(operands: ReadonlyArray<string>): void {
        if (operands.length < 6) return;
        const m = operands.map(Number.parseFloat);
        this.textMatrix = m;
        this.lineMatrix = [...m];
        this.curTx = 0;
        this.curTy = 0;
        this.textMatChanged = true;
    }

    private opTStar(): void {
        this.opTd(['0', (-this.leading).toString()]);
    }

    private opTj(operands: ReadonlyArray<string>): void {
        if (operands.length < 1) return;
        const raw = operands[0];
        if (raw.startsWith('(') && raw.endsWith(')')) {
            this.drawString(raw.substring(1, raw.length - 1));
        }
    }

    private opTJ(operands: ReadonlyArray<string>): void {
        // Parse TJ array from operand stack
        // Operands contain the tokens between [ and ]
        for (const tok of operands) {
            if (tok.startsWith('(') && tok.endsWith(')')) {
                this.drawString(tok.substring(1, tok.length - 1));
            } else if (tok !== '[' && tok !== ']') {
                const kern = Number.parseFloat(tok);
                if (!Number.isNaN(kern) && Math.abs(kern) > PP_EPS) {
                    // TJ kern: subtract from text position (PDF spec 9.4.4)
                    const displacement = (kern / 1000) * this.fontSize;
                    this.textMatrix[4] -= displacement * this.horizScaling;
                    this.textMatChanged = true;
                }
            }
        }
    }

    private opQuoteDbl(operands: ReadonlyArray<string>): void {
        if (operands.length < 3) return;
        this.wordSpace = Number.parseFloat(operands[0]);
        this.wordSpaceChanged = true;
        this.charSpace = Number.parseFloat(operands[1]);
        this.letterSpaceChanged = true;
        this.opTStar();
        this.opTj([operands[2]]);
    }

    private opRe(operands: ReadonlyArray<string>): void {
        if (operands.length < 4) return;
        this.pathPoints = operands.map(Number.parseFloat);
    }

    private opPathMove(operands: ReadonlyArray<string>): void {
        if (operands.length < 2) return;
        const x = Number.parseFloat(operands[0]);
        const y = Number.parseFloat(operands[1]);
        const p = transformPoint(x, y, this.ctm);
        this.generalPathPoints.push(p);
    }

    private opPathLine(operands: ReadonlyArray<string>): void {
        if (operands.length < 2) return;
        const p = transformPoint(Number.parseFloat(operands[0]), Number.parseFloat(operands[1]), this.ctm);
        this.generalPathPoints.push(p);
    }

    private opPathCurve(operands: ReadonlyArray<string>): void {
        if (operands.length < 6) return;
        this.generalPathPoints.push(
            transformPoint(Number.parseFloat(operands[0]), Number.parseFloat(operands[1]), this.ctm),
            transformPoint(Number.parseFloat(operands[2]), Number.parseFloat(operands[3]), this.ctm),
            transformPoint(Number.parseFloat(operands[4]), Number.parseFloat(operands[5]), this.ctm),
        );
    }

    private opPathCurve2Points(operands: ReadonlyArray<string>): void {
        if (operands.length < 4) return;
        this.generalPathPoints.push(
            transformPoint(Number.parseFloat(operands[0]), Number.parseFloat(operands[1]), this.ctm),
            transformPoint(Number.parseFloat(operands[2]), Number.parseFloat(operands[3]), this.ctm),
        );
    }

    private paintPath(stroked: boolean, filled: boolean): void {
        if (this.tryPaintPatternFill(filled)) return;

        const scaledLineWidth = this.lineWidth;
        this.emitReRect(stroked, filled, scaledLineWidth);
        this.emitGeneralPathRect(stroked, filled, scaledLineWidth);
        this.pathPoints = [];
        this.generalPathPoints.length = 0;
    }

    private tryPaintPatternFill(filled: boolean): boolean {
        if (!filled || !this.patternFillImage || this.generalPathPoints.length === 0) return false;

        const bbox = computePointsBBox(this.generalPathPoints);
        if (bbox.w > 1 && bbox.h > 1) {
            this.imageItems.push({
                dataUrl: this.patternFillImage,
                width: Math.round(bbox.w), height: Math.round(bbox.h),
                renderWidth: bbox.w, renderHeight: bbox.h,
                x: bbox.minX, y: bbox.minY,
            });
        }
        this.patternFillImage = null;
        this.pathPoints = [];
        this.generalPathPoints.length = 0;
        return true;
    }

    private emitReRect(stroked: boolean, filled: boolean, scaledLineWidth: number): void {
        if (this.pathPoints.length < 4) return;
        const [rx, ry, rw, rh] = this.pathPoints;
        const p1 = transformPoint(rx, ry, this.ctm);
        const p2 = transformPoint(rx + rw, ry + rh, this.ctm);
        this.pathRects.push({
            x: Math.min(p1.tx, p2.tx), y: Math.min(p1.ty, p2.ty),
            width: Math.abs(p2.tx - p1.tx), height: Math.abs(p2.ty - p1.ty),
            stroked, filled,
            strokeColor: this.strokeColor, fillColor: this.fillColor,
            lineWidth: scaledLineWidth, borderRadius: 0,
        });
    }

    private emitGeneralPathRect(stroked: boolean, filled: boolean, scaledLineWidth: number): void {
        if (this.generalPathPoints.length === 0) return;

        const bbox = computePointsBBox(this.generalPathPoints);
        let { w, h } = bbox;

        if (h < 2 && w >= 1) h = Math.max(h, scaledLineWidth);
        if (w < 2 && h >= 1) w = Math.max(w, scaledLineWidth);
        if (w < 1 && h < 1) return;

        const radius = estimateBorderRadius(this.generalPathPoints, bbox.minX, bbox.maxX, w, h);
        this.pathRects.push({
            x: bbox.minX, y: bbox.minY, width: w, height: h,
            stroked, filled,
            strokeColor: this.strokeColor, fillColor: this.fillColor,
            lineWidth: scaledLineWidth, borderRadius: radius,
        });
    }

    private opDo(
        operands: ReadonlyArray<string>,
        resources: Record<string, PdfObject>,
        pageWidth: number,
        pageHeight: number,
    ): void {
        if (operands.length < 1) return;
        const name = operands[0].startsWith('/') ? operands[0].substring(1) : operands[0];
        const xobjectDict = resources['XObject'] ? this.reader.getDict(resources['XObject']) : {};
        const ref = xobjectDict[name];
        if (!ref) return;

        const objDict = this.reader.getDict(ref);
        const subtype = this.reader.getString(objDict['Subtype']);

        if (subtype === 'Form') {
            this.processFormXObject(ref, resources, pageWidth, pageHeight);
        } else if (subtype === 'Image') {
            this.processImageXObject(ref, objDict);
        }
    }

    private processFormXObject(
        ref: PdfObject,
        parentResources: Record<string, PdfObject>,
        pageWidth: number,
        pageHeight: number,
    ): void {
        const objDict = this.reader.getDict(ref);
        const formResources = objDict['Resources']
            ? this.reader.getDict(objDict['Resources'])
            : parentResources;

        // Register fonts from form resources
        const fontDict = formResources['Font'] ? this.reader.getDict(formResources['Font']) : {};
        for (const [fname, fref] of Object.entries(fontDict)) {
            if (!this.fontInfoMap.has(fname)) {
                this.fontRegistry.registerFont(this.reader, fname, fref);
                this.fontInfoMap.set(fname, buildFontInfo(this.reader, fref));
            }
        }

        // Apply form matrix
        const savedCtm = [...this.ctm];
        if (objDict['Matrix']) {
            const matrix = this.reader.getArray(objDict['Matrix']).map(o => this.reader.getNumber(o));
            if (matrix.length >= 6) {
                this.ctm = multiplyMatrix(this.ctm, matrix);
                this.ctmChanged = true;
            }
        }

        try {
            const data = this.reader.getStreamData(ref);
            if (data.length > 0) {
                const tokens = tokenizeContentStream(data);
                this.dispatchOperators(tokens, formResources, pageWidth, pageHeight);
            }
        } catch { /* skip malformed form XObjects */ }

        this.ctm = savedCtm;
        this.ctmChanged = true;
    }

    private processImageXObject(ref: PdfObject, objDict: Record<string, PdfObject>): void {
        try {
            const imgWidth = objDict['Width'] ? this.reader.getNumber(objDict['Width']) : 0;
            const imgHeight = objDict['Height'] ? this.reader.getNumber(objDict['Height']) : 0;
            if (imgWidth <= 0 || imgHeight <= 0) return;

            const data = this.reader.getStreamData(ref);
            if (data.length === 0) return;

            const filterName = resolveImageFilterName(this.reader, objDict);
            let dataUrl: string | null = null;

            if (filterName === 'DCTDecode') {
                dataUrl = `data:image/jpeg;base64,${uint8ToBase64(data)}`;
            } else if (filterName === 'JPXDecode') {
                dataUrl = `data:image/jp2;base64,${uint8ToBase64(data)}`;
            } else {
                // Raw pixel data — use pdf-parser's full decoder (color spaces, PNG encoding)
                dataUrl = buildImageDataUrl(filterName, ref, this.reader, imgWidth, imgHeight, objDict);
            }
            if (!dataUrl) return;

            // Image placement: CTM maps unit square to image position
            const p1 = transformPoint(0, 0, this.ctm);
            const p2 = transformPoint(1, 1, this.ctm);
            const x = Math.min(p1.tx, p2.tx);
            const y = Math.min(p1.ty, p2.ty);
            const renderWidth = Math.abs(p2.tx - p1.tx);
            const renderHeight = Math.abs(p2.ty - p1.ty);

            this.imageItems.push({
                dataUrl,
                width: imgWidth,
                height: imgHeight,
                renderWidth,
                renderHeight,
                x, y,
            });
        } catch { /* skip malformed images */ }
    }

    private opGs(operands: ReadonlyArray<string>, resources: Record<string, PdfObject>): void {
        if (operands.length < 1) return;
        const name = operands[0].startsWith('/') ? operands[0].substring(1) : operands[0];
        const extGState = resources['ExtGState'] ? this.reader.getDict(resources['ExtGState']) : {};
        const gsRef = extGState[name];
        if (!gsRef) return;

        const gsDict = this.reader.getDict(gsRef);
        if (gsDict['Font']) {
            const fontArr = this.reader.getArray(gsDict['Font']);
            if (fontArr.length >= 2) {
                const fontObjDict = this.reader.getDict(fontArr[0]);
                const baseFontName = this.reader.getString(fontObjDict['BaseFont']) || '';
                if (baseFontName) { this.fontName = baseFontName; this.fontChanged = true; }
                this.fontSize = this.reader.getNumber(fontArr[1]);
            }
        }
    }

    // ── Helper methods ───────────────────────────────────────────────

    private resolveSpaceCode(fi: FontInfo | null | undefined): number {
        if (!fi?.isTwoByte) return 0x20;
        for (const [cid, uni] of fi.toUnicode) {
            if ((uni.codePointAt(0) ?? 0) === 0x20) return cid;
        }
        return 0x20;
    }

    private buildTextState(): TextState {
        const fi = this.currentFontInfo;
        const entry = this.fontRegistry.getEntry(this.fontName);
        const spaceCode = this.resolveSpaceCode(fi);
        const spaceW = fi ? (fi.widths.get(spaceCode) ?? fi.defaultWidth) : 1000;
        return {
            fontName: this.fontName,
            fontFamily: fi?.familyName ?? entry?.familyName ?? '',
            fontSize: this.curFontSize,
            fillColor: this.curFillColor,
            strokeColor: this.curStrokeColor,
            letterSpace: this.curLetterSpace,
            wordSpace: this.curWordSpace,
            verticalAlign: this.curVerticalAlign,
            bold: fi?.isBold ?? false,
            italic: fi?.isItalic ?? false,
            textRenderMode: this.renderMode,
            horizontalScaling: this.horizScaling * 100,
            spaceWidth: spaceW,
            fontAscent: entry?.ascent ?? 0.8,
            fontDescent: entry?.descent ?? -0.2,
        };
    }

    private updateLastStateStartIdx(): void {
        if (!this.currentLine) return;
        const lastState = this.currentLine.states.at(-1);
        if (lastState && !lastState.installed) {
            (lastState as { installed: LineStyleState | null }).installed = {
                startIdx: this.currentLine.text.length,
                fontId: 0, fontSizeId: 0, fillColorId: 0, strokeColorId: 0,
                letterSpaceId: 0, wordSpaceId: 0, verticalAlignId: 0,
                bold: lastState.textState.bold,
                italic: lastState.textState.italic,
                embedded: false, hasStroke: false,
                horizontalScaling: lastState.textState.horizontalScaling,
                verticalAlignIsZero: true,
                wordSpaceFree: false,
            };
        }
    }

    private tryAppendStream(s: PdfObject, parts: Uint8Array[]): void {
        try {
            const data = this.reader.getStreamData(s);
            parts.push(data, new Uint8Array([0x20]));
        } catch { /* skip */ }
    }

    private resolveResources(pageDict: Record<string, PdfObject>): Record<string, PdfObject> {
        return pageDict['Resources'] ? this.reader.getDict(pageDict['Resources']) : {};
    }

    private resolveContentData(pageDict: Record<string, PdfObject>): Uint8Array {
        const contentsRef = pageDict['Contents'];
        if (!contentsRef) return new Uint8Array(0);

        try {
            // Contents can be a single stream or an array of streams
            const contentsObj = this.reader.resolveDeep(contentsRef);
            if (contentsObj.type === 'array') {
                const streams = this.reader.getArray(contentsRef);
                const parts: Uint8Array[] = [];
                for (const s of streams) {
                    this.tryAppendStream(s, parts);
                }
                const totalLen = parts.reduce((sum, p) => sum + p.length, 0);
                const combined = new Uint8Array(totalLen);
                let offset = 0;
                for (const p of parts) {
                    combined.set(p, offset);
                    offset += p.length;
                }
                return combined;
            }
            return this.reader.getStreamData(contentsRef);
        } catch {
            return new Uint8Array(0);
        }
    }

    private extractAnnotations(
        pageDict: Record<string, PdfObject>,
        _pageHeight: number,
    ): PdfAnnotation[] {
        const annotsRef = pageDict['Annots'];
        if (!annotsRef) return [];

        const annotations: PdfAnnotation[] = [];
        try {
            const annots = this.reader.getArray(annotsRef);
            for (const annotRef of annots) {
                this.tryExtractLinkAnnotation(annotRef, annotations);
            }
        } catch { /* skip */ }
        return annotations;
    }

    private tryExtractLinkAnnotation(annotRef: PdfObject, annotations: PdfAnnotation[]): void {
        try {
            const annotDict = this.reader.getDict(annotRef);
            if (this.reader.getString(annotDict['Subtype']) !== 'Link') return;
            const aRef = annotDict['A'];
             
            const uri = aRef ? this.reader.getString(this.reader.getDict(aRef)['URI']) || '' : '';
            if (!uri) return;
            const rectArr = annotDict['Rect'] ? this.reader.getArray(annotDict['Rect']) : [];
            if (rectArr.length < 4) return;
            const nums = rectArr.map(o => this.reader.getNumber(o));
            const x = Math.min(nums[0], nums[2]), y = Math.min(nums[1], nums[3]);
            const w = Math.abs(nums[2] - nums[0]), h = Math.abs(nums[3] - nums[1]);
            annotations.push({ x, y, width: w, height: h, uri });
        } catch { /* skip malformed annotations */ }
    }
}

// ── Graphics Rendering ────────────────────────────────────────────────

function computePointsBBox(points: ReadonlyArray<{ tx: number; ty: number }>): {
    minX: number; minY: number; maxX: number; maxY: number; w: number; h: number;
} {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
        if (p.tx < minX) minX = p.tx;
        if (p.ty < minY) minY = p.ty;
        if (p.tx > maxX) maxX = p.tx;
        if (p.ty > maxY) maxY = p.ty;
    }
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

function estimateBorderRadius(
    points: ReadonlyArray<{ tx: number; ty: number }>,
    minX: number, maxX: number, w: number, h: number,
): number {
    if (w < 5 || h < 5) return 0;
    const edgeTol = 0.5;
    const quarterW = w * 0.3;
    let radius = 0;
    for (const p of points) {
        const xInset = Math.min(p.tx - minX, maxX - p.tx);
        if (xInset > edgeTol && xInset < quarterW && xInset > radius) {
            radius = xInset;
        }
    }
    return Math.min(radius, w / 2, h / 2);
}

function renderFilledRect(rect: PathRect, z: number): string {
    const left = round(rect.x * z);
    const bottom = round(rect.y * z);
    const w = round(rect.width * z);
    const h = round(rect.height * z);
    const br = rect.borderRadius > 0 ? `border-radius:${round(rect.borderRadius * z)}px;` : '';
    return `<div style="position:absolute;left:${left}px;bottom:${bottom}px;` +
        `width:${w}px;height:${h}px;background-color:${rect.fillColor};${br}"></div>`;
}

function renderStrokedRect(rect: PathRect, z: number): string {
    const left = round(rect.x * z);
    const bottom = round(rect.y * z);
    const w = round(rect.width * z);
    const h = round(rect.height * z);
    // PDF points are 1/72 inch; CSS pixels are 1/96 inch.
    // Scale by 4/3 and round UP to ensure lines render at the intended
    // thickness (browsers round sub-pixel border widths DOWN).
    const PDF_TO_CSS_PX = 4 / 3;
    const lw = Math.max(Math.ceil(rect.lineWidth * z * PDF_TO_CSS_PX), 1);
    const isHorizontalLine = rect.height < 2;
    const isVerticalLine = rect.width < 2;

    if (isHorizontalLine) {
        return `<div style="position:absolute;left:${left}px;bottom:${bottom}px;` +
            `width:${w}px;border-top:${lw}px solid ${rect.strokeColor};"></div>`;
    }
    if (isVerticalLine) {
        return `<div style="position:absolute;left:${left}px;bottom:${bottom}px;` +
            `height:${h}px;border-left:${lw}px solid ${rect.strokeColor};"></div>`;
    }
    const br = rect.borderRadius > 0 ? `border-radius:${round(rect.borderRadius * z)}px;` : '';
    return `<div style="position:absolute;left:${left}px;bottom:${bottom}px;` +
        `width:${w}px;height:${h}px;border:${lw}px solid ${rect.strokeColor};box-sizing:border-box;${br}"></div>`;
}

function renderImage(img: ImageItem, z: number): string {
    const left = round(img.x * z);
    const bottom = round(img.y * z);
    const w = round(img.renderWidth * z);
    const h = round(img.renderHeight * z);
    return `<img class="bi" style="position:absolute;left:${left}px;bottom:${bottom}px;` +
        `width:${w}px;height:${h}px;" src="${img.dataUrl}"/>`;
}

function renderAnnotation(ann: PdfAnnotation, z: number): string {
    const left = round(ann.x * z);
    const bottom = round(ann.y * z);
    const w = round(ann.width * z);
    const h = round(ann.height * z);
    return `<a class="l" href="${escapeHtml(ann.uri)}">` +
        `<div style="position:absolute;left:${left}px;bottom:${bottom}px;` +
        `width:${w}px;height:${h}px;background-color:rgba(255,255,255,0.000001);border-style:none;"></div></a>`;
}

// ── Page Assembly ─────────────────────────────────────────────────────

function extractLineText(line: TextLine, z: number): string {
    const offsetMap = new Map<number, number>();
    for (const off of line.offsets) {
        offsetMap.set(off.startIdx, off.width);
    }
    const emSize = (line.states.length > 0 ? line.states[0].textState.fontSize : 12) * z;
    const threshold = emSize * SPACE_THRESHOLD;
    let lineText = '';
    for (let ci = 0; ci < line.text.length; ci++) {
        const off = offsetMap.get(ci);
        if (off !== undefined && off >= threshold) lineText += ' ';
        const cp = line.text[ci];
        if (cp > 0) lineText += String.fromCodePoint(cp);
    }
    return lineText.trim();
}

function extractTextFromLines(lines: ReadonlyArray<TextLine>, z: number): string {
    const lineParts: string[] = [];
    for (const line of lines) {
        const text = extractLineText(line, z);
        if (text) lineParts.push(text);
    }
    return lineParts.join('\n');
}

function fixYFlippedCoordinates(result: ProcessedPage): void {
    const { initialYScale, lines, imageItems } = result;
    if (initialYScale <= 0 || initialYScale >= 1) return;
    for (const line of lines) {
        if (line.y < 0) line.y = Math.abs(line.y) * initialYScale;
    }
    for (const img of imageItems) {
        if (img.y < 0) (img as { y: number }).y = Math.abs(img.y) * initialYScale;
    }
}

function buildPageContentHtml(
    result: ProcessedPage, pageIndex: number,
    mgr: AllStateManager, fontRegistry: FontRegistry, z: number,
    scaledWidth: number, scaledHeight: number,
): string {
    const htmlParts: string[] = [];
    htmlParts.push(
        `<div id="pf${pageIndex + 1}" class="pf" style="width:${round(scaledWidth)}px;height:${round(scaledHeight)}px;" data-page-no="${pageIndex + 1}">`,
        `<div class="pc pc${pageIndex + 1}">`,
    );

    for (const rect of result.pathRects) {
        if (rect.filled && rect.fillColor) htmlParts.push(renderFilledRect(rect, z));
        if (rect.stroked && rect.strokeColor) htmlParts.push(renderStrokedRect(rect, z));
    }
    for (const img of result.imageItems) htmlParts.push(renderImage(img, z));
    for (const line of result.lines) {
        const lineHtml = line.dumpText(mgr, fontRegistry, H_EPS, SPACE_THRESHOLD, z);
        if (lineHtml) htmlParts.push(lineHtml);
    }
    for (const ann of result.annotations) {
        if (ann.uri) htmlParts.push(renderAnnotation(ann, z));
    }

    htmlParts.push('</div>', '</div>');
    return htmlParts.join('\n');
}

function assemblePageHtml(
    result: ProcessedPage,
    pageIndex: number,
    mgr: AllStateManager,
    fontRegistry: FontRegistry,
    z: number,
): PixelPerfectPage {
    fixYFlippedCoordinates(result);

    const scaledWidth = result.pageWidth * z;
    const scaledHeight = result.pageHeight * z;

    const text = extractTextFromLines(result.lines, z);

    for (const line of result.lines) {
        line.prepare(mgr, fontRegistry, z);
        line.optimizeNormal(mgr, H_EPS, SPACE_THRESHOLD, z);
    }

    return {
        html: buildPageContentHtml(result, pageIndex, mgr, fontRegistry, z, scaledWidth, scaledHeight),
        text,
        pageIndex,
        pageWidth: scaledWidth,
        pageHeight: scaledHeight,
    };
}

// ── Main Entry Point ──────────────────────────────────────────────────

export async function renderPixelPerfectPaged(buffer: ArrayBuffer, options?: PixelPerfectOptions): Promise<PixelPerfectPagedResult> {
    const header = new Uint8Array(buffer, 0, Math.min(5, buffer.byteLength));
    if (header.length < 5 ||
        header[0] !== 0x25 || header[1] !== 0x50 || header[2] !== 0x44 ||
        header[3] !== 0x46 || header[4] !== 0x2D) {
        throw new Error('Not a valid PDF file.');
    }

    const reader = new PdfReader(buffer);
    try {
        reader.parse();
    } catch {
        throw new Error('Unable to read this PDF. It may be corrupted or use an unsupported format.');
    }

    if (reader.isEncrypted()) {
        throw new Error('Encrypted PDFs are not supported.');
    }

    const pdfPages = reader.getPages();
    if (pdfPages.length === 0) {
        throw new Error('PDF contains no pages.');
    }

    const zoom = options?.zoom ?? DEFAULT_ZOOM;
    const mgr = new AllStateManager();
    const fontRegistry = new FontRegistry();
    const pages: PixelPerfectPage[] = [];
    const processor = new PixelPerfectProcessor(reader, fontRegistry, zoom);

    for (let i = 0; i < pdfPages.length; i++) {
        try {
            const result = processor.processPage(pdfPages[i], i);
            const page = assemblePageHtml(result, i, mgr, fontRegistry, zoom);
            pages.push(page);
        } catch {
            pages.push({
                html: `<div id="pf${i + 1}" class="pf" style="width:612px;height:792px;" data-page-no="${i + 1}"><div class="pc pc${i + 1}"></div></div>`,
                text: '',
                pageIndex: i,
                pageWidth: 612,
                pageHeight: 792,
            });
        }
    }

    const fontFaceCss = fontRegistry.dumpFontFaceCss();
    const fontFamilyCss = fontRegistry.dumpFontFamilyCss();
    const globalCss = BASE_CSS + '\n' + fontFaceCss + '\n' + fontFamilyCss + '\n' + mgr.dumpAllCss();

    return {
        pages,
        totalPages: pages.length,
        globalCss,
    };
}

export function toStandaloneHtml(result: PixelPerfectPagedResult): string {
    const pageHtml = result.pages.map(p => p.html).join('\n');
    return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8"/>
<meta name="generator" content="pdf-pixel-perfect-ts"/>
<style type="text/css">
${result.globalCss}
</style>
</head>
<body>
<div id="page-container">
${pageHtml}
</div>
</body>
</html>`;
}
