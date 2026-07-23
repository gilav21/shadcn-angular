import { describe, expect, it } from 'vitest';
import { suppressRepeatedLines } from './readable-repeats';
import { lineOf } from './readable-spec-helpers';
import type { Line } from './readable-types';

const HEIGHT = 792;

function pageWith(page: number, extras: Line[] = []): Line[] {
    return [
        lineOf('Acme Corp Annual Report', 50, 300, 760, { page }),
        lineOf('Body text for this page', 50, 500, 400, { page }),
        lineOf(`${page + 1}`, 300, 312, 30, { page }),
        ...extras,
    ];
}

describe('suppressRepeatedLines', () => {
    it('removes headers repeating at the same position on most pages', () => {
        const pages = [0, 1, 2, 3].map(p => pageWith(p));
        const filtered = suppressRepeatedLines(pages, pages.map(() => HEIGHT));
        for (const lines of filtered) {
            expect(lines.some(l => l.words[0].text.includes('Annual Report'))).toBe(false);
            expect(lines.some(l => l.words[0].text.includes('Body text'))).toBe(true);
        }
    });

    it('removes bare page numbers in margin zones', () => {
        const pages = [0, 1].map(p => pageWith(p));
        const filtered = suppressRepeatedLines(pages, pages.map(() => HEIGHT));
        for (const lines of filtered) {
            expect(lines.some(l => /^\d+$/.test(l.words[0].text))).toBe(false);
        }
    });

    it('keeps everything on short documents apart from bare page numbers', () => {
        const pages = [0, 1].map(p => pageWith(p));
        const filtered = suppressRepeatedLines(pages, pages.map(() => HEIGHT));
        for (const lines of filtered) {
            expect(lines.some(l => l.words[0].text.includes('Annual Report'))).toBe(true);
        }
    });

    it('masks digits so varying page footers still cluster', () => {
        const pages = [0, 1, 2].map(p => pageWith(p, [
            lineOf(`Page ${p + 1} of 3`, 250, 360, 25, { page: p }),
        ]));
        const filtered = suppressRepeatedLines(pages, pages.map(() => HEIGHT));
        for (const lines of filtered) {
            expect(lines.some(l => l.words[0].text.startsWith('Page '))).toBe(false);
        }
    });

    it('does not remove margin-zone lines unique to one page', () => {
        const pages = [0, 1, 2].map(p => pageWith(p));
        pages[1].push(lineOf('Unique footnote text', 50, 400, 40, { page: 1 }));
        const filtered = suppressRepeatedLines(pages, pages.map(() => HEIGHT));
        expect(filtered[1].some(l => l.words[0].text.includes('Unique footnote'))).toBe(true);
    });
});
