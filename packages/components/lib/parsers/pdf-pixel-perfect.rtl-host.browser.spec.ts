// A pixel-perfect PDF page is laid out in absolute coordinates and its text is already in visual order, so where a
// glyph is drawn must not depend on the direction of the page that hosts it. A host with dir="rtl" used to mirror
// every text run (the runs inherited direction:rtl under unicode-bidi:bidi-override). The golden hashes fix the CSS
// bytes only; this renders real PDFs into an ltr and an rtl host and compares where every glyph lands, which needs
// a real layout engine.
import { describe, expect, it } from 'vitest';
import hebrewReceiptUrl from '../../../../demo/public/examples/hebrew-receipt.pdf?url';
import invoiceUrl from '../../../../demo/public/examples/invoice.pdf?url';
import { renderPixelPerfectPaged } from './pdf-pixel-perfect';

const HEBREW = /[\u0590-\u05FF]/;

interface Rendered {
    /** Each run's box, then each of its glyphs with the position it is drawn at, in document order. */
    readonly layout: string[];
    readonly text: string;
    /**
     * Runs that read right to left overall: more than half of the steps from one glyph to the next go leftwards. A
     * Hebrew label followed by its number is one run with a single deliberate jump back to the left, so strict
     * monotonic order would be wrong; a mirrored run steps left almost every time.
     */
    readonly reversedRuns: number;
}

/** Each glyph of a run with the box it is drawn in. */
function glyphsOf(run: Element): Array<{ char: string; box: DOMRect }> {
    const glyphs: Array<{ char: string; box: DOMRect }> = [];
    const walker = document.createTreeWalker(run, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const content = node.textContent ?? '';
        for (let i = 0; i < content.length; i++) {
            const range = document.createRange();
            range.setStart(node, i);
            range.setEnd(node, i + 1);
            glyphs.push({ char: content[i], box: range.getBoundingClientRect() });
        }
    }
    return glyphs;
}

function render(css: string, pagesHtml: string, dir: 'ltr' | 'rtl'): Rendered {
    const host = document.createElement('div');
    host.setAttribute('dir', dir);
    host.style.cssText = 'width:1000px;position:relative';
    host.innerHTML = `<style>${css}</style>${pagesHtml}`;
    document.body.appendChild(host);
    try {
        const layout: string[] = [];
        let text = '';
        let reversedRuns = 0;
        for (const run of Array.from(host.querySelectorAll<HTMLElement>('.t'))) {
            const box = run.getBoundingClientRect();
            layout.push(`run ${box.left.toFixed(1)},${box.top.toFixed(1)},${box.width.toFixed(1)}`);
            const glyphs = glyphsOf(run);
            for (const { char, box: glyph } of glyphs) {
                layout.push(`${char} ${glyph.left.toFixed(1)},${glyph.top.toFixed(1)}`);
                text += char;
            }
            const leftSteps = glyphs.filter((glyph, i) => i > 0 && glyph.box.left < glyphs[i - 1].box.left - 0.5).length;
            if (leftSteps > (glyphs.length - 1) / 2) reversedRuns++;
        }
        return { layout, text, reversedRuns };
    } finally {
        host.remove();
    }
}

async function renderInBothHosts(url: string): Promise<{ ltr: Rendered; rtl: Rendered }> {
    const result = await renderPixelPerfectPaged(await fetch(url).then(r => r.arrayBuffer()));
    const pagesHtml = result.pages.map(page => page.html).join('');
    return { ltr: render(result.globalCss, pagesHtml, 'ltr'), rtl: render(result.globalCss, pagesHtml, 'rtl') };
}

const PDFS: ReadonlyArray<readonly [string, string, boolean]> = [
    ['hebrew-receipt', hebrewReceiptUrl, true],
    ['invoice', invoiceUrl, false],
];

describe('pixel-perfect PDF pages in a host of either direction', () => {
    it.each(PDFS)('%s: every glyph is drawn where it is in an ltr host', async (...[, url, hasHebrew]) => {
        const { ltr, rtl } = await renderInBothHosts(url);

        expect(ltr.text.length, 'the page has text to compare').toBeGreaterThan(20);
        expect(HEBREW.test(ltr.text), 'the fixture holds the kind of text the host direction would reorder').toBe(hasHebrew);
        expect(rtl.layout).toEqual(ltr.layout);
    });

    // The text is stored in visual order, so it must be drawn in document order, left to right, whatever the host:
    // two hosts that both mirror the runs would agree with each other and still be wrong.
    it.each(PDFS)('%s: every run reads left to right, in the order its text is stored', async (...[, url]) => {
        const { ltr, rtl } = await renderInBothHosts(url);

        expect(ltr.reversedRuns).toBe(0);
        expect(rtl.reversedRuns).toBe(0);
    });
});
