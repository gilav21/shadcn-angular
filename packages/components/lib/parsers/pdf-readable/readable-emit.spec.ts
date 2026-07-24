import { describe, expect, it } from 'vitest';
import { preserveLineBreaks } from './readable-emit';
import { lineOf } from './readable-spec-helpers';
import type { Line } from './readable-types';

describe('preserveLineBreaks', () => {
    it('is false for a single line', () => {
        expect(preserveLineBreaks([lineOf('only line', 50, 500, 700)])).toBe(false);
    });

    it('keeps flowing prose joined (most lines reach the wrap edge)', () => {
        const lines = [
            lineOf('a line that runs the full measure here', 50, 540, 700),
            lineOf('another line that also fills the measure', 50, 535, 686),
            lineOf('and one more that reaches across too', 50, 538, 672),
            lineOf('short tail', 50, 130, 658),
        ];
        expect(preserveLineBreaks(lines)).toBe(false);
    });

    it('preserves breaks for a stack of short key/value lines', () => {
        const lines = [
            lineOf('Name: Ada', 50, 160, 700),
            lineOf('Email: ada@x.io', 50, 200, 686),
            lineOf('Phone: 123', 50, 150, 672),
            lineOf('City: Metropolis', 50, 210, 658),
        ];
        expect(preserveLineBreaks(lines)).toBe(true);
    });

    it('measures the right edge for RTL stacks', () => {
        const lines: Line[] = [
            lineOf('ערך', 530, 582, 600, { dir: 'rtl' }),
            lineOf('ועוד', 535, 582, 584, { dir: 'rtl' }),
            lineOf('ערך ארוך יותר', 440, 582, 568, { dir: 'rtl' }),
        ];
        expect(preserveLineBreaks(lines)).toBe(true);
    });
});
