// A pixel-perfect PDF page is laid out in absolute coordinates and its text is already in visual order, so where a
// glyph is drawn must not depend on the direction of the page that hosts it, and every run must read left to right.
// The golden hashes fix the CSS bytes only; this renders real PDFs into an ltr and an rtl host and compares where
// every glyph lands, which needs a real layout engine.
import { describe, expect, it } from 'vitest';
import hebrewReceiptUrl from '../../../../demo/public/examples/hebrew-receipt.pdf?url';
import invoiceUrl from '../../../../demo/public/examples/invoice.pdf?url';
import { renderPixelPerfectPaged, type PixelPerfectPagedResult } from './pdf-pixel-perfect';

/** Wider than any page, so a page never overflows the host: overflow goes to a different side in an rtl host. */
const HOST_WIDTH_PX = 3000;
/** Sub-pixel noise between two layouts of the same page is not a difference. */
const TOLERANCE_PX = 0.5;
const MIN_GLYPHS = 20;

interface Placed {
    /** What was placed: a run, or a glyph's character. */
    readonly label: string;
    /** Where it is drawn: left and top, and for a run also its width. */
    readonly values: readonly number[];
}

interface Rendered {
    /** Each run's box, then each of its glyphs with the position it is drawn at, in document order. */
    readonly layout: readonly Placed[];
    readonly text: string;
    /**
     * Runs that read right to left overall: more than half of the steps from one glyph to the next go leftwards. A
     * Hebrew label followed by its number is one run with a single deliberate jump back to the left, so strict
     * monotonic order would be wrong; a mirrored run steps left almost every time.
     */
    readonly reversedRuns: number;
    /** Runs of two or more glyphs: the only ones whose direction can be judged. */
    readonly judgedRuns: number;
}

const rendered = new Map<string, Promise<PixelPerfectPagedResult>>();

/** Each PDF is parsed once for the whole file. */
function pdfPages(url: string): Promise<PixelPerfectPagedResult> {
    let pages = rendered.get(url);
    if (!pages) {
        pages = fetch(url).then(response => response.arrayBuffer()).then(bytes => renderPixelPerfectPaged(bytes));
        rendered.set(url, pages);
    }
    return pages;
}

function hasHebrew(text: string): boolean {
    return Array.from(text).some((char) => {
        const code = char.codePointAt(0) ?? 0;
        return code >= 0x590 && code <= 0x5ff;
    });
}

/** Each character of a run with the box it is drawn in. */
function glyphsOf(run: Element): Array<{ char: string; box: DOMRect }> {
    const glyphs: Array<{ char: string; box: DOMRect }> = [];
    const walker = document.createTreeWalker(run, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const content = node.textContent ?? '';
        let offset = 0;
        for (const char of content) {
            const range = document.createRange();
            range.setStart(node, offset);
            range.setEnd(node, offset + char.length);
            glyphs.push({ char, box: range.getBoundingClientRect() });
            offset += char.length;
        }
    }
    return glyphs;
}

/** Whether more than half of the steps from one glyph to the next go leftwards. */
function readsRightToLeft(glyphs: ReadonlyArray<{ box: DOMRect }>): boolean {
    const leftSteps = glyphs.filter((glyph, i) => i > 0 && glyph.box.left < glyphs[i - 1].box.left - TOLERANCE_PX).length;
    return leftSteps > (glyphs.length - 1) / 2;
}

async function render(result: PixelPerfectPagedResult, dir: 'ltr' | 'rtl'): Promise<Rendered> {
    const host = document.createElement('div');
    host.setAttribute('dir', dir);
    host.style.cssText = `width:${HOST_WIDTH_PX}px;position:relative`;
    host.innerHTML = `<style>${result.globalCss}</style>${result.pages.map(page => page.html).join('')}`;
    document.body.appendChild(host);
    try {
        // The PDF's fonts load on first use: force layout so they are requested, then wait, or a fallback font is measured.
        host.getBoundingClientRect();
        await document.fonts.ready;
        const layout: Placed[] = [];
        let text = '';
        let reversedRuns = 0;
        let judgedRuns = 0;
        for (const run of Array.from(host.querySelectorAll<HTMLElement>('.t'))) {
            const box = run.getBoundingClientRect();
            layout.push({ label: 'run', values: [box.left, box.top, box.width] });
            const glyphs = glyphsOf(run);
            for (const { char, box: glyph } of glyphs) {
                layout.push({ label: char, values: [glyph.left, glyph.top] });
                text += char;
            }
            const judged = glyphs.length > 1;
            judgedRuns += judged ? 1 : 0;
            reversedRuns += judged && readsRightToLeft(glyphs) ? 1 : 0;
        }
        return { layout, text, reversedRuns, judgedRuns };
    } finally {
        host.remove();
    }
}

async function renderInBothHosts(url: string): Promise<{ ltr: Rendered; rtl: Rendered }> {
    const result = await pdfPages(url);
    const ltr = await render(result, 'ltr');
    const rtl = await render(result, 'rtl');
    expect(ltr.text.length, 'the page has text to measure').toBeGreaterThan(MIN_GLYPHS);
    expect(rtl.text.length, 'the page has text to measure in the rtl host too').toBeGreaterThan(MIN_GLYPHS);
    return { ltr, rtl };
}

/** The largest distance, in px, between where the two layouts draw the same thing. They must hold the same things in the same order (the caller checks the labels first). */
function largestDeviation(a: readonly Placed[], b: readonly Placed[]): number {
    return a.reduce((largest, placed, i) => {
        const other = b[i].values;
        return placed.values.reduce((l, value, v) => Math.max(l, Math.abs(value - other[v])), largest);
    }, 0);
}

const PDFS: ReadonlyArray<readonly [string, string, boolean]> = [
    ['hebrew-receipt', hebrewReceiptUrl, true],
    ['invoice', invoiceUrl, false],
];

describe('pixel-perfect PDF pages in a host of either direction', () => {
    it.each(PDFS)('%s: every glyph is drawn where it is in an ltr host', async (...[, url, holdsHebrew]) => {
        const { ltr, rtl } = await renderInBothHosts(url);

        expect(hasHebrew(ltr.text), 'the fixture holds the kind of text the host direction would reorder').toBe(holdsHebrew);
        expect(rtl.layout.map(placed => placed.label)).toEqual(ltr.layout.map(placed => placed.label));
        expect(largestDeviation(ltr.layout, rtl.layout)).toBeLessThan(TOLERANCE_PX);
    });

    // The text is stored in visual order, so it must be drawn in document order, left to right, whatever the host:
    // two hosts that both mirror the runs agree with each other and are still wrong.
    it.each(PDFS)('%s: every run reads left to right, in the order its text is stored', async (...[, url]) => {
        const { ltr, rtl } = await renderInBothHosts(url);

        expect(ltr.judgedRuns, 'there are runs whose direction can be judged').toBeGreaterThan(0);
        expect(ltr.reversedRuns).toBe(0);
        expect(rtl.reversedRuns).toBe(0);
    });
});
