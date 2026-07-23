import { PdfReader, applyRtlWordFixes } from '../pdf-parser';
import { FontRegistry } from '../pdf-pixel-perfect';
import { buildPageBlocks } from './readable-blocks';
import { emitDocument } from './readable-emit';
import { extractDocument } from './readable-extract';
import { clusterIntoLineItems, linesFromClusters } from './readable-lines';
import type { WordBuildContext } from './readable-words';
import type {
    DocModel,
    ExtractedDocument,
    PageExtract,
    PageModel,
    PdfReadableOptions,
    PdfReadableResult,
} from './readable-types';

export type { PdfReadableOptions, PdfReadableResult } from './readable-types';

let importCounter = 0;

/**
 * Converts a PDF into clean, flowing, semantic HTML that visually resembles
 * the original document (fonts, colors, alignment, spacing) without absolute
 * positioning. The returned `fontFaceCss` must be added to the host document
 * (e.g. a `<style>` in `<head>`) for embedded fonts to render.
 */
export async function parsePdfReadable(
    buffer: ArrayBuffer,
    options?: PdfReadableOptions,
): Promise<PdfReadableResult> {
    const opts = normalizeOptions(options);
    const reader = createValidatedReader(buffer);
    const pages = reader.getPages();
    if (pages.length === 0) {
        throw new Error('PDF contains no pages.');
    }

    const registry = opts.embedFonts ? new FontRegistry(opts.fontFamilyPrefix) : null;
    const extracted = extractDocument(reader, pages, registry);
    const doc = buildDocModel(extracted, registry, opts);

    if (isImageOnly(doc, extracted)) {
        return emitImageOnly(extracted, opts);
    }
    if (!hasAnyText(doc)) {
        throw new Error('No readable content found in PDF.');
    }

    const { html, text } = emitDocument(doc, opts, extracted.fonts);
    return {
        html,
        fontFaceCss: registry?.dumpAllFontFaceCss() ?? '',
        text,
        imageOnly: false,
        pageCount: pages.length,
    };
}

function normalizeOptions(options?: PdfReadableOptions): Required<PdfReadableOptions> {
    importCounter++;
    return {
        embedFonts: options?.embedFonts ?? true,
        includeImages: options?.includeImages ?? true,
        pageWrappers: options?.pageWrappers ?? false,
        fontFamilyPrefix: options?.fontFamilyPrefix ?? `pdf${importCounter.toString(36)}-`,
    };
}

function createValidatedReader(buffer: ArrayBuffer): PdfReader {
    const header = new Uint8Array(buffer, 0, Math.min(5, buffer.byteLength));
    const isPdf = header.length === 5 &&
        header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 &&
        header[3] === 0x46 && header[4] === 0x2D;
    if (!isPdf) {
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
    return reader;
}

function buildDocModel(
    extracted: ExtractedDocument,
    registry: FontRegistry | null,
    opts: Required<PdfReadableOptions>,
): DocModel {
    const prepared = extracted.pages.map(page => ({
        page,
        clusters: clusterIntoLineItems(page.items),
        ctx: {
            annotations: page.annotations,
            spaceAdvance: (fontName: string) => registry?.getGlyphAdvance(fontName, 32, ' ') ?? null,
        } satisfies WordBuildContext,
    }));
    applyRtlWordFixes(prepared.flatMap(entry => entry.clusters));

    const pageModels: PageModel[] = prepared.map(({ page, clusters, ctx }) => {
        const lines = linesFromClusters(clusters, page.index, ctx);
        return {
            index: page.index,
            width: page.width,
            height: page.height,
            blocks: buildPageBlocks(lines, page, opts.includeImages),
        };
    });

    return { pages: pageModels, bodyFontSize: detectBodyFontSize(extracted.pages) };
}

function detectBodyFontSize(pages: readonly PageExtract[]): number {
    const weights = new Map<number, number>();
    for (const page of pages) {
        for (const item of page.items) {
            const size = Math.round(item.fontSize * 2) / 2;
            weights.set(size, (weights.get(size) ?? 0) + item.text.length);
        }
    }
    let bodySize = 12;
    let bestWeight = 0;
    for (const [size, weight] of weights) {
        if (weight > bestWeight) {
            bestWeight = weight;
            bodySize = size;
        }
    }
    return bodySize;
}

function hasAnyText(doc: DocModel): boolean {
    return doc.pages.some(page => page.blocks.some(block => block.kind !== 'image' && block.kind !== 'rule'));
}

function isImageOnly(doc: DocModel, extracted: ExtractedDocument): boolean {
    return !hasAnyText(doc) && extracted.pages.some(page => page.images.length > 0);
}

function emitImageOnly(
    extracted: ExtractedDocument,
    opts: Required<PdfReadableOptions>,
): PdfReadableResult {
    const images = extracted.pages
        .flatMap(page => page.images)
        .sort((a, b) => a.page === b.page ? b.y - a.y : a.page - b.page);
    const html = opts.includeImages
        ? images
            .map(img => `<img src="${img.dataUrl}" alt="Page image" style="width:${Math.round(img.renderWidth * 100) / 100}pt;max-width:100%;height:auto">`)
            .join('\n')
        : '';
    return {
        html,
        fontFaceCss: '',
        text: '',
        imageOnly: true,
        pageCount: extracted.pages.length,
    };
}
