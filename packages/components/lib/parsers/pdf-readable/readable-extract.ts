import {
    PdfReader,
    type PdfObject,
    type TextItem,
    deduplicateTextItems,
    extractPageContent,
    parseStructureTree,
} from '../pdf-parser';
import type { FontRegistry } from '../pdf-pixel-perfect';
import type { ExtractedDocument, FontMapping, PageExtract } from './readable-types';

const MAX_RESOURCE_DEPTH = 3;

/**
 * Extracts text/image/path/annotation data for every page and registers all
 * reachable fonts with the given registry (page resources plus nested form
 * XObject resources).
 *
 * The font map is keyed by resource name document-wide (inherited from
 * FontRegistry's `entriesByResourceName`): if two pages bind the same name
 * (e.g. `/F1`) to different font objects, the first binding wins for family
 * lookup. `TextItem.fontName` falls back to BaseFont matching in
 * `FontRegistry.getEntry`, which limits the practical impact.
 */
export function extractDocument(
    reader: PdfReader,
    pages: PdfObject[],
    registry: FontRegistry | null,
): ExtractedDocument {
    const structure = parseStructureTree(reader, pages);
    const fonts = new Map<string, FontMapping>();
    const pageExtracts: PageExtract[] = [];

    for (let i = 0; i < pages.length; i++) {
        const extract = extractSinglePage(reader, pages[i], i);
        if (extract) pageExtracts.push(extract);
        if (registry) registerPageFonts(reader, pages[i], registry, fonts);
    }

    if (registry) correctItemAdvances(pageExtracts, registry);
    return { pages: pageExtracts, structure, fonts };
}

/**
 * Rewrites each glyph run's right edge from the embedded font program's real
 * advances instead of the PDF `/Widths` array. Subset fonts frequently ship a
 * `/Widths` (or `defaultWidth`) that overshoots the true advance, so the
 * `endX` from {@link extractPageContent} runs long and collapses the small
 * positive inter-word gaps into overlaps — words merge. The registry's
 * advances (the same metrics the pixel-perfect renderer positions with)
 * restore accurate gaps. Runs whose glyphs are not all known to the registry
 * keep their original `endX`.
 */
function correctItemAdvances(pages: readonly PageExtract[], registry: GlyphAdvanceSource): void {
    for (const page of pages) {
        for (const item of page.items) {
            const width = embeddedRunWidth(item, registry);
            if (width !== null) item.endX = item.x + width;
        }
    }
}

/** The one {@link FontRegistry} capability the advance correction needs. */
export interface GlyphAdvanceSource {
    getGlyphAdvance(fontName: string, code: number, unicode?: string): number | null;
}

/** Width in points of a glyph run from the embedded font advances, or null when
 *  any glyph is unknown to the registry (leave the original `endX`). */
export function embeddedRunWidth(item: TextItem, registry: GlyphAdvanceSource): number | null {
    let advance = 0;
    let spaces = 0;
    for (const ch of item.text) {
        const code = ch === ' ' ? 32 : -1;
        const glyph = registry.getGlyphAdvance(item.fontName, code, ch);
        if (glyph === null) return null;
        advance += glyph;
        if (ch === ' ') spaces++;
    }
    const scale = item.horizontalScaling > 0 ? item.horizontalScaling / 100 : 1;
    return (advance / 1000) * item.fontSize * scale +
        [...item.text].length * item.charSpacing + spaces * item.wordSpacing;
}

function extractSinglePage(
    reader: PdfReader,
    pageObj: PdfObject,
    index: number,
): PageExtract | null {
    try {
        const { textItems, imageItems, pathRects, pageWidth, pageHeight, annotations } =
            extractPageContent(reader, pageObj, index);
        return {
            index,
            width: pageWidth,
            height: pageHeight,
            items: deduplicateTextItems(textItems),
            images: imageItems,
            rects: pathRects,
            annotations,
        };
    } catch {
        return null;
    }
}

function registerPageFonts(
    reader: PdfReader,
    pageObj: PdfObject,
    registry: FontRegistry,
    fonts: Map<string, FontMapping>,
): void {
    try {
        const pageDict = reader.getDict(pageObj);
        const resources = pageDict['Resources'] ? reader.getDict(pageDict['Resources']) : {};
        registerResourceFonts(reader, resources, registry, fonts, 0);
    } catch {
        // A malformed resource dict must not abort the page's text extraction.
    }
}

function registerResourceFonts(
    reader: PdfReader,
    resources: Record<string, PdfObject>,
    registry: FontRegistry,
    fonts: Map<string, FontMapping>,
    depth: number,
): void {
    if (depth > MAX_RESOURCE_DEPTH) return;
    registerFontDict(reader, resources, registry, fonts);
    descendIntoXObjects(reader, resources, registry, fonts, depth);
}

function registerFontDict(
    reader: PdfReader,
    resources: Record<string, PdfObject>,
    registry: FontRegistry,
    fonts: Map<string, FontMapping>,
): void {
    if (!resources['Font']) return;
    const fontDict = reader.getDict(resources['Font']);
    for (const [name, ref] of Object.entries(fontDict)) {
        if (fonts.has(name)) continue;
        registerSingleFont(reader, name, ref, registry, fonts);
    }
}

function registerSingleFont(
    reader: PdfReader,
    name: string,
    ref: PdfObject,
    registry: FontRegistry,
    fonts: Map<string, FontMapping>,
): void {
    try {
        const entry = registry.registerFont(reader, name, ref);
        const resolved = registry.cssFamilyFor(name);
        if (!resolved) return;
        fonts.set(name, {
            family: resolved.embedded ? resolved.family : '',
            fallback: entry.familyName || '',
            embedded: resolved.embedded,
        });
    } catch {
        // A single broken font program must not abort the import.
    }
}

function descendIntoXObjects(
    reader: PdfReader,
    resources: Record<string, PdfObject>,
    registry: FontRegistry,
    fonts: Map<string, FontMapping>,
    depth: number,
): void {
    if (!resources['XObject']) return;
    const xObjects = reader.getDict(resources['XObject']);
    for (const ref of Object.values(xObjects)) {
        const nested = resolveXObjectResources(reader, ref);
        if (nested) registerResourceFonts(reader, nested, registry, fonts, depth + 1);
    }
}

function resolveXObjectResources(
    reader: PdfReader,
    ref: PdfObject,
): Record<string, PdfObject> | null {
    try {
        const dict = reader.getDict(ref);
        return dict['Resources'] ? reader.getDict(dict['Resources']) : null;
    } catch {
        return null;
    }
}
